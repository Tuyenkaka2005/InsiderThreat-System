import { useState, useEffect } from 'react';
import { Table, Tag, message, Typography, Card, Input, Button, Space, Alert, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { ClockCircleOutlined, ScanOutlined, UserOutlined, SettingOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import type { ActiveNetwork } from '../services/attendanceService';
import type { AttendanceLog } from '../types';
import type { ColumnsType } from 'antd/es/table';
import './AttendancePage.css';

const { Title } = Typography;

function AttendancePage() {
    const { t } = useTranslation();
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
            message.success(t('attendance.save_config_success', 'Đã lưu cấu hình mạng thành công!'));
        } catch (error) {
            message.error(t('attendance.save_config_fail', 'Không thể lưu cấu hình mạng'));
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
            message.error(t('attendance.fetch_history_fail', 'Unable to fetch attendance history'));
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<AttendanceLog> = [
        {
            title: t('attendance.col_user', 'User'),
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
            title: t('attendance.col_check_in_time', 'Check-In Time'),
            dataIndex: 'checkInTime',
            key: 'checkInTime',
            render: (time) => (
                <span>
                    <ClockCircleOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />
                    {new Date(time).toLocaleString('vi-VN')}
                </span>
            ),
        },
        {
            title: t('attendance.col_method', 'Method'),
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
            <Title level={2}>{t('attendance.title', '📅 Lịch sử Chấm công')}</Title>

            {isAdmin && (
                <Card
                    title={<><SettingOutlined /> {t('attendance.config_title', 'Cấu hình Mạng WiFi (IP) Chấm công')}</>}
                    style={{ marginBottom: 24 }}
                    size="small"
                >
                    <Alert
                        message={t('attendance.config_alert_title', 'Bảo mật mạng WiFi')}
                        description={t('attendance.config_alert_desc', 'Chọn một mạng từ danh sách các mạng đang hoạt động của cả Máy chủ và Thiết bị hiện tại để tự động trích xuất dải mạng hợp lệ (rất hữu ích cho mạng cục bộ LAN/WiFi). Các thiết bị chung mạng này sẽ có thể chấm công. Hoặc bạn có thể nhập thủ công IP chính xác bên dưới.')}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <div className="attendance-config-container">
                        <div className="config-row">
                            <span className="config-label">{t('attendance.lbl_active_network', 'Mạng đang hoạt động:')}</span>
                            <Select
                                className="config-select"
                                placeholder={t('attendance.placeholder_network', 'Chọn mạng để tự động điền dải IP')}
                                loading={loadingNetworks}
                                onChange={(value) => setAllowedIPs(value)}
                                options={activeNetworks.map(n => ({
                                    label: `${n.name} (IP: ${n.ipAddress})`,
                                    value: n.prefix
                                }))}
                            />
                        </div>
                        <div className="config-row align-top">
                            <span className="config-label">{t('attendance.lbl_allowed_ips', 'Dải IP cho phép:')}</span>
                            <div className="config-input-group">
                                <Input
                                    className="config-input"
                                    placeholder={t('attendance.placeholder_ips', 'Ví dụ: 192.168.1., 10.0.0.5, ::1')}
                                    value={allowedIPs}
                                    onChange={(e) => setAllowedIPs(e.target.value)}
                                />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    onClick={handleSaveConfig}
                                    loading={savingConfig}
                                    className="config-btn"
                                >
                                    {t('attendance.btn_save', 'Lưu cấu hình')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 'max-content' }}
            />
        </div>
    );
}

export default AttendancePage;
