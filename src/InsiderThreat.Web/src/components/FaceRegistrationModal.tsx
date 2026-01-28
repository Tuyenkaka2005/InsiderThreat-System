import { useRef, useEffect, useState } from 'react';
import { Modal, Button, message, Space, Spin, Alert } from 'antd';
import { CameraOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { loadFaceApiModels, detectFace } from '../services/faceApi';
import { api } from '../services/api';

interface FaceRegistrationModalProps {
    visible: boolean;
    onCancel: () => void;
    userId: string | null;
    userName: string;
}

function FaceRegistrationModal({ visible, onCancel, userId, userName }: FaceRegistrationModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loadingModels, setLoadingModels] = useState(true);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Load models and start camera when modal opens
    useEffect(() => {
        if (visible) {
            initFaceApi();
        } else {
            stopCamera();
        }
    }, [visible]);

    const initFaceApi = async () => {
        setLoadingModels(true);
        setModelLoaded(false);
        try {
            const success = await loadFaceApiModels();
            if (success) {
                setModelLoaded(true);
                startCamera();
            } else {
                message.error('Failed to load Face API models. Check console for details.');
            }
        } catch (error) {
            message.error('Failed to load Face API models');
        } finally {
            setLoadingModels(false);
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

    const handleCapture = async () => {
        if (!videoRef.current || !userId) return;

        setProcessing(true);
        try {
            // Detect face
            const detection = await detectFace(videoRef.current);

            if (!detection) {
                message.warning('No face detected. Please position yourself clearly in the frame.');
                return;
            }

            // Get descriptor (Float32Array) -> Convert to regular array for JSON
            const descriptor = Array.from(detection.descriptor);

            // Send to backend
            console.log(`Registering Face for User ID: ${userId}`);
            console.log('Descriptor length:', descriptor.length);
            const url = `/api/users/${userId}/face-embeddings`;
            console.log('Sending PUT to:', url);

            await api.put(url, descriptor);

            message.success('Face ID registered successfully!');
            onCancel(); // Close modal on success
        } catch (error) {
            console.error(error);
            message.error('Failed to register face. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Modal
            title={`Register Face ID for ${userName}`}
            open={visible}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>Cancel</Button>,
                <Button
                    key="capture"
                    type="primary"
                    icon={<CameraOutlined />}
                    loading={processing || loadingModels}
                    onClick={handleCapture}
                    disabled={!stream || !modelLoaded}
                >
                    Capture & Save
                </Button>
            ]}
            width={500}
            destroyOnHidden
        >
            <Space orientation="vertical" style={{ width: '100%', alignItems: 'center' }}>
                <Alert
                    title="Ensure good lighting and look directly at the camera."
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
                            <div style={{ marginTop: 10, color: '#fff' }}>Loading AI Models...</div>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
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
