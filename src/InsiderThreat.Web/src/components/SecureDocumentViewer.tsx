import React from 'react';
import { Spin, Alert, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePhoneDetector } from '../hooks/usePhoneDetector';
import { VideoCameraOutlined, WarningOutlined } from '@ant-design/icons';
import './SecureDocumentViewer.css';

const { Title, Text } = Typography;

interface SecureDocumentViewerProps {
    children: React.ReactNode;
}

export default function SecureDocumentViewer({ children }: SecureDocumentViewerProps) {
    const { t } = useTranslation();
    const { isPhoneDetected, isLoadingAI, cameraError, cameraGranted } = usePhoneDetector();

    // Effect để bật thông báo Toast
    React.useEffect(() => {
        if (!isLoadingAI && cameraGranted && !cameraError) {
            message.success(t('security.ai_started_success', 'Hệ thống Mắt thần AI đã kích hoạt thành công, tài liệu được bảo vệ.'));
        }
    }, [isLoadingAI, cameraGranted, cameraError, t]);

    React.useEffect(() => {
        if (isPhoneDetected) {
            message.warning(t('security.toast_phone_detected', 'Phát hiện vật dụng khả nghi là điện thoại!'));
        }
    }, [isPhoneDetected, t]);

    // 1. Lỗi Camera
    if (cameraError) {
        return (
            <div className="secure-viewer-container flex-center">
                <Alert
                    message={t('security.camera_required', 'Yêu cầu Camera')}
                    description={cameraError}
                    type="error"
                    showIcon
                    icon={<VideoCameraOutlined />}
                />
            </div>
        );
    }

    // 2. Chờ AI khởi động
    if (isLoadingAI || !cameraGranted) {
        return (
            <div className="secure-viewer-container flex-center">
                <Spin size="large" tip={t('security.loading_ai', 'Đang khởi động hệ thống an ninh AI...')} />
            </div>
        );
    }

    // 3. Render nội dung chính với lớp bảo vệ
    return (
        <div className="secure-viewer-container relative">
            {/* Lớp hiển thị nội dung, bị làm mờ nếu phát hiện điện thoại */}
            <div className={`secure-content ${isPhoneDetected ? 'is-blurred' : ''}`}>
                {children}
            </div>

            {/* Màn hình cảnh báo đỏ rực nếu có điện thoại */}
            {isPhoneDetected && (
                <div className="secure-overlay flex-center">
                    <div className="warning-box">
                        <WarningOutlined className="warning-icon" />
                        <Title level={3} style={{ color: '#ff4d4f', marginTop: 16 }}>
                            {t('security.phone_detected_title', 'CẢNH BÁO BẢO MẬT')}
                        </Title>
                        <Text type="danger" style={{ fontSize: '1.2rem' }}>
                            {t('security.phone_detected_desc', 'Phát hiện thiết bị di động! Vui lòng cất điện thoại để tiếp tục xem tài liệu.')}
                        </Text>
                    </div>
                </div>
            )}
            
            {/* Camera Indicator (Optional: để nhân viên biết mình đang được scan) */}
            <div className="camera-indicator">
                 <VideoCameraOutlined /> <span style={{ marginLeft: 4, fontSize: 12 }}>AI Scanning Active</span>
            </div>
        </div>
    );
}
