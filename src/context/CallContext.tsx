import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

type CallType = 'voice' | 'video';
type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'active';

type IncomingCall = {
    fromUserId: string;
    fromUsername: string;
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

    const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const callStatusRef = useRef<CallStatus>('idle');
    const activeCallRef = useRef<ActiveCall | null>(null);

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

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
        setCallStatus('idle');
    }, [cleanupPeerConnection, stopLocalTracks]);

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

        await sendSignal({
            kind: 'hangup',
            fromUserId: user.id,
            toUserId: activeCall.peerId,
            roomId: activeCall.roomId,
        });

        resetCallState();
    }, [activeCall, resetCallState, sendSignal, user]);

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
                        if (!currentActiveCall || currentActiveCall.roomId !== event.roomId) return;
                        toast.message('Call ended');
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
    }, [attachStreamToPeer, createPeerConnection, ensureLocalStream, isAcceptedFriend, resetCallState, sendSignal, user]);

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

    return (
        <CallContext.Provider value={value}>
            {children}

            {incomingCall && (
                <div className="fixed right-4 bottom-20 lg:bottom-6 z-50 w-[320px] glass-strong rounded-2xl border border-border p-4 shadow-elegant">
                    <p className="text-sm font-semibold">Incoming {incomingCall.callType} call</p>
                    <p className="text-xs text-muted-foreground mt-1">@{incomingCall.fromUsername}</p>
                    <div className="mt-3 flex gap-2">
                        <Button className="flex-1 bg-neon-green text-white" onClick={() => void acceptIncomingCall()}>
                            <Phone className="w-4 h-4 mr-1" /> Accept
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={() => void declineIncomingCall()}>
                            <PhoneOff className="w-4 h-4 mr-1" /> Decline
                        </Button>
                    </div>
                </div>
            )}

            {activeCall && callStatus !== 'idle' && (
                <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl rounded-2xl bg-card border border-border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{activeCall.callType === 'video' ? 'Video call' : 'Voice call'} with @{activeCall.peerUsername}</p>
                                <p className="text-xs text-muted-foreground capitalize">{callStatus === 'calling' ? 'Ringing...' : callStatus}</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => void endCall()}>
                                <PhoneOff className="w-4 h-4 mr-1" /> End
                            </Button>
                        </div>

                        {activeCall.callType === 'video' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-56 bg-muted rounded-xl object-cover"
                                />
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-56 bg-muted rounded-xl object-cover"
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl bg-muted/40 p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Phone className="w-4 h-4" />
                                Voice call in progress
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                            Keep this tab open while on call.
                        </div>
                    </div>
                </div>
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
