import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, CameraOutlined } from '@ant-design/icons';
import FaceRegistrationModal from '../components/FaceRegistrationModal';
import { api } from '../services/api';
import type { User } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form] = Form.useForm();
    const [isFaceModalVisible, setIsFaceModalVisible] = useState(false);
    const [selectedUserForFace, setSelectedUserForFace] = useState<{ id: string; name: string } | null>(null);

    const handleRegisterFace = (user: User) => {
        if (!user.id) return;
        setSelectedUserForFace({ id: user.id, name: user.fullName });
        setIsFaceModalVisible(true);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await api.get<User[]>('/api/users');
            setUsers(data);
        } catch (error) {
            message.error('Lỗi tải danh sách người dùng!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        form.setFieldsValue({
            ...user,
            passwordHash: '', // Không hiển thị password cũ
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/api/users/${id}`);
            message.success('Đã xóa người dùng thành công');
            fetchUsers();
        } catch (error) {
            message.error('Lỗi khi xóa người dùng');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            if (editingUser && editingUser.id) {
                // Update
                await api.put(`/api/users/${editingUser.id}`, values);
                message.success('Cập nhật người dùng thành công');
            } else {
                // Create
                await api.post('/api/users', values);
                message.success('Tạo người dùng mới thành công');
            }

            setIsModalVisible(false);
            fetchUsers();
        } catch (error: any) {
            if (error.errorFields) {
                // Validate error
                return;
            }
            message.error(error.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const columns: ColumnsType<User> = [
        {
            title: 'Họ tên',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (text) => (
                <Space>
                    <UserOutlined />
                    {text}
                </Space>
            )
        },
        {
            title: 'Tên đăng nhập',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={role === 'Admin' ? 'red' : 'blue'}>
                    {role}
                </Tag>
            )
        },
        {
            title: 'Phòng ban',
            dataIndex: 'department',
            key: 'department',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button
                        icon={<CameraOutlined />}
                        title="Đăng ký Face ID"
                        onClick={() => handleRegisterFace(record)}
                    />
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title="Bạn có chắc muốn xóa tài khoản này?"
                        onConfirm={() => record.id && handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            disabled={record.username === 'admin'}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];



    return (
        <div style={{ padding: 24 }}>
            {/* ... (existing table and add modal) ... */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>👤 Quản lý Nhân viên</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Thêm nhân viên
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title={editingUser ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}
                open={isModalVisible}
                onOk={handleOk}
                onCancel={() => setIsModalVisible(false)}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="username"
                        label="Tên đăng nhập"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
                    >
                        <Input disabled={!!editingUser} />
                    </Form.Item>

                    <Form.Item
                        name="passwordHash"
                        label={editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"}
                        rules={[{ required: !editingUser, message: 'Vui lòng nhập mật khẩu!' }]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item
                        name="fullName"
                        label="Họ và tên"
                        rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email!' },
                            { type: 'email', message: 'Email không hợp lệ!' }
                        ]}
                    >
                        <Input placeholder="example@gmail.com" />
                    </Form.Item>

                    <Form.Item
                        name="department"
                        label="Phòng ban"
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Vai trò"
                        initialValue="User"
                        rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
                    >
                        <Select>
                            <Option value="User">Nhân viên (User)</Option>
                            <Option value="Admin">Quản trị viên (Admin)</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Face Registration Modal */}
            <FaceRegistrationModal
                visible={isFaceModalVisible}
                onCancel={() => setIsFaceModalVisible(false)}
                userId={selectedUserForFace?.id || null}
                userName={selectedUserForFace?.name || ''}
            />
        </div>
    );
}

export default UsersPage;
