import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Space, Card } from 'antd';
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { LogEntry } from '../types';
import type { ColumnsType } from 'antd/es/table';

function DocumentsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Lấy logs với filter type=FileAccess
            const data = await api.get<LogEntry[]>('/api/logs?type=FileAccess&limit=50');
            setLogs(data);
        } catch (error) {
            console.error('Error fetching document logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 15000);
        return () => clearInterval(interval);
    }, []);

    const columns: ColumnsType<LogEntry> = [
        {
            title: 'Tài liệu / File',
            dataIndex: 'message',
            key: 'message',
            render: (text) => (
                <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <span style={{ wordBreak: 'break-all' }}>{text}</span>
                </Space>
            )
        },
        {
            title: 'Máy tính',
            dataIndex: 'computerName',
            key: 'computerName',
        },
        {
            title: 'Hành động',
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            render: (action) => {
                let color = 'default';
                if (action === 'Read') color = 'blue';
                if (action === 'Write') color = 'orange';
                if (action === 'Delete') color = 'red';
                if (action === 'Created') color = 'green';
                return <Tag color={color}>{action}</Tag>;
            }
        },
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp: string) => new Date(timestamp).toLocaleString('vi-VN'),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>📄 Nhật ký Truy cập Tài liệu</h2>
                <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
                    Làm mới
                </Button>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    loading={loading}
                    locale={{ emptyText: 'Chưa có nhật ký truy cập tài liệu nào' }}
                />
            </Card>
        </div>
    );
}

export default DocumentsPage;
