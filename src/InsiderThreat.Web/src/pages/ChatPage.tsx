import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { chatService } from '../services/chatService';
import type { Message as ApiMessage } from '../services/chatService';
import { cryptoService } from '../services/cryptoService';
import './ChatPage.css';

// Types
interface ChatUser {
    id: string;
    username: string;
    fullName?: string;
    avatar?: string;
    isOnline?: boolean;
    lastMessage?: string;
    lastMessageTime?: string;
    publicKey?: string;
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
}

export default function ChatPage() {
    const navigate = useNavigate();
    // Stabilize currentUser to prevent infinite useEffect loops
    const currentUser = useMemo(() => authService.getCurrentUser(), []);
    const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [contacts, setContacts] = useState<ChatUser[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [keys, setKeys] = useState<{ publicKey: CryptoKey, privateKey: CryptoKey } | null>(null);

    // Refs for polling/intervals
    const pollInterval = useRef<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Initialize Keys
    useEffect(() => {
        const initKeys = async () => {
            if (!currentUser) return;

            const savedKeys = cryptoService.loadKeys();
            if (savedKeys.publicKey && savedKeys.privateKey) {
                // Import existing keys
                const pub = await cryptoService.importKey(savedKeys.publicKey, 'public');
                const priv = await cryptoService.importKey(savedKeys.privateKey, 'private');
                setKeys({ publicKey: pub, privateKey: priv });

                if (!currentUser?.id) return;
                // Ensure server has public key (idempotent-ish)
                await chatService.uploadPublicKey(currentUser.id, savedKeys.publicKey);
            } else {
                // Generate new keys
                const keyPair = await cryptoService.generateKeyPair();
                const pubBase64 = await cryptoService.exportKey(keyPair.publicKey);
                const privBase64 = await cryptoService.exportKey(keyPair.privateKey);

                cryptoService.saveKeys(pubBase64, privBase64);
                setKeys({ publicKey: keyPair.publicKey, privateKey: keyPair.privateKey });

                // Upload to server
                if (currentUser?.id) {
                    await chatService.uploadPublicKey(currentUser.id, pubBase64);
                }
            }
        };
        initKeys();
    }, [currentUser]);

    // 2. Fetch Contacts
    useEffect(() => {
        if (!currentUser) {
            // navigate('/login');
            return;
        }

        const fetchContacts = async () => {
            try {
                const users = await userService.getAllUsers();
                console.log("Fetched users for Chat:", users);
                const chatUsers: ChatUser[] = users
                    .filter(u => u.username !== currentUser.username)
                    .map(u => ({
                        id: u.id || u.username,
                        username: u.username,
                        fullName: u.fullName,
                        avatar: `https://i.pravatar.cc/150?u=${u.username}`,
                        isOnline: Math.random() > 0.5,
                        lastMessage: "Start E2EE Chat",
                        lastMessageTime: "",
                        publicKey: u.publicKey
                    }));
                setContacts(chatUsers);
            } catch (error) {
                console.error("Failed to fetch contacts", error);
            }
        };

        fetchContacts();
    }, [currentUser]);

    // 3. Fetch Messages when User Selected & Keys Ready
    useEffect(() => {
        if (!selectedUser || !currentUser || !keys) return;

        const loadMessages = async () => {
            if (!currentUser?.id) return;
            try {
                const apiMessages = await chatService.getMessages(selectedUser.id, currentUser.id);

                // Decrypt messages
                const decryptedMessages = await Promise.all(apiMessages.map(async (msg: ApiMessage) => {
                    let text = "[Encrypted]";
                    try {
                        // BETTER FIX: The user asked for E2EE. 

                        if (msg.senderId === currentUser.id) {
                            // Implemented: Read from senderContent if available
                            if (msg.senderContent) {
                                text = await cryptoService.decrypt(msg.senderContent, keys.privateKey);
                            } else {
                                text = "[Legacy Message - Encrypted]";
                            }
                        } else {
                            text = await cryptoService.decrypt(msg.content, keys.privateKey);
                        }
                    } catch (e) {
                        text = "[Decryption Error]";
                    }

                    return {
                        id: msg.id || Date.now().toString(),
                        text: text,
                        senderId: msg.senderId,
                        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                }));

                setMessages(prev => {
                    const isDifferent = prev.length !== decryptedMessages.length ||
                        prev[prev.length - 1]?.id !== decryptedMessages[decryptedMessages.length - 1]?.id;
                    return isDifferent ? decryptedMessages : prev;
                });
            } catch (error) {
                console.error("Failed to load messages", error);
            }
        };

        loadMessages();

        // Polling for new messages (SignalR replacement for MVP)
        pollInterval.current = window.setInterval(loadMessages, 3000);

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };

    }, [selectedUser, currentUser, keys]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedUser || !currentUser || !keys) return;

        try {
            // 1. Get Recipient's Public Key
            // We need to fetch IT FRESH to be sure, or use cached from contact list
            // Ideally chatService.getUserPublicKey
            let recipientPublicKey = selectedUser.publicKey;
            if (!recipientPublicKey) {
                recipientPublicKey = await chatService.getUserPublicKey(selectedUser.id);
            }

            if (!recipientPublicKey) {
                alert("This user has not set up E2EE yet (No Public Key). Ask them to log in!");
                return;
            }

            // 2. Import Recipient Key
            const importedRecipientKey = await cryptoService.importKey(recipientPublicKey, 'public');

            // 3. Encrypt for Receiver
            const encryptedForReceiver = await cryptoService.encrypt(messageInput, importedRecipientKey);

            // 3b. Encrypt for Self (Sender) so we can read it later
            const encryptedForSender = await cryptoService.encrypt(messageInput, keys.publicKey);

            // 4. Send to API
            await chatService.sendMessage({
                senderId: currentUser.id || '',
                receiverId: selectedUser.id,
                content: encryptedForReceiver,
                senderContent: encryptedForSender
            });

            // 5. Update Local UI (Optimistic)
            const newMsg: Message = {
                id: Date.now().toString(),
                text: messageInput, // We show plain text locally because we wrote it
                senderId: currentUser.id || 'me',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, newMsg]);
            setMessageInput('');

        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message E2EE");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSendMessage();
    };

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    return (
        <div className="chat-page-container">
            {/* Header */}
            <header className="chat-header">
                <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/feed')}>
                    <div className="logo-icon" style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>hub</span>
                    </div>
                    <span className="logo-text" style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>SocialNet</span>
                </div>

                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="header-icon-btn" style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }} onClick={() => navigate('/feed')}>
                        <span className="material-symbols-outlined">home</span>
                    </button>
                    <div className="user-avatar"
                        style={{
                            width: 40, height: 40, borderRadius: '50%',
                            backgroundImage: `url(https://i.pravatar.cc/150?u=${currentUser?.username || 'me'})`,
                            backgroundSize: 'cover',
                            cursor: 'pointer'
                        }}
                        onClick={() => navigate('/profile')}
                    ></div>
                </div>
            </header>

            <div className="chat-layout">
                {/* Sidebar */}
                <aside className="chat-sidebar">
                    <div className="sidebar-header" style={{ padding: '16px 16px 0 16px' }}>
                        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Chats <span style={{ fontSize: 12, color: '#10b981', border: '1px solid #10b981', padding: '2px 4px', borderRadius: 4 }}>E2EE</span></h2>
                    </div>
                    <div className="sidebar-search">
                        <div className="chat-search-input-wrapper">
                            <span className="material-symbols-outlined" style={{ color: '#9ca3af', fontSize: 20 }}>search</span>
                            <input className="chat-search-input" placeholder="Search Messenger" />
                        </div>
                    </div>

                    <div className="conversation-list">
                        {contacts.map(contact => (
                            <div
                                key={contact.id}
                                className={`conversation-item ${selectedUser?.id === contact.id ? 'active' : ''}`}
                                onClick={() => setSelectedUser(contact)}
                            >
                                <div className="conversation-avatar">
                                    <div className="avatar-img" style={{ backgroundImage: `url(${contact.avatar})` }}></div>
                                    {contact.isOnline && <div className="status-indicator status-online"></div>}
                                </div>
                                <div className="conversation-info">
                                    <div className="conversation-name">{contact.fullName || contact.username}</div>
                                    <div className="conversation-last-msg">
                                        {contact.lastMessage}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: 16, borderTop: '1px solid var(--color-dark-surface-lighter)' }}>
                        <button onClick={handleLogout} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#ef4444', width: '100%', padding: '8px 12px',
                            borderRadius: 8, transition: 'background-color 0.2s'
                        }}>
                            <span className="material-symbols-outlined">logout</span>
                            <span style={{ fontWeight: 500 }}>Logout</span>
                        </button>
                    </div>
                </aside>

                {/* Main Chat Area */}
                <main className="chat-window">
                    {selectedUser ? (
                        <>
                            <div className="chat-window-header">
                                <div className="chat-window-user">
                                    <div className="user-avatar" style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        backgroundImage: `url(${selectedUser.avatar})`,
                                        backgroundSize: 'cover'
                                    }}></div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{selectedUser.fullName || selectedUser.username}</h3>
                                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{selectedUser.isOnline ? 'Active now' : 'Offline'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <button className="chat-action-btn secondary-btn">
                                        <span className="material-symbols-outlined">info</span>
                                    </button>
                                </div>
                            </div>

                            <div className="chat-messages-area">
                                {messages.map(msg => {
                                    const isMe = msg.senderId === currentUser?.id;
                                    // console.log(`Msg ${msg.id}: Sender=${msg.senderId}, Me=${currentUser?.id}, isMe=${isMe}`, msg);
                                    return (
                                        <div key={msg.id} className={`message-group ${isMe ? 'sent' : 'received'}`}>
                                            {!isMe && (
                                                <div className="user-avatar" style={{
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    backgroundImage: `url(${selectedUser.avatar})`,
                                                    backgroundSize: 'cover',
                                                    marginRight: 8,
                                                    alignSelf: 'flex-end',
                                                    flexShrink: 0
                                                }}></div>
                                            )}
                                            <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                <div className="message-bubble" style={{ width: 'fit-content', wordBreak: 'break-word' }}>
                                                    {msg.text}
                                                </div>
                                                <span className="message-time">{msg.timestamp}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="chat-input-area">
                                <div className="chat-input-wrapper">
                                    <button className="chat-action-btn secondary-btn">
                                        <span className="material-symbols-outlined">add_circle</span>
                                    </button>
                                    <input
                                        className="chat-input-field"
                                        placeholder="Type an encrypted message..."
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <button className="chat-action-btn" onClick={handleSendMessage}>
                                        <span className="material-symbols-outlined">send</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>lock</span>
                            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#f3f4f6' }}>End-to-End Encrypted Chat</h2>
                            <p>Messages are encrypted on your device. Only the recipient can read them.</p>
                        </div>
                    )}
                </main>
            </div>
        </div >
    );
}
