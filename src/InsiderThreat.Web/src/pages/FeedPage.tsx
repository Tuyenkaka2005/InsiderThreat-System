import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import type { User } from '../types';
import './FeedPage.css';

// Mock Data
const STORIES = [
    { name: 'Your Story', avatar: 'https://i.pravatar.cc/150?u=my-story', isYours: true },
    { name: 'Alex Chen', avatar: 'https://i.pravatar.cc/150?u=alex', isYours: false },
    { name: 'Maria Garcia', avatar: 'https://i.pravatar.cc/150?u=maria', isYours: false },
    { name: 'Thomas Read', avatar: 'https://i.pravatar.cc/150?u=thomas', isYours: false },
    { name: 'Jessica Miles', avatar: 'https://i.pravatar.cc/150?u=jessica', isYours: false },
];

const POSTS = [
    {
        id: 1,
        author: { name: 'Thomas Read', avatar: 'https://i.pravatar.cc/150?u=thomas', timeAgo: '2 hours ago' },
        content: "Just finished a massive hike through the Dolomites! The views were absolutely breathtaking. Can't wait to go back next summer. 🏔️☀️ #Hiking #Travel #Nature",
        image: 'https://images.unsplash.com/photo-1597434429739-2574d7e06807?w=1080&h=720&fit=crop',
        likes: '1.2k',
        comments: '45',
        shares: '12'
    },
    {
        id: 2,
        author: { name: 'Jessica Miles', avatar: 'https://i.pravatar.cc/150?u=jessica', timeAgo: '5 hours ago' },
        content: "Working on a new design system for our upcoming product launch. It's challenging but so rewarding to see all the pieces come together! 🎨✨",
        likes: '342',
        comments: '18'
    }
];





export default function FeedPage() {
    const navigate = useNavigate();
    const user = authService.getCurrentUser();
    const [activeChatUser, setActiveChatUser] = useState<any | null>(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [contacts, setContacts] = useState<User[]>([]);

    useEffect(() => {
        if (!user) {
            // navigate('/login'); 
        }

        const fetchContacts = async () => {
            try {
                const users = await userService.getAllUsers();
                const otherUsers = users.filter(u => u.username !== user?.username);
                setContacts(otherUsers);
            } catch (error) {
                console.error("Failed to fetch contacts", error);
            }
        };
        fetchContacts();

        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [user, navigate]);

    const toggleMobileMenu = () => setShowMobileMenu(!showMobileMenu);

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    return (
        <div className="feed-page-container">
            {/* 1. Header */}
            <header className="feed-header">
                <div className="logo-section">
                    <div className="logo-icon">
                        <span className="material-symbols-outlined">hub</span>
                    </div>
                    <span className="logo-text">SocialNet</span>
                </div>

                <div className="header-search">
                    <div className="search-input-wrapper">
                        <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>search</span>
                        <input className="search-input" placeholder="Search for friends, posts or videos..." />
                    </div>
                </div>

                <div className="header-right">
                    <button className="header-icon-btn">
                        <span className="material-symbols-outlined">search</span>
                    </button>
                    <button className="header-icon-btn">
                        <span className="material-symbols-outlined">notifications</span>
                        <span className="notification-badge"></span>
                    </button>
                    <button className="header-icon-btn" onClick={() => navigate('/chat')}>
                        <span className="material-symbols-outlined">chat_bubble</span>
                    </button>
                    <div className="user-avatar" onClick={() => navigate('/profile')} style={{ backgroundImage: `url(https://i.pravatar.cc/150?u=${user?.username || 'me'})` }}></div>
                </div>
            </header>

            {/* 2. Main Grid */}
            <div className="main-wrapper">

                {/* Left Sidebar */}
                <aside className="left-sidebar">
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <a href="#" className="nav-link active">
                            <span className="material-symbols-outlined">home</span>
                            <span>Feed</span>
                        </a>
                        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>
                            <span className="material-symbols-outlined">person</span>
                            <span>Profile</span>
                        </a>
                        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/chat'); }}>
                            <span className="material-symbols-outlined">chat</span>
                            <span>Chat</span>
                        </a>
                        <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                            <span className="material-symbols-outlined">video_call</span>
                            <span>Join Meeting</span>
                        </button>
                        {user?.role === 'Admin' && (
                            <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                                <span className="material-symbols-outlined">add_box</span>
                                <span>Create Meeting</span>
                            </button>
                        )}
                        <a href="#" className="nav-link">
                            <span className="material-symbols-outlined">shield</span>
                            <span>Privacy</span>
                        </a>
                        <button className="nav-link" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', marginTop: 'auto' }}>
                            <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>logout</span>
                            <span style={{ color: '#ef4444' }}>Logout</span>
                        </button>
                    </nav>

                    <div style={{ marginTop: 32 }}>
                        <h3 className="shortcuts-title">Shortcuts</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <a href="#" className="nav-link">
                                <span className="material-symbols-outlined" style={{ color: '#c084fc' }}>groups</span>
                                <span>Design Community</span>
                            </a>
                            <a href="#" className="nav-link">
                                <span className="material-symbols-outlined" style={{ color: '#4ade80' }}>event</span>
                                <span>Events</span>
                            </a>
                            <a href="#" className="nav-link">
                                <span className="material-symbols-outlined" style={{ color: '#60a5fa' }}>bookmark</span>
                                <span>Saved Posts</span>
                            </a>
                        </div>
                    </div>
                </aside>

                {/* Main Feed Content */}
                <main className="feed-content">
                    {/* Stories */}
                    {/* Included effectively as a horizontal scroll or simplified here */}

                    {/* Create Post */}
                    <div className="create-post">
                        <div className="create-post-top">
                            <div className="user-avatar" style={{ backgroundImage: `url(https://i.pravatar.cc/150?u=${user?.username || 'me'})`, width: 40, height: 40, minWidth: 40 }}></div>
                            <input className="create-post-input" placeholder={`What's on your mind, ${user?.fullName?.split(' ')[0] || 'User'}?`} />
                        </div>
                        <div className="create-post-actions">
                            <button className="action-chip">
                                <span className="material-symbols-outlined" style={{ color: '#f87171' }}>videocam</span>
                                Live Video
                            </button>
                            <button className="action-chip">
                                <span className="material-symbols-outlined" style={{ color: '#4ade80' }}>photo_library</span>
                                Photo/Video
                            </button>
                            <button className="action-chip">
                                <span className="material-symbols-outlined" style={{ color: '#facc15' }}>sentiment_satisfied</span>
                                Feeling/Activity
                            </button>
                        </div>
                    </div>

                    {/* Posts */}
                    {POSTS.map(post => (
                        <article key={post.id} className="post-card">
                            <div className="post-header">
                                <div className="post-user">
                                    <div className="user-avatar" style={{ backgroundImage: `url(${post.author.avatar})` }}></div>
                                    <div className="post-user-info">
                                        <h4>{post.author.name}</h4>
                                        <div className="post-meta">
                                            {post.author.timeAgo} • <span className="material-symbols-outlined" style={{ fontSize: 14 }}>public</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="post-action-btn" style={{ width: 'auto' }}>
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>

                            <div className="post-content-text">
                                {post.content}
                            </div>

                            {post.image && (
                                <div className="post-image" style={{ backgroundImage: `url(${post.image})` }}></div>
                            )}

                            <div className="post-stats">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ display: 'flex', marginLeft: 4 }}>
                                        <div className="logo-icon" style={{ width: 16, height: 16, background: '#3b82f6', borderRadius: '50%' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 10, color: 'white' }}>thumb_up</span>
                                        </div>
                                    </div>
                                    <span>{post.likes}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <span>{post.comments} Comments</span>
                                    {post.shares && <span>{post.shares} Shares</span>}
                                </div>
                            </div>

                            <div className="post-actions-bar">
                                <button className="post-action-btn">
                                    <span className="material-symbols-outlined">thumb_up</span> Like
                                </button>
                                <button className="post-action-btn">
                                    <span className="material-symbols-outlined">chat_bubble</span> Comment
                                </button>
                                <button className="post-action-btn">
                                    <span className="material-symbols-outlined">share</span> Share
                                </button>
                            </div>
                        </article>
                    ))}
                </main>

                {/* Right Sidebar */}
                <aside className="right-sidebar">


                    <div className="widget">
                        <div className="widget-title">
                            <h3>Contacts</h3>
                            <button className="add-user-btn" style={{ padding: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {contacts.map((c) => (
                                <div key={c.id || c.username} className="user-row" style={{ marginBottom: 0, justifyContent: 'flex-start', gap: 12, cursor: 'pointer' }} onClick={() => setActiveChatUser(c)}>
                                    <div style={{ position: 'relative' }}>
                                        <div className="user-avatar" style={{ backgroundImage: `url(https://i.pravatar.cc/150?u=${c.username})`, width: 32, height: 32 }}></div>
                                        {/* Mocking online status for now as boolean isn't on User type usually */}
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#22c55e', borderRadius: '50%', border: '2px solid #1e2126' }}></div>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#d1d5db' }}>{c.fullName || c.username}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Floating Action Button (Mobile) */}
            {isMobile && !showMobileMenu && (
                <button
                    onClick={toggleMobileMenu}
                    style={{
                        position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2563eb, #9333ea)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)', zIndex: 100, cursor: 'pointer'
                    }}
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            )}

            {/* Mobile Overlay Menu */}
            {showMobileMenu && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
                    <div onClick={toggleMobileMenu} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}></div>
                    <div style={{ width: 300, background: '#1e2126', position: 'relative', height: '100%', padding: 24, borderLeft: '1px solid #374151' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 'bold', color: 'white' }}>Menu</h2>
                            <button onClick={toggleMobileMenu} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <a href="#" className="nav-link active">
                                <span className="material-symbols-outlined">home</span>
                                <span>Feed</span>
                            </a>
                            <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>
                                <span className="material-symbols-outlined">person</span>
                                <span>Profile</span>
                            </a>
                            <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                                <span className="material-symbols-outlined">video_call</span>
                                <span>Join Meeting</span>
                            </button>
                            {user?.role === 'Admin' && (
                                <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                                    <span className="material-symbols-outlined">add_box</span>
                                    <span>Create Meeting</span>
                                </button>
                            )}
                            <button className="nav-link" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', marginTop: 12, borderTop: '1px solid #374151', paddingTop: 12 }}>
                                <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>logout</span>
                                <span style={{ color: '#ef4444' }}>Logout</span>
                            </button>
                        </nav>
                    </div>
                </div>
            )}

            {/* Chat Widget */}
            {activeChatUser && (
                <div className="floating-overlay-menu">
                    <div className="overlay-header" onClick={() => setActiveChatUser(null)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                                <div className="user-avatar" style={{ backgroundImage: `url(${activeChatUser.avatar})`, width: 32, height: 32 }}></div>
                                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, background: '#22c55e', borderRadius: '50%', border: '1px solid #3b82f6' }}></div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: 0 }}>{activeChatUser.name}</h4>
                                <span style={{ fontSize: 10, opacity: 0.8 }}>Active Now</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                        </div>
                    </div>

                    <div className="overlay-body">
                        <div className="chat-bubble received">
                            Hey! Did you see the new update designs?
                        </div>
                        <div className="chat-bubble sent">
                            Yeah, looking great! I love the new dark mode palette.
                        </div>
                    </div>

                    <div className="overlay-footer">
                        <span className="material-symbols-outlined" style={{ color: '#9ca3af', cursor: 'pointer' }}>add_circle</span>
                        <input className="chat-input" placeholder="Aa" />
                        <span className="material-symbols-outlined" style={{ color: '#3b82f6', cursor: 'pointer' }}>send</span>
                    </div>
                </div>
            )}

        </div>
    );
}
