import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { API_BASE_URL } from '../services/api';
import type { User } from '../types';
import './StaffPage.css';

function getInitials(name: string) {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// Vibrant colors for initials avatars
const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
    '#0891b2', '#d97706', '#dc2626', '#65a30d', '#9333ea'
];
function getColor(name: string) {
    let h = 0; for (const c of name) h = (h + c.charCodeAt(0)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[h];
}

export default function StaffPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        userService.getAllUsers()
            .then(data => setUsers(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const getAvatarUrl = (user: User) => {
        if (!user.avatarUrl) return '';
        if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
        return `${API_BASE_URL}${user.avatarUrl}`;
    };

    const filtered = users.filter(u =>
        u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.department?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="staffPage">
            {/* Header */}
            <div className="staffHeader">
                <div>
                    <h1 className="staffTitle">NHÂN SỰ</h1>
                    <p className="staffSubtitle">Mạng lưới kết nối nội bộ nexuswork</p>
                </div>
                <div className="memberBadge">
                    <span>QUY MÔ</span>
                    <span className="count">{users.length}</span>
                    <span>THÀNH VIÊN</span>
                </div>
            </div>

            {/* Search Row */}
            <div className="staffSearchRow">
                <div className="staffSearchWrapper">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        className="staffSearchInput"
                        placeholder="Tìm theo tên, email, vị trí..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="filterBtn" onClick={() => setSearch('')}>TẤT CẢ</button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="emptyState">
                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>person_search</span>
                    <span>Đang tải...</span>
                </div>
            ) : (
                <div className="staffGrid">
                    {filtered.map(user => {
                        const avatarUrl = getAvatarUrl(user);
                        const name = user.fullName || user.username || 'User';
                        return (
                            <div key={user.id || user.username} className="staffCard">
                                {/* Avatar */}
                                <div
                                    className="cardAvatar"
                                    style={avatarUrl
                                        ? { backgroundImage: `url(${avatarUrl})` }
                                        : { background: getColor(name) }
                                    }
                                >
                                    {!avatarUrl && <span>{getInitials(name)}</span>}
                                    <div className="onlineDot" />
                                </div>

                                <div className="cardName" title={name}>
                                    {name.length > 16 ? name.slice(0, 15) + '…' : name}
                                </div>
                                <div className="cardRole">{user.role === 'Admin' ? 'Quản trị' : 'Nhân sự'}</div>

                                {user.department && (
                                    <div className="cardDept">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>business</span>
                                        {user.department}
                                    </div>
                                )}

                                {user.email && (
                                    <div className="cardEmail" title={user.email}>{user.email}</div>
                                )}

                                <div className="cardActions">
                                    <button
                                        className="btnChat"
                                        onClick={() => navigate(`/chat?userId=${user.id}`)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chat</span>
                                        CHAT
                                    </button>
                                    <button
                                        className="btnProfile"
                                        onClick={() => navigate(`/profile/${user.id}`)}
                                    >
                                        Hồ sơ
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="emptyState">
                            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>search_off</span>
                            <span>Không tìm thấy nhân sự phù hợp</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
