import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, message as antdMessage } from 'antd';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { api, API_BASE_URL } from '../services/api';
import { feedService } from '../services/feedService';
import type { User, Post } from '../types';
import PostCard from '../components/PostCard';
import BottomNavigation from '../components/BottomNavigation';
import LeftSidebar from '../components/LeftSidebar';
import FaceRegistrationModal from '../components/FaceRegistrationModal';
import './ProfilePage.css';

type TabType = 'overview' | 'security' | 'activity' | 'connections';

interface LogEntry {
    timestamp: string;
    actionTaken: string;
    message: string;
    severity: string;
    ipAddress: string;
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const { userId } = useParams<{ userId?: string }>();
    const [user, setUser] = useState<User | null>(null);
    const currentUser = useMemo(() => authService.getCurrentUser(), []);
    const [isOwnProfile, setIsOwnProfile] = useState(true);
    const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const loadProfile = async () => {
            if (!currentUser) {
                navigate('/login');
                return;
            }

            const targetUserId = userId || currentUser.id;
            const viewingOwnProfile = !userId || userId === currentUser.id;
            setIsOwnProfile(viewingOwnProfile);

            if (viewingOwnProfile) {
                setUser(currentUser);
            } else {
                try {
                    const userData = await userService.getUserById(targetUserId!);
                    setUser(userData);
                } catch (error) {
                    console.error("Error fetching user profile", error);
                }
            }

            try {
                const posts = await feedService.getUserPosts(targetUserId!);
                setUserPosts(posts);
            } catch (error) {
                console.error("Error fetching posts", error);
            }
        };

        loadProfile();
    }, [userId, currentUser, navigate]);

    const handlePostUpdated = (updatedPost: Post) => {
        setUserPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    const handlePostDeleted = (postId: string) => {
        setUserPosts(prev => prev.filter(p => p.id !== postId));
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
            const response = await api.post<{ url: string }>('/api/upload', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const avatarUrl = response.url;
            await userService.updateUser(user.id, { avatarUrl });

            const updatedUser = { ...user, avatarUrl };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            antdMessage.success('Cập nhật ảnh đại diện thành công');
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            antdMessage.error('Không thể tải lên ảnh đại diện');
        } finally {
            setIsUploading(false);
        }
    };

    if (!user) {
        return <div className="flex h-screen items-center justify-center bg-[#f8fafc] text-[#64748b]">Đang tải...</div>;
    }

    const getDisplayAvatarUrl = (url?: string) => {
        if (!url) return `https://i.pravatar.cc/150?u=${user.username}`;
        if (url.startsWith('http')) return url;
        return `${API_BASE_URL}${url}`;
    };

    const avatarUrl = getDisplayAvatarUrl(user.avatarUrl);

    return (
        <div className="profile-container">
            {!isMobile && <LeftSidebar />}

            <main className="profile-main-content">
                {/* Hero Section */}
                <section className="profile-hero">
                    <div className="profile-cover">
                        <button className="hero-dark-mode-fab">
                            <span className="material-symbols-outlined">dark_mode</span>
                        </button>
                    </div>

                    <div className="profile-hero-content">
                        <div className="hero-actions">
                            <Button className="btn-primary-mobile" onClick={() => navigate('/edit-profile')}>
                                Edit Profile
                            </Button>
                            <Button className="btn-icon-mobile">
                                <span className="material-symbols-outlined">settings</span>
                            </Button>
                        </div>

                        <div className="avatar-wrapper" onClick={isOwnProfile ? handleAvatarClick : undefined}>
                            <img src={avatarUrl} alt="Avatar" className="profile-avatar-large" />
                            <div className="status-indicator"></div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                            {isUploading && (
                                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        <div className="profile-identity">
                            <h1>
                                {user.fullName || user.username}
                                <span className="material-symbols-outlined verified-badge">verified</span>
                            </h1>
                            <p>{user.department || 'Administrator'} • {user.position || 'Security Ops'}</p>
                        </div>

                        <div className="profile-tabs-wrapper">
                            <div className="profile-tabs-mobile">
                                <button
                                    className={`profile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('overview')}
                                >Activity</button>
                                <button
                                    className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('security')}
                                >Security</button>
                                <button
                                    className={`profile-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('activity')}
                                >About</button>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="profile-content-grid">
                    {/* Left Column (Info) */}
                    <div className="flex flex-col gap-6">
                        <section className="profile-section">
                            <span className="section-label">Professional Information</span>
                            <div className="info-card-mobile">
                                <div className="info-item-mobile">
                                    <div className="info-icon-box">
                                        <span className="material-symbols-outlined">badge</span>
                                    </div>
                                    <div className="info-text-box">
                                        <label>Role</label>
                                        <span>{user.role || 'Senior Security Analyst'}</span>
                                    </div>
                                </div>
                                <div className="info-item-mobile">
                                    <div className="info-icon-box">
                                        <span className="material-symbols-outlined">apartment</span>
                                    </div>
                                    <div className="info-text-box">
                                        <label>Department</label>
                                        <span>{user.department || 'Information Security (SecOps)'}</span>
                                    </div>
                                </div>
                                <div className="info-item-mobile">
                                    <div className="info-icon-box">
                                        <span className="material-symbols-outlined">mail</span>
                                    </div>
                                    <div className="info-text-box">
                                        <label>Email</label>
                                        <span>{user.email || 'insider.threat@corporate.com'}</span>
                                    </div>
                                </div>
                                <div className="info-item-mobile">
                                    <div className="info-icon-box">
                                        <span className="material-symbols-outlined">call</span>
                                    </div>
                                    <div className="info-text-box">
                                        <label>Phone</label>
                                        <span>{user.phoneNumber || '+1 (555) 902-3412'}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="profile-section">
                            <span className="section-label">Security Settings</span>
                            <div className="info-card-mobile">
                                <div className="security-list">
                                    <div className="security-item-card">
                                        <span className="material-symbols-outlined icon-green">sentiment_satisfied</span>
                                        <span className="security-item-title">Face ID</span>
                                        <span className="status-tag verified">Verified</span>
                                    </div>
                                    <div className="security-item-card">
                                        <span className="material-symbols-outlined icon-blue">key</span>
                                        <span className="security-item-title">F2K Keys</span>
                                        <span className="status-tag unauthorized">Not Setup</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column (Feed) */}
                    <section className="profile-section">
                        <span className="section-label">Recent Activity</span>
                        <div className="mobile-activity-feed">
                            {userPosts.length === 0 ? (
                                <div className="bg-white rounded-[20px] p-8 border border-[#f1f5f9] text-center">
                                    <p className="text-[#94a3b8]">Chưa có bài đăng nào.</p>
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
                        </div>
                    </section>
                </div>

                {isMobile && (
                    <button className="floating-post-btn" onClick={() => navigate('/feed')}>
                        <span className="material-symbols-outlined">add</span>
                    </button>
                )}

                {isMobile && <BottomNavigation />}

                <FaceRegistrationModal
                    visible={isFaceModalOpen}
                    onCancel={() => setIsFaceModalOpen(false)}
                    userId={user.id || null}
                    userName={user.fullName || user.username}
                />
            </main>
        </div>
    );
}
