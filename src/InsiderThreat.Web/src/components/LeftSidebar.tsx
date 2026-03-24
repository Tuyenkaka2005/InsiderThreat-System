import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import styles from './LeftSidebar.module.css';

export default function LeftSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const { t } = useTranslation();
    const isDark = theme === 'dark';

    const user = authService.getCurrentUser();
    // Admin detection: check role (case-insensitive) or if username is 'admin'
    const isAdmin = user?.role?.toLowerCase().includes('admin') ||
        user?.username?.toLowerCase() === 'admin';

    const navItems = [
        ...(isAdmin ? [{ icon: 'monitoring', label: t('nav.admin_dashboard', 'Dashboard'), path: '/dashboard' }] : []),
        { icon: 'dynamic_feed', label: t('nav.feed', 'Bảng tin'), path: '/feed' },
        { icon: 'people', label: t('nav.staff', 'Nhân sự'), path: '/staff' },
        { icon: 'folder_shared', label: t('nav.library', 'Kho tài liệu'), path: '/library' },
        { icon: 'groups', label: t('nav.groups', 'Nhóm'), path: '/groups' },
        { icon: 'videocam', label: t('nav.meet', 'Họp trực tuyến'), path: '/meet' },
        { icon: 'event_available', label: t('nav.attendance', 'Chấm công'), path: '/attendance', special: true },
        { icon: 'person', label: t('nav.profile', 'Cá nhân'), path: '/profile' },
    ];

    const handleLogout = () => {
        Modal.confirm({
            title: t('nav.logout_confirm_title', 'Xác nhận Đăng xuất'),
            content: t('nav.logout_confirm_desc', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?'),
            okText: t('nav.logout_confirm_ok', 'Đăng xuất'),
            cancelText: t('nav.logout_confirm_cancel', 'Hủy'),
            okButtonProps: { danger: true },
            onOk: () => {
                authService.logout();
                navigate('/login');
            }
        });
    };

    return (
        <aside className={styles.sidebar}>
            {/* Nav */}
            <nav className={styles.nav}>
                {navItems.map(item => {
                    const isActive = location.pathname === item.path ||
                        (item.path === '/feed' && location.pathname === '/');
                    return (
                        <button
                            key={item.path}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            onClick={async () => {
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
                            }}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                                <span className={styles.navLabel}>{item.label}</span>
                        </button>
                    );
                })}

                {/* Theme Toggle */}
                <div 
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0px 12px',
                        borderRadius: '10px', background: 'transparent',
                        color: isDark ? '#cbd5e1' : '#475569', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'Inter, sans-serif', width: '100%', marginTop: 'auto', marginBottom: '8px'
                    }}
                >
                    <span>{isDark ? t('nav.theme_dark') : t('nav.theme_light')}</span>
                    <div style={{ transform: 'scale(0.65)', transformOrigin: 'right center', display: 'flex' }}>
                        <ThemeToggle />
                    </div>
                </div>

                {/* Language Toggle */}
                <div 
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0px 12px',
                        borderRadius: '10px', background: 'transparent',
                        color: isDark ? '#cbd5e1' : '#475569', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'Inter, sans-serif', width: '100%', marginBottom: '16px'
                    }}
                >
                    <span>{t('nav.language', 'Ngôn ngữ')} / Lang</span>
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'right center', display: 'flex' }}>
                        <LanguageToggle />
                    </div>
                </div>
            </nav>

            {/* Logout */}
            <button className={styles.logoutBtn} onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>{t('nav.logout', 'Đăng xuất')}</span>
            </button>
        </aside>
    );
}
