import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import JSZip from 'jszip';
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
    GlobalOutlined,
    FileZipOutlined,
    DeleteOutlined,
    FileSearchOutlined,
    InboxOutlined,
    ExportOutlined,
    PieChartOutlined,
    LineChartOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import { Table, Tag, Card, Row, Col, Statistic, Select, Input, Space, Button, Typography, Avatar, Badge, App, Breadcrumb, Modal, Checkbox, Upload, Empty } from 'antd';
import { monitorService } from '../services/monitorService';
import type { MonitorLog, MonitorSummary } from '../services/monitorService';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, 
    BarChart, Bar
} from 'recharts';

const { Dragger } = Upload;
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
    documentLeakAlerts: number;
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

    // Archive view state
    const [archiveLogs, setArchiveLogs] = useState<MonitorLog[]>([]);
    const [isArchiveMode, setIsArchiveMode] = useState(false);
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [archiveFileName, setArchiveFileName] = useState('');
    const [selectedArchiveMachine, setSelectedArchiveMachine] = useState<MachineInfo | null>(null);

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

    // 📊 PHÂN TÍCH DỮ LIỆU BIỂU ĐỒ
    const chartData = useMemo(() => {
        if (!allLogs || allLogs.length === 0) return { trend: [], types: [], topMachines: [] };

        const hourlyMap = new Map();
        const typeMap = new Map();
        const machineMap = new Map();

        allLogs.forEach(log => {
            // 1. Xu hướng theo giờ
            const hour = dayjs(log.timestamp).format('HH:00');
            hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);

            // 2. Tỉ lệ loại vi phạm
            typeMap.set(log.logType, (typeMap.get(log.logType) || 0) + 1);

            // 3. Top máy rủi ro
            machineMap.set(log.computerName, (machineMap.get(log.computerName) || 0) + 1);
        });

        const trend = Array.from(hourlyMap.entries())
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => a.time.localeCompare(b.time));

        const types = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));
        
        const topMachines = Array.from(machineMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { trend, types, topMachines };
    }, [allLogs]);

    // 📊 PHÂN TÍCH DỮ LIỆU BIỂU ĐỒ CHI TIẾT (Cho máy đang chọn)
    const detailChartData = useMemo(() => {
        if (!detailLogs || detailLogs.length === 0) return { trend: [], types: [] };

        const hourlyMap = new Map();
        const typeMap = new Map();

        detailLogs.forEach(log => {
            const hour = dayjs(log.timestamp).format('HH:00');
            hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
            typeMap.set(log.logType, (typeMap.get(log.logType) || 0) + 1);
        });

        const trend = Array.from(hourlyMap.entries())
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => a.time.localeCompare(b.time));

        const types = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

        return { trend, types };
    }, [detailLogs]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#f5222d'];

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
                    documentLeakAlerts: 0,
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
            if (log.logType === 'DocumentLeak') {
                m.documentLeakAlerts++;
                if (!m.latestKeyword) m.latestKeyword = '[RÒ RỈ TÀI LIỆU]';
            }
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
        setSelectedArchiveMachine(null);
        setDetailLogs([]);
        setDetailTotal(0);
    };

    // 📂 PHÂN TÍCH MÁY TÍNH TRONG FILE ZIP (Offline Analysis)
    const archiveMachines = useMemo(() => {
        if (!isArchiveMode || archiveLogs.length === 0) return [];
        const map = new Map<string, MachineInfo>();
        
        archiveLogs.forEach(log => {
            const key = `${log.computerName}||${log.computerUser}`;
            if (!map.has(key)) {
                map.set(key, {
                    computerName: log.computerName,
                    computerUser: log.computerUser || 'Unknown',
                    ipAddress: log.ipAddress || 'Offline',
                    totalAlerts: 0,
                    criticalAlerts: 0,
                    keywordAlerts: 0,
                    screenshotAlerts: 0,
                    documentLeakAlerts: 0,
                    lastActivity: log.timestamp,
                });
            }
            const m = map.get(key)!;
            m.totalAlerts++;
            if (log.severityScore >= 7) m.criticalAlerts++;
            if (log.logType === 'KeywordDetected') m.keywordAlerts++;
            if (log.logType === 'Screenshot') m.screenshotAlerts++;
            if (new Date(log.timestamp) > new Date(m.lastActivity)) m.lastActivity = log.timestamp;
        });
        
        return Array.from(map.values()).sort((a, b) => b.totalAlerts - a.totalAlerts);
    }, [archiveLogs, isArchiveMode]);

    // Lọc log của máy đang chọn trong Archive
    const filteredArchiveLogs = useMemo(() => {
        if (!selectedArchiveMachine) return [];
        return archiveLogs.filter(l => 
            l.computerName === selectedArchiveMachine.computerName && 
            l.computerUser === selectedArchiveMachine.computerUser
        );
    }, [archiveLogs, selectedArchiveMachine]);

    const handleArchiveLogs = () => {
        let clearAfterExport = false;
        const targetDesc = selectedMachine 
            ? `máy [${selectedMachine.computerName}] - người dùng [${selectedMachine.computerUser}]`
            : "toàn bộ máy tính";

        Modal.confirm({
            title: `Nén & Lưu trữ Nhật ký - ${selectedMachine ? "Máy cục bộ" : "Toàn bộ"}`,
            icon: <FileZipOutlined style={{ color: '#722ed1' }} />,
            content: (
                <div>
                    <p>Hệ thống sẽ gom logs của <strong>{targetDesc}</strong> thành một file nén (.zip) để bạn tải về.</p>
                    <Checkbox onChange={(e) => clearAfterExport = e.target.checked}>
                        <Text type="danger">Xóa log tương ứng trên Server sau khi nén thành công</Text>
                    </Checkbox>
                </div>
            ),
            okText: 'Bắt đầu nén',
            cancelText: 'Hủy',
            okButtonProps: { style: { backgroundColor: '#722ed1' } },
                onOk: async () => {
                const hide = message.loading('Đang xử lý nén dữ liệu...', 0);
                try {
                    const blobData = await monitorService.archiveLogs({
                        computerName: selectedMachine?.computerName,
                        computerUser: selectedMachine?.computerUser,
                        clearLogs: clearAfterExport
                    });
                    
                    const url = window.URL.createObjectURL(blobData);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    // Tên file tải về
                    const timeStr = dayjs().format('YYYYMMDD_HHmm');
                    const fileName = selectedMachine 
                        ? `Log_${selectedMachine.computerName}_${selectedMachine.computerUser}_${timeStr}.zip`
                        : `InsiderThreat_FullBackup_${timeStr}.zip`;

                    link.setAttribute('download', fileName);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    
                    message.success(`Đã đóng gói thành công: ${fileName}`);
                    if (clearAfterExport) {
                        loadOverview();
                        if (selectedMachine) handleBack();
                    }
                } catch (error: any) {
                    console.error('Archive failed:', error);
                    message.error('Lỗi khi nén dữ liệu: ' + (error.response?.data?.message || 'Lỗi server'));
                } finally {
                    hide();
                }
            }
        });
    };

    const handleUploadArchive = async (file: any) => {
        const hide = message.loading('Đang giải nén dữ liệu lưu trữ...', 0);
        try {
            // Get the actual file object (handle antd UploadFile)
            const actualFile = file.originFileObj || file;
            
            console.log('📂 [DEBUG] Processing file:', {
                name: actualFile.name,
                size: actualFile.size,
                type: actualFile.type,
                lastModified: new Date(actualFile.lastModified).toLocaleString()
            });

            if (actualFile.size === 0) {
                throw new Error('Tệp rỗng (0 bytes).');
            }

            const reader = new FileReader();
            const zipBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(new Error('Lỗi khi đọc file bằng FileReader'));
                reader.readAsArrayBuffer(actualFile);
            });

            console.log(`📂 [DEBUG] File loaded into buffer: ${zipBuffer.byteLength} bytes`);

            // Check Magic Bytes
            const header = new Uint8Array(zipBuffer.slice(0, 4));
            const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
            console.log(`📂 [DEBUG] Header Hex: ${headerHex}`);

            // ZIP signature is PK (0x50 0x4B)
            const isZip = header[0] === 0x50 && header[1] === 0x4B;
            
            // Check if it's a JSON file (starts with { or [)
            const isJson = header[0] === 0x7B || header[0] === 0x5B;

            if (!isZip) {
                if (isJson) {
                    throw new Error(`Đây có vẻ là một tệp JSON, không phải tệp ZIP. Vui lòng nén tệp JSON này lại hoặc xuất tệp mới từ hệ thống.`);
                }
                throw new Error(`Tệp không phải định dạng ZIP hợp lệ (Header: ${headerHex}). Vui lòng kiểm tra lại.`);
            }

            const zip = new JSZip();
            const contents = await zip.loadAsync(zipBuffer, { 
                checkCRC32: true,
                createFolders: false
            });
            
            // Find the JSON file inside the ZIP
            const jsonFile = Object.values(contents.files).find(f => f.name.endsWith('.json'));
            if (!jsonFile) {
                // List all files for debugging
                const allFiles = Object.keys(contents.files).join(', ');
                console.error('❌ [DEBUG] No JSON found. Files in ZIP:', allFiles);
                throw new Error(`Không tìm thấy tệp dữ liệu .json bên trong file nén! (Các tệp tìm thấy: ${allFiles || 'không có'})`);
            }

            console.log(`📄 [DEBUG] Found entry: ${jsonFile.name}`);

            const jsonStr = await jsonFile.async('string');
            let rawData: any[] = [];
            
            try {
                const parsed = JSON.parse(jsonStr);
                rawData = Array.isArray(parsed) ? parsed : (parsed.data || []);
            } catch (e: any) {
                throw new Error(`Lỗi khi giải mã JSON bên trong file nén: ${e.message}`);
            }

            // 🛡️ CHUẨN HÓA DỮ LIỆU (Normalize PascalCase to camelCase)
            const normalizedLogs: MonitorLog[] = rawData.map((item: any) => ({
                id: item.id || item.Id,
                logType: item.logType || item.LogType || 'Unknown',
                severity: item.severity || item.Severity || 'Info',
                severityScore: item.severityScore !== undefined ? item.severityScore : (item.SeverityScore || 0),
                message: item.message || item.Message || '',
                computerName: item.computerName || item.ComputerName || 'Unknown',
                ipAddress: item.ipAddress || item.IpAddress || '',
                actionTaken: item.actionTaken || item.ActionTaken || '',
                detectedKeyword: item.detectedKeyword || item.DetectedKeyword,
                messageContext: item.messageContext || item.MessageContext,
                applicationName: item.applicationName || item.ApplicationName,
                windowTitle: item.windowTitle || item.WindowTitle,
                computerUser: item.computerUser || item.ComputerUser,
                timestamp: item.timestamp || item.Timestamp || new Date().toISOString()
            }));
            
            setArchiveLogs(normalizedLogs);
            setIsArchiveMode(true);
            setArchiveFileName(actualFile.name);
            setUploadModalVisible(false);
            message.success(`Đã mở thành công bản lưu trữ: ${actualFile.name} (${normalizedLogs.length} bản ghi)`);
        } catch (error: any) {
            console.error('❌ [DEBUG] Archive Parse Error:', error);
            message.error({
                content: (
                    <div style={{ textAlign: 'left' }}>
                        <Text strong>Lỗi khi xử lý file nén:</Text>
                        <br />
                        <Text type="danger" style={{ fontSize: '12px' }}>{error.message || 'Lỗi không xác định'}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '11px' }}>Vui lòng tải về bản log mới nhất từ Server và thử lại.</Text>
                    </div>
                ),
                duration: 6
            });
        } finally {
            hide();
        }
        return false; // Prevent auto upload
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
                    case 'DocumentLeak':
                        return <Tag icon={<WarningOutlined />} color="#f5222d" style={{ animation: 'pulse 2s infinite' }}>RÒ RỈ TÀI LIỆU</Tag>;
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
                <Space orientation="vertical" size={2}>
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
                    {!isArchiveMode && (
                        <>
                            <Button
                                icon={<FileSearchOutlined />}
                                onClick={() => setUploadModalVisible(true)}
                                style={{ borderColor: '#faad14', color: '#faad14' }}
                            >
                                Xem Log từ ZIP (Offline)
                            </Button>
                            <Button
                                icon={<FileZipOutlined />}
                                onClick={handleArchiveLogs}
                                style={{ borderColor: '#722ed1', color: '#722ed1' }}
                            >
                                Nén & Lưu trữ Log (ZIP)
                            </Button>
                        </>
                    )}
                    {isArchiveMode && (
                        <Button
                            type="primary"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                                setIsArchiveMode(false);
                                setArchiveLogs([]);
                                setArchiveFileName('');
                            }}
                        >
                            Đóng Chế độ xem Lưu trữ
                        </Button>
                    )}
                    <Button
                        type="primary" 
                        icon={<SecurityScanOutlined />} 
                        style={{ backgroundColor: '#722ed1' }}
                        onClick={() => message.info('Tính năng điều khiển Agent đang được phát triển...')}
                    >
                        Agent kiểm soát tại máy tính cá nhân
                    </Button>
                    {!isArchiveMode && (
                        <Button icon={<ReloadOutlined />} onClick={selectedMachine ? () => loadDetailLogs(selectedMachine.computerName, selectedMachine.computerUser) : loadOverview} loading={loading}>
                            {t('common.refresh', 'Làm mới')}
                        </Button>
                    )}
                </Space>
            </div>

            {/* Archive Notification Bar */}
            {isArchiveMode && (
                <Card size="small" style={{ marginBottom: 24, background: '#fff7e6', border: '1px solid #faad14' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <FileZipOutlined style={{ fontSize: 24, color: '#faad14' }} />
                            <div>
                                <Title level={4} style={{ margin: 0 }}>Chế độ Xem Lưu trữ (Offline View)</Title>
                                <Text type="secondary">Đang hiển thị dữ liệu từ tệp: <Text strong color="orange">{archiveFileName}</Text> ({archiveLogs.length} bản ghi)</Text>
                            </div>
                        </Space>
                        <Button icon={<ExportOutlined />} onClick={() => setIsArchiveMode(false)}>Quay lại Dữ liệu Trực tiếp</Button>
                    </Space>
                </Card>
            )}

            {/* Summary Stats (Hide in archive mode to avoid confusion) */}
            {!isArchiveMode && (
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
            )}

            {/* 📈 ANALYTICS DASHBOARD - THỐNG KÊ CHI TIẾT BẰNG BIỂU ĐỒ */}
            {!selectedMachine && !isArchiveMode && allLogs.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {/* Xu hướng theo thời gian */}
                <Col xs={24} lg={12}>
                    <Card title={<Space><LineChartOutlined /> Xu hướng vi phạm trong ngày</Space>} bordered={false} style={{ borderRadius: 12, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <AreaChart data={chartData.trend}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
                                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorCount)" name="Số lượng" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                {/* Tỉ lệ loại vi phạm */}
                <Col xs={24} md={12} lg={6}>
                    <Card title={<Space><PieChartOutlined /> Loại vi phạm</Space>} bordered={false} style={{ borderRadius: 12, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={chartData.types}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.types.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                {/* Top máy rủi ro */}
                <Col xs={24} md={12} lg={6}>
                    <Card title={<Space><BarChartOutlined /> Top 5 Máy rủi ro</Space>} bordered={false} style={{ borderRadius: 12, height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart layout="vertical" data={chartData.topMachines}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} style={{ fontSize: '11px' }} />
                                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                                    <Bar dataKey="count" fill="#ff4d4f" radius={[0, 4, 4, 0]} barSize={20} name="Số cảnh báo" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>
            )}

            {/* ═══════ ARCHIVE VIEW (CHẾ ĐỘ XEM NGOẠI TUYẾN) ═══════ */}
            {isArchiveMode && (
                <>
                    {/* Quay lại danh sách máy trong Archive */}
                    {selectedArchiveMachine && (
                        <div style={{ marginBottom: 16 }}>
                            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => setSelectedArchiveMachine(null)}>
                                Quay lại danh sách máy trong file nén
                            </Button>
                        </div>
                    )}

                    {!selectedArchiveMachine ? (
                        <Card title={`Danh sách máy tính tìm thấy trong tệp [${archiveFileName}]`}>
                            <Row gutter={[16, 16]}>
                                {archiveMachines.map(m => (
                                    <Col xs={24} sm={12} lg={8} key={m.computerName + m.computerUser}>
                                        <Card 
                                            hoverable 
                                            size="small" 
                                            onClick={() => setSelectedArchiveMachine(m)}
                                            style={{ borderLeft: '4px solid #faad14', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Space>
                                                    <Avatar icon={<DesktopOutlined />} style={{ backgroundColor: '#faad14' }} />
                                                    <div>
                                                        <Text strong>{m.computerName}</Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>{m.computerUser}</Text>
                                                    </div>
                                                </Space>
                                                <div style={{ textAlign: 'right' }}>
                                                    <Badge count={m.totalAlerts} overflowCount={999} color="#faad14" />
                                                    <div style={{ fontSize: 10, color: '#8c8c8c' }}>logs</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Card>
                    ) : (
                        <Card title={<Space><DesktopOutlined /> Nhật ký chi tiết: {selectedArchiveMachine.computerName} ({selectedArchiveMachine.computerUser})</Space>} bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <Table
                                columns={columns}
                                dataSource={filteredArchiveLogs}
                                rowKey={(record) => `${record.timestamp}-${Math.random()}`}
                                pagination={{ pageSize: 20 }}
                                size="small"
                            />
                        </Card>
                    )}
                </>
            )}

            {/* ═══════ LEVEL 1: Machine List ═══════ */}
            {!selectedMachine && !isArchiveMode && (
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
                        {filteredMachines.map((machine: MachineInfo) => {
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
                                                <Col span={6}>
                                                    <div style={{ textAlign: 'center', background: '#f5f5f5', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d39c4' }}>{machine.totalAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Tổng</div>
                                                    </div>
                                                </Col>
                                                <Col span={6}>
                                                    <div style={{ textAlign: 'center', background: '#fff1f0', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#cf1322' }}>{machine.criticalAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Nguy hiểm</div>
                                                    </div>
                                                </Col>
                                                <Col span={6}>
                                                    <div style={{ textAlign: 'center', background: '#f9f0ff', borderRadius: '6px', padding: '4px 0' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#531dab' }}>{machine.keywordAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Từ khóa</div>
                                                    </div>
                                                </Col>
                                                <Col span={6}>
                                                    <div style={{ textAlign: 'center', background: machine.documentLeakAlerts > 0 ? '#ffccc7' : '#fafafa', borderRadius: '6px', padding: '4px 0', border: machine.documentLeakAlerts > 0 ? '1px solid #ff4d4f' : '1px solid transparent' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: machine.documentLeakAlerts > 0 ? '#f5222d' : '#d9d9d9' }}>{machine.documentLeakAlerts}</div>
                                                        <div style={{ fontSize: '10px', color: machine.documentLeakAlerts > 0 ? '#cf1322' : '#8c8c8c' }}>Rò rỉ</div>
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
                            {selectedMachine.documentLeakAlerts > 0 && <Tag color="#f5222d">{selectedMachine.documentLeakAlerts} rò rỉ tài liệu</Tag>}
                        </Space>
                    </Card>

                    {/* 📈 MACHINE-SPECIFIC ANALYTICS */}
                    {detailLogs.length > 0 && (
                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col xs={24} lg={16}>
                                <Card title={<Space><LineChartOutlined /> Xu hướng hoạt động của máy</Space>} size="small" bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '100%', height: 200 }}>
                                        <ResponsiveContainer>
                                            <AreaChart data={detailChartData.trend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="time" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                                                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                                                <Tooltip />
                                                <Area type="monotone" dataKey="count" stroke="#1890ff" fill="#e6f7ff" name="Số sự kiện" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </Col>
                            <Col xs={24} lg={8}>
                                <Card title={<Space><PieChartOutlined /> Phân bổ vi phạm</Space>} size="small" bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <div style={{ width: '100%', height: 200 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={detailChartData.types}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={60}
                                                    dataKey="value"
                                                >
                                                    {detailChartData.types.map((entry, index) => (
                                                        <Cell key={`cell-detail-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    )}

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
                                    <Option value="DocumentLeak">Rò rỉ Tài liệu</Option>
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

            {/* Upload Modal for Archives */}
            <Modal
                title="Mở Nhật ký Lưu trữ (.zip)"
                open={uploadModalVisible}
                onCancel={() => setUploadModalVisible(false)}
                footer={null}
                width={600}
            >
                <div style={{ padding: '20px 0' }}>
                    <Dragger
                        name="file"
                        accept=".zip"
                        multiple={false}
                        beforeUpload={handleUploadArchive}
                        showUploadList={false}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: '#faad14' }} />
                        </p>
                        <p className="ant-upload-text">Nhấp hoặc kéo thả tệp ZIP lưu trữ vào đây</p>
                        <p className="ant-upload-hint">
                            Tệp phải được xuất từ chức năng "Nén & Lưu trữ" của hệ thống InsiderThreat.
                        </p>
                    </Dragger>
                </div>
            </Modal>
        </div>
    );
};

export default MonitorLogsPage;
