import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Card, Row, Col, Statistic, Select, Input, Space, Button, Typography, Avatar, Badge, App, Breadcrumb } from 'antd';
import { 
    SecurityScanOutlined, 
    CameraOutlined, 
    WarningOutlined, 
    KeyOutlined, 
    ReloadOutlined,
    SearchOutlined,
    DesktopOutlined,
    UserOutlined,
    ArrowLeftOutlined,
    ClockCircleOutlined,
    HomeOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import { monitorService } from '../services/monitorService';
import type { MonitorLog, MonitorSummary } from '../services/monitorService';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// Grouped machine info derived from logs
interface MachineInfo {
    computerName: string;
    computerUser: string;
    ipAddress: string;
    totalAlerts: number;
    criticalAlerts: number;
    keywordAlerts: number;
    screenshotAlerts: number;
    lastActivity: string;
    latestKeyword?: string;
}

const MonitorLogsPage: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [allLogs, setAllLogs] = useState<MonitorLog[]>([]);
    const [summary, setSummary] = useState<MonitorSummary | null>(null);
    const navigate = useNavigate();

    // Two-level navigation state
    const [selectedMachine, setSelectedMachine] = useState<MachineInfo | null>(null);

    // Detail view state
    const [detailPage, setDetailPage] = useState(1);
    const [detailPageSize] = useState(20);
    const [detailLogs, setDetailLogs] = useState<MonitorLog[]>([]);
    const [detailTotal, setDetailTotal] = useState(0);
    const [logType, setLogType] = useState<string | undefined>(undefined);
    const [minSeverity, setMinSeverity] = useState<number | undefined>(undefined);

    // Machine list search
    const [machineSearch, setMachineSearch] = useState('');

    // Load all logs to build machine list
    const loadOverview = async () => {
        setLoading(true);
        try {
            const [logsRes, summaryRes] = await Promise.all([
                monitorService.getLogs({ pageSize: 500 }),
                monitorService.getSummary()
            ]);
            setAllLogs(logsRes.data);
            setSummary(summaryRes);
        } catch (error) {
            console.error('Failed to load monitor logs:', error);
            message.error(t('monitor.load_error', 'Không thể tải dữ liệu giám sát'));
        } finally {
            setLoading(false);
        }
    };

    // Load detail logs for a specific machine
    const loadDetailLogs = async (computerName: string, computerUser: string) => {
        setLoading(true);
        try {
            const res = await monitorService.getLogs({
                computerName,
                computerUser,
                logType,
                minSeverity,
                page: detailPage,
                pageSize: detailPageSize,
            });
            setDetailLogs(res.data);
            setDetailTotal(res.totalCount);
        } catch (error) {
            console.error('Failed to load detail logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, []);

    useEffect(() => {
        if (selectedMachine) {
            loadDetailLogs(selectedMachine.computerName, selectedMachine.computerUser);
        }
    }, [selectedMachine, detailPage, logType, minSeverity]);

    // Build machine list from all logs
    const machines: MachineInfo[] = useMemo(() => {
        const map = new Map<string, MachineInfo>();
        for (const log of allLogs) {
            const key = `${log.computerName}||${log.computerUser}`;
            if (!map.has(key)) {
                map.set(key, {
                    computerName: log.computerName,
                    computerUser: log.computerUser || 'Unknown',
                    ipAddress: log.ipAddress,
                    totalAlerts: 0,
                    criticalAlerts: 0,
                    keywordAlerts: 0,
                    screenshotAlerts: 0,
                    lastActivity: log.timestamp,
                    latestKeyword: undefined,
                });
            }
            const m = map.get(key)!;
            m.totalAlerts++;
            if (log.severityScore >= 7) m.criticalAlerts++;
            if (log.logType === 'KeywordDetected') {
                m.keywordAlerts++;
                if (!m.latestKeyword && log.detectedKeyword) m.latestKeyword = log.detectedKeyword;
            }
            if (log.logType === 'Screenshot') m.screenshotAlerts++;
            if (new Date(log.timestamp) > new Date(m.lastActivity)) {
                m.lastActivity = log.timestamp;
            }
        }
        return Array.from(map.values()).sort((a, b) => 
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );
    }, [allLogs]);

    // Filter machines by search
    const filteredMachines = useMemo(() => {
        if (!machineSearch) return machines;
        const q = machineSearch.toLowerCase();
        return machines.filter(m => 
            m.computerName.toLowerCase().includes(q) ||
            m.computerUser.toLowerCase().includes(q) ||
            m.ipAddress.toLowerCase().includes(q)
        );
    }, [machines, machineSearch]);

    const getSeverityColor = (score: number) => {
        if (score >= 9) return '#ff4d4f';
        if (score >= 7) return '#faad14';
        if (score >= 5) return '#1890ff';
        return '#52c41a';
    };

    const getRiskLevel = (machine: MachineInfo) => {
        if (machine.criticalAlerts > 5) return { color: '#ff4d4f', text: 'Nguy hiểm', status: 'error' as const };
        if (machine.criticalAlerts > 0) return { color: '#faad14', text: 'Cảnh báo', status: 'warning' as const };
        if (machine.totalAlerts > 0) return { color: '#1890ff', text: 'Bình thường', status: 'processing' as const };
        return { color: '#52c41a', text: 'An toàn', status: 'success' as const };
    };

    const handleMachineClick = (machine: MachineInfo) => {
        setSelectedMachine(machine);
        setDetailPage(1);
        setLogType(undefined);
        setMinSeverity(undefined);
    };

    const handleBack = () => {
        setSelectedMachine(null);
        setDetailLogs([]);
        setDetailTotal(0);
    };

    // ─── Detail View Columns ──────────────────────────
    const columns = [
        {
            title: t('monitor.timestamp', 'Thời gian'),
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm:ss'),
        },
        {
            title: t('monitor.type', 'Loại'),
            dataIndex: 'logType',
            key: 'logType',
            width: 150,
            render: (type: string) => {
                switch (type) {
                    case 'Screenshot':
                        return <Tag icon={<CameraOutlined />} color="cyan">{t('monitor.type_screenshot', 'Chụp màn hình')}</Tag>;
                    case 'KeywordDetected':
                        return <Tag icon={<KeyOutlined />} color="purple">{t('monitor.type_keyword', 'Từ khóa nhạy cảm')}</Tag>;
                    case 'NetworkDisconnect':
                        return <Tag icon={<GlobalOutlined />} color="error">{t('monitor.type_network', 'Mất kết nối')}</Tag>;
                    default:
                        return <Tag>{type}</Tag>;
                }
            }
        },
        {
            title: t('monitor.severity', 'Mức độ'),
            dataIndex: 'severityScore',
            key: 'severityScore',
            width: 100,
            render: (score: number) => (
                <Tag color={getSeverityColor(score)} style={{ fontWeight: 'bold' }}>
                    {score}/10
                </Tag>
            )
        },
        {
            title: t('monitor.content', 'Nội dung/Bối cảnh'),
            key: 'content',
            render: (record: MonitorLog) => (
                <Space direction="vertical" size={2}>
                    {record.detectedKeyword && (
                        <Text strong type="danger">
                            <KeyOutlined /> {t('monitor.keyword', 'Từ khóa')}: {record.detectedKeyword}
                        </Text>
                    )}
                    <div style={{ maxWidth: '400px', whiteSpace: 'pre-wrap' }}>
                        {record.messageContext || record.message}
                    </div>
                    {(record.applicationName || record.windowTitle) && (
                        <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                            {record.applicationName} {record.windowTitle ? ` - ${record.windowTitle}` : ''}
                        </Text>
                    )}
                </Space>
            )
        },
        {
            title: t('monitor.assessment', 'Đánh giá rủi ro'),
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            width: 250,
            render: (text: string) => <Text style={{ fontSize: '13px' }}>{text}</Text>
        }
    ];

    // ─── RENDER ──────────────────────────
    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    {selectedMachine ? (
                        <Breadcrumb items={[
                            { title: <span onClick={handleBack} style={{ cursor: 'pointer', color: '#1890ff' }}><HomeOutlined /> Tất cả máy tính</span> },
                            { title: <span><DesktopOutlined /> {selectedMachine.computerName} ({selectedMachine.computerUser})</span> },
                        ]} />
                    ) : null}
                    <Title level={2} style={{ margin: selectedMachine ? '8px 0 0' : 0 }}>
                        <SecurityScanOutlined /> {selectedMachine 
                            ? `Chi tiết giám sát - ${selectedMachine.computerName}`
                            : t('monitor.title', 'Giám sát Agent Máy tính Cá nhân')
                        }
                    </Title>
                </div>
                <Space>
                    <Button 
                        icon={<ArrowLeftOutlined />} 
                        onClick={selectedMachine ? handleBack : () => navigate(-1)}
                    >
                        {selectedMachine ? 'Quay lại' : 'Trở lại'}
                    </Button>
                    <Button
                        type="primary" 
                        icon={<SecurityScanOutlined />} 
                        style={{ backgroundColor: '#722ed1' }}
                        onClick={() => message.info('Tính năng điều khiển Agent đang được phát triển...')}
                    >
                        Agent kiểm soát tại máy tính cá nhân
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={selectedMachine ? () => loadDetailLogs(selectedMachine.computerName, selectedMachine.computerUser) : loadOverview} loading={loading}>
                        {t('common.refresh', 'Làm mới')}
                    </Button>
                </Space>
            </div>

            {/* Summary Stats */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={6}>
                    <Card variant="borderless" style={{ background: '#f0f5ff' }}>
                        <Statistic
                            title={t('monitor.total_today', 'Tổng cảnh báo hôm nay')}
                            value={summary?.totalToday || 0}
                            styles={{ content: { color: '#1d39c4' } }}
                            prefix={<SecurityScanOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" style={{ background: '#fff1f0' }}>
                        <Statistic
                            title={t('monitor.critical_today', 'Nguy hiểm (>=7)')}
                            value={summary?.criticalToday || 0}
                            styles={{ content: { color: '#cf1322' } }}
                            prefix={<WarningOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" style={{ background: '#e6fffb' }}>
                        <Statistic
                            title={t('monitor.screenshots_today', 'Ảnh chụp màn hình')}
                            value={summary?.screenshotsToday || 0}
                            styles={{ content: { color: '#08979c' } }}
                            prefix={<CameraOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" style={{ background: '#f9f0ff' }}>
                        <Statistic
                            title={t('monitor.keywords_today', 'Từ khóa nhạy cảm')}
                            value={summary?.keywordsToday || 0}
                            styles={{ content: { color: '#531dab' } }}
                            prefix={<KeyOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* ═══════ LEVEL 1: Machine List ═══════ */}
            {!selectedMachine && (
                <>
                    {/* Search bar */}
                    <Card style={{ marginBottom: '16px' }} size="small">
                        <Space size="large">
                            <div>
                                <Text type="secondary" style={{ marginRight: 8 }}>Tìm kiếm máy tính:</Text>
                                <Input
                                    placeholder="Nhập tên máy, tài khoản, IP..."
                                    style={{ width: 300 }}
                                    prefix={<SearchOutlined />}
                                    value={machineSearch}
                                    onChange={e => setMachineSearch(e.target.value)}
                                    allowClear
                                />
                            </div>
                            <Text type="secondary">
                                Tìm thấy <Text strong>{filteredMachines.length}</Text> máy tính đang được giám sát
                            </Text>
                        </Space>
                    </Card>

                    {/* Machine Cards */}
                    <Row gutter={[16, 16]}>
                        {filteredMachines.map((machine) => {
                            const risk = getRiskLevel(machine);
                            return (
                                <Col xs={24} sm={12} lg={8} xl={6} key={`${machine.computerName}-${machine.computerUser}`}>
                                    <Badge.Ribbon text={risk.text} color={risk.color}>
                                        <Card
                                            hoverable
                                            onClick={() => handleMachineClick(machine)}
                                            style={{ 
                                                borderLeft: `4px solid ${risk.color}`,
                                                cursor: 'pointer',
                                                transition: 'all 0.3s',
                                            }}
                                            styles={{ body: { padding: '16px' }}}
                                        >
                                            {/* Machine header */}
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                                <Avatar 
                                                    icon={<DesktopOutlined />} 
                                                    style={{ backgroundColor: risk.color, marginRight: '12px' }}
                                                    size="large"
                                                />
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <Text strong style={{ display: 'block', fontSize: '15px' }} ellipsis>
                                                        {machine.computerName}
                                                    </Text>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                        <UserOutlined /> {machine.computerUser}
                                                    </Text>
                                                </div>
                                            </div>

                                            {/* IP */}
                                            <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                <GlobalOutlined /> {machine.ipAddress}
                                            </Text>

                                            {/* Stats row */}
                                            <Row gutter={8} style={{ marginBottom: '8px' }}>
                                                <Col span={8}>
                                                    <div style={{ textAlign: 'center', background: '#f5f5f5', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d39c4' }}>{machine.totalAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Tổng</div>
                                                    </div>
                                                </Col>
                                                <Col span={8}>
                                                    <div style={{ textAlign: 'center', background: '#fff1f0', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#cf1322' }}>{machine.criticalAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Nguy hiểm</div>
                                                    </div>
                                                </Col>
                                                <Col span={8}>
                                                    <div style={{ textAlign: 'center', background: '#f9f0ff', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#531dab' }}>{machine.keywordAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Từ khóa</div>
                                                    </div>
                                                </Col>
                                            </Row>

                                            {/* Latest keyword */}
                                            {machine.latestKeyword && (
                                                <Tag color="red" style={{ marginBottom: '4px', fontSize: '11px' }}>
                                                    <KeyOutlined /> {machine.latestKeyword}
                                                </Tag>
                                            )}

                                            {/* Last activity */}
                                            <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '4px' }}>
                                                <ClockCircleOutlined /> Lần cuối: {dayjs(machine.lastActivity).format('DD/MM HH:mm')}
                                            </div>
                                        </Card>
                                    </Badge.Ribbon>
                                </Col>
                            );
                        })}
                        {filteredMachines.length === 0 && (
                            <Col span={24} style={{ textAlign: 'center', padding: '60px 0' }}>
                                <DesktopOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                                <div style={{ marginTop: '16px', color: '#8c8c8c' }}>
                                    Không tìm thấy máy tính nào
                                </div>
                            </Col>
                        )}
                    </Row>
                </>
            )}

            {/* ═══════ LEVEL 2: Detail View ═══════ */}
            {selectedMachine && (
                <>
                    {/* Machine Info Summary Bar */}
                    <Card size="small" style={{ marginBottom: '16px', background: '#fafafa' }}>
                        <Space size="large" wrap>
                            <Space>
                                <Avatar icon={<DesktopOutlined />} style={{ backgroundColor: getRiskLevel(selectedMachine).color }} />
                                <div>
                                    <Text strong>{selectedMachine.computerName}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        <UserOutlined /> {selectedMachine.computerUser} &nbsp;|&nbsp; 
                                        <GlobalOutlined /> {selectedMachine.ipAddress}
                                    </Text>
                                </div>
                            </Space>
                            <Tag color="blue">{selectedMachine.totalAlerts} cảnh báo</Tag>
                            <Tag color="red">{selectedMachine.criticalAlerts} nguy hiểm</Tag>
                            <Tag color="purple">{selectedMachine.keywordAlerts} từ khóa</Tag>
                            <Tag color="cyan">{selectedMachine.screenshotAlerts} ảnh chụp</Tag>
                        </Space>
                    </Card>

                    {/* Filters */}
                    <Card style={{ marginBottom: '16px' }} size="small">
                        <Space size="large" wrap>
                            <div>
                                <Text type="secondary" style={{ marginRight: 8 }}>{t('monitor.filter_type', 'Loại sự kiện')}:</Text>
                                <Select 
                                    placeholder={t('monitor.all', 'Tất cả')} 
                                    style={{ width: 160 }} 
                                    allowClear 
                                    value={logType}
                                    onChange={v => { setLogType(v); setDetailPage(1); }}
                                >
                                    <Option value="Screenshot">{t('monitor.type_screenshot', 'Chụp màn hình')}</Option>
                                    <Option value="KeywordDetected">{t('monitor.type_keyword', 'Từ khóa nhạy cảm')}</Option>
                                    <Option value="NetworkDisconnect">{t('monitor.type_network', 'Mất kết nối')}</Option>
                                </Select>
                            </div>
                            <div>
                                <Text type="secondary" style={{ marginRight: 8 }}>{t('monitor.filter_severity', 'Mức độ tối thiểu')}:</Text>
                                <Select 
                                    placeholder={t('monitor.all', 'Tất cả')} 
                                    style={{ width: 120 }} 
                                    allowClear 
                                    value={minSeverity}
                                    onChange={v => { setMinSeverity(v); setDetailPage(1); }}
                                >
                                    <Option value={1}>1+</Option>
                                    <Option value={4}>4+</Option>
                                    <Option value={7}>7+</Option>
                                    <Option value={9}>9+</Option>
                                </Select>
                            </div>
                        </Space>
                    </Card>

                    {/* Detail Table */}
                    <Table
                        columns={columns}
                        dataSource={detailLogs}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            current: detailPage,
                            pageSize: detailPageSize,
                            total: detailTotal,
                            onChange: (p) => setDetailPage(p),
                            showSizeChanger: false,
                        }}
                    />
                </>
            )}
        </div>
    );
};

export default MonitorLogsPage;
