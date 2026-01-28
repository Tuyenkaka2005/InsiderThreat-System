import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Space } from 'antd';
import { CheckOutlined, UsbOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import type { LogEntry, Device } from '../types';
import type { ColumnsType } from 'antd/es/table';

interface BlockedDevice {
    deviceId: string;
    deviceName: string;
    computerName: string;
    ipAddress: string;
    timestamp: string;
}

function BlockedDevicesTable() {
    const [loading, setLoading] = useState(false);
    const [devices, setDevices] = useState<BlockedDevice[]>([]);

    const fetchBlockedDevices = async () => {
        setLoading(true);
        try {
            // 1. Fetch Logs & Whitelist song song
            const [logs, whitelist] = await Promise.all([
                api.get<LogEntry[]>('/api/logs?limit=100'), // Lấy nhiều log hơn để check
                api.get<Device[]>('/api/devices')
            ]);

            // Create Set of whitelisted Log DeviceIds (Clean format)
            const allowedDeviceIds = new Set(whitelist.map(d => d.deviceId.toUpperCase()));

            // 2. Filter logs: Critical + Blocked AND Not in Whitelist
            const blockedLogs = logs
                .filter((log) => log.severity === 'Critical' && log.actionTaken === 'Blocked')
                .filter((log) => log.deviceId && log.deviceName)
                .filter((log) => {
                    // Check if current deviceId is in whitelist
                    if (!log.deviceId) return false;
                    return !allowedDeviceIds.has(log.deviceId.toUpperCase());
                });

            // 3. Deduplicate
            const uniqueDevices = new Map<string, BlockedDevice>();
            blockedLogs.forEach((log) => {
                if (log.deviceId && !uniqueDevices.has(log.deviceId)) {
                    uniqueDevices.set(log.deviceId, {
                        deviceId: log.deviceId,
                        deviceName: log.deviceName || 'Unknown',
                        computerName: log.computerName,
                        ipAddress: log.ipAddress,
                        timestamp: log.timestamp,
                    });
                }
            });

            setDevices(Array.from(uniqueDevices.values()));
        } catch (error) {
            // message.error('Lỗi tải danh sách thiết bị bị chặn!');
            console.error('Error fetching blocked devices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlockedDevices();
        // Auto-refresh mỗi 10 giây
        const interval = setInterval(fetchBlockedDevices, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (device: BlockedDevice) => {
        try {
            // Gọi API thêm vào whitelist
            await api.post<Device>('/api/devices', {
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                description: `Approved from ${device.computerName}`,
                isAllowed: true,
            });

            message.success(`Đã phê duyệt thiết bị: ${device.deviceName}`);

            // Refresh list
            fetchBlockedDevices();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi phê duyệt thiết bị!');
            console.error('Error approving device:', error);
        }
    };

    const columns: ColumnsType<BlockedDevice> = [
        {
            title: 'Thiết bị',
            dataIndex: 'deviceName',
            key: 'deviceName',
            render: (name: string) => (
                <Space>
                    <UsbOutlined style={{ color: '#ff4d4f' }} />
                    <strong>{name}</strong>
                </Space>
            ),
        },
        {
            title: 'VID/PID',
            dataIndex: 'deviceId',
            key: 'deviceId',
            render: (deviceId: string) => {
                // Extract VID and PID from deviceId
                const vidMatch = deviceId.match(/VID_([0-9A-F]{4})/i);
                const pidMatch = deviceId.match(/PID_([0-9A-F]{4})/i);
                const vid = vidMatch ? vidMatch[1] : '????';
                const pid = pidMatch ? pidMatch[1] : '????';
                return <Tag color="orange">{`${vid}:${pid}`}</Tag>;
            },
        },
        {
            title: 'Máy tính',
            dataIndex: 'computerName',
            key: 'computerName',
        },
        {
            title: 'IP Address',
            dataIndex: 'ipAddress',
            key: 'ipAddress',
        },
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp: string) => new Date(timestamp).toLocaleString('vi-VN'),
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: BlockedDevice) => (
                <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => handleApprove(record)}
                >
                    Phê duyệt
                </Button>
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
            locale={{ emptyText: 'Không có thiết bị bị chặn' }}
        />
    );
}

export default BlockedDevicesTable;
