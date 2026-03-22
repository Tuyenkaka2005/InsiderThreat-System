import { useCallback, useEffect, useRef, useState } from 'react';
import { videoSignalRService } from '../services/videoSignalR';
import type * as signalR from '@microsoft/signalr';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
    ]
};

export interface PeerState {
    connectionId: string;
    displayName: string;
    peerConnection: RTCPeerConnection;
    remoteStream: MediaStream;
}

export function useWebRTC() {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [displayStream, setDisplayStream] = useState<MediaStream | null>(null); // What to show in local video (camera or screen)
    const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const peersRef = useRef<Map<string, PeerState>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);  // Camera stream (always kept)
    const screenStreamRef = useRef<MediaStream | null>(null);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null); // Keep camera track reference

    // Force React to re-render with new Map reference
    const updatePeers = useCallback(() => {
        setPeers(new Map(peersRef.current));
    }, []);

    const createPeerConnection = useCallback((targetConnectionId: string, displayName: string): RTCPeerConnection => {
        // Close existing connection if any
        const existing = peersRef.current.get(targetConnectionId);
        if (existing) {
            existing.peerConnection.close();
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        const remoteStream = new MediaStream();

        // Add local tracks to peer connection
        const stream = localStreamRef.current;
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log('[WebRTC] Adding local track:', track.kind, track.label);
                pc.addTrack(track, stream);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && connectionRef.current) {
                connectionRef.current.invoke('SendIceCandidate', targetConnectionId, JSON.stringify(event.candidate))
                    .catch(err => console.error('[WebRTC] Failed to send ICE candidate:', err));
            }
        };

        // Handle remote tracks - THIS IS THE KEY FIX
        pc.ontrack = (event) => {
            console.log('[WebRTC] Received remote track:', event.track.kind, 'from', targetConnectionId);

            // Add the track to remoteStream
            remoteStream.addTrack(event.track);

            // Force update peer state with a marker to trigger re-render
            const peer = peersRef.current.get(targetConnectionId);
            if (peer) {
                // Create a NEW MediaStream with all current tracks to force React re-render
                const newStream = new MediaStream(remoteStream.getTracks());
                peer.remoteStream = newStream;
                updatePeers();
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE state for', targetConnectionId, ':', pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.log('[WebRTC] ICE failed, restarting...');
                pc.restartIce();
            }
            if (pc.iceConnectionState === 'disconnected') {
                // Give it a moment before removing - might reconnect
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                        removePeer(targetConnectionId);
                    }
                }, 5000);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state for', targetConnectionId, ':', pc.connectionState);
        };

        const peerState: PeerState = {
            connectionId: targetConnectionId,
            displayName,
            peerConnection: pc,
            remoteStream
        };

        peersRef.current.set(targetConnectionId, peerState);
        updatePeers();

        return pc;
    }, [updatePeers]);

    const removePeer = useCallback((connectionId: string) => {
        const peer = peersRef.current.get(connectionId);
        if (peer) {
            peer.peerConnection.close();
            peersRef.current.delete(connectionId);
            updatePeers();
        }
    }, [updatePeers]);

    const setupSignalRHandlers = useCallback((conn: signalR.HubConnection) => {
        // Remove any existing handlers first
        conn.off('UserJoined');
        conn.off('ReceiveOffer');
        conn.off('ReceiveAnswer');
        conn.off('ReceiveIceCandidate');
        conn.off('UserLeft');

        conn.on('UserJoined', (participant: { connectionId: string; displayName: string }) => {
            console.log('[SignalR] UserJoined:', participant.displayName, participant.connectionId);
            // New user will send us an offer, we just wait
        });

        conn.on('ReceiveOffer', async (senderConnectionId: string, sdp: string, displayName: string) => {
            console.log('[SignalR] ReceiveOffer from:', displayName, senderConnectionId);
            try {
                const pc = createPeerConnection(senderConnectionId, displayName);
                const offer = JSON.parse(sdp);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await conn.invoke('SendAnswer', senderConnectionId, JSON.stringify(pc.localDescription));
                console.log('[SignalR] Sent answer to:', senderConnectionId);
            } catch (err) {
                console.error('[WebRTC] Error handling offer:', err);
            }
        });

        conn.on('ReceiveAnswer', async (senderConnectionId: string, sdp: string) => {
            console.log('[SignalR] ReceiveAnswer from:', senderConnectionId);
            try {
                const peer = peersRef.current.get(senderConnectionId);
                if (peer && peer.peerConnection.signalingState === 'have-local-offer') {
                    await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
                }
            } catch (err) {
                console.error('[WebRTC] Error handling answer:', err);
            }
        });

        conn.on('ReceiveIceCandidate', async (senderConnectionId: string, candidate: string) => {
            try {
                const peer = peersRef.current.get(senderConnectionId);
                if (peer && peer.peerConnection.remoteDescription) {
                    await peer.peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
                }
            } catch (err) {
                console.error('[WebRTC] Error adding ICE candidate:', err);
            }
        });

        conn.on('UserLeft', (connectionId: string) => {
            console.log('[SignalR] UserLeft:', connectionId);
            removePeer(connectionId);
        });
    }, [createPeerConnection, removePeer]);

    const getMediaStream = useCallback(async (): Promise<MediaStream> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            // Save camera track reference
            cameraTrackRef.current = stream.getVideoTracks()[0] || null;
            return stream;
        } catch (err) {
            console.warn('[WebRTC] Camera+Audio failed, trying audio only:', err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                return stream;
            } catch (err2) {
                console.error('[WebRTC] All media failed:', err2);
                return new MediaStream();
            }
        }
    }, []);

    const connectSignalR = useCallback(async (): Promise<signalR.HubConnection> => {
        const token = localStorage.getItem('token') || '';
        const conn = await videoSignalRService.connect(token);
        connectionRef.current = conn;
        setupSignalRHandlers(conn);
        setIsConnected(true);
        return conn;
    }, [setupSignalRHandlers]);

    const createRoom = useCallback(async (): Promise<string> => {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);
        setDisplayStream(stream);

        const conn = await connectSignalR();
        const code = await conn.invoke<string>('CreateRoom');
        setRoomCode(code);
        console.log('[WebRTC] Room created:', code);
        return code;
    }, [getMediaStream, connectSignalR]);

    const joinRoom = useCallback(async (code: string): Promise<void> => {
        const stream = await getMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);
        setDisplayStream(stream);

        const conn = await connectSignalR();

        const existingParticipants = await conn.invoke<Array<{ connectionId: string; displayName: string }>>('JoinRoom', code);
        setRoomCode(code);
        console.log('[WebRTC] Joined room:', code, 'Existing participants:', existingParticipants.length);

        // Create offers to all existing participants (new user initiates)
        for (const participant of existingParticipants) {
            try {
                const pc = createPeerConnection(participant.connectionId, participant.displayName);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await conn.invoke('SendOffer', participant.connectionId, JSON.stringify(pc.localDescription));
                console.log('[WebRTC] Sent offer to:', participant.displayName);
            } catch (err) {
                console.error('[WebRTC] Error creating offer for', participant.displayName, err);
            }
        }
    }, [getMediaStream, connectSignalR, createPeerConnection]);

    const leaveRoom = useCallback(() => {
        peersRef.current.forEach(peer => peer.peerConnection.close());
        peersRef.current.clear();
        updatePeers();

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        screenStreamRef.current = null;
        cameraTrackRef.current = null;
        setLocalStream(null);
        setDisplayStream(null);

        connectionRef.current?.invoke('LeaveRoom').catch(() => { });
        videoSignalRService.disconnect();
        connectionRef.current = null;

        setRoomCode(null);
        setIsConnected(false);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        setIsScreenSharing(false);
    }, [updatePeers]);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    }, []);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            // Stop screen sharing → switch back to camera
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;

            const cameraTrack = cameraTrackRef.current;
            if (cameraTrack) {
                // Replace screen track with camera track on all peers
                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(cameraTrack).catch(err =>
                            console.error('[WebRTC] Error replacing track back to camera:', err)
                        );
                    }
                });
            }

            // Show camera in local preview
            setDisplayStream(localStreamRef.current);
            setIsScreenSharing(false);
        } else {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' } as any,
                    audio: false
                });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                // Replace camera track with screen track on all peers
                peersRef.current.forEach(peer => {
                    const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack).catch(err =>
                            console.error('[WebRTC] Error replacing track to screen:', err)
                        );
                    }
                });

                // Show screen share in local preview
                setDisplayStream(screenStream);
                setIsScreenSharing(true);

                // When user stops sharing via browser's built-in "Stop sharing" button
                screenTrack.onended = () => {
                    const camTrack = cameraTrackRef.current;
                    if (camTrack) {
                        peersRef.current.forEach(peer => {
                            const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) {
                                sender.replaceTrack(camTrack).catch(() => { });
                            }
                        });
                    }
                    screenStreamRef.current = null;
                    setDisplayStream(localStreamRef.current);
                    setIsScreenSharing(false);
                };
            } catch {
                // User cancelled screen share picker
                console.log('[WebRTC] Screen share cancelled by user');
            }
        }
    }, [isScreenSharing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            peersRef.current.forEach(peer => peer.peerConnection.close());
            peersRef.current.clear();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            videoSignalRService.disconnect();
        };
    }, []);

    return {
        localStream: displayStream, // Show camera or screen share in local video
        peers,
        roomCode,
        isConnected,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    };
}
