import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { chatService } from '../services/chatService';
import { feedService } from '../services/feedService';
import api from '../services/api';
import type { User, Post } from '../types';
import PostCard from '../components/PostCard';
import NotificationBell from '../components/NotificationBell';
import SearchBar from '../components/SearchBar';
import { confirmLogout } from '../utils/logoutUtils';
import { DEPARTMENTS, POST_CATEGORIES } from '../constants';
import { detectSensitiveContent } from '../utils/contentAnalyzer';
import './FeedPage.css';

// Import Notification type
import type { Notification } from '../services/notificationService';

export default function FeedPage() {
    const navigate = useNavigate();
    const location = useLocation();
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
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
    const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter State
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterDate, setFilterDate] = useState<string>('All');

    // Highlighted Post State
    const [searchParams] = useSearchParams();
    const highlightedPostId = searchParams.get('postId');

    // Focused Post State (from notification hash)
    const [focusedPostId, setFocusedPostId] = useState<string | null>(null);

    // Sensitive Content Warning State
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState('');
    const [detectedWords, setDetectedWords] = useState<string[]>([]);
    const [proceedWithPost, setProceedWithPost] = useState(false);

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

    // Detect hash for focused post (from notification)
    useEffect(() => {
        const hash = location.hash.slice(1); // Remove #
        if (hash) {
            console.log('Hash detected:', hash);
            setFocusedPostId(hash);
            // Scroll to post after small delay
            setTimeout(() => {
                const element = document.getElementById(`post-${hash}`);
                if (element) {
                    console.log('Scrolling to element:', element);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.log('Element not found:', `post-${hash}`);
                }
            }, 500);
        } else {
            setFocusedPostId(null);
        }
    }, [location.hash, posts]); // Re-run when hash or posts change

    // Initial Data Fetch
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const postsData = await feedService.getPosts();
                // Sort: Pinned first, then by Date descending
                const sortedPosts = postsData.posts.sort((a, b) => {
                    if (a.isPinned === b.isPinned) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }
                    return a.isPinned ? -1 : 1;
                });
                setPosts(sortedPosts);

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

        // Check for sensitive content
        const analysis = detectSensitiveContent(newPostContent);
        if (analysis.isSensitive) {
            setWarningMessage(analysis.warningMessage);
            setShowWarning(true);
            return; // Don't proceed until user confirms
        }

        await performCreatePost();
    };

    const performCreatePost = async () => {
        if (!newPostContent.trim() && !selectedFile) return;
        setIsPosting(true);
        try {
            let mediaFiles: any[] = [];
            let postType = 'Text';

            if (selectedFile) {
                const uploadResult = await feedService.uploadFile(selectedFile);
                const fileType = selectedFile.type.startsWith('image/') ? 'image' :
                    selectedFile.type.startsWith('video/') ? 'video' : 'file';

                mediaFiles.push({
                    type: fileType,
                    url: `http://127.0.0.1:5038${uploadResult.url}`,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.size
                });

                postType = fileType === 'image' ? 'Image' : fileType === 'video' ? 'Video' : 'File';
            } else if (newPostContent.includes('http')) {
                // Simple link detection
                postType = 'Link';
            }

            const newPost = await feedService.createPost(
                newPostContent,
                'Public',
                mediaFiles,
                selectedCategory,
                postType,
                allowedRoles,
                allowedDepartments
            );

            setPosts([newPost, ...posts]);
            setNewPostContent('');
            setSelectedCategory('General');
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

    // Filter Logic
    const filteredPosts = posts.filter(post => {
        // If highlightedPostId is present, only show that specific post
        if (highlightedPostId && post.id !== highlightedPostId) {
            return false;
        }

        // Category filter
        if (filterCategory !== 'All' && post.category !== filterCategory) {
            return false;
        }

        // Date filter
        if (filterDate !== 'All') {
            const postDate = new Date(post.createdAt);
            const now = new Date();

            if (filterDate === 'Today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (postDate < today) return false;
            } else if (filterDate === 'Week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (postDate < weekAgo) return false;
            } else if (filterDate === 'Month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (postDate < monthAgo) return false;
            }
        }

        return true;
    });

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
                        <SearchBar />
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
                                    <div key={n.id} className="p-4 hover:bg-[var(--color-dark-surface-lighter)] border-b border-[var(--color-border)] cursor-pointer transition-colors" onClick={() => {
                                        if (n.link) navigate(n.link);
                                        setShowNotifications(false);
                                    }}>
                                        <div className="text-white text-sm font-medium">{n.message}</div>
                                        <div className="text-[var(--color-text-muted)] text-xs mt-1">
                                            {n.actorName && `${n.actorName} • `}
                                            {new Date(n.createdAt).toLocaleString()}
                                        </div>
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

                        <div className="flex items-center gap-4 border-t border-[var(--color-border)] pt-3 justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*,video/*,application/pdf"
                                    style={{ display: 'none' }}
                                />
                                <button className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white px-3 py-2 rounded-lg hover:bg-[var(--color-dark-surface-lighter)] transition-colors" onClick={() => fileInputRef.current?.click()}>
                                    <span className="material-symbols-outlined text-green-500">attach_file</span> Media
                                </button>

                            </div>

                            {/* Visibility Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-[var(--color-text-muted)] text-sm">To:</span>
                                <select
                                    className="bg-[var(--color-dark-bg)] text-white text-sm border border-[var(--color-border)] rounded-lg px-2 py-2 focus:outline-none focus:border-[var(--color-primary)] max-w-[120px]"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAllowedRoles([]);
                                        setAllowedDepartments([]);

                                        if (val === 'Public') {
                                            // Default: All empty
                                        } else if (val === 'Managers') {
                                            setAllowedRoles(['Manager', 'Admin']);
                                        } else if (DEPARTMENTS.includes(val)) {
                                            setAllowedDepartments([val]);
                                        }
                                    }}
                                >
                                    <option value="Public">Everyone</option>
                                    <option value="Managers">Managers Only</option>
                                    <optgroup label="Departments">
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{dept} Dept</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[var(--color-text-muted)] text-sm">Tag:</span>
                                <select
                                    className="bg-[var(--color-dark-bg)] text-white text-sm border border-[var(--color-border)] rounded-lg px-2 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    {POST_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-4 border border-[var(--color-border)] shadow-sm">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-sm font-semibold text-white">Filters:</span>

                            {/* Category Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-text-muted)]">Category:</span>
                                <select
                                    className="bg-[var(--color-dark-bg)] text-white text-sm border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--color-primary)]"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="All">All</option>
                                    {POST_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-text-muted)]">Date:</span>
                                <div className="flex gap-1">
                                    {['All', 'Today', 'Week', 'Month'].map(period => (
                                        <button
                                            key={period}
                                            onClick={() => setFilterDate(period)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDate === period
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-dark-bg)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                                                }`}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active Filter Count */}
                            {(filterCategory !== 'All' || filterDate !== 'All') && (
                                <button
                                    onClick={() => {
                                        setFilterCategory('All');
                                        setFilterDate('All');
                                    }}
                                    className="text-xs text-[var(--color-primary)] hover:underline ml-auto"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Posts */}
                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
                        </div>
                    ) : (
                        <>
                            {/* Show "View All Posts" button when in focused mode */}
                            {focusedPostId && (
                                <div className="mb-4 p-4 bg-[var(--color-dark-surface)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
                                    <p className="text-[var(--color-text-muted)] text-sm">
                                        Viewing single post from notification
                                    </p>
                                    <button
                                        onClick={() => {
                                            setFocusedPostId(null);
                                            window.history.pushState({}, '', '/feed');
                                        }}
                                        className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors text-sm font-medium"
                                    >
                                        View All Posts
                                    </button>
                                </div>
                            )}

                            {(focusedPostId ? filteredPosts.filter(p => p.id === focusedPostId) : filteredPosts).map(post => (
                                <div
                                    key={post.id}
                                    id={`post-${post.id}`}
                                    style={{
                                        border: highlightedPostId === post.id ? '3px solid #ff4d4f' : 'none',
                                        borderRadius: '8px',
                                        padding: highlightedPostId === post.id ? '8px' : '0',
                                        backgroundColor: highlightedPostId === post.id ? 'rgba(255, 77, 79, 0.05)' : 'transparent'
                                    }}
                                >
                                    {highlightedPostId === post.id && (
                                        <div style={{
                                            backgroundColor: '#ff4d4f',
                                            color: 'white',
                                            padding: '8px 12px',
                                            borderRadius: '4px',
                                            marginBottom: '8px',
                                            fontWeight: 600,
                                            textAlign: 'center'
                                        }}>
                                            📌 Bài viết được báo cáo
                                        </div>
                                    )}
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        currentUser={user}
                                        onPostUpdated={handlePostUpdated}
                                        onPostDeleted={handlePostDeleted}
                                    />
                                </div>
                            ))}
                        </>
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

            {/* Sensitive Content Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
                    <div className="bg-[var(--color-dark-surface)] border-2 border-yellow-500 rounded-xl p-6 max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-yellow-500 text-3xl">warning</span>
                            <h3 className="text-xl font-bold text-white">Sensitive Content Detected</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] mb-4 leading-relaxed">{warningMessage}</p>
                        <p className="text-sm text-[var(--color-text-muted)] mb-6">Do you want to continue posting anyway?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                }}
                                className="flex-1 px-4 py-2 bg-[var(--color-dark-bg)] text-white rounded-lg hover:bg-[var(--color-dark-surface-lighter)] transition-colors border border-[var(--color-border)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                    performCreatePost();
                                }}
                                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
                            >
                                Post Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
