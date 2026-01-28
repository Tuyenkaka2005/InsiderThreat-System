import { useEffect, useRef, useState } from 'react';
import { Button, message, Spin, Typography, Card } from 'antd';
import { LoginOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { loadFaceApiModels, detectFace } from '../services/faceApi';
import { api } from '../services/api';
import { authService } from '../services/auth';
import type { LoginResponse } from '../types';

const { Title, Text } = Typography;

function FaceLoginPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        initFaceApi();
        return () => stopCamera();
    }, []);

    const initFaceApi = async () => {
        try {
            await loadFaceApiModels();
            startCamera();
        } catch (error) {
            message.error('Failed to load Face API models');
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
            message.error('Unable to access camera');
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
        try {
            const detection = await detectFace(videoRef.current);
            if (!detection) {
                message.warning('No face detected!');
                setScanning(false);
                return;
            }

            const descriptor = Array.from(detection.descriptor);

            // Call API
            const response = await api.post<LoginResponse>('/api/auth/face-login', descriptor);

            if (response.success && response.token) {
                message.success('Login successful!');
                // Fix: Dùng setSession thay vì gọi lại hàm login (gây lỗi 400)
                authService.setSession(response.user, response.token);
                navigate('/dashboard');
            } else {
                message.error('Face not recognized');
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.response?.data?.message || 'Login failed');
        } finally {
            setScanning(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400, textAlign: 'center' }}>
                <Title level={3}>🙂 Face ID Login</Title>
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

                <Button
                    type="primary"
                    size="large"
                    icon={<LoginOutlined />}
                    loading={scanning || loading}
                    onClick={handleFaceLogin}
                    block
                    style={{ marginBottom: 12 }}
                >
                    Scan & Login
                </Button>

                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/login')}
                >
                    Back to Password Login
                </Button>
            </Card>
        </div>
    );
}

export default FaceLoginPage;
