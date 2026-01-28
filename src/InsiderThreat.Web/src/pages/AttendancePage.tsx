import { useState, useEffect } from 'react';
import { Table, Tag, message, Typography } from 'antd';
import { ClockCircleOutlined, ScanOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { AttendanceLog } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

function AttendancePage() {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

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
            <Title level={2}>📅 Attendance History</Title>
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
