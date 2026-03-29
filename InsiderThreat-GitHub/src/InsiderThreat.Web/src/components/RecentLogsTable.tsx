import { useState, useEffect } from 'react';
import { Table, Tag, Select, Space } from 'antd';
import { api } from '../services/api';
import type { LogEntry } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

interface RecentLogsTableProps {
    defaultFilter?: string;
}

function RecentLogsTable({ defaultFilter = 'All' }: RecentLogsTableProps) {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<string>(defaultFilter);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await api.get<LogEntry[]>('/api/logs');
            setLogs(data.slice(0, 20)); // Lấy 20 logs mới nhất
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical':
                return 'red';
            case 'Warning':
                return 'orange';
            case 'Info':
                return 'blue';
            default:
                return 'default';
        }
    };

    const filteredLogs = filter === 'All'
        ? logs
        : logs.filter((log) => log.severity === filter);

    const columns: ColumnsType<LogEntry> = [
        {
            title: 'Mức độ',
            dataIndex: 'severity',
            key: 'severity',
            width: 100,
            render: (severity: string) => (
                <Tag color={getSeverityColor(severity)}>{severity}</Tag>
            ),
        },
        {
            title: 'Thông báo',
            dataIndex: 'message',
            key: 'message',
            width: 400,
            ellipsis: true,
        },
        {
            title: 'Máy tính',
            dataIndex: 'computerName',
            key: 'computerName',
            width: 150,
        },
        {
            title: 'IP',
            dataIndex: 'ipAddress',
            key: 'ipAddress',
            width: 130,
        },
        {
            title: 'Hành động',
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            width: 100,
            render: (action: string) => {
                const color = action === 'Blocked' ? 'red' : 'green';
                return <Tag color={color}>{action}</Tag>;
            },
        },
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180,
            render: (timestamp: string) => new Date(timestamp).toLocaleString('vi-VN'),
        },
    ];

    return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
                <span style={{ marginRight: 8 }}>Lọc theo mức độ:</span>
                <Select value={filter} onChange={setFilter} style={{ width: 150 }}>
                    <Option value="All">Tất cả</Option>
                    <Option value="Critical">Critical</Option>
                    <Option value="Warning">Warning</Option>
                    <Option value="Info">Info</Option>
                </Select>
            </div>

            <Table
                columns={columns}
                dataSource={filteredLogs}
                rowKey={(record) => record.id || record.timestamp}
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1000 }}
                locale={{ emptyText: 'Chưa có log nào' }}
            />
        </Space>
    );
}

export default RecentLogsTable;
