import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import { userService } from '../services/userService';
import { api, API_BASE_URL } from '../services/api';
import type { User } from '../types';
import './ProjectsPage.css';

interface Project {
    id: string;
    name: string;
    members: number;
    description: string;
    privacy: 'PRIVATE' | 'PUBLIC';
    category: string;
    coverImage?: string;
}

export default function ProjectsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    // Hooks for UI state
    const [projects, setProjects] = useState<Project[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ 
        name: '', description: '', privacy: 'Public', 
        startDate: '', endDate: '', members: [] as User[] 
    });
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (showCreate) {
            userService.getAllUsers().then(setAllUsers).catch(console.error);
        }
    }, [showCreate]);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const fetchedProjects = await api.get<any[]>('/api/groups?isProject=true');
                const realProjects = fetchedProjects.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    members: p.memberIds?.length || 1,
                    category: 'Dự án',
                    privacy: (p.privacy || 'PUBLIC').toUpperCase() as 'PUBLIC' | 'PRIVATE',
                    coverImage: p.coverUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop'
                }));
                setProjects(realProjects);
            } catch (err) {
                console.error("Failed to fetch projects", err);
            }
        };
        loadProjects();
    }, []);

    const handleAccessProject = (projectId: string) => {
        navigate(`/projects/${projectId}`);
    };

    const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        const confirmDelete = window.confirm(`Bạn có chắc muốn xóa dự án ${project.name}?`);
        if (!confirmDelete) return;

        try {
            await api.delete(`/api/groups/${project.id}`);
            setProjects(projects.filter(p => p.id !== project.id));
        } catch (err) {
            console.error('Failed to delete project', err);
            alert('Xóa dự án thất bại.');
        }
    };

    const filteredUsers = searchUserQuery 
        ? allUsers.filter(u => 
            (u.fullName?.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
             u.username.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
             u.email?.toLowerCase().includes(searchUserQuery.toLowerCase())) &&
            !form.members.find(m => m.id === u.id)
          ).slice(0, 5)
        : [];

    const getAvatarUrl = (user: User) => {
        if (!user.avatarUrl) return `https://ui-avatars.com/api/?name=${user.username}`;
        if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
        return `${API_BASE_URL}${user.avatarUrl}`;
    };

    return (
        <div className="groupsPage-container">
            {!isMobile && <LeftSidebar />}

            <div className="groupsPage-main-wrapper">
                <div className="groupsPage">
                    {/* Header */}
                    <div className="groupsHeader">
                        <div>
                            <h1 className="groupsTitle">Dự án</h1>
                            <p className="groupsSubtitle">Quản lý và theo dõi tiến độ công việc theo từng dự án lớn.</p>
                        </div>
                        <button className="createGroupBtn" onClick={() => setShowCreate(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
                            TẠO DỰ ÁN MỚI
                        </button>
                    </div>

                    {/* "Your Projects" Section */}
                    <div className="sectionTitle">Dự án của bạn ({projects.length})</div>
                    <div className="groupsGrid">
                        {projects.map(project => (
                            <div key={project.id} className="groupCard">
                                <div className="groupCoverWrap">
                                    {project.coverImage ? (
                                        <img src={project.coverImage} alt={project.name} className="groupCoverImg" />
                                    ) : (
                                        <div className="groupCoverPlaceholder">
                                            <span className="material-symbols-outlined">rocket_launch</span>
                                        </div>
                                    )}
                                    <span className={`privacyBadge ${project.privacy === 'PRIVATE' ? 'badgePrivate' : 'badgePublic'}`}>
                                        {project.privacy}
                                    </span>
                                    <button 
                                        className="deleteGroupBtn" 
                                        onClick={(e) => handleDeleteProject(e, project)}
                                        title="Xóa dự án"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                    </button>
                                </div>
                                <div className="groupBody">
                                    <div className="groupName">{project.name}</div>
                                    <div className="groupMeta">
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                                        {project.members} THÀNH VIÊN
                                        {project.category && <> • {project.category}</>}
                                    </div>
                                    <div className="groupDesc">{project.description}</div>
                                    <button className="accessBtn" onClick={() => handleAccessProject(project.id)}>
                                        TRUY CẬP
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Create Project Modal */}
                    {showCreate && (
                        <div className="modalBackdrop" onClick={() => setShowCreate(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()}>
                                <h3 className="modalTitle">Tạo dự án mới</h3>
                                <div className="formRow">
                                    <label className="formLabel">Tên dự án</label>
                                    <input
                                        className="formInput"
                                        placeholder="Nhập tên dự án..."
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                                <div className="formRow">
                                    <label className="formLabel">Mô tả</label>
                                    <textarea
                                        className="formTextarea"
                                        placeholder="Khái quát thông tin dự án..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>
                                
                                <div className="formRowGroup">
                                    <div className="formRow">
                                        <label className="formLabel">Thời gian bắt đầu</label>
                                        <input
                                            type="date"
                                            className="formInput"
                                            value={form.startDate}
                                            onChange={e => setForm({ ...form, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="formRow">
                                        <label className="formLabel">Thời gian kết thúc</label>
                                        <input
                                            type="date"
                                            className="formInput"
                                            value={form.endDate}
                                            onChange={e => setForm({ ...form, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="formRow">
                                    <label className="formLabel">Thêm thành viên</label>
                                    <div className="membersInputWrap" style={{ position: 'relative' }}>
                                        <input
                                            className="formInput"
                                            placeholder="Tìm theo tên hoặc email..."
                                            value={searchUserQuery}
                                            onChange={e => setSearchUserQuery(e.target.value)}
                                        />
                                        <button className="addMemberBtn"><span className="material-symbols-outlined">search</span></button>
                                        
                                        {/* Dropdown for search results */}
                                        {filteredUsers.length > 0 && (
                                            <div className="userSearchResults">
                                                {filteredUsers.map(user => (
                                                    <div 
                                                        key={user.id} 
                                                        className="userResultItem"
                                                        onClick={() => {
                                                            setForm({ ...form, members: [...form.members, user] });
                                                            setSearchUserQuery('');
                                                        }}
                                                    >
                                                        <img src={getAvatarUrl(user)} alt="Avatar" />
                                                        <div className="userInfoBlock">
                                                            <div className="uName">{user.fullName || user.username}</div>
                                                            <div className="uEmail">{user.email || `@${user.username}`}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="selectedMembers">
                                        {form.members.map(member => (
                                            <span key={member.id} className="memberTag">
                                                <img src={getAvatarUrl(member)} alt="Avatar" />
                                                {member.fullName || member.username}
                                                <button 
                                                    className="removeTag"
                                                    onClick={() => setForm({ ...form, members: form.members.filter(m => m.id !== member.id) })}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="formRow">
                                    <label className="formLabel">Quyền riêng tư</label>
                                    <select
                                        className="formInput"
                                        value={form.privacy}
                                        onChange={e => setForm({ ...form, privacy: e.target.value })}
                                    >
                                        <option value="Public">Công khai</option>
                                        <option value="Private">Riêng tư</option>
                                    </select>
                                </div>
                                <div className="modalActions">
                                    <button className="btnCancel" onClick={() => setShowCreate(false)}>Hủy</button>
                                    <button 
                                        className="btnCreate" 
                                        onClick={async () => {
                                            if (!form.name.trim()) {
                                                alert('Vui lòng nhập tên dự án!');
                                                return;
                                            }
                                            
                                            try {
                                                const projectData = {
                                                    name: form.name,
                                                    description: form.description || 'Dự án mới',
                                                    type: 'Project',
                                                    isProject: true,
                                                    privacy: form.privacy,
                                                    projectStartDate: form.startDate ? new Date(form.startDate).toISOString() : null,
                                                    projectEndDate: form.endDate ? new Date(form.endDate).toISOString() : null,
                                                    memberIds: form.members.map(m => m.id || (m as any).Id)
                                                };
                                                
                                                const p = await api.post<any>('/api/groups', projectData);
                                                
                                                const newProject: Project = {
                                                    id: p.id,
                                                    name: p.name,
                                                    description: p.description,
                                                    members: p.memberIds?.length || 1,
                                                    category: 'Dự án',
                                                    privacy: (p.privacy || 'PRIVATE').toUpperCase() as 'PUBLIC' | 'PRIVATE',
                                                    coverImage: p.coverUrl || `https://picsum.photos/seed/${Date.now()}/400/200`
                                                };
                                                
                                                setProjects([newProject, ...projects]);
                                                setForm({ 
                                                    name: '', description: '', privacy: 'Public', 
                                                    startDate: '', endDate: '', members: [] 
                                                });
                                                setSearchUserQuery('');
                                                setShowCreate(false);
                                            } catch (err) {
                                                console.error('Create project failed', err);
                                                alert('Lỗi khi tạo dự án.');
                                            }
                                        }}
                                    >
                                        Khởi tạo
                                    </button>
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
