import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/auth';
import { API_BASE_URL } from '../services/api';
import { userService } from '../services/userService';
import { chatService } from '../services/chatService';
import { signalRService } from '../services/signalRService';
import type { Message as ApiMessage } from '../services/chatService';
import type { User } from '../types';
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
    unreadCount?: number;
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    isRead?: boolean;
}

export default function ChatPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const userIdParam = searchParams.get('userId');

    // Stabilize currentUser to prevent infinite useEffect loops
    const currentUser = useMemo(() => authService.getCurrentUser(), []);
    const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [contacts, setContacts] = useState<ChatUser[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    // Refs for polling/intervals
    const pollInterval = useRef<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Info Popover State
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);
    const infoPopoverRef = useRef<HTMLDivElement>(null);
    const [activeFilter, setActiveFilter] = useState<'media' | 'files' | 'messages'>('media');

    // Search State
    const [searchTerm, setSearchTerm] = useState("");

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

    // No client-side key init needed — server handles encryption/decryption

    // 2. Fetch Contacts
    useEffect(() => {
        const fetchContacts = async () => {
            if (!currentUser?.id) return;
            try {
                const [allUsers, conversations, onlineUserIds] = await Promise.all([
                    userService.getAllUsers(),
                    chatService.getConversations(currentUser.id),
                    userService.getOnlineUsers()
                ]);

                const onlineSet = new Set(onlineUserIds);

                const getAvatarUrl = (u: User | null | string) => {
                    if (!u) return `https://i.pravatar.cc/150`;
                    if (typeof u === 'string') return u.startsWith('http') ? u : `${API_BASE_URL}${u}`;
                    if (!(u as User).avatarUrl) return `https://i.pravatar.cc/150?u=${(u as User).username || 'user'}`;
                    if ((u as User).avatarUrl?.startsWith('http')) return (u as User).avatarUrl;
                    return `${API_BASE_URL}${(u as User).avatarUrl}`;
                };

                const chatUsersMap = new Map<string, ChatUser>();

                conversations.forEach((conv: any) => {
                    chatUsersMap.set(conv.id, {
                        id: conv.id,
                        username: conv.username,
                        fullName: conv.fullName,
                        avatar: getAvatarUrl(conv.avatar || conv.username),
                        isOnline: onlineSet.has(conv.id),
                        lastMessage: conv.lastMessage,
                        lastMessageTime: conv.lastMessageTime,
                        publicKey: conv.publicKey,
                        unreadCount: conv.unreadCount || 0
                    });
                });

                allUsers.forEach((u: User) => {
                    if (u.id && u.username && u.username !== currentUser.username && !chatUsersMap.has(u.id)) {
                        chatUsersMap.set(u.id, {
                            id: u.id,
                            username: u.username,
                            fullName: u.fullName,
                            avatar: getAvatarUrl(u),
                            isOnline: onlineSet.has(u.id),
                            lastMessage: "Bắt đầu trò chuyện",
                            lastMessageTime: "",
                            publicKey: u.publicKey,
                            unreadCount: 0
                        });
                    }
                });

                const sortedUsers = Array.from(chatUsersMap.values()).sort((a, b) => {
                    if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1;
                    if ((a.unreadCount || 0) === 0 && (b.unreadCount || 0) > 0) return 1;

                    if (a.lastMessageTime && b.lastMessageTime) {
                        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
                    }
                    if (a.lastMessageTime) return -1;
                    if (b.lastMessageTime) return 1;

                    return a.username.localeCompare(b.username);
                });

                setContacts(sortedUsers);
            } catch (error) {
                console.error("Failed to fetch contacts", error);
            }
        };

        fetchContacts();
    }, [currentUser]);

    // Auto-select user from URL parameter
    useEffect(() => {
        if (userIdParam && contacts.length > 0) {
            setSelectedUser(prevSelected => {
                if (prevSelected?.id === userIdParam) return prevSelected;
                const userToSelect = contacts.find(c => c.id === userIdParam);
                return userToSelect || prevSelected;
            });
        }
    }, [userIdParam, contacts]);

    // Realtime Presence Listeners
    useEffect(() => {
        const handleUserOnline = (userId: string) => {
            setContacts(prev => prev.map(c => c.id === userId ? { ...c, isOnline: true } : c));
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => prev ? { ...prev, isOnline: true } : prev);
            }
        };

        const handleUserOffline = (userId: string) => {
            setContacts(prev => prev.map(c => c.id === userId ? { ...c, isOnline: false } : c));
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => prev ? { ...prev, isOnline: false } : prev);
            }
        };

        const handleMessagesRead = (readerId: string) => {
            if (selectedUser?.id === readerId) {
                setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
            }
        };

        const hubConnection = signalRService.getConnection();
        if (hubConnection) {
            hubConnection.on('UserOnline', handleUserOnline);
            hubConnection.on('UserOffline', handleUserOffline);
            hubConnection.on('MessagesRead', handleMessagesRead);
        }

        return () => {
            if (hubConnection) {
                hubConnection.off('UserOnline', handleUserOnline);
                hubConnection.off('UserOffline', handleUserOffline);
                hubConnection.off('MessagesRead', handleMessagesRead);
            }
        };
    }, [selectedUser?.id]);

    // 3. Fetch Messages when User Selected (server decrypts before returning)
    useEffect(() => {
        if (!selectedUser || !currentUser) return;

        const loadMessages = async () => {
            if (!currentUser?.id) return;
            try {
                const apiMessages = await chatService.getMessages(selectedUser.id, currentUser.id);

                const mappedMessages = apiMessages.map((msg: ApiMessage) => ({
                    id: msg.id || Date.now().toString(),
                    text: msg.content || '',
                    senderId: msg.senderId,
                    timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    attachmentUrl: msg.attachmentUrl,
                    attachmentType: msg.attachmentType,
                    attachmentName: msg.attachmentName,
                    isRead: msg.isRead
                }));

                setMessages(prev => {
                    const isDifferent = prev.length !== mappedMessages.length ||
                        prev[prev.length - 1]?.id !== mappedMessages[mappedMessages.length - 1]?.id ||
                        prev.some((m, i) => m.isRead !== mappedMessages[i]?.isRead);
                    return isDifferent ? mappedMessages : prev;
                });

                // Mark messages as read
                const unreadMsgs = apiMessages.filter((m: any) => m.senderId === selectedUser.id && !m.isRead);
                if (unreadMsgs.length > 0) {
                    await chatService.markMessagesAsRead(selectedUser.id);
                    setContacts(prev => prev.map(c => c.id === selectedUser.id ? { ...c, unreadCount: 0 } : c));
                }

            } catch (error) {
                console.error("Failed to load messages", error);
            }
        };

        loadMessages();

        // Polling for new messages every 3s
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

        const plainText = messageInput;

        try {
            // Send plain text — server encrypts before storing in DB
            await chatService.sendMessage({
                senderId: currentUser.id || '',
                receiverId: selectedUser.id,
                content: plainText,
            });

            // Optimistic UI — show immediately
            const newMsg: Message = {
                id: Date.now().toString(),
                text: plainText,
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

            await chatService.sendMessage({
                senderId: currentUser.id || '',
                receiverId: selectedUser.id,
                content: "",
                attachmentUrl: attachmentUrl,
                attachmentType: attachmentType,
                attachmentName: attachmentName
            });

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
                                const getAvatarUrl = (u: User | string | undefined | null) => {
                                    if (!u) return `https://i.pravatar.cc/150`;
                                    if (typeof u === 'string') return u.startsWith('http') ? u : `${API_BASE_URL}${u}`;
                                    if (!(u as User).avatarUrl) return `https://i.pravatar.cc/150?u=${(u as User).username || 'user'}`;
                                    if ((u as User).avatarUrl?.startsWith('http')) return (u as User).avatarUrl;
                                    return `${API_BASE_URL}${(u as User).avatarUrl}`;
                                };
                                return getAvatarUrl(currentUser);
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
                                        <div className="chat-preview-text">
                                            <span style={{ fontWeight: contact.unreadCount ? 'bold' : 'normal', color: contact.unreadCount ? 'var(--color-primary)' : 'inherit' }}>
                                                {contact.lastMessage}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="chat-item-meta">
                                        <div className="chat-time" style={{ fontWeight: contact.unreadCount ? 'bold' : 'normal', color: contact.unreadCount ? 'var(--color-primary)' : 'inherit' }}>
                                            {contact.lastMessageTime
                                                ? new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : ''}
                                        </div>
                                        {contact.unreadCount ? (
                                            <div className="unread-badge">
                                                {contact.unreadCount}
                                            </div>
                                        ) : null}
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
                                        <div className="info-popover" ref={infoPopoverRef}>
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
                                                                style={{ backgroundImage: `url(${API_BASE_URL}${msg.attachmentUrl})` }}
                                                                onClick={() => window.open(`${API_BASE_URL}${msg.attachmentUrl}`, '_blank')}
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
                                                                href={`${API_BASE_URL}/api/upload/download/${msg.attachmentUrl?.split('/').pop()}?originalName=${encodeURIComponent(msg.attachmentName || 'file')}&downloaderName=${encodeURIComponent(currentUser?.username || '')}`}
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
                                {messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUser?.id;
                                    const isLastReadMessage = isMe && msg.isRead && !messages.slice(index + 1).some(m => m.senderId === currentUser?.id && m.isRead);

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
                                                                    src={`${API_BASE_URL}${msg.attachmentUrl}`}
                                                                    alt="attachment"
                                                                    style={{
                                                                        maxWidth: '200px',
                                                                        display: 'block',
                                                                        border: '1px solid #374151',
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <a
                                                                href={`${API_BASE_URL}/api/upload/download/${msg.attachmentUrl?.split('/').pop()}?originalName=${encodeURIComponent(msg.attachmentName || 'file')}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    padding: '8px 12px', background: '#374151', borderRadius: 8,
                                                                    color: 'white', textDecoration: 'none'
                                                                }}
                                                            >
                                                                <span className="material-symbols-outlined">description</span>
                                                                <span style={{ fontSize: 14 }}>{msg.attachmentName || 'Download File'}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                <span className="message-time">{msg.timestamp}</span>

                                                {/* Read Receipt */}
                                                {isLastReadMessage && (
                                                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>done_all</span>
                                                        Đã xem
                                                    </div>
                                                )}
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
        </div >
    );
}
