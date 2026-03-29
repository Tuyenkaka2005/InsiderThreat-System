import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Avatar, Badge, Button, Tag, Space, Typography, Spin, Empty, App } from 'antd';
import { 
    BellOutlined, CheckCircleOutlined, MessageOutlined, 
    RocketOutlined, ClockCircleOutlined, MailOutlined,
    ArrowRightOutlined, DeleteOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../services/api';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import './InboxPage.css';

dayjs.extend(relativeTime);
const { Title, Text } = Typography;

interface Notification {
    id: string;
    type: string;
    message: string;
    actorName?: string;
    actorUserId?: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export default function InboxPage() {
    const navigate = useNavigate();
    const { message: antdMessage } = App.useApp();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const res = await api.get<Notification[]>('/api/notifications');
            setNotifications(res || []);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const markAsRead = async (id: string, link?: string) => {
        try {
            await api.put(`/api/notifications/${id}/read`, {});
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
            if (link) navigate(link);
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unread = notifications.filter(n => !n.isRead);
            await Promise.all(unread.map(n => api.put(`/api/notifications/${n.id}/read`, {})));
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            antdMessage.success('Đã đánh dấu tất cả là đã đọc');
        } catch (error) {
            antdMessage.error('Thao tác thất bại');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'TaskAssignment': return <RocketOutlined style={{ color: '#3b82f6' }} />;
            case 'TaskStatusChange': return <CheckCircleOutlined style={{ color: '#10b981' }} />;
            case 'TaskComment': return <MessageOutlined style={{ color: '#f59e0b' }} />;
            default: return <BellOutlined style={{ color: '#6366f1' }} />;
        }
    };

    return (
        <div className="inbox-container">
            {!isMobile && <LeftSidebar defaultCollapsed={true} />}
            
            <div className="inbox-main-wrapper">
                <main className="inbox-content animate-in">
                    <header className="inbox-header">
                        <div className="header-left">
                            <Title level={2} className="inbox-title">Inbox</Title>
                            <Text type="secondary" className="inbox-subtitle">
                                Luôn cập nhật những thay đổi mới nhất trong các dự án của bạn.
                            </Text>
                        </div>
                        <div className="header-right">
                            <Button 
                                type="text" 
                                icon={<CheckCircleOutlined />} 
                                onClick={markAllAsRead}
                                className="action-btn"
                            >
                                Đánh dấu tất cả đã đọc
                            </Button>
                        </div>
                    </header>

                    <div className="inbox-filter-bar">
                        <Space size="middle">
                            <Badge count={notifications.filter(n => !n.isRead).length} offset={[10, 0]}>
                                <Tag className="filter-tag active">Tất cả</Tag>
                            </Badge>
                            <Tag className="filter-tag">Chưa đọc</Tag>
                            <Tag className="filter-tag">Giao việc</Tag>
                            <Tag className="filter-tag">Thảo luận</Tag>
                        </Space>
                    </div>

                    <div className="inbox-list-wrapper">
                        {loading ? (
                            <div className="loading-state"><Spin size="large" tip="Đang tải thông báo..." /></div>
                        ) : notifications.length === 0 ? (
                            <Empty 
                                image={<MailOutlined style={{ fontSize: 64, color: 'var(--color-border)' }} />}
                                description="Hộp thư của bạn đang trống"
                                className="empty-inbox"
                            />
                        ) : (
                            <div className="notification-list">
                                <AnimatePresence>
                                    {notifications.map((n, index) => (
                                        <motion.div 
                                            key={n.id || index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`notification-card ${n.isRead ? 'read' : 'unread'}`}
                                            onClick={() => markAsRead(n.id, n.link)}
                                        >
                                            <div className="card-icon">
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="card-body">
                                                <div className="card-header">
                                                    <Text strong className="actor-name">{n.actorName || 'Hệ thống'}</Text>
                                                    <Text className="time-stamp">{dayjs(n.createdAt).fromNow()}</Text>
                                                </div>
                                                <div className="card-message">
                                                    {n.message}
                                                </div>
                                                {!n.isRead && <div className="unread-dot" />}
                                            </div>
                                            <div className="card-actions">
                                                <Button type="text" icon={<ArrowRightOutlined />} className="view-btn" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            
            {isMobile && <BottomNavigation />}
        </div>
    );
}
