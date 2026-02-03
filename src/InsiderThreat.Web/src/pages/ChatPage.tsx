import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { chatService } from '../services/chatService';
import type { Message as ApiMessage } from '../services/chatService';
import type { User } from '../types';
import { cryptoService } from '../services/cryptoService';
import { confirmLogout } from '../utils/logoutUtils';
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
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Info Popover State
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'media' | 'files' | 'messages'>('media');

    // Search State
    const [searchTerm, setSearchTerm] = useState("");

    // Chat Access Code State
    const [isChatUnlocked, setIsChatUnlocked] = useState(false);
    const [chatAccessCode, setChatAccessCode] = useState("");
    const [showUnlockModal, setShowUnlockModal] = useState(true);
    const [unlockError, setUnlockError] = useState("");
    const [codeNotSet, setCodeNotSet] = useState(false);

    // Initial Check for Chat Code
    useEffect(() => {
        // Check if already unlocked in this session
        const isUnlocked = localStorage.getItem('isChatUnlocked') === 'true';
        if (isUnlocked) {
            setIsChatUnlocked(true);
            setShowUnlockModal(false);
        } else {
            setShowUnlockModal(true);
        }
    }, []);

    const handleUnlock = async () => {
        if (chatAccessCode.length !== 6) {
            setUnlockError("Code must be 6 digits");
            return;
        }

        try {
            if (codeNotSet) {
                // Set the code AND upload Private Key if we have it
                const privKey = keys?.privateKey
                    ? await cryptoService.exportKey(keys.privateKey)
                    : undefined;

                const res = await authService.setChatCode(chatAccessCode, privKey);

                if (res.success) {
                    console.log("Unlock success (Set Code)");
                    localStorage.setItem('isChatUnlocked', 'true');
                    setIsChatUnlocked(true);
                    setShowUnlockModal(false);
                    setCodeNotSet(false);
                } else {
                    console.error("Unlock failed (Set Code)", res);
                    setUnlockError(res.message);
                }
            } else {
                // Verify the code
                const res = await authService.verifyChatCode(chatAccessCode);
                if (res.success) {
                    console.log("Unlock success (Verify)");

                    // If server returned a Private Key, use it to sync this device
                    if (res.privateKey) {
                        try {
                            const importedPriv = await cryptoService.importKey(res.privateKey, 'private');
                            // We need the public key too, usually in pair, but let's assume we can derive or existing public key is fine?
                            // Actually, simpler: just save string to storage if that's what cryptoService uses, 
                            // BUT cryptoService stores keys in separate flow. 
                            // Let's just update state 'keys' and let the effect persist it?
                            // cryptoService.saveKeys(pub, priv); -> we need public key. 

                            // Hack: If we receive a private key, we assume it matches the public key we have or will fetch.
                            // Better: Update internal keys.
                            const currentPub = keys?.publicKey ? await cryptoService.exportKey(keys.publicKey) : "";
                            if (currentPub) {
                                cryptoService.saveKeys(currentPub, res.privateKey);
                                setKeys({ publicKey: keys!.publicKey, privateKey: importedPriv });
                                console.log("Keys synced from server!");
                            } else {
                                // If we have NO keys, we might be in trouble finding the public one blindly.
                                // But usually ChatPage inits keys on mount.
                                // Let's try to update just the private key in memory for now.
                                // Force re-read or update state?
                                // Let's assume initKeys found nothing -> generated new keys -> mismatched.
                                // Now we overwrite with server key.
                                const pub = await cryptoService.exportKey((await cryptoService.generateKeyPair()).publicKey); // temporary fallback
                                // Wait, if we are here, initKeys probably ran.
                                // Let's just blindly save the private key?
                                // We need to trigger a re-render or re-decryption.
                                setKeys(prev => ({ ...prev!, privateKey: importedPriv }));
                            }
                        } catch (e) {
                            console.error("Failed to import synced key", e);
                        }
                    } else {
                        // Server has NO key. If WE have a key, upload it to enable sync for other devices.
                        if (keys?.privateKey) {
                            try {
                                const exportedPriv = await cryptoService.exportKey(keys.privateKey);
                                // Re-set code (same code) with private key to update server
                                await authService.setChatCode(chatAccessCode, exportedPriv);

                                // ALSO upload Public Key now that we are "official"
                                if (keys.publicKey && currentUser?.id) {
                                    const exportedPub = await cryptoService.exportKey(keys.publicKey);
                                    await chatService.uploadPublicKey(currentUser.id, exportedPub);
                                }

                                console.log("Keys (Public/Private) uploaded to server for sync.");
                            } catch (e) {
                                console.error("Failed to upload key for sync", e);
                            }
                        }
                    }

                    localStorage.setItem('isChatUnlocked', 'true');
                    setIsChatUnlocked(true);
                    setShowUnlockModal(false);
                    setUnlockError("");
                } else {
                    if (res.codeNotSet) {
                        setCodeNotSet(true);
                        setUnlockError("You haven't set a code yet. Please enter a new 6-digit code to set it.");
                    } else {
                        setUnlockError("Incorrect code");
                    }
                }
            }
        } catch (err) {
            console.error(err);
            setUnlockError("Failed to verify code");
        }
    };

    // Filtered Content for Popover
    const filteredContent = useMemo(() => {
        switch (activeFilter) {
            case 'media':
                return messages.filter(m => m.attachmentType === 'image');
            case 'files':
                return messages.filter(m => m.attachmentType === 'file');
            case 'messages':
                return messages.filter(m => m.text && !m.text.startsWith('[Sent a'));
            default:
                return [];
        }
    }, [messages, activeFilter]);

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

                // DO NOT upload to server yet. We must wait for Chat Access Code unlock
                // to see if we should download an existing key instead.
                // If we upload now, we overwrite the user's identity on the server, breaking E2EE for others.
                /*
                if (currentUser?.id) {
                    await chatService.uploadPublicKey(currentUser.id, pubBase64);
                }
                */
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
                const getAvatarUrl = (u: User | null) => {
                    if (!u?.avatarUrl) return `https://i.pravatar.cc/150?u=${u?.username || 'user'}`;
                    if (u.avatarUrl.startsWith('http')) return u.avatarUrl;
                    return `http://127.0.0.1:5038${u.avatarUrl}`;
                };

                const chatUsers: ChatUser[] = users
                    .filter(u => u.username !== currentUser.username)
                    .map(u => ({
                        id: u.id || u.username,
                        username: u.username,
                        fullName: u.fullName,
                        avatar: getAvatarUrl(u), // Use resolved URL
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

    // 3. Fetch Messages when User Selected
    useEffect(() => {
        if (!selectedUser || !currentUser) return;

        const loadMessages = async () => {
            if (!currentUser?.id) return;
            try {
                const apiMessages = await chatService.getMessages(selectedUser.id, currentUser.id);

                // Map messages directly (No Decryption)
                const mappedMessages = apiMessages.map((msg: ApiMessage) => {
                    return {
                        id: msg.id || Date.now().toString(),
                        text: msg.content, // Show content directly
                        senderId: msg.senderId,
                        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        attachmentUrl: msg.attachmentUrl,
                        attachmentType: msg.attachmentType,
                        attachmentName: msg.attachmentName
                    };
                });

                setMessages(prev => {
                    const isDifferent = prev.length !== mappedMessages.length ||
                        prev[prev.length - 1]?.id !== mappedMessages[mappedMessages.length - 1]?.id;
                    return isDifferent ? mappedMessages : prev;
                });
            } catch (error) {
                console.error("Failed to load messages", error);
            }
        };

        loadMessages();

        // Polling for new messages
        pollInterval.current = window.setInterval(loadMessages, 3000);

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };

    }, [selectedUser, currentUser]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedUser || !currentUser) return;

        try {
            // Send Plain Text
            await chatService.sendMessage({
                senderId: currentUser.id || '',
                receiverId: selectedUser.id,
                content: messageInput,
                senderContent: messageInput // Same logic for sender view
            });

            // Optimistic UI
            const newMsg: Message = {
                id: Date.now().toString(),
                text: messageInput,
                senderId: currentUser.id || 'me',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, newMsg]);
            setMessageInput('');

        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message");
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !selectedUser || !currentUser) return;

        const file = e.target.files[0];
        try {
            const uploadRes = await chatService.uploadFile(file);
            const attachmentUrl = uploadRes.url;
            const attachmentName = uploadRes.originalName;
            const attachmentType = file.type.startsWith('image/') ? 'image' : 'file';

            // Send Plain Text Message with Attachment
            await chatService.sendMessage({
                senderId: currentUser.id || '',
                receiverId: selectedUser.id,
                content: "", // Empty or description
                senderContent: "",
                attachmentUrl: attachmentUrl,
                attachmentType: attachmentType,
                attachmentName: attachmentName
            });

            // Optimistic UI
            const newMsg: Message = {
                id: Date.now().toString(),
                text: "",
                senderId: currentUser.id || 'me',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                attachmentUrl: attachmentUrl,
                attachmentType: attachmentType,
                attachmentName: attachmentName
            };
            setMessages(prev => [...prev, newMsg]);

        } catch (error) {
            console.error("Failed to send file", error);
            alert("Failed to upload/send file");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSendMessage();
    };

    const handleLogout = () => {
        confirmLogout(() => {
            authService.logout();
            navigate('/login');
        });
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
                            backgroundImage: `url(${(() => {
                                if (!currentUser?.avatarUrl) return `https://i.pravatar.cc/150?u=${currentUser?.username || 'me'}`;
                                if (currentUser.avatarUrl.startsWith('http')) return currentUser.avatarUrl;
                                return `http://127.0.0.1:5038${currentUser.avatarUrl}`;
                            })()})`,
                            backgroundSize: 'cover',
                            cursor: 'pointer'
                        }}
                        onClick={() => navigate('/profile')}
                    ></div>
                </div>
            </header >

            <div className="chat-layout">
                {/* Sidebar */}
                <aside className="chat-sidebar">
                    <div className="sidebar-header" style={{ padding: '16px 16px 0 16px' }}>
                        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Chats <span style={{ fontSize: 12, color: '#10b981', border: '1px solid #10b981', padding: '2px 4px', borderRadius: 4 }}>E2EE</span></h2>
                    </div>
                    <div className="sidebar-search">
                        <div className="chat-search-input-wrapper">
                            <span className="material-symbols-outlined" style={{ color: '#9ca3af', fontSize: 20 }}>search</span>
                            <input
                                className="chat-search-input"
                                placeholder="Search Messenger"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="conversation-list">
                        {contacts
                            .filter(contact =>
                                (contact.fullName || contact.username).toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map(contact => (
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
                                <div className="info-popover-container">
                                    <button
                                        className={`chat-action-btn secondary-btn ${isInfoPopoverOpen ? 'active' : ''}`}
                                        onClick={() => setIsInfoPopoverOpen(!isInfoPopoverOpen)}
                                        title="Chat Info"
                                    >
                                        <span className="material-symbols-outlined">info</span>
                                    </button>

                                    {/* Info Popover */}
                                    {isInfoPopoverOpen && (
                                        <div className="info-popover">
                                            <div className="info-popover-header">
                                                Chat Info
                                            </div>
                                            <div className="info-popover-tabs">
                                                <button
                                                    className={`info-tab ${activeFilter === 'media' ? 'active' : ''}`}
                                                    onClick={() => setActiveFilter('media')}
                                                >
                                                    Media
                                                </button>
                                                <button
                                                    className={`info-tab ${activeFilter === 'files' ? 'active' : ''}`}
                                                    onClick={() => setActiveFilter('files')}
                                                >
                                                    Files
                                                </button>
                                                <button
                                                    className={`info-tab ${activeFilter === 'messages' ? 'active' : ''}`}
                                                    onClick={() => setActiveFilter('messages')}
                                                >
                                                    Text
                                                </button>
                                            </div>

                                            <div className="info-popover-content">
                                                {activeFilter === 'media' && (
                                                    <div className="popover-media-grid">
                                                        {filteredContent.map(msg => (
                                                            <div
                                                                key={msg.id}
                                                                className="popover-media-item"
                                                                style={{ backgroundImage: `url(http://localhost:5038${msg.attachmentUrl})` }}
                                                                onClick={() => window.open(`http://localhost:5038${msg.attachmentUrl}`, '_blank')}
                                                                title="View Image"
                                                            ></div>
                                                        ))}
                                                        {filteredContent.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13, gridColumn: 'span 3', textAlign: 'center', padding: 20 }}>No images shared</div>}
                                                    </div>
                                                )}

                                                {activeFilter === 'files' && (
                                                    <div className="popover-file-list">
                                                        {filteredContent.map(msg => (
                                                            <a
                                                                key={msg.id}
                                                                href={`http://localhost:5038/api/upload/download/${msg.attachmentUrl?.split('/').pop()}?originalName=${encodeURIComponent(msg.attachmentName || 'file')}`}
                                                                className="popover-file-item"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <span className="material-symbols-outlined popover-file-icon">description</span>
                                                                <div className="popover-file-info">
                                                                    <div className="popover-file-name">{msg.attachmentName || 'Unknown File'}</div>
                                                                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{msg.timestamp}</div>
                                                                </div>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>download</span>
                                                            </a>
                                                        ))}
                                                        {filteredContent.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>No files shared</div>}
                                                    </div>
                                                )}

                                                {activeFilter === 'messages' && (
                                                    <div className="popover-message-list">
                                                        {filteredContent.map(msg => (
                                                            <div key={msg.id} className="popover-message-item">
                                                                <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{msg.text}</div>
                                                                <span className="popover-message-time">{msg.timestamp}</span>
                                                            </div>
                                                        ))}
                                                        {filteredContent.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>No text messages</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                            <div className="message-content" style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                {/* Text Message */}
                                                {(msg.text && !msg.text.startsWith('[Sent a')) && (
                                                    <div className="message-bubble" style={{ width: 'fit-content', wordBreak: 'break-word', marginTop: msg.attachmentUrl ? 8 : 0 }}>
                                                        {msg.text}
                                                    </div>
                                                )}

                                                {/* Attachment */}
                                                {msg.attachmentUrl && (
                                                    <div className="message-attachment" style={{ marginTop: 8 }}>
                                                        {msg.attachmentType === 'image' ? (
                                                            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                                                                <img
                                                                    src={`http://localhost:5038${msg.attachmentUrl}`}
                                                                    alt="attachment"
                                                                    style={{
                                                                        maxWidth: '200px',
                                                                        display: 'block',
                                                                        border: '1px solid #374151',
                                                                        filter: isChatUnlocked ? 'none' : 'blur(15px)',
                                                                        transition: 'filter 0.3s'
                                                                    }}
                                                                />
                                                                {!isChatUnlocked && (
                                                                    <div style={{
                                                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        cursor: 'pointer'
                                                                    }} onClick={() => setShowUnlockModal(true)}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>lock</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <a
                                                                href={isChatUnlocked ? `http://localhost:5038/api/upload/download/${msg.attachmentUrl?.split('/').pop()}?originalName=${encodeURIComponent(msg.attachmentName || 'file')}` : '#'}
                                                                target={isChatUnlocked ? "_blank" : undefined}
                                                                rel="noreferrer"
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    padding: '8px 12px', background: '#374151', borderRadius: 8,
                                                                    color: 'white', textDecoration: 'none',
                                                                    cursor: isChatUnlocked ? 'pointer' : 'not-allowed',
                                                                    opacity: isChatUnlocked ? 1 : 0.7
                                                                }}
                                                                onClick={(e) => {
                                                                    if (!isChatUnlocked) {
                                                                        e.preventDefault();
                                                                        setShowUnlockModal(true);
                                                                    }
                                                                }}
                                                            >
                                                                <span className="material-symbols-outlined">{isChatUnlocked ? 'description' : 'lock'}</span>
                                                                <span style={{ fontSize: 14 }}>{isChatUnlocked ? (msg.attachmentName || 'Download File') : '[Hidden File]'}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                <span className="message-time">{msg.timestamp}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="chat-input-area">
                                <div className="chat-input-wrapper">
                                    <button className="chat-action-btn secondary-btn" onClick={() => fileInputRef.current?.click()}>
                                        <span className="material-symbols-outlined">add_circle</span>
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileSelect}
                                    />
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

            {/* Only main chat window, removed Info Panel */}
            {/* Unlock Modal */}
            {
                showUnlockModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            background: '#1f2937', padding: 24, borderRadius: 12,
                            width: '90%', maxWidth: 320, textAlign: 'center',
                            color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ marginBottom: 16 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#10b981' }}>lock</span>
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>
                                {codeNotSet ? "Set Chat Access Code" : "Enter Chat Access Code"}
                            </h3>
                            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                                {codeNotSet ? "Create a 6-digit PIN to secure your chats." : "Please enter your 6-digit PIN to view encrypted content."}
                            </p>

                            <input
                                type="password"
                                maxLength={6}
                                value={chatAccessCode}
                                onChange={(e) => setChatAccessCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 8,
                                    border: '1px solid #374151', backgroundColor: '#374151',
                                    color: 'white', fontSize: 24, textAlign: 'center', letterSpacing: 8,
                                    marginBottom: 16, outline: 'none'
                                }}
                            />

                            {unlockError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{unlockError}</div>}

                            <button
                                onClick={handleUnlock}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 8,
                                    border: 'none', backgroundColor: '#10b981',
                                    color: 'white', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                {codeNotSet ? "Set Code" : "Unlock"}
                            </button>
                        </div>
                    </div>
                )
            }
            {/* Unlock Modal */}
            {
                showUnlockModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            background: '#1f2937', padding: 24, borderRadius: 12,
                            width: '90%', maxWidth: 320, textAlign: 'center',
                            color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                        }}>
                            <div style={{ marginBottom: 16 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#10b981' }}>lock</span>
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>
                                {codeNotSet ? "Set Chat Access Code" : "Enter Chat Access Code"}
                            </h3>
                            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                                {codeNotSet ? "Create a 6-digit PIN to secure your chats." : "Please enter your 6-digit PIN to view encrypted content."}
                            </p>

                            <input
                                type="password"
                                maxLength={6}
                                value={chatAccessCode}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setChatAccessCode(val);
                                    setUnlockError("");
                                }}
                                placeholder="000000"
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 8,
                                    border: '1px solid #374151', backgroundColor: '#374151',
                                    color: 'white', fontSize: 24, textAlign: 'center', letterSpacing: 8,
                                    marginBottom: 16, outline: 'none'
                                }}
                            />

                            {unlockError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{unlockError}</div>}

                            <button
                                onClick={handleUnlock}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 8,
                                    border: 'none', backgroundColor: '#10b981',
                                    color: 'white', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                {codeNotSet ? "Set Code" : "Unlock"}
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
