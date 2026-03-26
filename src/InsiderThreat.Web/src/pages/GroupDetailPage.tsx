import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import GroupDashboardTab from '../components/groups/GroupDashboardTab';
import MyTaskTab from '../components/groups/MyTaskTab';
import { useTranslation } from 'react-i18next';
import './GroupDetailPage.css';

export default function GroupDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Mock Group data mapped from GroupsPage
    const getGroupName = (id?: string) => {
        switch (id) {
            case '1': return 'Phòng Phát Triển Sản Phẩm';
            case '2': return 'Hội Những Người Thích Cà Phê';
            case '3': return 'Kỹ thuật & Công nghệ';
            case '4': return 'HR & Văn hóa doanh nghiệp';
            default: return `Dự án Không Tên (${id})`;
        }
    };
    
    const groupName = getGroupName(id);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <GroupDashboardTab />;
            case 'mytask':
                return (
                    <div className="placeholder-view">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 16 }}>view_kanban</span>
                        <h2>Kanban Board</h2>
                        <p>Danh sách công việc kéo thả (Đang phát triển)</p>
                    </div>
                );
            case 'timeline':
                return (
                    <div className="placeholder-view">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 16 }}>timeline</span>
                        <h2>Gantt Timeline</h2>
                        <p>Biểu đồ thời gian dự án (Đang phát triển)</p>
                    </div>
                );
            case 'files':
                return (
                    <div className="placeholder-view">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 16 }}>folder</span>
                        <h2>Files & Attachments</h2>
                        <p>Quản lý tài liệu, word, pdf, thư mục (Đang phát triển)</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="groupDetail-container">
            <div className="groupDetail-main-wrapper">
                <div className="groupDetail">
                    {/* Header */}
                    <div className="groupDetail-header">
                        <button className="backBtn" onClick={() => navigate('/groups')} title={t('common.btn_back', 'Quay lại')}>
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="groupInfo">
                            <h1 className="groupTitle">{groupName}</h1>
                            <p className="groupSubtitle">Quản lý và theo dõi tiến độ công việc dự án</p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="tabContent">
                        {activeTab === 'dashboard' && <GroupDashboardTab />}
                        {activeTab === 'mytask' && <MyTaskTab />}
                        {activeTab === 'timeline' && <div className="placeholder-tab">Timeline View</div>}
                        {activeTab === 'files' && <div className="placeholder-tab">Files View</div>}
                    </div>

                    {/* Tab Navigation */}
                    <div className="groupDetail-tabs">
                        <button className={`tabItem ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                            Dashboard
                        </button>
                        <button className={`tabItem ${activeTab === 'mytask' ? 'active' : ''}`} onClick={() => setActiveTab('mytask')}>
                            My Task
                        </button>
                        <button className={`tabItem ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
                            Timeline
                        </button>
                        <button className={`tabItem ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
                            Files
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="groupDetail-body">
                        {renderContent()}
                    </div>
                </div>
            </div>
            
            {isMobile && <BottomNavigation />}
        </div>
    );
}
