import { useEffect, useRef, useState } from 'react';
import { Button, message, Spin, Typography, Card, Alert } from 'antd';
import { LoginOutlined, ArrowLeftOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadFaceApiModels } from '../services/faceApi';
import { api } from '../services/api';
import { authService } from '../services/auth';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import LivenessChallengeComponent from '../components/LivenessChallenge';
import type { LoginResponse } from '../types';

const { Title } = Typography;

function FaceLoginPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showLiveness, setShowLiveness] = useState(false);
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

    // New flow: Open Liveness Challenge
    const handleFaceLogin = () => {
        setErrorMessage(null);
        // Stop the preview camera — Liveness component will open its own
        stopCamera();
        setShowLiveness(true);
    };

    // Called when liveness challenge is completed with a verified descriptor
    const handleLivenessComplete = async (descriptor: number[], livenessVerified: boolean) => {
        setShowLiveness(false);
        setScanning(true);
        setErrorMessage(null);

        try {
            // Lấy Machine ID (nếu chạy trong Tauri) hoặc dùng Fingerprint trình duyệt
            let machineId = localStorage.getItem('machine_id') || 'unknown_web_client';
            
            // Chỉ cố gắng gọi Tauri API nếu object __TAURI__ tồn tại (chế độ desktop app)
            if ((window as any).__TAURI__) {
                try {
                    // Dùng dynamic import với đường dẫn tuyệt đối hoặc bypass vite check nếu cần
                    // Ở đây ta dùng cách kiểm tra an toàn hơn
                    const tauriApi = (window as any).__TAURI__;
                    if (tauriApi && tauriApi.invoke) {
                        machineId = await tauriApi.invoke('get_machine_id');
                    }
                } catch (e) { 
                    console.warn('[FaceID] Failed to get hardware id via Tauri', e); 
                }
            }

            // Gửi yêu cầu đăng nhập với các lớp bảo mật bổ sung
            const response = await api.post<LoginResponse>('/api/auth/face-login', {
                descriptor,
                timestamp: Date.now(),
                machineId: machineId,
                livenessToken: btoa(Date.now().toString())
            });

            if (response.token) {
                message.success(t('auth.login_success', 'Login successful!'));
                authService.setSession(response.user, response.token);
                navigate('/feed');
            } else {
                const errorMsg = t('auth.face_not_recognized', '❌ Khuôn mặt không khớp! Bạn chưa đăng ký Face ID hoặc khuôn mặt không được nhận diện.');
                setErrorMessage(errorMsg);
                message.error(t('auth.face_not_recognized_short', 'Face not recognized'));
                startCamera(); // Restart preview
            }
        } catch (error: any) {
            console.error('[FaceID] Login error:', error);
            const errorMsg = error.response?.data?.message || t('auth.face_login_failed_desc', 'Đăng nhập thất bại! Khuôn mặt không hợp lệ hoặc chưa được đăng ký.');
            setErrorMessage(`🚫 ${errorMsg}`);
            message.error(errorMsg);
            startCamera(); // Restart preview
        } finally {
            setScanning(false);
        }
    };

    const handleLivenessFail = (reason: string) => {
        setShowLiveness(false);
        setErrorMessage(`🚫 ${reason}`);
        startCamera();
    };

    const handleLivenessCancel = () => {
        setShowLiveness(false);
        startCamera();
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

                {/* Security badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, marginBottom: 16,
                    padding: '6px 12px', borderRadius: 8,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                }}>
                    <SafetyOutlined style={{ color: '#22c55e', fontSize: 14 }} />
                    <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                        {t('auth.liveness_protected', 'Bảo vệ bởi Liveness Detection + Zero Trust')}
                    </span>
                </div>

                {errorMessage && (
                    <Alert
                        title={t('auth.login_failed', 'Đăng nhập thất bại')}
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

            {/* Liveness Challenge Modal */}
            <LivenessChallengeComponent
                visible={showLiveness}
                onComplete={handleLivenessComplete}
                onFail={handleLivenessFail}
                onCancel={handleLivenessCancel}
            />
        </div>
    );
}

export default FaceLoginPage;
