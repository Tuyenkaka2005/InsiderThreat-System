import { useEffect, useRef, useState } from 'react';
import { Button, message, Spin, Typography, Card, Alert } from 'antd';
import { LoginOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadFaceApiModels, detectFace } from '../services/faceApi';
import { api } from '../services/api';
import { authService } from '../services/auth';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import type { LoginResponse } from '../types';

const { Title } = Typography;

function FaceLoginPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        initFaceApi();
        return () => stopCamera();
    }, []);

    const initFaceApi = async () => {
        try {
            await loadFaceApiModels();
            startCamera();
        } catch (error) {
            message.error(t('auth.face_load_failed', 'Failed to load Face API models'));
        } finally {
            setLoading(false);
        }
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            message.error(t('auth.camera_error', 'Unable to access camera'));
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleFaceLogin = async () => {
        if (!videoRef.current) return;

        setScanning(true);
        setErrorMessage(null); // Clear previous errors

        try {
            const detection = await detectFace(videoRef.current);
            if (!detection) {
                const errorMsg = t('auth.no_face_detected', '⚠️ Không phát hiện khuôn mặt! Vui lòng đặt mặt vào giữa khung hình.');
                setErrorMessage(errorMsg);
                message.warning(t('auth.no_face_detected_short', 'No face detected!'));
                setScanning(false);
                return;
            }

            const descriptor = Array.from(detection.descriptor);

            // Call API
            const response = await api.post<LoginResponse>('/api/auth/face-login', descriptor);

            if (response.token) {
                message.success(t('auth.login_success', 'Login successful!'));
                // Fix: Dùng setSession thay vì gọi lại hàm login (gây lỗi 400)
                authService.setSession(response.user, response.token);
                navigate('/feed');
            } else {
                const errorMsg = t('auth.face_not_recognized', '❌ Khuôn mặt không khớp! Bạn chưa đăng ký Face ID hoặc khuôn mặt không được nhận diện.');
                setErrorMessage(errorMsg);
                message.error(t('auth.face_not_recognized_short', 'Face not recognized'));
            }
        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.message || t('auth.face_login_failed_desc', 'Đăng nhập thất bại! Khuôn mặt không hợp lệ hoặc chưa được đăng ký.');
            setErrorMessage(`🚫 ${errorMsg}`);
            message.error(errorMsg);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--color-bg)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 24, right: 32, display: 'flex', gap: 16, alignItems: 'center', zIndex: 10 }}>
                <LanguageToggle />
                <ThemeToggle />
            </div>
            <Card style={{ width: 400, textAlign: 'center' }}>
                <Title level={3}>{t('auth.face_id_title', '🙂 Face ID Login')}</Title>
                <div style={{
                    width: '100%',
                    height: 250,
                    background: '#000',
                    borderRadius: 8,
                    marginBottom: 20,
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    {loading ? <Spin /> : (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                        />
                    )}
                </div>

                {errorMessage && (
                    <Alert
                        message={t('auth.login_failed', 'Đăng nhập thất bại')}
                        description={errorMessage}
                        type="error"
                        showIcon
                        closable
                        onClose={() => setErrorMessage(null)}
                        style={{ marginBottom: 16, textAlign: 'left' }}
                    />
                )}

                <Button
                    type="primary"
                    size="large"
                    icon={<LoginOutlined />}
                    loading={scanning || loading}
                    onClick={handleFaceLogin}
                    block
                    style={{ marginBottom: 12 }}
                >
                    {t('auth.scan_login', 'Scan & Login')}
                </Button>

                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/login')}
                >
                    {t('auth.back_to_login', 'Back to Password Login')}
                </Button>
            </Card>
        </div>
    );
}

export default FaceLoginPage;
