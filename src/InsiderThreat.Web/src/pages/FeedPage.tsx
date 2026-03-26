import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import { API_BASE_URL } from '../services/api';
import { userService } from '../services/userService';
import { feedService } from '../services/feedService';
import type { User, Post } from '../types';
import PostCard from '../components/PostCard';
import NavigationBar from '../components/NavigationBar';
import LeftSidebar from '../components/LeftSidebar';
import FloatingChat from '../components/chat/FloatingChat';
import ChatSidebar from '../components/chat/ChatSidebar';
import BottomNavigation from '../components/BottomNavigation';
import { DEPARTMENTS, POST_CATEGORIES } from '../constants';
import { detectSensitiveContent } from '../utils/contentAnalyzer';
import { validateFileSize } from '../utils/imageCompressor';
import './FeedPage.css';



export default function FeedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = authService.getCurrentUser();
    const { t } = useTranslation();
    const [openChats, setOpenChats] = useState<User[]>([]); // Max 3 chat windows

    // Helper function to open a chat window
    const handleOpenChat = (chatUser: User) => {
        // Check if already open
        if (openChats.some(u => u.id === chatUser.id || u.username === chatUser.username)) {
            return; // Already open
        }
        // Check max limit
        if (openChats.length >= 3) {
            message.warning(t('feed.max_chat_windows', 'Maximum 3 chat windows allowed'));
            return;
        }
        setOpenChats(prev => [...prev, chatUser]);
    };

    // Function to close a chat window
    const handleCloseChat = (chatUserId: string) => {
        setOpenChats(prev => prev.filter(u => (u.id || u.username) !== chatUserId));
    };

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

    // Post Modal State
    const [showPostModal, setShowPostModal] = useState(false);
    const [postBgColor, setPostBgColor] = useState<string | null>(null);

    const BG_COLORS = [
        null,
        'linear-gradient(135deg,#f857a4,#ff5858)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#e0e0e0,#f5f5f5)',
        '#1a1a2e',
        'linear-gradient(135deg,#1e40af,#3b82f6)',
        'linear-gradient(135deg,#f7971e,#ffd200)',
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


            } catch (error) {
                console.error("Error loading feed data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user?.username, navigate]);

    // Quick Chat Effects - REMOVED history loading
    // useEffect(() => { ... })

    // Scroll effect REMOVED




    const getAvatarUrl = (userOrUrl?: any) => {
        if (!userOrUrl) return `https://i.pravatar.cc/150?u=user`;
        const url = typeof userOrUrl === 'string' ? userOrUrl : userOrUrl.avatarUrl;
        if (!url) return `https://i.pravatar.cc/150?u=${userOrUrl.username || 'user'}`;
        if (url.startsWith('http')) return url;
        return `${API_BASE_URL}${url}`;
    };

    // Feed Actions
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (reject files > 50MB)
            const sizeError = validateFileSize(file);
            if (sizeError) {
                message.error(sizeError);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

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
                    url: uploadResult.url,  // lưu đường dẫn tương đối /uploads/..., không dùng full URL
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
        } catch (error: any) {
            console.error("Failed to create post", error);
            const errMsg = error.response?.data?.message || error.message || t('feed.post_fail_try_again', "Please try again.");
            alert(t('feed.post_fail_msg', { msg: errMsg, defaultValue: `Failed to post: ${errMsg}` }));
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
        <div className="flex min-h-screen w-full flex-col bg-[var(--color-bg)] text-[var(--color-text-main)]">
            {/* New Navigation Bar */}
            <NavigationBar onChatClick={() => navigate('/chat')} />

            <div className="social-layout">
                {/* Left Navigation Sidebar */}
                <LeftSidebar />

                {/* Main Feed Content */}
                <div className="feed-wrapper">
                    <div className="feed-container">
                        {/* ── Welcome Banner ── */}
                        <div className="rounded-3xl p-8 md:p-10 text-white relative flex flex-col gap-6 overflow-hidden hero-banner-light dark:hero-banner-dark shadow-[0_12px_40px_rgba(37,99,235,0.25)] dark:shadow-none transition-all duration-500"
                             style={{ background: 'var(--gradient-premium)' /* Fallback for light mode if CSS fails */ }}>
                            
                            {/* Background decoration (Light Mode Only) */}
                            <div className="block dark:hidden" style={{
                                position: 'absolute', left: -20, bottom: -20,
                                width: 140, height: 140,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.06)',
                                pointerEvents: 'none',
                            }} />

                            <div className="relative z-10 max-w-[80%]">
                                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight block dark:hidden">
                                    {t('feed.welcome_back_user', { name: user?.fullName || user?.username, defaultValue: `Chào mừng trở lại, ${user?.fullName || user?.username} 👋` })}
                                </h1>
                                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight hidden dark:block text-blue-400">
                                    {t('feed.welcome_back_admin', 'Chào mừng trở lại, Administrator')}
                                </h1>
                                <p className="text-sm md:text-base opacity-90 font-medium block dark:hidden">
                                     {t('feed.daily_prompt_user', 'Hôm nay có gì mới không? Chia sẻ với đồng nghiệp nhé!')}
                                </p>
                                <p className="text-sm md:text-base text-slate-400 font-medium hidden dark:block">
                                    {t('feed.daily_prompt_admin', 'Theo dõi các biến động truy cập hệ thống và hoạt động mới nhất.')}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 relative z-10 block dark:hidden">
                                {user?.role === 'Admin' && (
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            borderRadius: 12,
                                            padding: '8px 20px',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: 'white',
                                            border: 'none',
                                            backdropFilter: 'blur(4px)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t('feed.admin_panel', 'Admin Panel')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Create Post — Click to open modal */}
                        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setShowPostModal(true)}>
                            <div className="flex-shrink-0" style={{
                                backgroundImage: `url(${getAvatarUrl(user)})`,
                                width: 42, height: 42, minWidth: 42,
                                borderRadius: '50%', backgroundSize: 'cover',
                                border: '2px solid #e2e8f0'
                            }} />
                            <div className="flex-1 bg-[var(--color-surface-lighter)] hover:bg-[var(--color-bg)] transition-colors rounded-full h-10 flex items-center px-4 text-[var(--color-text-muted)] text-[15px] select-none">
                                {t('feed.post_placeholder', { name: user?.fullName?.split(' ').pop() || user?.username, defaultValue: `${user?.fullName?.split(' ').pop() || user?.username} ơi, bạn đang nghĩ gì?` })}
                            </div>
                        </div>

                        {/* Post Creation Modal */}
                        {showPostModal && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                                onClick={(e) => e.target === e.currentTarget && setShowPostModal(false)}
                            >
                                <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
                                    {/* Modal Header */}
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                                        <h2 className="text-lg font-bold text-[var(--color-text-main)]">{t('feed.create_post_title', 'TẠO BÀI VIẾT')}</h2>
                                        <button
                                            onClick={() => { setShowPostModal(false); setNewPostContent(''); setPostBgColor(null); removeSelectedFile(); }}
                                            className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-surface-lighter)] hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text-muted)] text-xl font-bold"
                                        >×</button>
                                    </div>

                                    {/* User Info */}
                                    <div className="flex items-center gap-3 px-5 pt-4">
                                        <div style={{
                                            backgroundImage: `url(${getAvatarUrl(user)})`,
                                            width: 48, height: 48, minWidth: 48,
                                            borderRadius: '50%', backgroundSize: 'cover',
                                            border: '2px solid #e2e8f0'
                                        }} />
                                        <div>
                                            <div className="font-semibold text-[var(--color-text-main)] text-[15px]">{user?.fullName || user?.username}</div>
                                            <div className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 text-[11px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                                                {t('feed.public_badge', '🌐 CÔNG KHAI')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Text Area — changes by mode */}
                                    <div
                                        className="flex-1 mx-5 mt-4 mb-3 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300"
                                        style={{
                                            background: !previewUrl ? (postBgColor || 'transparent') : 'transparent',
                                            minHeight: !previewUrl && postBgColor ? 180 : 120,
                                        }}
                                    >
                                        <textarea
                                            autoFocus
                                            className="w-full bg-transparent resize-none border-none focus:ring-0 outline-none transition-all duration-300 placeholder:text-slate-400/70"
                                            style={{
                                                // Caption mode (with image): simple left-aligned text
                                                // Color mode: big centered bold text
                                                // Default: medium centered text
                                                textAlign: previewUrl ? 'left' : 'center',
                                                fontSize: previewUrl
                                                    ? 15
                                                    : postBgColor
                                                        ? (newPostContent.length > 80 ? 18 : newPostContent.length > 40 ? 22 : 26)
                                                        : 17,
                                                fontWeight: postBgColor && !previewUrl ? 600 : 500,
                                                color: postBgColor && !previewUrl ? '#fff' : 'var(--color-text-main)',
                                                padding: previewUrl ? '8px 4px' : '20px 16px',
                                                minHeight: previewUrl ? 60 : postBgColor ? 160 : 100,
                                                textShadow: postBgColor && !previewUrl ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                                                lineHeight: 1.5,
                                            }}
                                            placeholder={
                                                previewUrl
                                                    ? t('feed.caption_placeholder', 'Thêm chú thích...')
                                                    : t('feed.post_placeholder', { name: user?.fullName?.split(' ').pop() || user?.username, defaultValue: `${user?.fullName?.split(' ').pop() || user?.username} ơi, bạn đang nghĩ gì?` })
                                            }
                                            value={newPostContent}
                                            onChange={(e) => setNewPostContent(e.target.value)}
                                            onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleCreatePost()}
                                            rows={previewUrl ? 2 : 4}
                                        />
                                    </div>

                                    {/* Image/Video Preview — thumbnail style */}
                                    {previewUrl && (
                                        <div className="flex flex-wrap gap-2 mx-5 mb-4 p-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200 transition-all duration-300">
                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden group shadow-sm border border-white flex-shrink-0">
                                                {selectedFile?.type.startsWith('video/') ? (
                                                    <video src={previewUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                )}
                                                <button
                                                    onClick={() => { removeSelectedFile(); setPostBgColor(null); }}
                                                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-sm"
                                                >×</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Background Color Picker — hidden when image loaded */}
                                    <div
                                        className="overflow-hidden transition-all duration-300"
                                        style={{ maxHeight: previewUrl ? 0 : 64, opacity: previewUrl ? 0 : 1, marginBottom: previewUrl ? 0 : undefined }}
                                    >
                                        <div className="flex items-center gap-2 px-5 mb-4">
                                            {BG_COLORS.map((color, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setPostBgColor(i === 0 ? null : color)}
                                                    className="transition-all duration-200 hover:scale-110 active:scale-95"
                                                    style={{
                                                        width: 40, height: 40,
                                                        borderRadius: 10,
                                                        background: i === 0 ? 'white' : color || 'white',
                                                        border: (i === 0 && !postBgColor) || postBgColor === color
                                                            ? '3px solid #2563eb'
                                                            : (i === 0 ? '2px solid #cbd5e1' : '2px solid transparent'),
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}
                                                >
                                                    {i === 0 && <span style={{ color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>×</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Add to Post Bar — merged photo+video, no emoji */}
                                    <div className="mx-5 mb-4 border border-[var(--color-border)] bg-[var(--color-surface-lighter)]/30 rounded-xl px-4 py-3 flex items-center justify-between">
                                        <span className="text-[var(--color-text-muted)] text-sm font-medium">{t('feed.add_to_post', 'Thêm vào bài viết')}</span>
                                        <div className="flex items-center gap-2">
                                            {/* Merged Photo + Video button */}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                accept="image/*,video/*"
                                                style={{ display: 'none' }}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors text-sm font-medium"
                                                title={t('feed.add_media_title', 'Ảnh hoặc Video')}
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                                </svg>
                                                <span>{t('feed.add_media', 'Ảnh/Video')}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Visibility + Category */}
                                    <div className="flex items-center gap-2 px-5 pb-4">
                                        <select
                                            className="flex-1 bg-[var(--color-surface-lighter)] text-[var(--color-text-main)] text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 cursor-pointer"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setAllowedRoles([]);
                                                setAllowedDepartments([]);
                                                if (val === 'Managers') setAllowedRoles(['Manager', 'Admin']);
                                                else if (DEPARTMENTS.includes(val)) setAllowedDepartments([val]);
                                            }}
                                        >
                                            <option value="Public">{t('feed.scope_public', '🌐 Toàn công ty')}</option>
                                            <option value="Managers">{t('feed.scope_managers', '👔 Chỉ quản lý')}</option>
                                            {DEPARTMENTS.map(d => <option key={d} value={d}>🏢 {d}</option>)}
                                        </select>
                                        <select
                                            className="flex-1 bg-[var(--color-surface-lighter)] text-[var(--color-text-main)] text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 cursor-pointer"
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                        >
                                            {POST_CATEGORIES.map(c => <option key={c} value={c}>#{c}</option>)}
                                        </select>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="px-5 pb-5">
                                        <button
                                            onClick={async () => { await handleCreatePost(); if (!showWarning) setShowPostModal(false); }}
                                            disabled={(!newPostContent.trim() && !selectedFile) || isPosting}
                                            className="w-full py-3 rounded-xl font-bold text-[15px] tracking-wide transition-all duration-300"
                                            style={{
                                                background: (!newPostContent.trim() && !selectedFile)
                                                    ? 'var(--color-surface-lighter)'
                                                    : 'linear-gradient(135deg,#1e40af,#3b82f6)',
                                                color: (!newPostContent.trim() && !selectedFile) ? 'var(--color-text-muted)' : '#fff',
                                                cursor: (!newPostContent.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
                                                boxShadow: (!newPostContent.trim() && !selectedFile) ? 'none' : '0 4px 15px rgba(37,99,235,0.35)',
                                            }}
                                        >
                                            {isPosting ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                    {t('feed.posting', 'Đang đăng bài...')}
                                                </span>
                                            ) : t('feed.post_now', 'ĐĂNG BÀI NGAY')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('feed.filter', 'Bộ lọc:')}</span>
                                    <select
                                        className="bg-[var(--color-surface-lighter)] text-[var(--color-text-main)] text-[15px] font-medium border border-[var(--color-border)] rounded-xl px-4 py-2 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                    >
                                        <option value="All">{t('feed.all_categories', 'Tất cả danh mục')}</option>
                                        {POST_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                                {['All', 'Today', 'Week', 'Month'].map(period => (
                                    <button
                                        key={period}
                                        onClick={() => setFilterDate(period)}
                                        className={`px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all whitespace-nowrap ${filterDate === period
                                            ? 'bg-[var(--color-primary)] text-white shadow-md'
                                            : 'bg-[var(--color-surface-lighter)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] border border-[var(--color-border)]'
                                            }`}
                                    >
                                        {period === 'All' ? t('feed.period_all', 'Tất cả') : period === 'Today' ? t('feed.period_today', 'Hôm nay') : period === 'Week' ? t('feed.period_week', 'Tuần này') : t('feed.period_month', 'Tháng này')}
                                    </button>
                                ))}
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
                                            {t('feed.viewing_single', 'Viewing single post from notification')}
                                        </p>
                                        <button
                                            onClick={() => {
                                                setFocusedPostId(null);
                                                window.history.pushState({}, '', '/feed');
                                            }}
                                            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors text-sm font-medium"
                                        >
                                            {t('feed.view_all', 'View All Posts')}
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
                                                {t('feed.reported_post', '📌 Bài viết được báo cáo')}
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
                    </div>
                </div>

                {/* Chat Sidebar - right side (Always visible like Facebook) */}
                <ChatSidebar onContactClick={handleOpenChat} />
            </div>


            {/* Sensitive Content Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-[var(--color-surface)] border-2 border-yellow-400 rounded-2xl p-6 max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-yellow-500 text-3xl">warning</span>
                            <h3 className="text-xl font-bold text-[var(--color-text-main)]">{t('feed.sensitive_detected', 'Sensitive Content Detected')}</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] mb-4 leading-relaxed">{warningMessage}</p>
                        <p className="text-sm text-[var(--color-text-muted)] mb-6">{t('feed.sensitive_continue', 'Do you want to continue posting anyway?')}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                }}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                            >
                                {t('feed.btn_cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowWarning(false);
                                    setWarningMessage('');
                                    performCreatePost();
                                }}
                                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
                            >
                                {t('feed.btn_post_anyway', 'Post Anyway')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Chat Windows - Render up to 3 */}
            {openChats.map((chatUser, index) => (
                <FloatingChat
                    key={chatUser.id || chatUser.username}
                    chatUser={chatUser}
                    windowIndex={index}
                    onClose={() => handleCloseChat(chatUser.id || chatUser.username)}
                />
            ))}

            <BottomNavigation />
        </div>
    );
}
