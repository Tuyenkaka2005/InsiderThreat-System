import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import Logo from '../components/Logo';
import { useTheme } from '../context/ThemeContext';
import './LoginPage.css';

const { Title, Text } = Typography;

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { t } = useTranslation();

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        setErrorMessage(null); // Clear previous errors
        try {
            const response = await authService.login(values.username, values.password);
            message.success(t('auth.welcome', { name: response.user.fullName, defaultValue: `Chào mừng ${response.user.fullName}!` }));

            // Redirect dựa trên role
            const role = response.user.role?.trim().toLowerCase();
            if (role === 'admin') {
                navigate('/dashboard');
            } else {
                navigate('/feed');
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.message || t('auth.login_failed_desc', 'Đăng nhập thất bại! Kiểm tra lại tên đăng nhập và mật khẩu.');
            setErrorMessage(errMsg);
            message.error(errMsg);
            console.error('Login error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-theme-toggle">
                <LanguageToggle />
                <ThemeToggle />
            </div>
            <Card className="login-card">
                <div className="login-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <Logo width={64} height={64} showText={false} />
                    </div>
                    <Title level={2}>InsiderThreat System</Title>
                </div>

                {errorMessage && (
                    <Alert
                        message={t('auth.login_failed', 'Đăng nhập thất bại')}
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
                        rules={[{ required: true, message: t('auth.require_username', 'Vui lòng nhập tên đăng nhập!') }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder={t('auth.username', 'Tên đăng nhập')}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: t('auth.require_password', 'Vui lòng nhập mật khẩu!') }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder={t('auth.password', 'Mật khẩu')}
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
                            {t('auth.login', 'Đăng nhập')}
                        </Button>
                        <Button
                            block
                            icon={<ScanOutlined />}
                            onClick={() => navigate('/face-login')}
                        >
                            {t('auth.face_login', 'Đăng nhập bằng Face ID')}
                        </Button>
                    </Form.Item>
                </Form>

                <div className="login-footer">
                    <Button
                        type="link"
                        onClick={() => navigate('/forgot-password')}
                        style={{ padding: 0, marginBottom: 8 }}
                    >
                        {t('auth.forgot_password', 'Quên mật khẩu?')}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default LoginPage;
