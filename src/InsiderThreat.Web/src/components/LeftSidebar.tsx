import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Modal, Avatar } from 'antd';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import styles from './LeftSidebar.module.css';

interface LeftSidebarProps {
    defaultCollapsed?: boolean;
}

export default function LeftSidebar({ defaultCollapsed = false }: LeftSidebarProps = {}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const [user, setUser] = useState(authService.getCurrentUser());
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    useEffect(() => {
        const handleUserUpdate = (e: any) => {
            setUser(e.detail);
        };
        window.addEventListener('auth-user-updated', handleUserUpdate as EventListener);
        return () => window.removeEventListener('auth-user-updated', handleUserUpdate as EventListener);
    }, []);

    const isAdmin = user?.role?.toLowerCase().includes('admin') ||
        user?.username?.toLowerCase() === 'admin';

    const mainNavItems = [
        ...(isAdmin ? [{ icon: 'monitoring', label: t('nav.admin_dashboard', 'Dashboard'), path: '/dashboard' }] : []),
        { icon: 'dynamic_feed', label: t('nav.feed', 'Bảng tin'), path: '/feed' },
        { icon: 'mail', label: t('nav.inbox', 'Inbox'), path: '/inbox', badge: 5 },
        { icon: 'people', label: t('nav.staff', 'Nhân sự'), path: '/staff' },
        { icon: 'folder_shared', label: t('nav.library', 'Kho tài liệu'), path: '/library' },
        { icon: 'rocket_launch', label: t('nav.projects', 'Dự án'), path: '/projects' },
        { icon: 'groups', label: t('nav.groups', 'Cộng đồng'), path: '/groups' },
        { icon: 'videocam', label: t('nav.meet', 'Họp trực tuyến'), path: '/meet' },
        { icon: 'event_available', label: t('nav.attendance', 'Chấm công'), path: '/attendance', special: true },
        ...(isAdmin ? [{ icon: 'security', label: t('nav.monitor_logs', 'Agent System'), path: '/monitor-logs' }] : []),
    ];

    const favouriteItems = [
        { icon: 'list', label: 'ABC Projects - Dashboard', path: '/groups/1' },
        { icon: 'list', label: 'Kiara Projects - Website', path: '/groups/2' },
        { icon: 'list', label: 'Dribbble Shot', path: '/groups/3' },
    ];

    const handleNavigation = async (item: any) => {
        if (item.special && item.path === '/attendance') {
            try {
                const res = await attendanceService.checkCanCheckIn();
                if (!res.canCheckIn) {
                    message.warning(t('nav.attendance_warning', "Bạn phải kết nối vào mạng WiFi (IP) được chỉ định để chấm công"));
                    return;
                }
            } catch (e) {
                message.error(t('nav.attendance_error', "Lỗi khi kiểm tra kết nối mạng"));
                return;
            }
        }
        navigate(item.path);
    };

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
            
            {/* User Profile Section (Top Left) */}
            <div className={styles.userProfileSection}>
                <Avatar src={user?.avatarUrl} size={40}>{user?.fullName?.charAt(0)}</Avatar>
                {!isCollapsed && (
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{user?.fullName || 'User'}</div>
                        <div className={styles.userEmail}>{user?.username}@mail.com</div>
                    </div>
                )}
                <button className={styles.toggleCollapseBtn} onClick={() => setIsCollapsed(!isCollapsed)}>
                    <span className="material-symbols-outlined">
                        {isCollapsed ? 'menu_open' : 'view_sidebar'}
                    </span>
                </button>
            </div>

            {/* Create Project Button */}
            <div className={styles.createTaskWrapper}>
                <button className={styles.createTaskBtn} onClick={() => navigate('/projects')}>
                    <span className="material-symbols-outlined">add</span>
                    {!isCollapsed && <span>Tạo Dự Án</span>}
                </button>
            </div>

            {/* Main Navigation */}
            <nav className={styles.nav}>
                <div className={styles.navSectionScroll}>
                    {mainNavItems.map(item => {
                        const isActive = location.pathname.startsWith(item.path) ||
                            (item.path === '/feed' && location.pathname === '/');
                        return (
                            <button
                                key={item.path}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                onClick={() => handleNavigation(item)}
                            >
                                <span className={`material-symbols-outlined ${styles.navIcon}`}>{item.icon}</span>
                                {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                                {!isCollapsed && item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                            </button>
                        );
                    })}

                    {!isCollapsed && (
                        <>
                            <div className={styles.sectionHeader}>
                                <span><span className="material-symbols-outlined" style={{fontSize: 14}}>expand_less</span> Favourite</span>
                                <span className="material-symbols-outlined" style={{fontSize: 16, cursor: 'pointer'}}>add</span>
                            </div>
                            {favouriteItems.map(item => (
                                <button
                                    key={item.path}
                                    className={`${styles.navItem} ${styles.favouriteItem}`}
                                    onClick={() => handleNavigation(item)}
                                >
                                    <span className={`material-symbols-outlined ${styles.navIcon}`}>{item.icon}</span>
                                    <span className={styles.navLabel}>{item.label}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </nav>

            {/* Settings & Help Center & Logout */}
            <div className={styles.sidebarFooter}>
                <div className={styles.settingsRow}>
                    <div className={styles.settingsItem}>
                        <ThemeToggle />
                        {!isCollapsed && <span className={styles.settingsLabel}>{t('nav.theme', 'Giao diện')}</span>}
                    </div>
                    <div className={styles.settingsItem}>
                        <LanguageToggle />
                        {!isCollapsed && <span className={styles.settingsLabel}>{t('nav.language', 'Ngôn ngữ')}</span>}
                    </div>
                </div>

                <div className={styles.footerActions}>
                    <button className={styles.footerBtn}>
                        {!isCollapsed && <span>Help Center</span>}
                        <span className="material-symbols-outlined">help</span>
                    </button>
                    <button 
                        className={`${styles.footerBtn} ${styles.logoutBtn}`}
                        onClick={() => {
                            if (window.confirm(t('nav.logout_confirm', 'Bạn có chắc chắn muốn đăng xuất?'))) {
                                authService.logout();
                                navigate('/login');
                            }
                        }}
                    >
                        {!isCollapsed && <span>{t('nav.logout', 'Đăng xuất')}</span>}
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
