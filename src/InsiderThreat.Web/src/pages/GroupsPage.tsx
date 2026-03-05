import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import './GroupsPage.css';

interface Group {
    id: string;
    name: string;
    members: number;
    description: string;
    privacy: 'PRIVATE' | 'PUBLIC';
    category: string;
    coverImage?: string;
}

const MOCK_GROUPS: Group[] = [
    {
        id: '1',
        name: 'Phòng Phát Triển Sản Phẩm',
        members: 55,
        description: 'Nơi thảo luận về chiến lược sản phẩm và đổi mới sáng tạo.',
        privacy: 'PRIVATE',
        category: 'Phòng ban',
        coverImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop',
    },
    {
        id: '2',
        name: 'Hội Những Người Thích Cà Phê',
        members: 120,
        description: 'Chia sẻ các loại cà phê ngon, địa điểm thú vị và mẹo pha chế.',
        privacy: 'PUBLIC',
        category: 'Sở thích',
        coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=200&fit=crop',
    },
    {
        id: '3',
        name: 'Kỹ thuật & Công nghệ',
        members: 88,
        description: 'Chia sẻ kiến thức kỹ thuật, debug tips và best practices.',
        privacy: 'PUBLIC',
        category: 'Chuyên môn',
        coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=200&fit=crop',
    },
    {
        id: '4',
        name: 'HR & Văn hóa doanh nghiệp',
        members: 32,
        description: 'Cập nhật chính sách, hoạt động nội bộ và văn hóa công ty.',
        privacy: 'PRIVATE',
        category: 'Phòng ban',
        coverImage: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop',
    },
];

export default function GroupsPage() {
    const navigate = useNavigate();
    const [groups] = useState<Group[]>(MOCK_GROUPS);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', privacy: 'PUBLIC' });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="groupsPage-container">
            {!isMobile && <LeftSidebar />}

            <div className="groupsPage-main-wrapper">
                <div className="groupsPage">
                    {/* Header */}
                    <div className="groupsHeader">
                        <div>
                            <h1 className="groupsTitle">Cộng đồng</h1>
                            <p className="groupsSubtitle">Khám phá và kết nối với các đồng nghiệp cùng sở thích.</p>
                        </div>
                        <button className="createGroupBtn" onClick={() => setShowCreate(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>group_add</span>
                            TẠO NHÓM MỚI
                        </button>
                    </div>

                    {/* "Your Groups" Section */}
                    <div className="sectionTitle">Nhóm của bạn</div>
                    <div className="groupsGrid">
                        {groups.map(group => (
                            <div key={group.id} className="groupCard">
                                <div className="groupCoverWrap">
                                    {group.coverImage ? (
                                        <img src={group.coverImage} alt={group.name} className="groupCoverImg" />
                                    ) : (
                                        <div className="groupCoverPlaceholder">
                                            <span className="material-symbols-outlined">groups</span>
                                        </div>
                                    )}
                                    <span className={`privacyBadge ${group.privacy === 'PRIVATE' ? 'badgePrivate' : 'badgePublic'}`}>
                                        {group.privacy}
                                    </span>
                                </div>
                                <div className="groupBody">
                                    <div className="groupName">{group.name}</div>
                                    <div className="groupMeta">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                                        {group.members} THÀNH VIÊN
                                        {group.category && <> • {group.category}</>}
                                    </div>
                                    <div className="groupDesc">{group.description}</div>
                                    <button className="accessBtn" onClick={() => navigate(`/groups/${group.id}`)}>
                                        TRUY CẬP
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Create Group Modal */}
                    {showCreate && (
                        <div className="modalBackdrop" onClick={() => setShowCreate(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()}>
                                <h3 className="modalTitle">Tạo nhóm mới</h3>
                                <div className="formRow">
                                    <label className="formLabel">Tên nhóm</label>
                                    <input
                                        className="formInput"
                                        placeholder="Nhập tên nhóm..."
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                                <div className="formRow">
                                    <label className="formLabel">Mô tả</label>
                                    <textarea
                                        className="formTextarea"
                                        placeholder="Mô tả ngắn về nhóm..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>
                                <div className="formRow">
                                    <label className="formLabel">Quyền riêng tư</label>
                                    <select
                                        className="formInput"
                                        value={form.privacy}
                                        onChange={e => setForm({ ...form, privacy: e.target.value })}
                                    >
                                        <option value="PUBLIC">Công khai</option>
                                        <option value="PRIVATE">Riêng tư</option>
                                    </select>
                                </div>
                                <div className="modalActions">
                                    <button className="btnCancel" onClick={() => setShowCreate(false)}>Hủy</button>
                                    <button className="btnCreate" onClick={() => setShowCreate(false)}>Tạo nhóm</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <BottomNavigation />
        </div>
    );
}
