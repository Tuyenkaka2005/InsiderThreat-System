import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Popconfirm, Space } from 'antd';
import { DeleteOutlined, UsbOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { Device } from '../types';
import type { ColumnsType } from 'antd/es/table';

function WhitelistTable() {
    const [loading, setLoading] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);

    const fetchWhitelist = async () => {
        setLoading(true);
        try {
            const data = await api.get<Device[]>('/api/devices');
            setDevices(data);
        } catch (error) {
            message.error('Lỗi tải danh sách whitelist!');
            console.error('Error fetching whitelist:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWhitelist();
        // Auto-refresh every 15 seconds
        const interval = setInterval(fetchWhitelist, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleRemove = async (id: string, deviceName: string) => {
        try {
            await api.delete(`/api/devices/${id}`);
            message.success(`Đã xóa thiết bị: ${deviceName}`);
            fetchWhitelist();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi xóa thiết bị!');
            console.error('Error removing device:', error);
        }
    };

    const columns: ColumnsType<Device> = [
        {
            title: 'Thiết bị',
            dataIndex: 'deviceName',
            key: 'deviceName',
            render: (name: string) => (
                <Space>
                    <UsbOutlined style={{ color: '#52c41a' }} />
                    <strong>{name}</strong>
                </Space>
            ),
        },
        {
            title: 'VID/PID',
            dataIndex: 'deviceId',
            key: 'deviceId',
            render: (deviceId: string) => {
                const vidMatch = deviceId.match(/VID_([0-9A-F]{4})/i);
                const pidMatch = deviceId.match(/PID_([0-9A-F]{4})/i);
                const vid = vidMatch ? vidMatch[1] : '????';
                const pid = pidMatch ? pidMatch[1] : '????';
                return <Tag color="green">{`${vid}:${pid}`}</Tag>;
            },
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Ngày thêm',
            dataIndex: 'addedAt',
            key: 'addedAt',
            render: (date: string) =>
                date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: Device) => (
                <Popconfirm
                    title="Xác nhận xóa"
                    description={`Bạn có chắc muốn xóa "${record.deviceName}" khỏi whitelist?`}
                    onConfirm={() => record.id && handleRemove(record.id, record.deviceName)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                >
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                    >
                        Xóa
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={devices}
            rowKey="deviceId"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'Chưa có thiết bị trong whitelist' }}
        />
    );
}

export default WhitelistTable;
