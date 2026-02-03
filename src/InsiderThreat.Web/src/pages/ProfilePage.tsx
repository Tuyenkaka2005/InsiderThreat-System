import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { api } from '../services/api';
import { feedService } from '../services/feedService';
import { confirmLogout } from '../utils/logoutUtils';
import type { User, Post } from '../types';
import PostCard from '../components/PostCard';

type TabType = 'overview' | 'security' | 'activity';

interface LogEntry {
    timestamp: string;
    actionTaken: string; // or message
    message: string;
    severity: string;
    ipAddress: string;
}

import FaceRegistrationModal from '../components/FaceRegistrationModal';

export default function ProfilePage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);
    const [userPosts, setUserPosts] = useState<Post[]>([]);

    // Form Data for Edit Profile
    const [formData, setFormData] = useState({
        fullName: '',
        department: '',
        position: '',
        bio: '',
        phoneNumber: '',
        email: ''
    });

    // Change Password State
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setFormData({
                fullName: currentUser.fullName || '',
                bio: currentUser.bio || '',
                department: currentUser.department || '',
                position: currentUser.position || '',
                phoneNumber: currentUser.phoneNumber || '',
                email: currentUser.email || ''
            });

            // Fetch activity logs
            const fetchLogs = async () => {
                try {
                    const logs = await userService.getActivityLogs(currentUser.id || '');
                    setActivityLogs(logs.map((log: any) => ({
                        timestamp: log.timestamp,
                        message: log.details || log.action,
                        actionTaken: log.action,
                        severity: 'Info', // Default
                        ipAddress: log.ipAddress || '127.0.0.1'
                    })));
                } catch (error) {
                    console.error("Error fetching logs", error);
                }
            };
            fetchLogs();

            // Fetch user posts
            const fetchPosts = async () => {
                try {
                    // Assuming feedService.getUserPosts returns Post[]
                    if (currentUser.id) {
                        const posts = await feedService.getUserPosts(currentUser.id);
                        setUserPosts(posts);
                    }
                } catch (error) {
                    console.error("Error fetching user posts", error);
                    // Fallback to empty if fails
                    setUserPosts([]);
                }
            };
            fetchPosts();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    // Fetch Logs when Activity Tab is active
    useEffect(() => {
        if (activeTab === 'activity' && user?.id) {
            const fetchLogs = async () => {
                try {
                    const logs = await api.get<LogEntry[]>(`/ api / users / ${user.id}/logs`);
                    setActivityLogs(logs);
                } catch (error) {
                    console.error("Failed to fetch logs", error);
                }
            };
            fetchLogs();
        }
    }, [activeTab, user?.id]);

    const handlePostUpdated = (updatedPost: Post) => {
        setUserPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    const handlePostDeleted = (postId: string) => {
        setUserPosts(prev => prev.filter(p => p.id !== postId));
    };

    const handleEditClick = () => {
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                department: user.department || '',
                position: user.position || '',
                bio: user.bio || '',
                phoneNumber: user.phoneNumber || '',
                email: user.email || ''
            });
            setIsEditing(true);
        }
    };

    const handleSaveProfile = async () => {
        if (!user || !user.id) return;

        try {
            await userService.updateUser(user.id, {
                fullName: formData.fullName,
                department: formData.department,
                position: formData.position,
                bio: formData.bio,
                phoneNumber: formData.phoneNumber,
                email: formData.email
            });

            // Update local state
            const updatedUser = { ...user, ...formData };
            setUser(updatedUser);
            // Update auth service storage if necessary or just rely on state until refresh
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Failed to update profile');
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError("New passwords do not match");
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }

        try {
            await api.post('/api/auth/change-password', {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });
            setPasswordSuccess("Password changed successfully");
            setPasswordError("");
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (any) {
            setPasswordError("Failed to change password. check old password.");
            setPasswordSuccess("");
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !user.id) return;

        setIsUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        try {
            // Upload file
            const response = await api.post<{ url: string }>('/api/upload', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // ASP.NET Core default JSON serialization is camelCase
            const avatarUrl = response.url; // url not Url

            // Update user profile with new avatar URL
            // Assuming backend returns relative path like /uploads/filename.jpg, we might need full URL if backend doesn't handle static files at root properly, but usually it does.
            // Let's assume the returned Url is what we save.

            // Construct full URL if needed, but let's save what server gives.
            // The server returns /uploads/filename
            // Currently server runs on port 5038.
            // The Url returned is relative. E.g. /uploads/guid.jpg
            // We should store this relative path or full path. Storing relative is better?
            // User.cs expects AvatarUrl.

            // NOTE: The current API base URL is http://127.0.0.1:5038
            // If we save relative path, we need to prepend API_BASE_URL when displaying.
            // Or we can save full URL.
            // Let's save the relative path as returned by UploadController,
            // and when displaying, check if it starts with http. If not, prepend API_BASE_URL.

            // Actually, let's just save the full URL to make it easier for now,
            // or modify the display logic.
            // Let's modify display logic to handle relative URLs.

            await userService.updateUser(user.id, {
                avatarUrl: avatarUrl
            });

            const updatedUser = { ...user, avatarUrl: avatarUrl };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    // Fallback if user is loading or not found
    // Helper to get display Avatar URL
    if (!user) {
        return <div className="flex h-screen items-center justify-center bg-[var(--color-dark-bg)] text-white">Loading...</div>;
    }

    const getDisplayAvatarUrl = (url?: string) => {
        if (!url) return `https://i.pravatar.cc/150?u=${user.username}`;
        if (url.startsWith('http')) return url;
        return `http://127.0.0.1:5038${url}`; // Prepend API URL for relative paths
    };

    const avatarUrl = getDisplayAvatarUrl(user.avatarUrl);

    return (
        <div className="flex min-h-screen w-full flex-col bg-[var(--color-dark-bg)] text-[var(--color-text-main)] font-[Inter] overflow-x-hidden">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-dark-surface)] px-4 py-3 lg:px-6 h-[var(--header-height)]">
                <div className="flex items-center gap-4 lg:gap-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/feed')}>
                        <div className="logo-icon" style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>hub</span>
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight hidden sm:block">SocialNet</span>
                    </div>

                    {/* Search Bar */}
                    <label className="flex flex-col min-w-40 !h-10 max-w-64 lg:w-96 hidden md:flex">
                        <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                        </div>
                    </label>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-white transition-colors relative">
                        {/* <span className="material-symbols-outlined">chat_bubble</span> */}
                        {/* <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border border-[var(--color-dark-surface)]"></span> */}
                    </button>
                    <button className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-white transition-colors">
                        {/* <span className="material-symbols-outlined">notifications</span> */}
                    </button>
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-[var(--color-border)] cursor-pointer" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex flex-1 justify-center py-6 px-4 lg:px-8 max-w-[1600px] mx-auto w-full gap-6">
                {/* Navigation Sidebar (Added) */}
                <aside className="hidden lg:flex flex-col w-64 min-w-[250px]">
                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-2 border border-[var(--color-border)] sticky top-24">
                        <a href="#" className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors" onClick={() => navigate('/feed')}>
                            <span className="material-symbols-outlined">home</span><span>Feed</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-3 bg-[var(--color-dark-surface-lighter)] text-white rounded-lg font-medium transition-colors" onClick={() => navigate('/profile')}>
                            <span className="material-symbols-outlined">person</span><span>Profile</span>
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-3 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors" onClick={() => navigate('/chat')}>
                            <span className="material-symbols-outlined">chat</span><span>Chat</span>
                        </a>
                        <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-[var(--color-dark-surface-lighter)] rounded-lg font-medium transition-colors mt-2 text-left"
                            onClick={() => {
                                confirmLogout(() => {
                                    authService.logout();
                                    navigate('/login');
                                });
                            }}>
                            <span className="material-symbols-outlined">logout</span><span>Logout</span>
                        </button>
                    </div>
                </aside>

                <div className="flex flex-col max-w-[1200px] flex-1 w-full gap-5">
                    {/* Profile Hero Section */}
                    <div className="flex flex-col w-full bg-[var(--color-dark-surface)] rounded-xl overflow-hidden shadow-sm border border-[var(--color-border)]">
                        {/* Cover Image */}
                        <div className="w-full bg-center bg-no-repeat bg-cover h-48 md:h-64 lg:h-80 relative" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDkjvK405c9kygPu-McjoGoNz93gEiXxBm6Lwatwqv_9EhU5ra1ZB5Yo50KJJBiSHrD5ltyTlcxpclF3mGnLIIBXsucZdKeHtyR5n_DnMnNyJIX9diIziIYPhFxs7-3iEjhrlwNGCuS0lq0vR-6CNsWhU8nkk3NHbrQL0Z6pgQ7gRq_XJwV83t0NspdQzSdNfCwGiV2RkHDGFzxCaLkKC7cpIdzW7mndxjgARC0TJqxx-4fJKQ270zAz3mpPWYbXm87T2lnU-9oH1uR")' }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#111418]/80 to-transparent"></div>
                        </div>

                        {/* Profile Info & Actions */}
                        <div className="px-4 pb-4 md:px-8">
                            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end -mt-16 relative z-10">
                                {/* Avatar */}
                                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                    <div className="bg-center bg-no-repeat bg-cover rounded-full size-32 md:size-40 ring-4 ring-[var(--color-dark-surface)] bg-[var(--color-dark-bg)]" style={{ backgroundImage: `url(${avatarUrl})` }}></div>
                                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                                            <div className="size-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Name & Title */}
                                <div className="flex flex-col flex-1 mb-2">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-white text-2xl md:text-3xl font-bold leading-tight">{user.fullName || user.username}</h1>
                                        <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px] md:text-[24px]" title="Verified Account">verified</span>
                                    </div>
                                    <p className="text-[var(--color-text-muted)] text-base md:text-lg font-normal">{user.position ? `${user.position} at ` : ''}{user.department || 'Insider Threat System User'}</p>
                                    {user.bio && <p className="text-gray-400 text-sm mt-1 max-w-2xl">{user.bio}</p>}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-4 md:mt-0 mb-2 w-full md:w-auto">
                                    <button
                                        onClick={handleEditClick}
                                        className="flex-1 md:flex-auto min-w-[100px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors text-white text-sm font-bold tracking-[0.015em] shadow-lg shadow-blue-500/20"
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('security')}
                                        className="flex-1 md:flex-auto min-w-[100px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-[var(--color-dark-surface-lighter)] hover:bg-[#3b4754] transition-colors text-white text-sm font-bold tracking-[0.015em] border border-[var(--color-border)]"
                                    >
                                        Settings
                                    </button>
                                </div>
                            </div>

                            {/* Divider with Tabs */}
                            <div className="flex items-center gap-6 mt-8 border-b border-[var(--color-border)]">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'overview' ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                                >
                                    Overview
                                    {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full"></div>}
                                </button>
                                <button
                                    onClick={() => setActiveTab('security')}
                                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'security' ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                                >
                                    Security
                                    {activeTab === 'security' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full"></div>}
                                </button>
                                <button
                                    onClick={() => setActiveTab('activity')}
                                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'activity' ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                                >
                                    Activity
                                    {activeTab === 'activity' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full"></div>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Based on Tab */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                        {activeTab === 'overview' && (
                            <>
                                {/* Left Sidebar (Identity) */}
                                <aside className="lg:col-span-4 flex flex-col gap-6">
                                    {/* About Card */}
                                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm">
                                        <h3 className="text-white text-lg font-bold mb-4">About</h3>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[20px]">badge</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs uppercase tracking-wider font-semibold text-[#64748b]">Role</span>
                                                    <span className="text-white">{user.role}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[20px]">work</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs uppercase tracking-wider font-semibold text-[#64748b]">Department</span>
                                                    <span className="text-white">{user.department || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[20px]">mail</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs uppercase tracking-wider font-semibold text-[#64748b]">Email</span>
                                                    <span className="text-white break-all">{user.email || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[20px]">call</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs uppercase tracking-wider font-semibold text-[#64748b]">Phone</span>
                                                    <span className="text-white">{user.phoneNumber || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* E2EE Verify */}
                                    <div className="bg-[var(--color-dark-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm">
                                        <h3 className="text-white text-lg font-bold mb-4">Identity Verification</h3>
                                        <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-2">
                                            <span>Face ID</span>
                                            <span className="text-green-500 font-medium">Verified</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                                            <span>E2EE Keys</span>
                                            <span className={user.publicKey ? "text-green-500 font-medium" : "text-yellow-500 font-medium"}>
                                                {user.publicKey ? 'Active' : 'Not Setup'}
                                            </span>
                                        </div>
                                    </div>
                                </aside>

                                {/* Right Column (Feed) */}
                                <section className="lg:col-span-8 flex flex-col gap-6">
                                    <h3 className="text-white text-lg font-bold">Posts</h3>
                                    {userPosts.length === 0 ? (
                                        <div className="bg-[var(--color-dark-surface)] rounded-xl p-8 border border-[var(--color-border)] shadow-sm flex flex-col items-center justify-center min-h-[200px] text-center">
                                            <span className="material-symbols-outlined text-4xl text-[#3b4754] mb-3">post_add</span>
                                            <h3 className="text-white font-medium text-lg">No recent posts</h3>
                                            <p className="text-[var(--color-text-muted)]">When you share updates, they will appear here.</p>
                                        </div>
                                    ) : (
                                        userPosts.map(post => (
                                            <PostCard
                                                key={post.id}
                                                post={post}
                                                currentUser={user}
                                                onPostUpdated={handlePostUpdated}
                                                onPostDeleted={handlePostDeleted}
                                            />
                                        ))
                                    )}
                                </section>
                            </>
                        )}

                        {activeTab === 'security' && (
                            <section className="lg:col-span-12 flex flex-col max-w-2xl mx-auto w-full gap-6">
                                <div className="bg-[var(--color-dark-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
                                    <h3 className="text-white text-lg font-bold mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--color-primary)]">lock</span>
                                        Change Password
                                    </h3>

                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label className="block text-[var(--color-text-muted)] text-sm mb-1">Current Password</label>
                                            <input
                                                type="password"
                                                className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                                value={passwordData.oldPassword}
                                                onChange={e => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[var(--color-text-muted)] text-sm mb-1">New Password</label>
                                            <input
                                                type="password"
                                                className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                                value={passwordData.newPassword}
                                                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[var(--color-text-muted)] text-sm mb-1">Confirm New Password</label>
                                            <input
                                                type="password"
                                                className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                                value={passwordData.confirmPassword}
                                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            />
                                        </div>

                                        {passwordError && <div className="text-red-500 text-sm">{passwordError}</div>}
                                        {passwordSuccess && <div className="text-green-500 text-sm">{passwordSuccess}</div>}

                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={handleChangePassword}
                                                className="px-6 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold shadow-lg shadow-blue-500/20 transition-colors"
                                            >
                                                Update Password
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[var(--color-dark-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
                                    <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--color-primary)]">face</span>
                                        Face ID Settings
                                    </h3>
                                    <p className="text-[var(--color-text-muted)] text-sm mb-4">Manage your facial recognition data for secure login.</p>
                                    <button
                                        onClick={() => setIsFaceModalOpen(true)}
                                        className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-white hover:bg-[var(--color-dark-surface-lighter)] transition-colors">
                                        Re-scan Face Data
                                    </button>
                                </div>
                            </section>
                        )}

                        {activeTab === 'activity' && (
                            <section className="lg:col-span-12 flex flex-col w-full gap-6">
                                <div className="bg-[var(--color-dark-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                                        <h3 className="text-white text-lg font-bold">Activity Log</h3>
                                        <button className="text-[var(--color-text-muted)] hover:text-white text-sm">Download Report</button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-[var(--color-text-muted)]">
                                            <thead className="bg-[#111418] text-white uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium">Timestamp</th>
                                                    <th className="px-6 py-3 font-medium">Action</th>
                                                    <th className="px-6 py-3 font-medium">Details</th>
                                                    <th className="px-6 py-3 font-medium">IP Address</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-border)]">
                                                {activityLogs.length > 0 ? activityLogs.map((log, index) => (
                                                    <tr key={index} className="hover:bg-[var(--color-dark-surface-lighter)] transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-medium text-white">{log.actionTaken || 'Log Entry'}</td>
                                                        <td className="px-6 py-4">{log.message}</td>
                                                        <td className="px-6 py-4 font-mono text-xs">{log.ipAddress}</td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                                                            No recent activity logs found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>

            {/* Edit Profile Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-dark-surface)] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-[var(--color-border)] max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                            <h3 className="text-white text-xl font-bold">Edit Profile</h3>
                            <button onClick={() => setIsEditing(false)} className="text-[var(--color-text-muted)] hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-[var(--color-text-muted)] text-sm mb-1">Full Name</label>
                                <input
                                    className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[var(--color-text-muted)] text-sm mb-1">Department</label>
                                    <input
                                        className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="Department"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[var(--color-text-muted)] text-sm mb-1">Position</label>
                                    <input
                                        className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        placeholder="Job Title"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[var(--color-text-muted)] text-sm mb-1">Email</label>
                                <input
                                    className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="Enter email address"
                                />
                            </div>
                            <div>
                                <label className="block text-[var(--color-text-muted)] text-sm mb-1">Phone Number</label>
                                <input
                                    className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)]"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    placeholder="Phone number"
                                />
                            </div>
                            <div>
                                <label className="block text-[var(--color-text-muted)] text-sm mb-1">Bio</label>
                                <textarea
                                    className="w-full bg-[var(--color-dark-bg)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--color-primary)] min-h-[100px] resize-none"
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    placeholder="Tell us about yourself..."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-3 bg-[var(--color-dark-bg)]/50">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 rounded-lg text-[var(--color-text-muted)] hover:text-white font-medium hover:bg-[var(--color-dark-surface-lighter)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                className="px-6 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold shadow-lg shadow-blue-500/20 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Face Registration Modal */}
            <FaceRegistrationModal
                visible={isFaceModalOpen}
                onCancel={() => setIsFaceModalOpen(false)}
                userId={user.id || null}
                userName={user.fullName || user.username}
            />
        </div>
    );
}
