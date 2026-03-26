import { useRef, useEffect, useState, useCallback } from 'react';
import { Modal, Button, message, Space, Spin, Alert } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { loadFaceApiModels, detectFace } from '../services/faceApi';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';

interface FaceRegistrationModalProps {
    visible: boolean;
    onCancel: () => void;
    userId: string | null;
    userName: string;
}

function FaceRegistrationModal({ visible, onCancel, userId, userName }: FaceRegistrationModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const { t } = useTranslation();

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraReady(false);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = mediaStream;

            // Wait a tick for video element to be rendered
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    setCameraReady(true);
                    console.log('[FaceReg] Camera started and attached to video element');
                } else {
                    console.warn('[FaceReg] videoRef.current is null after camera started');
                }
            }, 100);
        } catch (error) {
            console.error('[FaceReg] Camera access error:', error);
            message.error(t('face.camera_error', 'Không thể truy cập camera'));
        }
    }, [t]);

    // Load models and start camera when modal opens
    useEffect(() => {
        if (!visible) {
            stopCamera();
            return;
        }

        let cancelled = false;

        const init = async () => {
            setLoadingModels(true);
            setModelLoaded(false);
            setCameraReady(false);

            try {
                const success = await loadFaceApiModels();
                if (cancelled) return;

                if (success) {
                    setModelLoaded(true);
                    setLoadingModels(false);
                    // Start camera after models loaded and loadingModels is false
                    // so that video element is rendered
                    await startCamera();
                } else {
                    message.error(t('face.model_load_failed', 'Không thể tải model AI. Kiểm tra console.'));
                    setLoadingModels(false);
                }
            } catch (error) {
                if (!cancelled) {
                    message.error(t('face.model_load_failed', 'Không thể tải model AI'));
                    setLoadingModels(false);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
        };
    }, [visible, stopCamera, startCamera, t]);

    const handleCapture = async () => {
        if (!videoRef.current || !userId) {
            console.warn('[FaceReg] Cannot capture: videoRef or userId missing');
            return;
        }

        setProcessing(true);
        try {
            const detection = await detectFace(videoRef.current);

            if (!detection) {
                message.warning(t('face.no_face', 'Không phát hiện khuôn mặt. Hãy đặt khuôn mặt rõ ràng trước camera.'));
                return;
            }

            const descriptor = Array.from(detection.descriptor);

            console.log(`[FaceReg] Registering Face for User ID: ${userId}`);
            console.log('[FaceReg] Descriptor length:', descriptor.length);

            await api.put(`/api/users/${userId}/face-embeddings`, descriptor);

            message.success(t('face.success', 'Đăng ký Face ID thành công!'));
            handleClose();
        } catch (error) {
            console.error('[FaceReg] Capture error:', error);
            message.error(t('face.capture_failed', 'Đăng ký thất bại. Vui lòng thử lại.'));
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
            title={`${t('face.register_title', 'Đăng ký Face ID cho')} ${userName}`}
            open={visible}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    {t('common.cancel', 'Hủy bỏ')}
                </Button>,
                <Button
                    key="capture"
                    type="primary"
                    icon={<CameraOutlined />}
                    loading={processing}
                    onClick={handleCapture}
                    disabled={!cameraReady || !modelLoaded || loadingModels}
                >
                    {t('face.capture_save', 'Chụp và lưu')}
                </Button>,
            ]}
            width={500}
            destroyOnHidden
        >
            <Space direction="vertical" style={{ width: '100%', alignItems: 'center' }}>
                <Alert
                    message={t('face.instruction', 'Hãy đảm bảo ánh sáng tốt và nhìn thẳng vào máy ảnh.')}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <div style={{
                    width: '100%',
                    height: 300,
                    backgroundColor: '#000',
                    borderRadius: 8,
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    {loadingModels ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: 10, color: '#fff' }}>
                                {t('face.loading_models', 'Đang tải mô hình AI...')}
                            </div>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                        />
                    )}
                </div>
            </Space>
        </Modal>
    );
}

export default FaceRegistrationModal;
