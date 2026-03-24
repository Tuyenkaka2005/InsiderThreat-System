import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Typography, Card, Input, Button, Space, message, Layout, Tag, Tooltip } from 'antd';
import {
    VideoCameraOutlined, EnterOutlined, ApiOutlined,
    AudioOutlined, AudioMutedOutlined, DesktopOutlined,
    PhoneOutlined, CopyOutlined, VideoCameraAddOutlined,
} from '@ant-design/icons';
import { authService } from '../services/auth';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTranslation } from 'react-i18next';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import styles from './MeetPage.module.css';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function MeetPage() {
    const { t } = useTranslation();
    const [inputCode, setInputCode] = useState('');
    const [loading, setLoading] = useState(false);
    const user = authService.getCurrentUser();

    const {
        localStream, peers, roomCode, isConnected,
        isAudioEnabled, isVideoEnabled, isScreenSharing,
        peerUpdateCounter,
        createRoom, joinRoom, leaveRoom,
        toggleAudio, toggleVideo, toggleScreenShare,
    } = useWebRTC();

    // Callback ref: fires when the video element mounts AND when localStream changes
    // This fixes the timing issue where useEffect([localStream]) misses because
    // the video element only renders after inMeeting becomes true
    const localVideoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node && localStream) {
            node.srcObject = localStream;
            node.play().catch(() => { });
        }
    }, [localStream]);

    const handleCreateRoom = useCallback(async () => {
        setLoading(true);
        try {
            const code = await createRoom();
            message.success(`${t('meet.create_success', 'Đã tạo phòng: ')}${code}`);
        } catch (err: any) {
            message.error(err?.message || t('meet.create_fail', 'Không thể tạo phòng'));
        }
        setLoading(false);
    }, [createRoom, t]);

    const handleJoinRoom = useCallback(async () => {
        const code = inputCode.trim().toUpperCase();
        if (!code) {
            message.warning(t('meet.input_code_warning', 'Vui lòng nhập mã phòng'));
            return;
        }
        setLoading(true);
        try {
            await joinRoom(code);
            message.success(t('meet.join_success', 'Đã tham gia phòng'));
        } catch (err: any) {
            message.error(err?.message || t('meet.join_fail', 'Không thể tham gia phòng'));
        }
        setLoading(false);
    }, [inputCode, joinRoom, t]);

    const handleLeave = useCallback(() => {
        leaveRoom();
        message.info(t('meet.leave_room', 'Đã rời phòng'));
    }, [leaveRoom, t]);

    const copyRoomCode = useCallback(() => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            message.success(t('meet.copy_code_success', 'Đã sao chép mã phòng'));
        }
    }, [roomCode, t]);

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
                                title={<><VideoCameraOutlined style={{ color: 'var(--color-primary)', marginRight: 8 }} /> {t('meet.lobby_title', 'Phòng Họp Trực Tuyến')}</>}
                                bordered={false}
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            >
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <ApiOutlined style={{ fontSize: 48, color: 'var(--color-primary)', marginBottom: 16 }} />
                                    <Title level={4}>{t('meet.lobby_subtitle', 'Kết nối với đồng nghiệp của bạn')}</Title>
                                    <Text type="secondary">
                                        {t('meet.lobby_desc', 'Tạo phòng mới và chia sẻ mã cho người khác, hoặc nhập mã phòng để tham gia.')}
                                    </Text>
                                </div>

                                <Space direction="vertical" style={{ width: '100%' }} size="large">
                                    <Input
                                        size="large"
                                        placeholder={t('meet.placeholder_code', 'Nhập mã phòng (VD: ABC123)')}
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
                                            {t('meet.btn_create', 'Tạo phòng mới')}
                                        </Button>
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<EnterOutlined />}
                                            onClick={handleJoinRoom}
                                            loading={loading}
                                            disabled={!inputCode.trim()}
                                        >
                                            {t('meet.btn_join', 'Tham gia')}
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
                                <span>{t('meet.lbl_room_code', 'Mã phòng: ')} </span>
                                <Tag color="blue" style={{ fontSize: 16, padding: '2px 12px', letterSpacing: 3, fontWeight: 'bold' }}>
                                    {roomCode}
                                </Tag>
                                <Tooltip title={t('meet.tooltip_copy', 'Sao chép mã phòng')}>
                                    <Button
                                        type="text"
                                        icon={<CopyOutlined />}
                                        onClick={copyRoomCode}
                                        size="small"
                                    />
                                </Tooltip>
                                <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                    {t('meet.participants_count', '{{count}} người tham gia', { count: peers.size + 1 })}
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
                                        {user?.fullName || user?.username || t('meet.lbl_you', 'Bạn')} ({t('meet.lbl_you', 'Bạn')})
                                    </span>
                                </div>

                                {/* Remote Videos */}
                                {Array.from(peers.values()).map(peer => (
                                    <RemoteVideo key={peer.connectionId} peer={peer} streamId={peer.remoteStream.id} />
                                ))}
                            </div>

                            {/* Control Bar */}
                            <div className={styles.controlBar}>
                                <Tooltip title={isAudioEnabled ? t('meet.tooltip_mute', 'Tắt mic') : t('meet.tooltip_unmute', 'Bật mic')}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                                        onClick={toggleAudio}
                                        danger={!isAudioEnabled}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title={isVideoEnabled ? t('meet.tooltip_video_off', 'Tắt camera') : t('meet.tooltip_video_on', 'Bật camera')}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<VideoCameraOutlined />}
                                        onClick={toggleVideo}
                                        danger={!isVideoEnabled}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title={isScreenSharing ? t('meet.tooltip_stop_share', 'Dừng chia sẻ') : t('meet.tooltip_share_screen', 'Chia sẻ màn hình')}>
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<DesktopOutlined />}
                                        onClick={toggleScreenShare}
                                        type={isScreenSharing ? 'primary' : 'default'}
                                        className={styles.controlBtn}
                                    />
                                </Tooltip>
                                <Tooltip title={t('meet.tooltip_leave', 'Rời phòng')}>
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

/* Remote video component - uses useEffect to update srcObject when stream changes */
function RemoteVideo({ peer, streamId: _streamId }: { peer: { connectionId: string; displayName: string; remoteStream: MediaStream }; streamId?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !peer.remoteStream) return;

        // Always reassign srcObject when stream reference changes
        videoEl.srcObject = peer.remoteStream;
        videoEl.play().catch(() => { });

        // Listen for track changes on the stream itself
        const handleTrackAdded = () => {
            console.log('[RemoteVideo] Track added to remote stream');
            videoEl.srcObject = peer.remoteStream;
            videoEl.play().catch(() => { });
            forceUpdate(n => n + 1);
        };

        const handleTrackRemoved = () => {
            console.log('[RemoteVideo] Track removed from remote stream');
            videoEl.srcObject = peer.remoteStream;
            forceUpdate(n => n + 1);
        };

        peer.remoteStream.addEventListener('addtrack', handleTrackAdded);
        peer.remoteStream.addEventListener('removetrack', handleTrackRemoved);

        return () => {
            peer.remoteStream.removeEventListener('addtrack', handleTrackAdded);
            peer.remoteStream.removeEventListener('removetrack', handleTrackRemoved);
        };
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
