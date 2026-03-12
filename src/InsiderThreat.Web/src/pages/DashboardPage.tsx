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
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import { confirmLogout } from '../utils/logoutUtils';
import UsbNotification from '../components/UsbNotification';
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
            message.success('Đã đăng xuất!');
            navigate('/login');
        });
    };

    const menuItems = [
        {
            key: 'feed',
            icon: <TeamOutlined />,
            label: 'Feed',
        },
        {
            key: 'usb',
            icon: <UsbOutlined />,
            label: 'USB Management',
        },
        {
            key: 'documents',
            icon: <FileTextOutlined />,
            label: 'Document Logs',
        },
        {
            key: 'attendance',
            icon: <TeamOutlined />,
            label: 'Attendance',
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
            label: 'User Management',
        });
        menuItems.splice(2, 0, {
            key: 'posts',
            icon: <MessageOutlined />,
            label: 'Post Management',
        });
        menuItems.splice(3, 0, {
            key: 'reports',
            icon: <WarningOutlined />,
            label: 'Báo cáo vi phạm',
        });
    }

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Thông tin',
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
            onClick: handleLogout,
        },
    ];

    const tabItems = [
        {
            key: 'blocked',
            label: '🚫 Blocked Devices',
            children: <BlockedDevicesTable />,
        },
        {
            key: 'whitelist',
            label: '✅ Whitelisted Devices',
            children: <WhitelistTable />,
        },
        {
            key: 'alerts',
            label: '⚠️ Security Alerts',
            children: <RecentLogsTable defaultFilter="Warning" />,
        },
        {
            key: 'recent-logs',
            label: '📝 Recent Logs',
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
                        {!isMobile && <Title level={2}>🔐 USB Device Management</Title>}
                        {isMobile && (
                            <header className="mobile-usb-header">
                                <div className="mobile-usb-header-left">
                                    <div className="usb-icon-badge">
                                        <span className="material-symbols-outlined">shield</span>
                                    </div>
                                    <div className="usb-header-text">
                                        <h1>USB Security</h1>
                                        <p>InsiderThreat Admin</p>
                                    </div>
                                </div>
                                <Avatar size={40} src="https://i.pravatar.cc/150?u=admin" />
                            </header>
                        )}
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
        { icon: 'newspaper', label: 'Feed', path: '/feed' },
        ...(user?.role === 'Admin' ? [
            { icon: 'person_search', label: 'Users', key: 'users', onClick: () => setSelectedKey('users') },
            { icon: 'chat', label: 'Posts', key: 'posts', onClick: () => setSelectedKey('posts') },
            { icon: 'report', label: 'Vi phạm', key: 'reports', onClick: () => setSelectedKey('reports') },
        ] : []),
        { icon: 'usb', label: 'USB', key: 'usb', onClick: () => setSelectedKey('usb') },
        { icon: 'folder_open', label: 'Documents', key: 'documents', onClick: () => setSelectedKey('documents') },
        { icon: 'checklist', label: 'Attendance', key: 'attendance', onClick: () => setSelectedKey('attendance') },
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
                                    message.warning("Bạn phải kết nối vào mạng WiFi (IP) được chỉ định để chấm công");
                                    return;
                                }
                                setSelectedKey('attendance');
                            } catch (e) {
                                message.error("Lỗi khi kiểm tra kết nối mạng");
                            }
                        }}>
                            Điểm danh chấm công
                        </Button>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <div className="user-info">
                                <Avatar icon={<UserOutlined />} />
                                <span className="username">{user.fullName}</span>
                                <span className="role-badge">{user.role}</span>
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
