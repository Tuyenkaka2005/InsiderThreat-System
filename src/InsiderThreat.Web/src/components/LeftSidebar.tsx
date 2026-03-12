import { useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import styles from './LeftSidebar.module.css';

export default function LeftSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const user = authService.getCurrentUser();
    // Admin detection: check role (case-insensitive) or if username is 'admin'
    const isAdmin = user?.role?.toLowerCase().includes('admin') ||
        user?.username?.toLowerCase() === 'admin';

    const navItems = [
        ...(isAdmin ? [{ icon: 'monitoring', label: 'Dashboard', path: '/dashboard' }] : []),
        { icon: 'dynamic_feed', label: 'Bảng tin', path: '/feed' },
        { icon: 'people', label: 'Nhân sự', path: '/staff' },
        { icon: 'folder_shared', label: 'Kho tài liệu', path: '/library' },
        { icon: 'groups', label: 'Nhóm', path: '/groups' },
        { icon: 'videocam', label: 'Họp trực tuyến', path: '/meet' },
        { icon: 'event_available', label: 'Chấm công', path: '/attendance', special: true },
        { icon: 'person', label: 'Cá nhân', path: '/profile' },
    ];

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
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
                                            message.warning("Bạn phải kết nối vào mạng WiFi (IP) được chỉ định để chấm công");
                                            return;
                                        }
                                    } catch (e) {
                                        message.error("Lỗi khi kiểm tra kết nối mạng");
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
            </nav>

            {/* Logout */}
            <button className={styles.logoutBtn} onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Đăng xuất</span>
            </button>
        </aside>
    );
}
