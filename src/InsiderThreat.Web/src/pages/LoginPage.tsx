import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons';
import { authService } from '../services/auth';
import './LoginPage.css';

const { Title, Text } = Typography;

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        try {
            const response = await authService.login(values.username, values.password);
            message.success(`Chào mừng ${response.user.fullName}!`);

            // Redirect dựa trên role
            if (response.user.role === 'Admin') {
                navigate('/dashboard');
            } else {
                navigate('/chat');
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Đăng nhập thất bại!');
            console.error('Login error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <Card className="login-card">
                <div className="login-header">
                    <Title level={2}>🔐 InsiderThreat System</Title>
                    <Text type="secondary">Quản lý bảo mật thiết bị USB</Text>
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    autoComplete="off"
                    size="large"
                    layout="vertical"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Tên đăng nhập"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Mật khẩu"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{ marginBottom: 12 }}
                        >
                            Đăng nhập
                        </Button>
                        <Button
                            block
                            icon={<ScanOutlined />}
                            onClick={() => navigate('/face-login')}
                        >
                            Đăng nhập bằng Face ID
                        </Button>
                    </Form.Item>
                </Form>

                <div className="login-footer">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Demo: admin / 123456
                    </Text>
                </div>
            </Card>
        </div>
    );
}

export default LoginPage;
