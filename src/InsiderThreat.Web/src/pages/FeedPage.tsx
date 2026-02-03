import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { chatService } from '../services/chatService';
import { feedService } from '../services/feedService';
import api from '../services/api';
import type { User, Post, Comment } from '../types';
import PostCard from '../components/PostCard';
import { confirmLogout } from '../utils/logoutUtils';
import './FeedPage.css';

interface Notification {
    id: string;
    title: string;
    content: string;
    type: string;
    createdAt: string;
}

export default function FeedPage() {
    const navigate = useNavigate();
    const user = authService.getCurrentUser();
    const [activeChatUser, setActiveChatUser] = useState<any | null>(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [contacts, setContacts] = useState<User[]>([]);

    // Feed State
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Quick Chat State
    // REMOVED: quickMessages, quickInput, interval
    // const [quickMessages, setQuickMessages] = useState<any[]>([]);
    // const [quickInput, setQuickInput] = useState("");
    // const quickChatInterval = useRef<number | null>(null);
    // const quickChatScrollRef = useRef<HTMLDivElement>(null);

    const quickActions = [
        "👋 Xin chào",
        "💼 Trao đổi công việc",
        "❓ Bạn có rảnh không?",
        "📧 Check mail nhé",
        "👍 OK / Đã rõ"
    ];

    // Initial Data Fetch
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const postsData = await feedService.getPosts();
                setPosts(postsData.posts);

                const users = await userService.getAllUsers();
                const otherUsers = users.filter(u => u.username !== user?.username);
                setContacts(otherUsers);

                const notifs = await api.get<Notification[]>('/api/notifications');
                setNotifications(notifs);
                setUnreadCount(notifs.length);

            } catch (error) {
                console.error("Error loading feed data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        const notifInterval = setInterval(async () => {
            try {
                const notifs = await api.get<Notification[]>('/api/notifications');
                setNotifications(notifs);
                setUnreadCount(notifs.length);
            } catch (e) { }
        }, 60000);

        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(notifInterval);
        };
    }, [user?.username, navigate]);

    // Quick Chat Effects - REMOVED history loading
    // useEffect(() => { ... })

    // Scroll effect REMOVED

    const handleQuickSend = async (content: string) => {
        if (!content || !activeChatUser || !user?.id) return;
        try {
            await chatService.sendMessage({
                senderId: user.id,
                receiverId: activeChatUser.id || activeChatUser.username,
                content: content,
                senderContent: content
            });
            message.success(`Đã gửi: "${content}"`);
        } catch (e) {
            console.error(e);
            message.error("Gửi tin nhắn thất bại");
        }
    };

    const handleLogout = () => {
        confirmLogout(() => {
            authService.logout();
            navigate('/login');
        });
    };

    const getAvatarUrl = (userOrUrl?: any) => {
        if (!userOrUrl) return `https://i.pravatar.cc/150?u=user`;
        const url = typeof userOrUrl === 'string' ? userOrUrl : userOrUrl.avatarUrl;
        if (!url) return `https://i.pravatar.cc/150?u=${userOrUrl.username || 'user'}`;
        if (url.startsWith('http')) return url;
        return `http://127.0.0.1:5038${url}`;
    };

    // Feed Actions
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim() && !selectedFile) return;
        setIsPosting(true);
        try {
            let mediaFiles: any[] = [];
            if (selectedFile) {
                const uploadResult = await feedService.uploadFile(selectedFile);
                mediaFiles.push({
                    type: 'image',
                    url: `http://127.0.0.1:5038${uploadResult.url}`,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.size
                });
            }

            const newPost = await feedService.createPost(newPostContent, 'Public', mediaFiles);
            setPosts([newPost, ...posts]);
            setNewPostContent('');
            removeSelectedFile();
        } catch (error) {
            console.error("Failed to create post", error);
            alert("Failed to post. Please try again.");
        } finally {
            setIsPosting(false);
        }
    };

    const handlePostUpdated = (updatedPost: Post) => {
        setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    const handlePostDeleted = (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-[var(--color-dark-bg)] text-[var(--color-text-main)] font-[Inter] overflow-x-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-dark-surface)] px-4 py-3 lg:px-6 h-[var(--header-height)]">
                <div className="lg:hidden">
                    <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="text-white">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>
                <div className="flex items-center gap-4 lg:gap-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/feed')}>
                        <div className="logo-icon" style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>hub</span>
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight hidden sm:block">SocialNet</span>
                    </div>

                    <label className="flex flex-col min-w-40 !h-10 max-w-64 lg:w-96 hidden md:flex">
                        <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                            {/* <div className="text-[var(--color-text-muted)] flex border-none bg-[var(--color-dark-bg)] items-center justify-center pl-4 rounded-l-xl border-r-0 border border-[var(--color-border)]">
                                <span className="material-symbols-outlined">search</span>
                            </div> */}
                            {/* <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border-none bg-[var(--color-dark-bg)] focus:border-none h-full placeholder:text-[var(--color-text-muted)] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal border border-[var(--color-border)]" placeholder="Search..." /> */}
                        </div>
                    </label>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-white transition-colors relative" onClick={() => setShowNotifications(!showNotifications)}>
                        <span className="material-symbols-outlined">notifications</span>
                        {unreadCount > 0 && <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border border-[var(--color-dark-surface)]"></span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute top-16 right-4 sm:right-10 w-80 bg-[var(--color-dark-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 animate-fade-in max-h-[400px] overflow-y-auto">
                            <div className="p-4 border-b border-[var(--color-border)]">
                                <h3 className="text-white font-bold">Notifications</h3>
                            </div>
                            <div className="flex flex-col">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} className="p-4 hover:bg-[var(--color-dark-surface-lighter)] border-b border-[var(--color-border)] cursor-pointer transition-colors">
                                        <div className="text-white text-sm font-medium">{n.title}</div>
                                        <div className="text-[var(--color-text-muted)] text-xs">{n.content}</div>
                                    </div>
                                )) : <div className="p-4 text-[var(--color-text-muted)] text-sm">No new notifications</div>}
                            </div>
                        </div>
                    )}
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-[var(--color-border)] cursor-pointer"
                        style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}
                        onClick={() => navigate('/profile')}
                    ></div>
                </div>
            </header>

            <div className="flex flex-1 justify-center py-6 px-4 lg:px-8 gap-6 max-w-[1600px] mx-auto w-full">
                {/* Left Sidebar */}
                <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out bg-[var(--color-dark-surface)] lg:relative lg:translate-x-0 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} lg:bg-transparent lg:block pt-20 lg:pt-0`}>
                    <div className="lg:hidden absolute top-4 right-4">
                        <button onClick={() => setShowMobileMenu(false)} className="text-white"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <nav className="flex flex-col gap-2 p-4 lg:p-0">
                        {/* Using inline styles or custom classes for sidebar items to match exactly */}
                        <div className="bg-[var(--color-dark-surface)] rounded-xl p-2 border border-[var(--color-border)]">
                            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium transition-colors">
                                <span className="material-symbols-outlined">home</span><span>Feed</span>
                            </a>
                            <a href="#" className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors" onClick={() => navigate('/profile')}>
                                <span className="material-symbols-outlined">person</span><span>Profile</span>
                            </a>
                            <a href="#" className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors" onClick={() => navigate('/chat')}>
                                <span className="material-symbols-outlined">chat</span><span>Chat</span>
                            </a>
                            {user?.role === 'Admin' && (
                                <a href="#" className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors" onClick={() => navigate('/dashboard')}>
                                    <span className="material-symbols-outlined">admin_panel_settings</span><span>Admin Manager</span>
                                </a>
                            )}
                            <a href="#" className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors mt-2" onClick={handleLogout}>
                                <span className="material-symbols-outlined">logout</span><span>Logout</span>
                            </a>
                        </div>
                    </nav>
                </aside>

                {/* Feed Content */}
                <main className="flex-1 max-w-2xl flex flex-col gap-6">
                    {/* Create Post */}
                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm relative z-0">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="user-avatar" style={{ backgroundImage: `url(${getAvatarUrl(user)})`, width: 40, height: 40, minWidth: 40, borderRadius: '50%', backgroundSize: 'cover' }}></div>
                            <input
                                className="flex-1 bg-[var(--color-dark-bg)] border-none rounded-2xl h-12 px-6 text-white placeholder:text-[var(--color-text-muted)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                                placeholder={`What's on your mind?`}
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreatePost()}
                            />
                            <button
                                onClick={handleCreatePost}
                                disabled={(!newPostContent.trim() && !selectedFile) || isPosting}
                                className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                            >
                                {isPosting ? 'Posting...' : 'Post'}
                            </button>
                        </div>

                        {/* Image Preview */}
                        {previewUrl && (
                            <div className="relative mb-4 rounded-lg overflow-hidden border border-[var(--color-border)]">
                                <img src={previewUrl} alt="Preview" className="w-full max-h-[300px] object-cover" />
                                <button
                                    onClick={removeSelectedFile}
                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-4 border-t border-[var(--color-border)] pt-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white px-3 py-2 rounded-lg hover:bg-[var(--color-dark-surface-lighter)] transition-colors" onClick={() => fileInputRef.current?.click()}>
                                <span className="material-symbols-outlined text-green-500">photo_library</span> Photo/Video
                            </button>
                        </div>
                    </div>

                    {/* Posts */}
                    {isLoading ? (
                        <div className="text-center text-[var(--color-text-muted)] py-10">Loading posts...</div>
                    ) : posts.length === 0 ? (
                        <div className="text-center text-[var(--color-text-muted)] py-10">No posts yet. Be the first to share!</div>
                    ) : (
                        posts.map(post => (
                            <PostCard
                                key={post.id}
                                post={post}
                                currentUser={user}
                                onPostUpdated={handlePostUpdated}
                                onPostDeleted={handlePostDeleted}
                            />
                        ))
                    )}
                </main>

                {/* Right Sidebar - Contacts */}
                <aside className="w-80 hidden lg:flex flex-col gap-6">
                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm">
                        <h3 className="text-white text-lg font-bold mb-4">Contacts</h3>
                        <div className="flex flex-col gap-2">
                            {contacts.map((c) => (
                                <div key={c.id || c.username} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-dark-surface-lighter)] cursor-pointer transition-colors" onClick={() => setActiveChatUser(c)}>
                                    <div className="relative">
                                        <div className="user-avatar" style={{ backgroundImage: `url(${getAvatarUrl(c)})`, width: 36, height: 36, borderRadius: '50%', backgroundSize: 'cover' }}></div>
                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--color-dark-surface)]"></div>
                                    </div>
                                    <span className="text-sm font-medium text-[var(--color-text-main)]">{c.fullName || c.username}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Quick Chat Overlay - Restricted Mode */}
            {activeChatUser && (
                <div className={`fixed bottom-0 right-4 w-80 bg-[var(--color-dark-surface)] border border-[var(--color-border)] rounded-t-lg shadow-xl z-50 flex flex-col transition-all duration-300 ${activeChatUser ? 'translate-y-0' : 'translate-y-full'}`} style={{ height: 'auto', maxHeight: '400px' }}>
                    <div className="p-3 bg-[var(--color-dark-surface-lighter)] border-b border-[var(--color-border)] flex items-center justify-between rounded-t-lg">
                        <div className="flex items-center gap-2">
                            <div className="user-avatar w-8 h-8 relative rounded-full bg-cover" style={{ backgroundImage: `url(${getAvatarUrl(activeChatUser)})` }}>
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--color-dark-surface)]"></div>
                            </div>
                            <div>
                                <div className="text-white font-medium text-sm">{activeChatUser.fullName || activeChatUser.username}</div>
                                <div className="text-[10px] text-[var(--color-text-muted)]">Quick Message Only</div>
                            </div>
                        </div>
                        <button onClick={() => setActiveChatUser(null)} className="text-[var(--color-text-muted)] hover:text-white">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-3 bg-[var(--color-dark-bg)]">
                        <div className="text-center text-[var(--color-text-muted)] text-sm mb-2">
                            Select a message to send instantly:
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {quickActions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleQuickSend(action)}
                                    className="text-left px-4 py-3 rounded-lg bg-[var(--color-dark-surface-lighter)] text-white hover:bg-[var(--color-primary)] hover:text-white transition-colors text-sm font-medium border border-[var(--color-border)] hover:border-transparent flex items-center gap-2"
                                >
                                    <span>{action}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 text-center">
                            <button
                                onClick={() => navigate('/chat')}
                                className="text-xs text-[var(--color-primary)] hover:underline"
                            >
                                Open full chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
