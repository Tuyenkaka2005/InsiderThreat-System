import { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Tabs, message } from 'antd';
import {
    UsbOutlined,
    FileTextOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    TeamOutlined,
    MessageOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import { confirmLogout } from '../utils/logoutUtils';
import UsbNotification from '../components/UsbNotification';
import UsbAnalyticsChart from '../components/UsbAnalyticsChart';
import BlockedDevicesTable from '../components/BlockedDevicesTable';
import WhitelistTable from '../components/WhitelistTable';
import RecentLogsTable from '../components/RecentLogsTable';
import UsersPage from './UsersPage';
import PostManagementPage from './PostManagementPage';
import DocumentsPage from './DocumentsPage';
import AttendancePage from './AttendancePage';
import ReportsPage from './ReportsPage';
import BottomNavigation from '../components/BottomNavigation';
import './DashboardPage.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function DashboardPage() {
    const [collapsed, setCollapsed] = useState(false);
    const [selectedKey, setSelectedKey] = useState('usb');
    const navigate = useNavigate();
    const user = authService.getCurrentUser();
    const { t } = useTranslation();

    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

    // Navigate to /feed when Feed menu is selected
    useEffect(() => {
        if (selectedKey === 'feed') {
            navigate('/feed');
        }
    }, [selectedKey, navigate]);

    const handleLogout = () => {
        confirmLogout(() => {
            authService.logout();
            message.success(t('dashboard.logged_out', 'Đã đăng xuất!'));
            navigate('/login');
        });
    };

    const menuItems = [
        {
            key: 'feed',
            icon: <TeamOutlined />,
            label: t('dashboard.menu_feed', 'Feed'),
        },
        {
            key: 'usb',
            icon: <UsbOutlined />,
            label: t('dashboard.menu_usb', 'USB Management'),
        },
        {
            key: 'documents',
            icon: <FileTextOutlined />,
            label: t('dashboard.menu_documents', 'Document Logs'),
        },
        {
            key: 'attendance',
            icon: <TeamOutlined />,
            label: t('dashboard.menu_attendance', 'Attendance'),
        },
    ];

    // Check admin - case insensitive, or any user on dashboard is treated as admin
    const isAdminUser = user?.role?.toLowerCase() === 'admin' ||
        user?.role?.toLowerCase() === 'giam doc' ||
        user?.role?.toLowerCase() === 'giám đốc';

    if (isAdminUser || true) { // Show admin items to all dashboard users (dashboard is admin-only)
        menuItems.splice(1, 0, {
            key: 'users',
            icon: <UserOutlined />,
            label: t('dashboard.menu_users', 'User Management'),
        });
        menuItems.splice(2, 0, {
            key: 'posts',
            icon: <MessageOutlined />,
            label: t('dashboard.menu_posts', 'Post Management'),
        });
        menuItems.splice(3, 0, {
            key: 'reports',
            icon: <WarningOutlined />,
            label: t('dashboard.menu_reports', 'Báo cáo vi phạm'),
        });
    }

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: t('dashboard.user_profile', 'Thông tin'),
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: t('dashboard.user_logout', 'Đăng xuất'),
            onClick: handleLogout,
        },
    ];

    const tabItems = [
        {
            key: 'blocked',
            label: t('dashboard.tab_blocked', '🚫 Blocked Devices'),
            children: <BlockedDevicesTable />,
        },
        {
            key: 'whitelist',
            label: t('dashboard.tab_whitelist', '✅ Whitelisted Devices'),
            children: <WhitelistTable />,
        },
        {
            key: 'alerts',
            label: t('dashboard.tab_alerts', '⚠️ Security Alerts'),
            children: <RecentLogsTable defaultFilter="Warning" />,
        },
        {
            key: 'recent-logs',
            label: t('dashboard.tab_logs', '📝 Recent Logs'),
            children: <RecentLogsTable />,
        },
    ];

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!user) return null;

    const renderContent = () => {
        switch (selectedKey) {
            case 'usb':
                return (
                    <div className={`content-wrapper ${isMobile ? 'mobile-usb-content' : ''}`}>
                        {!isMobile && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <Title level={2} style={{ margin: 0 }}>{t('dashboard.usb_title', '🔐 USB Device Management')}</Title>
                                <Button 
                                    type="primary" 
                                    danger 
                                    size="large"
                                    icon={<WarningOutlined />} 
                                    onClick={() => navigate('/monitor-logs')}
                                    style={{ animation: 'pulse 2s infinite', fontWeight: 'bold' }}
                                >
                                    Cảnh báo Rò rỉ Tài liệu (PC Monitor)
                                </Button>
                            </div>
                        )}
                        {isMobile && (
                            <header className="mobile-usb-header">
                                <div className="mobile-usb-header-left">
                                    <div className="usb-icon-badge">
                                        <span className="material-symbols-outlined">shield</span>
                                    </div>
                                    <div className="usb-header-text">
                                        <h1>{t('dashboard.usb_sec', 'USB Security')}</h1>
                                        <p>{t('dashboard.admin_label', 'InsiderThreat Admin')}</p>
                                    </div>
                                </div>
                                <Avatar size={40} src="https://i.pravatar.cc/150?u=admin" />
                            </header>
                        )}

                        {/* 📊 BIỂU ĐỒ PHÂN TÍCH USB */}
                        <UsbAnalyticsChart />

                        <Tabs
                            items={tabItems}
                            defaultActiveKey="alerts"
                            className={isMobile ? 'mobile-tabs' : ''}
                        />
                    </div>
                );
            case 'users':
                return (
                    <div className="content-wrapper">
                        <UsersPage />
                    </div>
                );
            case 'posts':
                return (
                    <div className="content-wrapper">
                        <PostManagementPage />
                    </div>
                );
            case 'reports':
                return (
                    <div className="content-wrapper">
                        <ReportsPage />
                    </div>
                );
            case 'documents':
                return (
                    <div className="content-wrapper">
                        <DocumentsPage />
                    </div>
                );
            case 'attendance':
                return (
                    <div className="content-wrapper">
                        <AttendancePage />
                    </div>
                );
            default:
                return null;
        }
    };

    const dashboardNavItems = [
        { icon: 'newspaper', label: t('dashboard.nav_feed', 'Feed'), path: '/feed' },
        ...(isAdminUser ? [
            { icon: 'person_search', label: t('dashboard.nav_users', 'Users'), key: 'users', onClick: () => setSelectedKey('users') },
            { icon: 'chat', label: t('dashboard.nav_posts', 'Posts'), key: 'posts', onClick: () => setSelectedKey('posts') },
            { icon: 'report', label: t('dashboard.nav_reports', 'Vi phạm'), key: 'reports', onClick: () => setSelectedKey('reports') },
        ] : []),
        { icon: 'usb', label: t('dashboard.nav_usb', 'USB'), key: 'usb', onClick: () => setSelectedKey('usb') },
        { icon: 'folder_open', label: t('dashboard.nav_documents', 'Documents'), key: 'documents', onClick: () => setSelectedKey('documents') },
        { icon: 'checklist', label: t('dashboard.nav_attendance', 'Attendance'), key: 'attendance', onClick: () => setSelectedKey('attendance') },
    ];

    if (isMobile) {
        return (
            <div className="mobile-dashboard">
                <UsbNotification userRole={user.role} />
                <main className="mobile-main">
                    {renderContent()}
                </main>
                <div className="floating-action-btn">
                    <span className="material-symbols-outlined">notifications</span>
                </div>
                <BottomNavigation items={dashboardNavItems} activeKey={selectedKey} />
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Real-time USB Notification */}
            <UsbNotification userRole={user.role} />

            {/* Sidebar */}
            <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
                <div className="logo">
                    <UsbOutlined style={{ fontSize: 24, color: '#fff' }} />
                    {!collapsed && <span style={{ marginLeft: 12 }}>InsiderThreat</span>}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={['usb']}
                    selectedKeys={[selectedKey]}
                    items={menuItems}
                    onClick={({ key }) => setSelectedKey(key)}
                />
            </Sider>

            <Layout>
                {/* Header */}
                <Header className="site-header">
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        className="trigger"
                    />

                    <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Button type="primary" onClick={async () => {
                            try {
                                const res = await attendanceService.checkCanCheckIn();
                                if (!res.canCheckIn) {
                                    message.warning(t('dashboard.attendance_warning', "Bạn phải kết nối vào mạng WiFi (IP) được chỉ định để chấm công"));
                                    return;
                                }
                                setSelectedKey('attendance');
                            } catch (e) {
                                message.error(t('dashboard.attendance_error', "Lỗi khi kiểm tra kết nối mạng"));
                            }
                        }}>
                            {t('dashboard.check_in_btn', 'Điểm danh chấm công')}
                        </Button>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <div className="user-info">
                                <Avatar icon={<UserOutlined />} />
                                <span className="username">{user.fullName}</span>
                            </div>
                        </Dropdown>
                    </div>
                </Header>

                {/* Main Content */}
                <Content className="site-content">
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
}

export default DashboardPage;
