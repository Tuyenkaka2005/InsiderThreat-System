<<<<<<< HEAD
import { useState, useCallback } from 'react';
=======
import { useState, useCallback, useRef, useEffect } from 'react';
>>>>>>> buigiaduy/duy-design
import { Typography, Card, Input, Button, Space, message, Layout, Tag, Tooltip } from 'antd';
import {
    VideoCameraOutlined, EnterOutlined, ApiOutlined,
    AudioOutlined, AudioMutedOutlined, DesktopOutlined,
    PhoneOutlined, CopyOutlined, VideoCameraAddOutlined,
} from '@ant-design/icons';
import { authService } from '../services/auth';
import { useWebRTC } from '../hooks/useWebRTC';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import styles from './MeetPage.module.css';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function MeetPage() {
    const [inputCode, setInputCode] = useState('');
    const [loading, setLoading] = useState(false);
<<<<<<< HEAD
=======
    const localVideoRef = useRef<HTMLVideoElement>(null);
>>>>>>> buigiaduy/duy-design
    const user = authService.getCurrentUser();

    const {
        localStream, peers, roomCode, isConnected,
        isAudioEnabled, isVideoEnabled, isScreenSharing,
        createRoom, joinRoom, leaveRoom,
        toggleAudio, toggleVideo, toggleScreenShare,
    } = useWebRTC();

<<<<<<< HEAD
    // Callback ref to attach local stream to video element
    const localVideoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node && localStream) {
            node.srcObject = localStream;
=======
    // Attach local stream (camera or screen share) to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => { });
>>>>>>> buigiaduy/duy-design
        }
    }, [localStream]);

    const handleCreateRoom = useCallback(async () => {
        setLoading(true);
        try {
            const code = await createRoom();
            message.success(`Đã tạo phòng: ${code}`);
        } catch (err: any) {
            message.error(err?.message || 'Không thể tạo phòng');
        }
        setLoading(false);
    }, [createRoom]);

    const handleJoinRoom = useCallback(async () => {
        const code = inputCode.trim().toUpperCase();
        if (!code) {
            message.warning('Vui lòng nhập mã phòng');
            return;
        }
        setLoading(true);
        try {
            await joinRoom(code);
            message.success('Đã tham gia phòng');
        } catch (err: any) {
            message.error(err?.message || 'Không thể tham gia phòng');
        }
        setLoading(false);
    }, [inputCode, joinRoom]);

    const handleLeave = useCallback(() => {
        leaveRoom();
        message.info('Đã rời phòng');
    }, [leaveRoom]);

    const copyRoomCode = useCallback(() => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            message.success('Đã sao chép mã phòng');
        }
    }, [roomCode]);

    const inMeeting = isConnected && roomCode;

    return (
        <Layout className={styles.layout}>
            <div className={styles.sidebarContainer}>
                <LeftSidebar />
            </div>

            <Content className={styles.mainContent}>
                <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {!inMeeting ? (
                        /* ========== LOBBY ========== */
                        <div style={{ maxWidth: 600, margin: '0 auto', marginTop: 80, width: '100%' }}>
                            <Card
                                title={<><VideoCameraOutlined style={{ color: '#1890ff', marginRight: 8 }} /> Phòng Họp Trực Tuyến</>}
                                bordered={false}
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            >
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <ApiOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                                    <Title level={4}>Kết nối với đồng nghiệp của bạn</Title>
                                    <Text type="secondary">
                                        Tạo phòng mới và chia sẻ mã cho người khác, hoặc nhập mã phòng để tham gia.
                                    </Text>
                                </div>

                                <Space direction="vertical" style={{ width: '100%' }} size="large">
                                    <Input
                                        size="large"
                                        placeholder="Nhập mã phòng (VD: ABC123)"
                                        value={inputCode}
                                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                        prefix={<VideoCameraOutlined />}
                                        onPressEnter={handleJoinRoom}
                                        maxLength={6}
                                        style={{ textTransform: 'uppercase', letterSpacing: 4, fontWeight: 'bold', textAlign: 'center' }}
                                    />

                                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                        <Button
                                            size="large"
                                            icon={<VideoCameraAddOutlined />}
                                            onClick={handleCreateRoom}
                                            loading={loading}
                                        >
                                            Tạo phòng mới
                                        </Button>
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<EnterOutlined />}
                                            onClick={handleJoinRoom}
                                            loading={loading}
                                            disabled={!inputCode.trim()}
                                        >
                                            Tham gia
                                        </Button>
                                    </div>
                                </Space>
                            </Card>
                        </div>
                    ) : (
                        /* ========== IN MEETING ========== */
                        <div className={styles.meetingContainer}>
                            {/* Room Info Bar */}
                            <div className={styles.roomInfoBar}>
                                <span>Mã phòng: </span>
                                <Tag color="blue" style={{ fontSize: 16, padding: '2px 12px', letterSpacing: 3, fontWeight: 'bold' }}>
                                    {roomCode}
                                </Tag>
                                <Tooltip title="Sao chép mã phòng">
                                    <Button
                                        type="text"
                                        icon={<CopyOutlined />}
                                        onClick={copyRoomCode}
                                        size="small"
                                    />
                                </Tooltip>
                                <span style={{ marginLeft: 'auto', color: '#999', fontSize: 13 }}>
                                    {peers.size + 1} người tham gia
                                </span>
                            </div>

                            {/* Video Grid */}
                            <div className={styles.videoGrid}>
                                {/* Local Video */}
                                <div className={styles.videoTile}>
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className={styles.videoElement}
                                    />
                                    {!isVideoEnabled && (
                                        <div className={styles.videoOff}>
                                            <VideoCameraOutlined style={{ fontSize: 36, color: '#fff' }} />
                                        </div>
                                    )}
                                    <span className={styles.nameTag}>
                                        {user?.fullName || user?.username || 'Bạn'} (Bạn)
                                    </span>
                                </div>

                                {/* Remote Videos */}
                                {Array.from(peers.values()).map(peer => (
                                    <RemoteVideo key={peer.connectionId} peer={peer} />
                                ))}
                            </div>

                            {/* Control Bar */}
                            <div className={styles.controlBar}>
                                <Tooltip title={isAudioEnabled ? 'Tắt mic' : 'Bật mic'}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                                        onClick={toggleAudio}
                                        danger={!isAudioEnabled}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title={isVideoEnabled ? 'Tắt camera' : 'Bật camera'}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<VideoCameraOutlined />}
                                        onClick={toggleVideo}
                                        danger={!isVideoEnabled}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title={isScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<DesktopOutlined />}
                                        onClick={toggleScreenShare}
                                        type={isScreenSharing ? 'primary' : 'default'}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title="Rời phòng">
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<PhoneOutlined style={{ transform: 'rotate(135deg)' }} />}
                                        onClick={handleLeave}
                                        danger
                                        type="primary"
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                            </div>
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

<<<<<<< HEAD
/* Remote video component - handles srcObject assignment */
function RemoteVideo({ peer }: { peer: { connectionId: string; displayName: string; remoteStream: MediaStream } }) {
    const videoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node) {
            node.srcObject = peer.remoteStream;
=======
/* Remote video component - uses useEffect to update srcObject when stream changes */
function RemoteVideo({ peer }: { peer: { connectionId: string; displayName: string; remoteStream: MediaStream } }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.remoteStream) {
            videoRef.current.srcObject = peer.remoteStream;
            // Force play in case autoplay is blocked
            videoRef.current.play().catch(() => { });
>>>>>>> buigiaduy/duy-design
        }
    }, [peer.remoteStream]);

    return (
        <div className={styles.videoTile}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.videoElement}
            />
            <span className={styles.nameTag}>{peer.displayName}</span>
        </div>
    );
}
