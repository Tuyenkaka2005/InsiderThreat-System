import { useNavigate, useLocation } from 'react-router-dom';
import styles from './BottomNavigation.module.css';

interface NavItem {
    icon: string;
    label: string;
    path?: string;
    key?: string;
    onClick?: () => void;
}

interface BottomNavigationProps {
    items?: NavItem[];
    activeKey?: string;
}

export default function BottomNavigation({ items, activeKey }: BottomNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const defaultItems: NavItem[] = [
        { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
        { icon: 'newspaper', label: 'Bảng tin', path: '/feed' },
        { icon: 'group', label: 'Nhân sự', path: '/staff' },
        { icon: 'folder', label: 'Kho tài liệu', path: '/library' },
        { icon: 'person', label: 'Cá nhân', path: '/profile' },
    ];

    const displayItems = items || defaultItems;

    const isItemActive = (item: NavItem) => {
        if (activeKey && item.key) return activeKey === item.key;
        if (item.path) return location.pathname === item.path;
        return false;
    };

    return (
        <nav className={`${styles.bottomNav} ${items ? styles.dashboardBottomNav : ''}`}>
            {displayItems.map((item, index) => (
                <button
                    key={index}
                    className={`${styles.navItem} ${isItemActive(item) ? styles.active : ''}`}
                    onClick={() => {
                        if (item.onClick) item.onClick();
                        else if (item.path) navigate(item.path);
                    }}
                >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
