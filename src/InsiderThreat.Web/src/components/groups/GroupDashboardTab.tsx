import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { App, Modal, DatePicker, Form, Input, Button, Progress, Tag, Space, Avatar, Tooltip } from 'antd';
import { EditOutlined, TeamOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, HeartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import ContributionHeatmap from './ContributionHeatmap';
import './GroupDashboardTab.css';

interface Member {
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string;
    isAdmin: boolean;
}

interface Task {
    id: string;
    status: string;
}

interface GroupInfo {
    id: string;
    name: string;
    description: string;
    projectStartDate?: string;
    projectEndDate?: string;
    isProject: boolean;
}

const TaskPieChart = ({ stats }: { stats: any }) => {
    const { t } = useTranslation();
    const total = stats.done + stats.progress + stats.todo;
    const progressPercent = total > 0 ? Math.round((stats.done / total) * 100) : 0;

    return (
        <div className="pie-chart-container">
            <div className="progress-circle-wrap">
                <Progress 
                    type="circle" 
                    percent={progressPercent} 
                    strokeColor={{ '0%': '#10b981', '100%': '#39d353' }}
                    railColor="#161b22"
                    size={120}
                    format={p => <span style={{ color: '#fff', fontSize: '20px' }}>{p}%</span>}
                />
            </div>
            <div className="pie-legend">
                <div className="legend-item"><span className="dot dot-done"></span> {t('project_detail.charts.done')}: {stats.done}</div>
                <div className="legend-item"><span className="dot dot-progress"></span> {t('project_detail.charts.in_progress')}: {stats.progress}</div>
                <div className="legend-item"><span className="dot dot-todo"></span> {t('project_detail.charts.remaining')}: {stats.todo}</div>
            </div>
        </div>
    );
};

export default function GroupDashboardTab() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [stats, setStats] = useState({ done: 0, progress: 0, todo: 0 });
    const [contributionData, setContributionData] = useState([]);
    const [leakAlerts, setLeakAlerts] = useState<any[]>([]);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [form] = Form.useForm();

    const fetchData = async () => {
        try {
            const groupRes = await api.get<GroupInfo>(`/api/groups/${id}`);
            const membersRes = await api.get<Member[]>(`/api/groups/${id}/members-details`);
            const tasksRes = await api.get<Task[]>(`/api/groups/${id}/tasks`);
            const statsRes = await api.get<any>(`/api/groups/${id}/contribution-stats`);

            setGroup(groupRes);
            setMembers(membersRes);
            setContributionData(statsRes);

            const tasks = tasksRes;
            setStats({
                done: tasks.filter(t => t.status === 'Done').length,
                progress: tasks.filter(t => t.status === 'InProgress' || t.status === 'InReview').length,
                todo: tasks.filter(t => t.status === 'Todo').length
            });

            // Fetch leak alerts
            try {
                const leaksRes = await api.get<any[]>(`/api/groups/${id}/leak-alerts`);
                setLeakAlerts(leaksRes);
            } catch { /* no leak data yet */ }
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        }
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const handleUpdateProject = async (values: any) => {
        try {
            await api.patch(`/api/groups/${id}`, {
                ...values,
                projectStartDate: values.dates?.[0]?.toISOString(),
                projectEndDate: values.dates?.[1]?.toISOString()
            });
            message.success('Cập nhật dự án thành công');
            setIsEditModalVisible(false);
            fetchData();
        } catch (err) {
            message.error('Cập nhật thất bại');
        }
    };

    const dashboardStats = [
        { label: 'Sức khỏe dự án', value: 'High', color: '#10b981', icon: <HeartOutlined /> },
        { label: 'Tổng Task', value: stats.done + stats.progress + stats.todo, color: '#3b82f6', icon: <TeamOutlined /> },
        { label: 'Đang làm', value: stats.progress, color: '#f59e0b', icon: <ClockCircleOutlined /> },
        { label: 'Đã xong', value: stats.done, color: '#8b5cf6', icon: <CheckCircleOutlined /> },
    ];

    if (!group) return <div className="loading-state">Loading...</div>;

    const daysLeft = group.projectEndDate ? dayjs(group.projectEndDate).diff(dayjs(), 'day') : null;

    return (
        <div className="dashboardTab animate-in">
            {/* Top Action Bar */}
            <div className="dash-toprow">
                <div className="dash-project-meta">
                    <Space>
                        <Tag color="purple" style={{ margin: 0 }}>PROJECT</Tag>
                        <Text strong style={{ color: '#fff' }}>{group.name}</Text>
                    </Space>
                    <p className="dash-breadcrumb">
                        {group.projectStartDate ? dayjs(group.projectStartDate).format('DD/MM/YYYY') : 'N/A'} 
                        {' → '} 
                        {group.projectEndDate ? dayjs(group.projectEndDate).format('DD/MM/YYYY') : 'N/A'}
                        {daysLeft !== null && (
                            <span style={{ color: daysLeft < 0 ? '#ff4d4f' : '#10b981', marginLeft: 8 }}>
                                ({daysLeft < 0 ? `Quá hạn ${Math.abs(daysLeft)} ngày` : `Còn ${daysLeft} ngày`})
                            </span>
                        )}
                    </p>
                </div>
                <div className="dash-toprow-actions">
                    <Avatar.Group max={{ count: 3 }} size="large">
                        {members.map(m => (
                            <Tooltip key={m.id} title={m.fullName}>
                                <Avatar src={m.avatarUrl || `https://ui-avatars.com/api/?name=${m.fullName}&background=random`} />
                            </Tooltip>
                        ))}
                    </Avatar.Group>
                    <Button 
                        type="primary" 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            form.setFieldsValue({
                                name: group.name,
                                description: group.description,
                                dates: group.projectStartDate ? [dayjs(group.projectStartDate), dayjs(group.projectEndDate)] : []
                            });
                            setIsEditModalVisible(true);
                        }}
                    >
                        Chỉnh sửa Dự án
                    </Button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="statCards-grid">
                {dashboardStats.map((s, i) => (
                    <div className="statCard" key={i} style={{ borderTop: `3px solid ${s.color}` }}>
                        <div className="statCard-top">
                            <p className="statLabel">{s.label}</p>
                            <span className="statIcon" style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="statValueWrap">
                            <span className="statValue" style={{ color: s.color }}>{s.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="dashboard-mainGrid">
                <div className="mainGrid-left">
                    <ContributionHeatmap data={contributionData} />
                    
                    <div className="panelCard breakdown-panel" style={{ marginTop: '24px' }}>
                        <div className="panelHeader">
                            <h3>Phân bổ Công việc</h3>
                        </div>
                        <div className="breakdown-content">
                            <TaskPieChart stats={stats} />
                        </div>
                    </div>
                </div>

                <div className="mainGrid-right">
                    {/* Leak Alerts Panel */}
                    {leakAlerts.length > 0 && (
                        <div className="panelCard" style={{ marginBottom: 16, borderLeft: '3px solid #ef4444' }}>
                            <div className="panelHeader">
                                <h3 style={{ color: '#ef4444' }}>🚨 Cảnh báo Rò rỉ</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {leakAlerts.map((alert: any) => (
                                    <div key={alert.id} style={{ 
                                        padding: '10px 12px', 
                                        background: alert.severity >= 8 ? '#fef2f2' : '#fffbeb', 
                                        borderRadius: 8,
                                        border: `1px solid ${alert.severity >= 8 ? '#fecaca' : '#fed7aa'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Tag color={alert.severity >= 8 ? 'red' : 'orange'}>
                                                {alert.type === 'DocumentLeak' ? 'Rò rỉ File' : 'Clipboard Copy'}
                                            </Tag>
                                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                                {new Date(alert.timestamp).toLocaleString('vi-VN')}
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                                            <strong>{alert.app}</strong> trên máy <strong>{alert.machine}</strong>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>Thành viên ({members.length})</h3>
                        </div>
                        <div className="teamList">
                            {members.map(m => (
                                <div className="teamMember" key={m.id}>
                                    <Avatar src={m.avatarUrl} size="large" />
                                    <div className="memberInfo">
                                        <p className="memberName">{m.fullName}</p>
                                        <p className="memberRole">{m.isAdmin ? 'Project Admin' : 'Member'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                title="Cấu hình Dự án"
                open={isEditModalVisible}
                onCancel={() => setIsEditModalVisible(false)}
                footer={null}
                destroyOnHidden={true}
            >
                <Form form={form} layout="vertical" onFinish={handleUpdateProject}>
                    <Form.Item name="name" label="Tên dự án" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="dates" label="Thời gian thực hiện">
                        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" block htmlType="submit">Lưu thay đổi</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

// Helper text component
const Text = ({ children, style, strong, type }: any) => (
    <span style={{ 
        fontWeight: strong ? 'bold' : 'normal', 
        color: type === 'danger' ? '#ff4d4f' : 'inherit',
        ...style 
    }}>
        {children}
    </span>
);
