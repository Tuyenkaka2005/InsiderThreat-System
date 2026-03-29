import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import api, { API_BASE_URL } from '../services/api';
import SearchBar from './SearchBar';
import type { Notification } from '../services/notificationService';
import styles from './NavigationBar.module.css';

interface NavigationBarProps {
    onChatClick?: () => void;
}

export default function NavigationBar({ onChatClick }: NavigationBarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = authService.getCurrentUser();

    const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const avatarRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
                setShowAvatarDropdown(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const notifs = await api.get<Notification[]>('/api/notifications');
                setNotifications(notifs);
                setUnreadCount(notifs.length);
            } catch (error) {
                console.error('Failed to fetch notifications', error);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    const getAvatarUrl = () => {
        if (!user?.avatarUrl) return `https://i.pravatar.cc/150?u=${user?.username || 'user'}`;
        if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
        return `${API_BASE_URL}${user.avatarUrl}`;
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            authService.logout();
            navigate('/login');
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (notification.link) {
            navigate(notification.link);
        }
        setShowNotifications(false);
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className={styles.navbar}>
            <div className={styles.leftSection}>
                {/* Logo */}
                <div className={styles.logo} onClick={() => navigate('/feed')}>
                    <div className={styles.logoIcon}>
                        <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>hub</span>
                    </div>
                    <span className={styles.logoText}>SocialNet</span>
                </div>
            </div>

            {/* Search Bar */}
            <div className={styles.searchContainer}>
                <SearchBar />
            </div>

            {/* Right Section */}
            <div className={styles.rightSection}>
                {/* Feed Link */}
                <button
                    className={`${styles.iconButton} ${isActive('/feed') ? styles.active : ''}`}
                    onClick={() => navigate('/feed')}
                    title="Feed"
                >
                    <span className="material-symbols-outlined">home</span>
                </button>

                {/* Chat Link */}
                <button
                    className={styles.iconButton}
                    onClick={onChatClick || (() => navigate('/chat'))}
                    title="Chat"
                >
                    <span className="material-symbols-outlined">chat</span>
                </button>

                {/* Notifications */}
                <div style={{ position: 'relative' }} ref={notificationRef}>
                    <button
                        className={styles.iconButton}
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <span className="material-symbols-outlined">notifications</span>
                        {unreadCount > 0 && <span className={styles.badge}></span>}
                    </button>

                    {showNotifications && (
                        <div className={styles.notificationDropdown}>
                            <div className={styles.notificationHeader}>
                                Notifications
                            </div>
                            {notifications.length > 0 ? (
                                notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={styles.notificationItem}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className={styles.notificationMessage}>
                                            {notif.message}
                                        </div>
                                        <div className={styles.notificationMeta}>
                                            {notif.actorName && `${notif.actorName} • `}
                                            {new Date(notif.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyNotifications}>
                                    No new notifications
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Avatar with Dropdown */}
                <div className={styles.avatarContainer} ref={avatarRef}>
                    <div
                        className={styles.avatar}
                        style={{ backgroundImage: `url(${getAvatarUrl()})` }}
                        onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                    />

                    {showAvatarDropdown && (
                        <div className={styles.dropdownMenu}>
                            <div className={styles.dropdownHeader}>
                                <div className={styles.dropdownUserName}>
                                    {user?.fullName || user?.username}
                                </div>
                                <div className={styles.dropdownUserEmail}>
                                    {user?.email || user?.username}
                                </div>
                            </div>

                            <button
                                className={styles.dropdownItem}
                                onClick={() => {
                                    navigate('/profile');
                                    setShowAvatarDropdown(false);
                                }}
                            >
                                <span className="material-symbols-outlined">person</span>
                                <span>Profile</span>
                            </button>

                            {user?.role === 'Admin' && (
                                <button
                                    className={styles.dropdownItem}
                                    onClick={() => {
                                        navigate('/dashboard');
                                        setShowAvatarDropdown(false);
                                    }}
                                >
                                    <span className="material-symbols-outlined">admin_panel_settings</span>
                                    <span>Admin Dashboard</span>
                                </button>
                            )}

                            <button
                                className={`${styles.dropdownItem} ${styles.danger}`}
                                onClick={handleLogout}
                            >
                                <span className="material-symbols-outlined">logout</span>
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
