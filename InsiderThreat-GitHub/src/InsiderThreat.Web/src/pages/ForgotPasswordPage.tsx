import { useState } from 'react';
import { Button, Input, message, Card, Typography, Alert, Steps } from 'antd';
import { MailOutlined, ArrowLeftOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './ForgotPasswordPage.css';

const { Title } = Typography;

function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpTokenId, setOtpTokenId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (!email) {
            message.warning('Vui lòng nhập email');
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/forgot-password', { email });
            message.success('OTP đã được gửi đến email của bạn!');
            setCurrentStep(1);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Gửi OTP thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpCode) {
            message.warning('Vui lòng nhập mã OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post<{ message: string; token: string }>('/api/auth/verify-otp', { email, code: otpCode });
            setOtpTokenId(response.token);
            message.success('OTP hợp lệ!');
            setCurrentStep(2);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'OTP không hợp lệ');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            message.warning('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        if (newPassword !== confirmPassword) {
            message.error('Mật khẩu xác nhận không khớp');
            return;
        }

        if (newPassword.length < 6) {
            message.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/reset-password', {
                otpTokenId,
                newPassword
            });
            message.success('Reset mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Reset mật khẩu thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-password-container">
            <Card className="forgot-password-card">
                <Title level={3}>🔒 Quên Mật Khẩu</Title>

                <Steps
                    current={currentStep}
                    style={{ marginBottom: 30 }}
                    items={[
                        { title: 'Nhập Email', icon: <MailOutlined /> },
                        { title: 'Xác thực OTP', icon: <SafetyOutlined /> },
                        { title: 'Đặt mật khẩu mới', icon: <LockOutlined /> }
                    ]}
                />

                {currentStep === 0 && (
                    <div>
                        <Alert
                            message="Nhập email đã đăng ký"
                            description="Chúng tôi sẽ gửi mã OTP đến email của bạn"
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input
                            size="large"
                            placeholder="Email của bạn"
                            prefix={<MailOutlined />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onPressEnter={handleSendOtp}
                            style={{ marginBottom: 16 }}
                        />
                        <Button
                            type="primary"
                            size="large"
                            block
                            loading={loading}
                            onClick={handleSendOtp}
                        >
                            Gửi mã OTP
                        </Button>
                    </div>
                )}

                {currentStep === 1 && (
                    <div>
                        <Alert
                            message="Kiểm tra email của bạn"
                            description={`Mã OTP đã được gửi đến ${email}. Mã có hiệu lực trong 5 phút.`}
                            type="success"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input
                            size="large"
                            placeholder="Nhập mã OTP (6 chữ số)"
                            prefix={<SafetyOutlined />}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            onPressEnter={handleVerifyOtp}
                            maxLength={6}
                            style={{ marginBottom: 16 }}
                        />
                        <Button
                            type="primary"
                            size="large"
                            block
                            loading={loading}
                            onClick={handleVerifyOtp}
                        >
                            Xác thực OTP
                        </Button>
                        <Button
                            type="link"
                            onClick={() => setCurrentStep(0)}
                            style={{ marginTop: 8 }}
                        >
                            Gửi lại mã OTP
                        </Button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <Alert
                            message="Tạo mật khẩu mới"
                            description="Mật khẩu phải có ít nhất 6 ký tự"
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input.Password
                            size="large"
                            placeholder="Mật khẩu mới"
                            prefix={<LockOutlined />}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ marginBottom: 12 }}
                        />
                        <Input.Password
                            size="large"
                            placeholder="Xác nhận mật khẩu"
                            prefix={<LockOutlined />}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onPressEnter={handleResetPassword}
                            style={{ marginBottom: 16 }}
                        />
                        <Button
                            type="primary"
                            size="large"
                            block
                            loading={loading}
                            onClick={handleResetPassword}
                        >
                            Đặt lại mật khẩu
                        </Button>
                    </div>
                )}

                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/login')}
                    style={{ marginTop: 16 }}
                >
                    Quay lại đăng nhập
                </Button>
            </Card>
        </div>
    );
}

export default ForgotPasswordPage;
