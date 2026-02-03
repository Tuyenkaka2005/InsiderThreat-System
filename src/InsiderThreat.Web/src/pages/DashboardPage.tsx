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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { confirmLogout } from '../utils/logoutUtils';
import UsbNotification from '../components/UsbNotification';
import BlockedDevicesTable from '../components/BlockedDevicesTable';
import WhitelistTable from '../components/WhitelistTable';
import RecentLogsTable from '../components/RecentLogsTable';
import UsersPage from './UsersPage';
import PostManagementPage from './PostManagementPage';
import DocumentsPage from './DocumentsPage';
import AttendancePage from './AttendancePage';
import './DashboardPage.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function DashboardPage() {
    const [collapsed, setCollapsed] = useState(true);
    const [selectedKey, setSelectedKey] = useState('usb');
    const navigate = useNavigate();
    const user = authService.getCurrentUser();

    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

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
            label: 'Document Logs', // Changed label
        },
        {
            key: 'attendance',
            icon: <TeamOutlined />,
            label: 'Attendance',
        },
    ];

    if (user?.role === 'Admin') {
        menuItems.splice(1, 0, { // Changed from push to splice, and label changed
            key: 'users',
            icon: <UserOutlined />,
            label: 'User Management',
        });
        menuItems.splice(2, 0, {
            key: 'posts',
            icon: <MessageOutlined />,
            label: 'Post Management',
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

    if (!user) return null;

    const renderContent = () => {
        switch (selectedKey) {
            case 'usb':
                return (
                    <div className="content-wrapper">
                        <Title level={2}>🔐 USB Device Management</Title>
                        <Tabs items={tabItems} defaultActiveKey="blocked" />
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

    // Handle Feed Navigation separately to avoid rendering inside layout if we want full redirect
    useEffect(() => {
        if (selectedKey === 'feed') {
            navigate('/feed');
        }
    }, [selectedKey, navigate]);

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

                    <div className="header-right">
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
