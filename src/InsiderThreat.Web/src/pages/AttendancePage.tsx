import { useState, useEffect } from 'react';
import { Table, Tag, message, Typography, Card, Input, Button, Space, Alert, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ClockCircleOutlined, ScanOutlined, UserOutlined, SettingOutlined, SaveOutlined, SafetyOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { attendanceService } from '../services/attendanceService';
import { generateNonce } from '../services/deviceValidator';
import type { ActiveNetwork } from '../services/attendanceService';
import type { AttendanceLog } from '../types';
import type { ColumnsType } from 'antd/es/table';
import LivenessChallengeComponent from '../components/LivenessChallenge';
import './AttendancePage.css';

const { Title } = Typography;

function AttendancePage() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [showLiveness, setShowLiveness] = useState(false);

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

    // Face Check-in handlers
    const handleFaceCheckIn = () => {
        setShowLiveness(true);
    };

    const handleLivenessComplete = async (descriptor: number[], livenessVerified: boolean) => {
        setShowLiveness(false);
        setCheckingIn(true);

        try {
            const nonce = generateNonce();
            const result = await attendanceService.faceCheckIn(descriptor, nonce, livenessVerified);
            message.success(
                t('attendance.checkin_success', {
                    defaultValue: `✅ Chấm công thành công! Độ khớp: ${(1 - result.matchConfidence).toFixed(1)}%`,
                })
            );
            fetchHistory(); // Refresh the table
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || t('attendance.checkin_fail', 'Chấm công thất bại');
            message.error(`🚫 ${errorMsg}`);
        } finally {
            setCheckingIn(false);
        }
    };

    const handleLivenessFail = (reason: string) => {
        setShowLiveness(false);
        message.error(`🚫 ${reason}`);
    };

    const handleLivenessCancel = () => {
        setShowLiveness(false);
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
                const icon = <ScanOutlined />;

                if (method === 'FaceID') color = 'green';
                else if (method === 'Password') color = 'orange';

                return (
                    <Tag color={color} icon={icon}>
                        {method}
                    </Tag>
                );
            },
        },
        {
            title: t('attendance.col_liveness', 'Liveness'),
            dataIndex: 'livenessVerified',
            key: 'livenessVerified',
            render: (verified) => (
                <Tooltip title={verified ? t('attendance.liveness_verified', 'Đã xác minh liveness') : t('attendance.liveness_not_verified', 'Chưa xác minh liveness')}>
                    {verified ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>Verified</Tag>
                    ) : (
                        <Tag color="default" icon={<CloseCircleOutlined />}>N/A</Tag>
                    )}
                </Tooltip>
            ),
        },
        {
            title: t('attendance.col_confidence', 'Confidence'),
            dataIndex: 'matchConfidence',
            key: 'matchConfidence',
            render: (confidence) => {
                if (!confidence && confidence !== 0) return <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>—</span>;
                const pct = ((1 - confidence) * 100).toFixed(1);
                const color = confidence < 0.3 ? '#22c55e' : confidence < 0.45 ? '#eab308' : '#ef4444';
                return <span style={{ fontWeight: 600, color }}>{pct}%</span>;
            },
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <Title level={2} style={{ margin: 0 }}>{t('attendance.title', '📅 Lịch sử Chấm công')}</Title>

                {/* Face Check-in Button */}
                <Button
                    type="primary"
                    size="large"
                    icon={<ScanOutlined />}
                    loading={checkingIn}
                    onClick={handleFaceCheckIn}
                    style={{
                        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                        borderColor: 'transparent',
                        borderRadius: 12,
                        height: 48,
                        paddingInline: 28,
                        fontWeight: 700,
                        fontSize: 15,
                        boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                    }}
                >
                    {t('attendance.face_checkin', '🔐 Chấm công Face ID')}
                </Button>
            </div>

            {/* Security info */}
            <Alert
                title={
                    <Space>
                        <SafetyOutlined />
                        {t('attendance.security_info', 'Hệ thống được bảo vệ bởi: Liveness Detection + Server-Side Matching + Anti-Replay')}
                    </Space>
                }
                type="success"
                showIcon={false}
                style={{ marginBottom: 16, borderRadius: 10 }}
            />


            {isAdmin && (
                <Card
                    title={<><SettingOutlined /> {t('attendance.config_title', 'Cấu hình Mạng WiFi (IP) Chấm công')}</>}
                    style={{ marginBottom: 24 }}
                    size="small"
                >
                    <Alert
                        title={t('attendance.config_alert_title', 'Bảo mật mạng WiFi')}
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

            {/* Liveness Challenge Modal */}
            <LivenessChallengeComponent
                visible={showLiveness}
                onComplete={handleLivenessComplete}
                onFail={handleLivenessFail}
                onCancel={handleLivenessCancel}
            />
        </div>
    );
}

export default AttendancePage;
