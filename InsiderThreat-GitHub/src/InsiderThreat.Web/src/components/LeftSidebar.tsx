import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import styles from './LeftSidebar.module.css';

export default function LeftSidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: 'dynamic_feed', label: 'Bảng tin', path: '/feed' },
        { icon: 'people', label: 'Nhân sự', path: '/staff' },
        { icon: 'groups', label: 'Nhóm', path: '/groups' },
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
                            onClick={() => navigate(item.path)}
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
