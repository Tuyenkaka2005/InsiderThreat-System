import { useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import styles from './BottomNavigation.module.css';

interface NavItem {
    icon: string;
    label: string;
    path?: string;
    key?: string;
    special?: boolean;
    onClick?: () => void;
}

interface BottomNavigationProps {
    items?: NavItem[];
    activeKey?: string;
}

export default function BottomNavigation({ items, activeKey }: BottomNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const user = authService.getCurrentUser();
    const isAdmin = user?.role?.toLowerCase().includes('admin') ||
        user?.username?.toLowerCase() === 'admin';

    const defaultItems: NavItem[] = [
        ...(isAdmin ? [{ icon: 'dashboard', label: 'Dashboard', path: '/dashboard' }] : []),
        { icon: 'newspaper', label: 'Bảng tin', path: '/feed' },
        { icon: 'group', label: 'Nhân sự', path: '/staff' },
        { icon: 'folder', label: 'Kho tài liệu', path: '/library' },
        { icon: 'videocam', label: 'Họp', path: '/meet' },
        { icon: 'event_available', label: 'Chấm công', path: '/attendance', special: true },
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
                    onClick={async () => {
                        if ((item as any).special && item.path === '/attendance') {
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
