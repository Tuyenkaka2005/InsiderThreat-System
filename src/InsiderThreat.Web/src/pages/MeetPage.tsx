import { useState } from 'react';
import { Typography, Card, Input, Button, Space, message, Layout } from 'antd';
import { VideoCameraOutlined, EnterOutlined, ApiOutlined } from '@ant-design/icons';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { authService } from '../services/auth';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import styles from './MeetPage.module.css';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function MeetPage() {
    const [roomName, setRoomName] = useState('');
    const [inMeeting, setInMeeting] = useState(false);

    const user = authService.getCurrentUser();

    const handleJoin = () => {
        let finalRoomName = roomName.trim();
        if (!finalRoomName) {
            const randomString = Math.random().toString(36).substring(2, 12);
            finalRoomName = `InsiderThreatRoom_${randomString}`;
            setRoomName(finalRoomName);
        }
        setInMeeting(true);
    };

    const generateRoomName = () => {
        const randomString = Math.random().toString(36).substring(2, 12);
        setRoomName(`InsiderThreatRoom_${randomString}`);
    };

    return (
        <Layout className={styles.layout}>
            <div className={styles.sidebarContainer}>
                <LeftSidebar />
            </div>

            <Content className={styles.mainContent}>
                <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {!inMeeting ? (
                        <div style={{ maxWidth: 600, margin: '0 auto', marginTop: 100, width: '100%' }}>
                            <Card
                                title={<><VideoCameraOutlined style={{ color: '#1890ff', marginRight: 8 }} /> Tham Gia Trực Tuyến (Meet)</>}
                                bordered={false}
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            >
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <ApiOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                                    <Title level={4}>Kết nối với đồng nghiệp của bạn</Title>
                                    <Text type="secondary">Nhập mã phòng có sẵn để tham gia, hoặc tạo phòng ngẫu nhiên mới và chia sẻ mã này cho người khác.</Text>
                                </div>

                                <Space direction="vertical" style={{ width: '100%' }} size="large">
                                    <Input
                                        size="large"
                                        placeholder="Nhập mã phòng ví dụ: ThuongDinhTeam"
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        prefix={<VideoCameraOutlined />}
                                        onPressEnter={handleJoin}
                                    />

                                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                        <Button
                                            size="large"
                                            onClick={generateRoomName}
                                        >
                                            Tạo mã phòng ngẫu nhiên
                                        </Button>
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<EnterOutlined />}
                                            onClick={handleJoin}
                                        >
                                            Tham gia ngay
                                        </Button>
                                    </div>
                                </Space>
                            </Card>
                        </div>
                    ) : (
                        <div style={{ flex: 1, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
                            <JitsiMeeting
                                domain="meet.jit.si"
                                roomName={roomName}
                                configOverwrite={{
                                    startWithAudioMuted: true,
                                    disableModeratorIndicator: true,
                                    startScreenSharing: true,
                                    enableEmailInStats: false,
                                    prejoinPageEnabled: false
                                }}
                                interfaceConfigOverwrite={{
                                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
                                }}
                                userInfo={{
                                    displayName: user?.username || 'Guest',
                                    email: user?.email || ''
                                }}
                                onApiReady={(_externalApi) => {
                                    // You can add event listeners here
                                }}
                                getIFrameRef={(iframeRef) => {
                                    iframeRef.style.height = '100%';
                                    iframeRef.style.width = '100%';
                                }}
                            />
                        </div>
                    )}
                </div>
            </Content>

            <div className={styles.bottomNavContainer}>
                <BottomNavigation />
            </div>
        </Layout>
    );
}
