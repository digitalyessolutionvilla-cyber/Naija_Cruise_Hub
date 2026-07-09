import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, Shield, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

type CallType = 'voice' | 'video';
type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'active';

type IncomingCall = {
    fromUserId: string;
    fromUsername: string;
    fromAvatarId?: string;
    callType: CallType;
    roomId: string;
};

type ActiveCall = {
    peerId: string;
    peerUsername: string;
    callType: CallType;
    roomId: string;
    isCaller: boolean;
};

type CallEvent = {
    kind: 'invite' | 'invite-accepted' | 'invite-declined' | 'offer' | 'answer' | 'ice-candidate' | 'hangup';
    fromUserId: string;
    fromUsername?: string;
    fromAvatarId?: string;
    toUserId: string;
    roomId: string;
    callType?: CallType;
    reason?: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
};

interface CallContextType {
    callStatus: CallStatus;
    activeCall: ActiveCall | null;
    incomingCall: IncomingCall | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    startCall: (peerId: string, peerUsername: string, callType: CallType) => Promise<void>;
    acceptIncomingCall: () => Promise<void>;
    declineIncomingCall: () => Promise<void>;
    endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const STUN_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

function createRoomId(userA: string, userB: string) {
    return `${[userA, userB].sort().join('-')}-${Date.now()}`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const [callStatus, setCallStatus] = useState<CallStatus>('idle');
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);
    const [minimizedPosition, setMinimizedPosition] = useState({ x: 16, y: 96 });

    const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const callStatusRef = useRef<CallStatus>('idle');
    const activeCallRef = useRef<ActiveCall | null>(null);
    const incomingCallRef = useRef<IncomingCall | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ringtoneIntervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    const stopLocalTracks = useCallback(() => {
        setLocalStream((prev) => {
            prev?.getTracks().forEach((track) => track.stop());
            return null;
        });
    }, []);

    const cleanupPeerConnection = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.onicecandidate = null;
            pcRef.current.ontrack = null;
            pcRef.current.onconnectionstatechange = null;
            pcRef.current.close();
            pcRef.current = null;
        }
        setRemoteStream(null);
    }, []);

    const resetCallState = useCallback(() => {
        cleanupPeerConnection();
        stopLocalTracks();
        setIncomingCall(null);
        setActiveCall(null);
        setCallStartedAt(null);
        setElapsedSeconds(0);
        setIsMuted(false);
        setIsCameraEnabled(true);
        setIsOverlayMinimized(false);
        setMinimizedPosition({ x: 16, y: 96 });
        setCallStatus('idle');
    }, [cleanupPeerConnection, stopLocalTracks]);

    const clearCallTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const createNotification = useCallback(async (targetUserId: string, title: string, body: string) => {
        try {
            const sb = supabase as any;
            await sb.from('notifications').insert({
                user_id: targetUserId,
                type: 'system',
                title,
                body,
            });
        } catch (error) {
            console.error('Unable to create notification', error);
        }
    }, []);

    const recordCallLog = useCallback(async (params: {
        callerId: string;
        calleeId: string;
        callType: CallType;
        status: 'completed' | 'missed' | 'declined' | 'canceled' | 'failed';
        durationSeconds: number;
    }) => {
        try {
            const sb = supabase as any;
            await sb.from('call_logs').insert({
                caller_id: params.callerId,
                callee_id: params.calleeId,
                call_type: params.callType,
                status: params.status,
                duration_seconds: params.durationSeconds,
            });
        } catch (error) {
            console.error('Unable to save call log', error);
        }
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneIntervalRef.current !== null) {
            window.clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
    }, []);

    const getAudioContext = useCallback(async () => {
        if (typeof window === 'undefined') return null;
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) return null;
            audioContextRef.current = new Ctx();
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    const playTone = useCallback((ctx: AudioContext, frequency: number, durationMs: number, delayMs: number, volume = 0.05, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = ctx.currentTime + (delayMs / 1000);
        const endAt = startAt + (durationMs / 1000);

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startAt);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startAt);
        osc.stop(endAt + 0.02);
    }, []);

    const startIncomingRingtone = useCallback(async () => {
        stopRingtone();
        const ctx = await getAudioContext();
        if (!ctx) return;

        const sequence = () => {
            playTone(ctx, 698, 220, 0, 0.06, 'triangle');
            playTone(ctx, 880, 260, 280, 0.06, 'triangle');
            playTone(ctx, 1047, 300, 620, 0.05, 'triangle');
            playTone(ctx, 880, 260, 980, 0.045, 'triangle');
        };

        sequence();
        ringtoneIntervalRef.current = window.setInterval(sequence, 2400);
    }, [getAudioContext, playTone, stopRingtone]);

    const startOutgoingRingback = useCallback(async () => {
        stopRingtone();
        const ctx = await getAudioContext();
        if (!ctx) return;

        const sequence = () => {
            playTone(ctx, 440, 350, 0, 0.04, 'sine');
            playTone(ctx, 440, 350, 500, 0.04, 'sine');
        };

        sequence();
        ringtoneIntervalRef.current = window.setInterval(sequence, 3000);
    }, [getAudioContext, playTone, stopRingtone]);

    const isAcceptedFriend = useCallback(async (selfId: string, otherId: string) => {
        const { data } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(requester_id.eq.${selfId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${selfId})`)
            .eq('status', 'accepted')
            .maybeSingle();

        return !!data;
    }, []);

    const sendSignal = useCallback(async (payload: CallEvent) => {
        if (!signalingChannelRef.current) return;
        const { error } = await signalingChannelRef.current.send({
            type: 'broadcast',
            event: 'call-event',
            payload,
        });
        if (error) {
            console.error('Failed to send call signal', error);
        }
    }, []);

    const ensureLocalStream = useCallback(async (callType: CallType) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
        });
        setIsMuted(false);
        setIsCameraEnabled(callType === 'video');
        setLocalStream(stream);
        return stream;
    }, []);

    const attachStreamToPeer = useCallback((peer: RTCPeerConnection, stream: MediaStream) => {
        stream.getTracks().forEach((track) => {
            peer.addTrack(track, stream);
        });
    }, []);

    const createPeerConnection = useCallback((roomId: string, peerId: string) => {
        const peer = new RTCPeerConnection({ iceServers: STUN_SERVERS });

        peer.onicecandidate = (event) => {
            if (!user || !event.candidate) return;
            void sendSignal({
                kind: 'ice-candidate',
                fromUserId: user.id,
                toUserId: peerId,
                roomId,
                candidate: event.candidate.toJSON(),
            });
        };

        peer.ontrack = (event) => {
            const [stream] = event.streams;
            if (stream) {
                setRemoteStream(stream);
                setCallStatus('active');
                setCallStartedAt((prev) => prev ?? Date.now());
            }
        };

        peer.onconnectionstatechange = () => {
            if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected' || peer.connectionState === 'closed') {
                void resetCallState();
            }
        };

        pcRef.current = peer;
        return peer;
    }, [resetCallState, sendSignal, user]);

    const startCall = useCallback(async (peerId: string, peerUsername: string, callType: CallType) => {
        if (!user) return;

        if (callStatusRef.current !== 'idle') {
            toast.error('You are already in another call.');
            return;
        }

        const isFriend = await isAcceptedFriend(user.id, peerId);
        if (!isFriend) {
            toast.error('You can only call users who are your friends.');
            return;
        }

        const roomId = createRoomId(user.id, peerId);
        setActiveCall({ peerId, peerUsername, callType, roomId, isCaller: true });
        setCallStatus('calling');

        await sendSignal({
            kind: 'invite',
            fromUserId: user.id,
            fromUsername: profile?.username || 'User',
            fromAvatarId: profile?.avatar_id || 'av1',
            toUserId: peerId,
            roomId,
            callType,
        });

        toast.success(`${callType === 'video' ? 'Video' : 'Voice'} call request sent to @${peerUsername}`);
    }, [isAcceptedFriend, profile?.username, sendSignal, user]);

    const declineIncomingCall = useCallback(async () => {
        if (!user || !incomingCall) return;

        await sendSignal({
            kind: 'invite-declined',
            fromUserId: user.id,
            toUserId: incomingCall.fromUserId,
            roomId: incomingCall.roomId,
            reason: 'declined',
        });

        setIncomingCall(null);
        setCallStatus('idle');
    }, [incomingCall, sendSignal, user]);

    const acceptIncomingCall = useCallback(async () => {
        if (!user || !incomingCall) return;

        try {
            setCallStatus('connecting');
            setActiveCall({
                peerId: incomingCall.fromUserId,
                peerUsername: incomingCall.fromUsername,
                callType: incomingCall.callType,
                roomId: incomingCall.roomId,
                isCaller: false,
            });

            const stream = await ensureLocalStream(incomingCall.callType);
            const peer = createPeerConnection(incomingCall.roomId, incomingCall.fromUserId);
            attachStreamToPeer(peer, stream);

            await sendSignal({
                kind: 'invite-accepted',
                fromUserId: user.id,
                fromUsername: profile?.username || 'User',
                toUserId: incomingCall.fromUserId,
                roomId: incomingCall.roomId,
                callType: incomingCall.callType,
            });

            setIncomingCall(null);
        } catch (error) {
            console.error(error);
            toast.error('Could not access microphone/camera.');
            await declineIncomingCall();
        }
    }, [attachStreamToPeer, createPeerConnection, declineIncomingCall, ensureLocalStream, incomingCall, profile?.username, sendSignal, user]);

    const endCall = useCallback(async () => {
        if (!user || !activeCall) {
            resetCallState();
            return;
        }

        const durationSeconds = callStartedAt ? Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)) : 0;
        const status = callStatusRef.current === 'active' ? 'completed' : 'canceled';

        await sendSignal({
            kind: 'hangup',
            fromUserId: user.id,
            toUserId: activeCall.peerId,
            roomId: activeCall.roomId,
        });

        await recordCallLog({
            callerId: activeCall.isCaller ? user.id : activeCall.peerId,
            calleeId: activeCall.isCaller ? activeCall.peerId : user.id,
            callType: activeCall.callType,
            status,
            durationSeconds,
        });

        resetCallState();
    }, [activeCall, callStartedAt, recordCallLog, resetCallState, sendSignal, user]);

    const startDrag = useCallback((clientX: number, clientY: number) => {
        dragOffsetRef.current = {
            x: clientX - minimizedPosition.x,
            y: clientY - minimizedPosition.y,
        };
        isDraggingRef.current = true;
    }, [minimizedPosition.x, minimizedPosition.y]);

    const onDrag = useCallback((clientX: number, clientY: number) => {
        if (!isDraggingRef.current) return;
        const widgetWidth = 320;
        const widgetHeight = 78;
        const nextX = Math.min(Math.max(8, clientX - dragOffsetRef.current.x), window.innerWidth - widgetWidth - 8);
        const nextY = Math.min(Math.max(8, clientY - dragOffsetRef.current.y), window.innerHeight - widgetHeight - 8);
        setMinimizedPosition({ x: nextX, y: nextY });
    }, []);

    const stopDrag = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    const toggleMute = useCallback(() => {
        const nextMuted = !isMuted;
        localStream?.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted;
        });
        setIsMuted(nextMuted);
    }, [isMuted, localStream]);

    const toggleCamera = useCallback(() => {
        const nextEnabled = !isCameraEnabled;
        localStream?.getVideoTracks().forEach((track) => {
            track.enabled = nextEnabled;
        });
        setIsCameraEnabled(nextEnabled);
    }, [isCameraEnabled, localStream]);

    useEffect(() => {
        if (callStatus !== 'active' || !callStartedAt) {
            setElapsedSeconds(0);
            return;
        }

        setElapsedSeconds(Math.floor((Date.now() - callStartedAt) / 1000));
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - callStartedAt) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [callStartedAt, callStatus]);

    useEffect(() => {
        if (callStatus === 'incoming') {
            void startIncomingRingtone();
            return;
        }
        if (callStatus === 'calling') {
            void startOutgoingRingback();
            return;
        }
        stopRingtone();
    }, [callStatus, startIncomingRingtone, startOutgoingRingback, stopRingtone]);

    useEffect(() => {
        clearCallTimeout();
        if (callStatus !== 'calling' && callStatus !== 'incoming') return;

        timeoutRef.current = window.setTimeout(() => {
            const currentActiveCall = activeCallRef.current;
            const currentIncoming = incomingCall;

            if (callStatusRef.current === 'calling' && currentActiveCall && user) {
                void sendSignal({
                    kind: 'hangup',
                    fromUserId: user.id,
                    toUserId: currentActiveCall.peerId,
                    roomId: currentActiveCall.roomId,
                    reason: 'no_answer',
                });
                void createNotification(
                    currentActiveCall.peerId,
                    'Missed Call',
                    `You missed a ${currentActiveCall.callType} call from @${profile?.username || 'User'}.`
                );
                toast.error('No answer from user.');
                resetCallState();
                return;
            }

            if (callStatusRef.current === 'incoming' && currentIncoming && user) {
                void sendSignal({
                    kind: 'invite-declined',
                    fromUserId: user.id,
                    toUserId: currentIncoming.fromUserId,
                    roomId: currentIncoming.roomId,
                    reason: 'missed',
                });
                void recordCallLog({
                    callerId: currentIncoming.fromUserId,
                    calleeId: user.id,
                    callType: currentIncoming.callType,
                    status: 'missed',
                    durationSeconds: 0,
                });
                setIncomingCall(null);
                setCallStatus('idle');
            }
        }, 45000);

        return () => clearCallTimeout();
    }, [callStatus, clearCallTimeout, createNotification, incomingCall, profile?.username, recordCallLog, resetCallState, sendSignal, user]);

    useEffect(() => {
        if (!activeCall || callStatus === 'idle') return;

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            const looksLikeCapture =
                event.key === 'PrintScreen' ||
                ((event.metaKey || event.ctrlKey) && event.shiftKey && (key === '3' || key === '4' || key === '5' || key === 's'));

            if (!looksLikeCapture) return;
            event.preventDefault();
            toast.error('Screen capture is blocked during calls on this app.');
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                toast.warning('Keep call in foreground for privacy and best quality.');
            }
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeCall, callStatus]);

    useEffect(() => {
        return () => {
            clearCallTimeout();
            stopRingtone();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                void audioContextRef.current.close();
            }
        };
    }, [clearCallTimeout, stopRingtone]);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            onDrag(event.clientX, event.clientY);
        };
        const onTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            onDrag(touch.clientX, touch.clientY);
        };
        const onMouseUp = () => stopDrag();
        const onTouchEnd = () => stopDrag();

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchend', onTouchEnd);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [onDrag, stopDrag]);

    useEffect(() => {
        if (!localVideoRef.current) return;
        localVideoRef.current.srcObject = localStream;
    }, [localStream]);

    useEffect(() => {
        if (!remoteVideoRef.current) return;
        remoteVideoRef.current.srcObject = remoteStream;
    }, [remoteStream]);

    useEffect(() => {
        if (!user) {
            resetCallState();
            return;
        }

        const channel = supabase
            .channel('call-signaling')
            .on('broadcast', { event: 'call-event' }, async ({ payload }: { payload: CallEvent }) => {
                const event = payload;
                if (event.toUserId !== user.id) return;
                const currentActiveCall = activeCallRef.current;
                const currentCallStatus = callStatusRef.current;

                switch (event.kind) {
                    case 'invite': {
                        const allowed = await isAcceptedFriend(user.id, event.fromUserId);
                        if (!allowed || currentCallStatus !== 'idle') {
                            await sendSignal({
                                kind: 'invite-declined',
                                fromUserId: user.id,
                                toUserId: event.fromUserId,
                                roomId: event.roomId,
                                reason: 'busy',
                            });
                            return;
                        }

                        setIncomingCall({
                            fromUserId: event.fromUserId,
                            fromUsername: event.fromUsername || 'User',
                            fromAvatarId: event.fromAvatarId || 'av1',
                            callType: event.callType || 'voice',
                            roomId: event.roomId,
                        });
                        setCallStatus('incoming');
                        break;
                    }
                    case 'invite-accepted': {
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId || !currentActiveCall.isCaller) return;

                        try {
                            setCallStatus('connecting');
                            const stream = await ensureLocalStream(currentActiveCall.callType);
                            const peer = createPeerConnection(currentActiveCall.roomId, currentActiveCall.peerId);
                            attachStreamToPeer(peer, stream);

                            const offer = await peer.createOffer();
                            await peer.setLocalDescription(offer);

                            await sendSignal({
                                kind: 'offer',
                                fromUserId: user.id,
                                toUserId: currentActiveCall.peerId,
                                roomId: currentActiveCall.roomId,
                                sdp: offer,
                            });
                        } catch (error) {
                            console.error(error);
                            toast.error('Could not start call.');
                            resetCallState();
                        }
                        break;
                    }
                    case 'invite-declined': {
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId) return;
                        void recordCallLog({
                            callerId: currentActiveCall.isCaller ? user.id : currentActiveCall.peerId,
                            calleeId: currentActiveCall.isCaller ? currentActiveCall.peerId : user.id,
                            callType: currentActiveCall.callType,
                            status: event.reason === 'missed' ? 'missed' : 'declined',
                            durationSeconds: 0,
                        });
                        toast.error(event.reason === 'busy' ? 'User is busy right now.' : 'Call declined.');
                        resetCallState();
                        break;
                    }
                    case 'offer': {
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId || !pcRef.current) return;

                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.sdp));
                        const answer = await pcRef.current.createAnswer();
                        await pcRef.current.setLocalDescription(answer);

                        await sendSignal({
                            kind: 'answer',
                            fromUserId: user.id,
                            toUserId: currentActiveCall.peerId,
                            roomId: currentActiveCall.roomId,
                            sdp: answer,
                        });
                        break;
                    }
                    case 'answer': {
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId || !pcRef.current) return;
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.sdp));
                        break;
                    }
                    case 'ice-candidate': {
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId || !pcRef.current || !event.candidate) return;
                        try {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(event.candidate));
                        } catch (error) {
                            console.error('Failed to add ICE candidate', error);
                        }
                        break;
                    }
                    case 'hangup': {
                        if (currentActiveCall && currentActiveCall.roomId === event.roomId) {
                            const durationSeconds = callStartedAt ? Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)) : 0;
                            void recordCallLog({
                                callerId: currentActiveCall.isCaller ? user.id : currentActiveCall.peerId,
                                calleeId: currentActiveCall.isCaller ? currentActiveCall.peerId : user.id,
                                callType: currentActiveCall.callType,
                                status: durationSeconds > 0 ? 'completed' : 'canceled',
                                durationSeconds,
                            });
                            toast.message('Call ended');
                            resetCallState();
                            break;
                        }

                        const currentIncoming = incomingCallRef.current;
                        if (currentIncoming && currentIncoming.roomId === event.roomId) {
                            setIncomingCall(null);
                            setCallStatus('idle');
                            toast.message('Call ended');
                            break;
                        }

                        resetCallState();
                        break;
                    }
                    default:
                        break;
                }
            })
            .subscribe();

        signalingChannelRef.current = channel;

        return () => {
            if (signalingChannelRef.current) {
                supabase.removeChannel(signalingChannelRef.current);
            }
            signalingChannelRef.current = null;
            resetCallState();
        };
    }, [attachStreamToPeer, callStartedAt, createPeerConnection, ensureLocalStream, isAcceptedFriend, recordCallLog, resetCallState, sendSignal, user]);

    const value = useMemo<CallContextType>(() => ({
        callStatus,
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endCall,
    }), [acceptIncomingCall, activeCall, callStatus, declineIncomingCall, endCall, incomingCall, localStream, remoteStream, startCall]);

    const formatCallDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <CallContext.Provider value={value}>
            {children}

            {incomingCall && (
                <div className="fixed inset-0 z-50 bg-black text-white">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
                    <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
                        <AvatarDisplay avatarId={incomingCall.fromAvatarId || 'av1'} size="xl" isOnline={true} />
                        <p className="mt-5 text-2xl font-semibold">@{incomingCall.fromUsername}</p>
                        <p className="text-sm text-white/80 mt-1">Incoming {incomingCall.callType} call...</p>
                        <p className="text-xs text-white/60 mt-2">Ringing...</p>

                        <div className="mt-10 flex gap-3 w-full max-w-xs">
                            <Button className="flex-1 bg-neon-green text-white" onClick={() => void acceptIncomingCall()}>
                                <Phone className="w-4 h-4 mr-1" /> Accept
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={() => void declineIncomingCall()}>
                                <PhoneOff className="w-4 h-4 mr-1" /> Decline
                            </Button>
                        </div>

                        <div className="mt-3 flex gap-2 w-full max-w-xs">
                            <Button
                                variant="outline"
                                className="flex-1 border-white/30 text-white hover:bg-white/10"
                                onClick={() => {
                                    toast.info('We will remind you shortly.');
                                    setTimeout(() => {
                                        toast.message(`Reminder: @${incomingCall.fromUsername} called you.`);
                                    }, 60000);
                                    void declineIncomingCall();
                                }}
                            >
                                Remind Me
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-white/30 text-white hover:bg-white/10"
                                onClick={() => {
                                    const targetId = incomingCall.fromUserId;
                                    const targetName = incomingCall.fromUsername;
                                    void declineIncomingCall().then(() => {
                                        void startCall(targetId, targetName, incomingCall.callType);
                                    });
                                }}
                            >
                                Call Back
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {activeCall && callStatus !== 'idle' && (
                isOverlayMinimized ? (
                    <div
                        className="fixed z-50 w-[320px] glass-strong rounded-2xl border border-border p-3 shadow-elegant"
                        style={{ left: minimizedPosition.x, top: minimizedPosition.y }}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div
                                className="flex-1 cursor-move"
                                onMouseDown={(event) => startDrag(event.clientX, event.clientY)}
                                onTouchStart={(event) => {
                                    const touch = event.touches[0];
                                    if (!touch) return;
                                    startDrag(touch.clientX, touch.clientY);
                                }}
                            >
                                <p className="text-sm font-semibold truncate">@{activeCall.peerUsername}</p>
                                <p className="text-xs text-muted-foreground">
                                    {callStatus === 'calling'
                                        ? 'Ringing...'
                                        : callStatus === 'connecting'
                                            ? 'Connecting...'
                                            : formatCallDuration(elapsedSeconds)}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                {activeCall.callType === 'video' && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleCamera}>
                                        {isCameraEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                                    </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleMute}>
                                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsOverlayMinimized(false)}>
                                    <Maximize2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-9 w-9 rounded-full bg-red-600 hover:bg-red-500 text-white"
                                    onClick={() => void endCall()}
                                >
                                    <PhoneOff className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 z-40 bg-black text-white select-none">
                        {activeCall.callType === 'video' ? (
                            <div className="absolute inset-0">
                                {remoteStream ? (
                                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
                                )}
                            </div>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
                        )}

                        <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                            <div className="max-w-md mx-auto text-center relative">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-0 top-0 h-8 w-8 text-white/90 hover:text-white hover:bg-white/10"
                                    onClick={() => setIsOverlayMinimized(true)}
                                >
                                    <Minimize2 className="w-4 h-4" />
                                </Button>
                                <p className="font-semibold text-lg">@{activeCall.peerUsername}</p>
                                <div className="mt-1 flex items-center justify-center gap-2 text-xs text-white/90">
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>End-to-end encrypted</span>
                                    <span>•</span>
                                    <span>
                                        {callStatus === 'calling'
                                            ? 'Ringing...'
                                            : callStatus === 'connecting'
                                                ? 'Connecting...'
                                                : formatCallDuration(elapsedSeconds)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {activeCall.callType === 'video' && (
                            <div className="absolute top-16 right-4 w-28 h-40 rounded-2xl overflow-hidden border border-white/25 bg-black/40 shadow-lg">
                                {localStream && isCameraEnabled ? (
                                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-black/70">
                                        <CameraOff className="w-5 h-5 text-white/80" />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/45 to-transparent">
                            <div className="mx-auto flex items-center justify-center gap-5">
                                {activeCall.callType === 'video' && (
                                    <Button
                                        size="icon"
                                        className="h-12 w-12 rounded-full bg-white/15 hover:bg-white/25 border border-white/20"
                                        onClick={toggleCamera}
                                    >
                                        {isCameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    className="h-12 w-12 rounded-full bg-white/15 hover:bg-white/25 border border-white/20"
                                    onClick={toggleMute}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 text-white"
                                    onClick={() => void endCall()}
                                >
                                    <PhoneOff className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="text-center text-[11px] text-white/70 mt-3">
                                Protected call screen. Recording and screenshots are restricted by app policy.
                            </div>
                        </div>
                    </div>
                )
            )}
        </CallContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCall() {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within CallProvider');
    }
    return context;
}
