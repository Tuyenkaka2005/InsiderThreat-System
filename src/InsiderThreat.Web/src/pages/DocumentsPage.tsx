import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Space, Card } from 'antd';
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import type { LogEntry } from '../types';
import type { ColumnsType } from 'antd/es/table';

function DocumentsPage() {
    const { t } = useTranslation();
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
            title: t('docs.col_doc', 'Tài liệu / File'),
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
            title: t('docs.col_account', 'Tài khoản / Máy tính'),
            dataIndex: 'computerName',
            key: 'computerName',
        },
        {
            title: t('docs.col_action', 'Hành động'),
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            render: (action) => {
                let color = 'default';
                if (action === 'Read') color = 'blue';
                if (action === 'Write') color = 'orange';
                if (action === 'Delete') color = 'red';
                if (action === 'Create' || action === 'Created') color = 'green';
                if (action === 'Download') color = 'cyan';
                if (action === 'Cảnh báo Camera' || action === 'CameraWarning') color = 'volcano';
                return <Tag color={color}>{action}</Tag>;
            }
        },
        {
            title: t('docs.col_time', 'Thời gian'),
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp: string) => new Date(timestamp).toLocaleString('vi-VN'),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>📄 {t('docs.title', 'Nhật ký Truy cập Tài liệu')}</h2>
                <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
                    {t('docs.btn_refresh', 'Làm mới')}
                </Button>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    loading={loading}
                    locale={{ emptyText: t('docs.empty_text', 'Chưa có nhật ký truy cập tài liệu nào') }}
                />
            </Card>
        </div>
    );
}

export default DocumentsPage;
