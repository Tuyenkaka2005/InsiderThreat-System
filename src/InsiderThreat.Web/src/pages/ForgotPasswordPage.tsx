import { useState } from 'react';
import { Button, Input, message, Card, Typography, Alert, Steps } from 'antd';
import { MailOutlined, ArrowLeftOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
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
    const { t } = useTranslation();

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
            message.warning(t('auth.require_otp', 'Vui lòng nhập mã OTP'));
            return;
        }

        setLoading(true);
        try {
            const response = await api.post<{ message: string; token: string }>('/api/auth/verify-otp', { email, code: otpCode });
            setOtpTokenId(response.token);
            message.success(t('auth.otp_valid', 'OTP hợp lệ!'));
            setCurrentStep(2);
        } catch (error: any) {
            message.error(error.response?.data?.message || t('auth.otp_invalid', 'OTP không hợp lệ'));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            message.warning(t('auth.require_all_info', 'Vui lòng nhập đầy đủ thông tin'));
            return;
        }

        if (newPassword !== confirmPassword) {
            message.error(t('auth.password_mismatch', 'Mật khẩu xác nhận không khớp'));
            return;
        }

        if (newPassword.length < 6) {
            message.error(t('auth.password_length', 'Mật khẩu phải có ít nhất 6 ký tự'));
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/reset-password', {
                otpTokenId,
                newPassword
            });
            message.success(t('auth.reset_success', 'Reset mật khẩu thành công! Đang chuyển đến trang đăng nhập...'));
            setTimeout(() => navigate('/login'), 2000);
        } catch (error: any) {
            message.error(error.response?.data?.message || t('auth.reset_failed', 'Reset mật khẩu thất bại'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-password-container" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 24, right: 32, display: 'flex', gap: 16, alignItems: 'center', zIndex: 10 }}>
                <LanguageToggle />
                <ThemeToggle />
            </div>
            <Card className="forgot-password-card">
                <Title level={3}>{t('auth.forgot_password_title', '🔒 Quên Mật Khẩu')}</Title>

                <Steps
                    current={currentStep}
                    style={{ marginBottom: 30 }}
                    items={[
                        { title: t('auth.enter_email', 'Nhập Email'), icon: <MailOutlined /> },
                        { title: t('auth.verify_otp', 'Xác thực OTP'), icon: <SafetyOutlined /> },
                        { title: t('auth.set_new_password', 'Đặt mật khẩu mới'), icon: <LockOutlined /> }
                    ]}
                />

                {currentStep === 0 && (
                    <div>
                        <Alert
                            message={t('auth.email_instruction_title', 'Nhập email đã đăng ký')}
                            description={t('auth.email_instruction_desc', 'Chúng tôi sẽ gửi mã OTP đến email của bạn')}
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input
                            size="large"
                            placeholder={t('auth.your_email', 'Email của bạn')}
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
                            {t('auth.send_otp', 'Gửi mã OTP')}
                        </Button>
                    </div>
                )}

                {currentStep === 1 && (
                    <div>
                        <Alert
                            message={t('auth.check_email', 'Kiểm tra email của bạn')}
                            description={t('auth.otp_sent_to', { email, defaultValue: `Mã OTP đã được gửi đến ${email}. Mã có hiệu lực trong 5 phút.` })}
                            type="success"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input
                            size="large"
                            placeholder={t('auth.enter_otp', 'Nhập mã OTP (6 chữ số)')}
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
                            {t('auth.verify_otp', 'Xác thực OTP')}
                        </Button>
                        <Button
                            type="link"
                            onClick={() => setCurrentStep(0)}
                            style={{ marginTop: 8 }}
                        >
                            {t('auth.resend_otp', 'Gửi lại mã OTP')}
                        </Button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <Alert
                            message={t('auth.create_new_password', 'Tạo mật khẩu mới')}
                            description={t('auth.password_length', 'Mật khẩu phải có ít nhất 6 ký tự')}
                            type="info"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Input.Password
                            size="large"
                            placeholder={t('auth.new_password', 'Mật khẩu mới')}
                            prefix={<LockOutlined />}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ marginBottom: 12 }}
                        />
                        <Input.Password
                            size="large"
                            placeholder={t('auth.confirm_password', 'Xác nhận mật khẩu')}
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
                            {t('auth.reset_password', 'Đặt lại mật khẩu')}
                        </Button>
                    </div>
                )}

                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/login')}
                    style={{ marginTop: 16 }}
                >
                    {t('auth.back_to_login', 'Quay lại đăng nhập')}
                </Button>
            </Card>
        </div>
    );
}

export default ForgotPasswordPage;
