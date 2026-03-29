import { useRef, useEffect, useState, useCallback } from 'react';
import { Modal, Button, message, Space, Spin, Alert, Progress } from 'antd';
import { CameraOutlined, SafetyCertificateOutlined, CheckCircleFilled } from '@ant-design/icons';
import * as faceapi from '@vladmandic/face-api';
import { loadFaceApiModels, getFaceDetectorOptions } from '../services/faceApi';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';
import { LivenessDetector } from '../services/livenessService';
import { validateVideoDevices } from '../services/deviceValidator';

interface FaceRegistrationModalProps {
    visible: boolean;
    onCancel: () => void;
    userId: string | null;
    userName: string;
}

type RegistrationPhase = 'checking_device' | 'loading' | 'ready' | 'verifying_liveness' | 'capturing' | 'done';

function FaceRegistrationModal({ visible, onCancel, userId, userName }: FaceRegistrationModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number>(0);
    const detectorRef = useRef(new LivenessDetector(10000)); // 10s timeout

    const [phase, setPhase] = useState<RegistrationPhase>('checking_device');
    const [blinkCount, setBlinkCount] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [blockedDevice, setBlockedDevice] = useState<string | null>(null);
    const { t } = useTranslation();

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setPhase('ready');
    }, []);

    const startCamera = useCallback(async () => {
        try {
            // Step 1: Chống camera ảo
            const deviceResult = await validateVideoDevices();
            if (!deviceResult.isValid) {
                setBlockedDevice(deviceResult.blockedDevice || 'Unknown');
                setPhase('ready');
                message.error(`Cảnh báo: Phát hiện camera ảo (${deviceResult.blockedDevice}). Vui lòng dùng camera thật.`);
                return false;
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 } 
            });
            streamRef.current = mediaStream;

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setPhase('ready');
                return true;
            }
        } catch (error) {
            message.error(t('face.camera_error', 'Không thể truy cập camera'));
        }
        return false;
    }, [t]);

    useEffect(() => {
        if (!visible) {
            stopCamera();
            return;
        }

        const init = async () => {
            setPhase('loading');
            try {
                await loadFaceApiModels();
                await startCamera();
            } catch (error) {
                message.error(t('face.model_load_failed', 'Lỗi khởi tạo hệ thống AI'));
            }
        };

        init();
        return () => stopCamera();
    }, [visible, stopCamera, startCamera, t]);

    const startLivenessCheck = () => {
        setPhase('verifying_liveness');
        setBlinkCount(0);
        detectorRef.current.reset();
        detectionLoop();
    };

    const detectionLoop = async () => {
        if (!videoRef.current || phase === 'done') return;

        const api = (faceapi as any).default || faceapi;
        try {
            const options = getFaceDetectorOptions();
            const detection = await api.detectSingleFace(videoRef.current, options)
                .withFaceLandmarks();


            if (detection) {
                const isBlinked = detectorRef.current.processFrame(detection.landmarks, 'blink');
                
                // Cập nhật số lần chớp mắt để hiển thị UI (dùng internal state của detector)
                const currentBlinks = (detectorRef.current as any).blinkCount || 0;
                setBlinkCount(currentBlinks);

                if (isBlinked) {
                    // Liveness verified! Move to capture
                    handleFinalCapture();
                    return;
                }
            }
        } catch (e) { /* ignore frame error */ }

        if (phase === 'verifying_liveness') {
            animFrameRef.current = requestAnimationFrame(detectionLoop);
        }
    };

    const handleFinalCapture = async () => {
        if (!videoRef.current || !userId) return;

        setPhase('capturing');
        setProcessing(true);
        
        try {
            const api = (faceapi as any).default || faceapi;
            const options = getFaceDetectorOptions();
            const finalDetection = await api.detectSingleFace(videoRef.current, options)
                .withFaceLandmarks()
                .withFaceDescriptor();


            if (!finalDetection) {
                message.error("Lỗi: Mất dấu khuôn mặt ở bước cuối. Thử lại.");
                setPhase('ready');
                return;
            }

            const descriptor = Array.from(finalDetection.descriptor);
            await api.put(`/api/users/${userId}/face-embeddings`, descriptor);

            setPhase('done');
            message.success(t('face.success', 'Đăng ký Face ID bảo mật thành công!'));
            setTimeout(handleClose, 1500);
        } catch (error) {
            message.error('Lỗi khi lưu dữ liệu khuôn mặt');
            setPhase('ready');
        } finally {
            setProcessing(false);
        }
    };

    const handleClose = () => {
        stopCamera();
        onCancel();
    };

    return (
        <Modal
            title={<Space><SafetyCertificateOutlined style={{color: '#1890ff'}} /> {t('face.register_title', 'Đăng ký Face ID Bảo mật')}</Space>}
            open={visible}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose} disabled={processing}>
                    {t('common.cancel', 'Hủy bỏ')}
                </Button>,
                phase === 'ready' && (
                    <Button
                        key="start"
                        type="primary"
                        icon={<CameraOutlined />}
                        onClick={startLivenessCheck}
                        disabled={!!blockedDevice}
                    >
                        Bắt đầu xác minh & Đăng ký
                    </Button>
                ),
            ]}
            width={520}
            destroyOnHidden
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {blockedDevice ? (
                    <Alert
                        title={<span style={{ fontWeight: 600 }}>Thiết bị bị chặn</span>}
                        description={`Phát hiện phần mềm camera ảo: ${blockedDevice}. Vui lòng tắt OBS/ManyCam và sử dụng camera vật lý để đăng ký.`}
                        type="error"
                        showIcon
                    />
                ) : (
                    <Alert
                        title={<span style={{ fontWeight: 600 }}>{phase === 'verifying_liveness' ? "Xác minh thực thể sống" : "Hướng dẫn đăng ký"}</span>}
                        description={phase === 'verifying_liveness' 
                            ? "Vui lòng chớp mắt 2 lần trước camera để xác nhận bạn là người thật." 
                            : "Nhìn thẳng vào máy ảnh, đảm bảo đủ ánh sáng. Hệ thống sẽ yêu cầu bạn chớp mắt để bảo mật."}
                        type={phase === 'verifying_liveness' ? "warning" : "info"}
                        showIcon
                    />
                )}


                <div style={{
                    width: '100%', height: 320, backgroundColor: '#000',
                    borderRadius: 12, overflow: 'hidden', position: 'relative',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    border: phase === 'verifying_liveness' ? '3px solid #faad14' : '3px solid #f0f0f0'
                }}>
                    {phase === 'loading' ? (
                        <Spin size="large">
                            <div style={{ marginTop: 10, color: '#fff' }}>Đang khởi tạo AI...</div>
                        </Spin>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay playsInline muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                            
                            {/* Overlay cho bước chớp mắt */}
                            {phase === 'verifying_liveness' && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(0,0,0,0.2)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <div style={{ 
                                        padding: '12px 24px', background: 'rgba(0,0,0,0.7)', 
                                        borderRadius: 30, color: '#fff', textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>VUI LÒNG CHỚP MẮT</div>
                                        <Progress 
                                            percent={(blinkCount / 2) * 100} 
                                            steps={2} 
                                            strokeColor="#52c41a" 
                                            showInfo={false}
                                            style={{ width: 120 }}
                                        />
                                        <div style={{ marginTop: 4 }}>{blinkCount}/2 lần</div>
                                    </div>
                                </div>
                            )}

                            {phase === 'capturing' && (
                                <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(24,144,255,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Spin size="large">
                                        <div style={{ marginTop: 10, color: '#fff' }}>Đang lấy mẫu khuôn mặt...</div>
                                    </Spin>
                                </div>
                            )}

                            {phase === 'done' && (
                                <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(82,196,26,0.4)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff'
                                }}>
                                    <CheckCircleFilled style={{ fontSize: 64, marginBottom: 16 }} />
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>ĐĂNG KÝ THÀNH CÔNG</div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                    ID Nhân viên: <code style={{background: '#f5f5f5', padding: '2px 6px'}}>{userId}</code>
                </div>
            </div>
        </Modal>
    );
}

export default FaceRegistrationModal;
