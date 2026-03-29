import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import GroupDashboardTab from '../components/groups/GroupDashboardTab';
import MyTaskTab from '../components/groups/MyTaskTab';
import TimelineTab from '../components/groups/TimelineTab';
import FilesTab from '../components/groups/FilesTab';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { userService } from '../services/userService';
import type { User } from '../types';
import SynchroHeader from '../components/SynchroHeader';
import ProjectSidebar from '../components/groups/ProjectSidebar';
import { HistoryOutlined, ThunderboltFilled } from '@ant-design/icons';
import './ProjectDetailPage.css';

const TABS = [
    { key: 'dashboard', label: 'project_detail.tabs.dashboard', icon: 'dashboard' },
    { key: 'mytask', label: 'project_detail.tabs.mytasks', icon: 'task_alt' },
    { key: 'timeline', label: 'project_detail.tabs.timeline', icon: 'timeline' },
    { key: 'files', label: 'project_detail.tabs.files', icon: 'folder' },
];

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [groupName, setGroupName] = useState<string>('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [members, setMembers] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [showSidebar, setShowSidebar] = useState(false);

    const fetchMembers = async () => {
        try {
            const res = await api.get<any[]>(`/api/groups/${id}/members-details`);
            setMembers(res);
        } catch (err) {
            console.error('Failed to fetch members', err);
        }
    };

    useEffect(() => {
        const fetchGroupName = async () => {
            try {
                const res = await api.get<any>(`/api/groups/${id}`);
                setGroupName(res.name);
            } catch (err) {
                console.error('Failed to fetch group name', err);
            }
        };
        if (id) {
            fetchGroupName();
            fetchMembers();
        }
    }, [id]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const renderContent = () => {
        const handleInviteTrigger = () => {
            if (!allUsers.length) {
                userService.getAllUsers().then(setAllUsers).catch(console.error);
            }
            setShowInviteModal(true);
        };

        switch (activeTab) {
            case 'dashboard': return <GroupDashboardTab onInviteClick={handleInviteTrigger} />;
            case 'mytask': return <MyTaskTab />;
            case 'timeline': return <TimelineTab />;
            case 'files': return <FilesTab />;
            default: return null;
        }
    };

    const handleDeleteProject = async () => {
        const confirmDelete = window.confirm(t('groups.confirm_delete_msg', { name: groupName }));
        if (!confirmDelete) return;

        try {
            await api.delete(`/api/groups/${id}`);
            navigate('/projects');
        } catch (err) {
            console.error('Failed to delete project', err);
            alert(t('groups.delete_fail', 'Xóa dự án thất bại.'));
        }
    };

    const filteredUsers = searchUserQuery 
        ? allUsers.filter(u => 
            (u.fullName?.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
             u.username.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
             u.email?.toLowerCase().includes(searchUserQuery.toLowerCase())) &&
            !members.find(m => m.id === u.id)
          ).slice(0, 5)
        : [];

    const handleInviteUser = async (user: User) => {
        try {
            await api.post(`/api/groups/${id}/members`, { userId: user.id });
            setSearchUserQuery('');
            setShowInviteModal(false);
            fetchMembers(); // refresh
        } catch (err) {
            console.error('Failed to invite user', err);
            alert('Lỗi thêm thành viên');
        }
    };

    return (
        <div className="groupDetail-container">
            {/* DEBUG MARKER */}
            {!isMobile && <LeftSidebar defaultCollapsed={true} />}
            
            <div className="groupDetail-main-wrapper">
                <main className="groupDetail">
                    {/* Header Section */}
                    {/* HEADER THEO THIẾT KẾ MỚI */}
                    <SynchroHeader 
                        breadcrumb={[
                            { label: 'Workspace' },
                            { label: 'Projects' },
                            { label: groupName || 'Loading...', active: true }
                        ]} 
                        members={members}
                        onInviteClick={() => {
                            if (!allUsers.length) {
                                userService.getAllUsers().then(setAllUsers).catch(console.error);
                            }
                            setShowInviteModal(true);
                        }}
                    />

                    <div className="groupDetail-top-section">
                        {/* Sub-Header / Tab Navigation */}
                        <div className="groupDetail-tabs-wrapper">
                            <div className="groupDetail-tabs">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        className={`tabItem ${activeTab === tab.key ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        <span className="material-symbols-outlined">{tab.icon}</span>
                                        {t(tab.label)}
                                    </button>
                                ))}
                            </div>
                            <div className="project-actions">
                                <button className="proj-action-btn">
                                    <span className="material-symbols-outlined">settings</span>
                                </button>
                                {!['1', '2', '3', '4'].includes(id || '') && (
                                    <button 
                                        className="proj-action-btn delete" 
                                        onClick={handleDeleteProject}
                                        title={t('project_detail.header.btn_delete')}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                )}
                                <button className="proj-action-btn" onClick={() => setShowSidebar(true)}>
                                    <ThunderboltFilled style={{ color: '#f59e0b' }} />
                                </button>
                                <button className="proj-action-btn">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <ProjectSidebar 
                        open={showSidebar} 
                        onClose={() => setShowSidebar(false)} 
                        projectName={groupName} 
                    />

                    {/* Main Content Area */}
                    <div className="groupDetail-body">
                        {renderContent()}
                    </div>
                </main>
            </div>
            
            {showInviteModal && (
                <div className="modalBackdrop" onClick={() => setShowInviteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <h3 className="modalTitle">Thêm thành viên</h3>
                        <div className="formRow">
                            <div className="membersInputWrap" style={{ position: 'relative' }}>
                                <input
                                    className="formInput"
                                    placeholder="Tìm theo tên hoặc email..."
                                    value={searchUserQuery}
                                    onChange={e => setSearchUserQuery(e.target.value)}
                                    autoFocus
                                />
                                <button className="addMemberBtn"><span className="material-symbols-outlined">search</span></button>
                                
                                {filteredUsers.length > 0 && (
                                    <div className="userSearchResults" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                        {filteredUsers.map(user => (
                                            <div 
                                                key={user.id} 
                                                className="userResultItem"
                                                onClick={() => handleInviteUser(user)}
                                            >
                                                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username}`} alt="Avatar" />
                                                <div className="userInfoBlock">
                                                    <div className="uName">{user.fullName || user.username}</div>
                                                    <div className="uEmail">{user.email || `@${user.username}`}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modalActions">
                            <button className="btnCancel" onClick={() => setShowInviteModal(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {isMobile && <BottomNavigation />}
        </div>
    );
}
