import { useState, useEffect } from 'react';
import { Table, Tag, message, Typography, Card, Input, Button, Space, Alert, Select } from 'antd';
import { ClockCircleOutlined, ScanOutlined, UserOutlined, SettingOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import type { ActiveNetwork } from '../services/attendanceService';
import type { AttendanceLog } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

function AttendancePage() {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(false);

    const user = authService.getCurrentUser();
    const isAdmin = user?.role === 'Admin';
    const [allowedIPs, setAllowedIPs] = useState('');
    const [savingConfig, setSavingConfig] = useState(false);
    const [activeNetworks, setActiveNetworks] = useState<ActiveNetwork[]>([]);
    const [loadingNetworks, setLoadingNetworks] = useState(false);

    useEffect(() => {
        fetchHistory();
        if (isAdmin) {
            fetchConfig();
        }
    }, [isAdmin]);

    const fetchConfig = async () => {
        try {
            const config = await attendanceService.getConfig();
            setAllowedIPs(config.allowedIPs || '');

            setLoadingNetworks(true);
            const networks = await attendanceService.getActiveNetworks();
            setActiveNetworks(networks);
        } catch (error) {
            console.error("Failed to load attendance config", error);
        } finally {
            setLoadingNetworks(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            await attendanceService.updateConfig({ allowedIPs: allowedIPs });
            message.success('Đã lưu cấu hình mạng thành công!');
        } catch (error) {
            message.error('Không thể lưu cấu hình mạng');
        } finally {
            setSavingConfig(false);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await api.get<AttendanceLog[]>('/api/attendance/history');
            setLogs(data);
        } catch (error) {
            message.error('Unable to fetch attendance history');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<AttendanceLog> = [
        {
            title: 'User',
            dataIndex: 'userName',
            key: 'userName',
            render: (text) => (
                <span>
                    <UserOutlined style={{ marginRight: 8 }} />
                    {text}
                </span>
            ),
        },
        {
            title: 'Check-In Time',
            dataIndex: 'checkInTime',
            key: 'checkInTime',
            render: (time) => (
                <span>
                    <ClockCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    {new Date(time).toLocaleString('vi-VN')}
                </span>
            ),
        },
        {
            title: 'Method',
            dataIndex: 'method',
            key: 'method',
            render: (method) => {
                let color = 'geekblue';
                let icon = <ScanOutlined />;

                if (method === 'FaceID') color = 'green';
                else if (method === 'Password') color = 'orange';

                return (
                    <Tag color={color} icon={icon}>
                        {method}
                    </Tag>
                );
            },
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>📅 Lịch sử Chấm công</Title>

            {isAdmin && (
                <Card
                    title={<><SettingOutlined /> Cấu hình Mạng WiFi (IP) Chấm công</>}
                    style={{ marginBottom: 24 }}
                    size="small"
                >
                    <Alert
                        message="Bảo mật mạng WiFi"
                        description="Chọn một mạng từ danh sách các mạng đang hoạt động của cả Máy chủ và Thiết bị hiện tại để tự động trích xuất dải mạng hợp lệ (rất hữu ích cho mạng cục bộ LAN/WiFi). Các thiết bị chung mạng này sẽ có thể chấm công. Hoặc bạn có thể nhập thủ công IP chính xác bên dưới."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <Space direction="vertical" style={{ width: '100%', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ fontWeight: 500, width: 150 }}>Mạng đang hoạt động:</span>
                            <Select
                                style={{ width: 400 }}
                                placeholder="Chọn mạng để tự động điền dải IP"
                                loading={loadingNetworks}
                                onChange={(value) => setAllowedIPs(value)}
                                options={activeNetworks.map(n => ({
                                    label: `${n.name} (IP: ${n.ipAddress})`,
                                    value: n.prefix
                                }))}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                            <span style={{ fontWeight: 500, width: 150, marginTop: 5 }}>Dải IP cho phép:</span>
                            <Space align="start">
                                <Input
                                    placeholder="Ví dụ: 192.168.1., 10.0.0.5, ::1"
                                    value={allowedIPs}
                                    onChange={(e) => setAllowedIPs(e.target.value)}
                                    style={{ width: 400 }}
                                />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    onClick={handleSaveConfig}
                                    loading={savingConfig}
                                >
                                    Lưu cấu hình
                                </Button>
                            </Space>
                        </div>
                    </Space>
                </Card>
            )}

            <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />
        </div>
    );
}

export default AttendancePage;
