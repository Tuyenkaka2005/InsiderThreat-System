import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { API_BASE_URL } from '../services/api';
import type { User } from '../types';
import BottomNavigation from '../components/BottomNavigation';
import LeftSidebar from '../components/LeftSidebar';
import './StaffPage.css';

function getInitials(name: string) {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
    '#0891b2', '#d97706', '#dc2626', '#65a30d', '#9333ea'
];
function getColor(name: string) {
    let h = 0; for (const c of name) h = (h + c.charCodeAt(0)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[h];
}

const DEPARTMENTS_DATA = [
    { id: 'marketing', name: 'Marketing', count: 24, icon: 'groups', color: '#3b82f6' },
    { id: 'tech', name: 'Kỹ thuật', count: 42, icon: 'code', color: '#8b5cf6' },
    { id: 'accounting', name: 'Kế toán', count: 12, icon: 'account_balance', color: '#f59e0b' },
    { id: 'hr', name: 'Nhân sự', count: 8, icon: 'badge', color: '#10b981' }
];

export default function StaffPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);

        userService.getAllUsers()
            .then(data => setUsers(data))
            .catch(() => { })
            .finally(() => setLoading(false));

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getAvatarUrl = (user: User) => {
        if (!user.avatarUrl) return '';
        if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
        return `${API_BASE_URL}${user.avatarUrl}`;
    };

    const suggestions = users.slice(0, 3);

    return (
        <div className="staffPageContainer">
            {!isMobile && <LeftSidebar />}

            <div className="staffMainWrapper">
                {/* Header */}
                <header className="staffHeaderMobile">
                    <h1 className="staffTitleMobile">Nhân sự</h1>
                    <button className="addStaffBtn">
                        <span className="material-symbols-outlined">person_add</span>
                    </button>
                </header>

                {/* Search */}
                <div className="staffSearchMobile">
                    <div className="staffSearchInputWrapper">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm đồng nghiệp..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <main className="staffMainContent">
                    {/* Suggestions Section */}
                    <section className="staffSection">
                        <div className="staffSectionHeader">
                            <h2>GỢI Ý LIÊN HỆ</h2>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </div>
                        <div className="suggestionsList">
                            {suggestions.map(user => {
                                const avatarUrl = getAvatarUrl(user);
                                const name = user.fullName || user.username || 'User';
                                return (
                                    <div key={user.id} className="suggestionItem">
                                        <div className="suggestionLeft">
                                            <div
                                                className="suggestionAvatar"
                                                style={avatarUrl
                                                    ? { backgroundImage: `url(${avatarUrl})` }
                                                    : { background: getColor(name) }
                                                }
                                            >
                                                {!avatarUrl && <span>{getInitials(name)}</span>}
                                                <div className="onlineIndicator" />
                                            </div>
                                            <div className="suggestionInfo">
                                                <h3>{name}</h3>
                                                <span className="statusText">ĐANG ONLINE</span>
                                            </div>
                                        </div>
                                        <button className="chatQuickBtn" onClick={() => navigate(`/chat?userId=${user.id}`)}>
                                            <span className="material-symbols-outlined">chat</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Departments Section */}
                    <section className="staffSection">
                        <div className="staffSectionHeader">
                            <h2>PHÒNG BAN</h2>
                        </div>
                        <div className="deptGridMobile">
                            {DEPARTMENTS_DATA.map(dept => (
                                <div key={dept.id} className="deptCardMobile">
                                    <div className="deptIconWrapper" style={{ backgroundColor: `${dept.color}15`, color: dept.color }}>
                                        <span className="material-symbols-outlined">{dept.icon}</span>
                                    </div>
                                    <div className="deptCardInfo">
                                        <h3>{dept.name}</h3>
                                        <span>{dept.count} nhân viên</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                {isMobile && <BottomNavigation />}
            </div>
        </div>
    );
}
