import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons';
import { authService } from '../services/auth';
import './LoginPage.css';

const { Title, Text } = Typography;

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        setErrorMessage(null); // Clear previous errors
        try {
            const response = await authService.login(values.username, values.password);
            message.success(`Chào mừng ${response.user.fullName}!`);

            // Redirect dựa trên role
            const role = response.user.role?.trim().toLowerCase();
            if (role === 'admin') {
                navigate('/dashboard');
            } else {
                navigate('/feed');
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.message || 'Đăng nhập thất bại! Kiểm tra lại tên đăng nhập và mật khẩu.';
            setErrorMessage(errMsg);
            message.error(errMsg);
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
                </div>

                {errorMessage && (
                    <Alert
                        message="Đăng nhập thất bại"
                        description={errorMessage}
                        type="error"
                        showIcon
                        closable
                        onClose={() => setErrorMessage(null)}
                        style={{ marginBottom: 16 }}
                    />
                )}

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
                    <Button
                        type="link"
                        onClick={() => navigate('/forgot-password')}
                        style={{ padding: 0, marginBottom: 8 }}
                    >
                        Quên mật khẩu?
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default LoginPage;
