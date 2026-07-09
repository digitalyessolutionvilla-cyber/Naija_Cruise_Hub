import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useXP } from '@/hooks/useXP';
import type { PrivateMessage, Conversation, MessageAttachment } from '@/types';

const MAX_RENDER_MESSAGES = 250;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 200 * 1024 * 1024;

type MessagePermissionState = {
    kind: 'friends' | 'pending' | 'pending_limit_reached' | 'request_required';
    canSend: boolean;
    remainingIntroMessages: number | null;
};

type SendMessageParams = {
    receiverId: string;
    content: string;
    files?: File[];
    replyToId?: string | null;
    clientId?: string;
    sticker?: string | null;
};

export function useMessages(partnerId?: string) {
    const { user } = useAuth();
    const { awardXP } = useXP();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<PrivateMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [messagePermission, setMessagePermission] = useState<MessagePermissionState>({
        kind: 'friends',
        canSend: true,
        remainingIntroMessages: null,
    });
    const [loading, setLoading] = useState(true);

    const typingTimeoutsRef = useRef<Record<string, number>>({});
    const inFlightClientIdsRef = useRef<Set<string>>(new Set());
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const dmRoomId = useMemo(() => {
        if (!user?.id || !partnerId) return null;
        return ['dm', user.id, partnerId].sort().join(':');
    }, [partnerId, user?.id]);

    const toMessage = useCallback((row: any): PrivateMessage => ({
        ...row,
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        reactions: (row.reactions || {}) as Record<string, string[]>,
        status: row.is_read ? 'read' : 'delivered',
        error: null,
    }), []);

    const capMessages = useCallback((rows: PrivateMessage[]) => {
        if (rows.length <= MAX_RENDER_MESSAGES) return rows;
        return rows.slice(rows.length - MAX_RENDER_MESSAGES);
    }, []);

    const compressImage = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) return file;
        if (file.size <= 1.5 * 1024 * 1024) return file;

        const imageBitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / imageBitmap.width);
        canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
        canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));
        ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
        });
        imageBitmap.close();
        if (!blob) return file;
        if (blob.size >= file.size) return file;

        return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }, []);

    const getMessagePermission = useCallback(async (receiverId: string): Promise<MessagePermissionState> => {
        if (!user) {
            return { kind: 'request_required', canSend: false, remainingIntroMessages: 0 };
        }

        const { data: acceptedFriendship } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${receiverId}),and(requester_id.eq.${receiverId},addressee_id.eq.${user.id})`)
            .eq('status', 'accepted')
            .maybeSingle();

        if (acceptedFriendship) {
            return { kind: 'friends', canSend: true, remainingIntroMessages: null };
        }

        const { data: pendingRequest } = await supabase
            .from('friendships')
            .select('id')
            .eq('requester_id', user.id)
            .eq('addressee_id', receiverId)
            .eq('status', 'pending')
            .maybeSingle();

        if (!pendingRequest) {
            return { kind: 'request_required', canSend: false, remainingIntroMessages: 0 };
        }

        const { count } = await supabase
            .from('private_messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', user.id)
            .eq('receiver_id', receiverId);

        const sentCount = count ?? 0;
        if (sentCount >= 1) {
            return { kind: 'pending_limit_reached', canSend: false, remainingIntroMessages: 0 };
        }

        return { kind: 'pending', canSend: true, remainingIntroMessages: 1 - sentCount };
    }, [user]);

    const fetchConversations = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        const { data } = await supabase.rpc('get_conversations', { p_user_id: user.id });
        if (!data) {
            setConversations([]);
            setLoading(false);
            return;
        }

        const partnerIds = (data as Conversation[]).map((c) => c.partner_id);
        if (partnerIds.length === 0) {
            setConversations([]);
            setLoading(false);
            return;
        }

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_id, level, is_online')
            .in('id', partnerIds);

        const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]));

        setConversations((data as Conversation[]).map((c) => ({
            ...c,
            unread_count: Number(c.unread_count),
            profile: profileMap.get(c.partner_id),
        })));
        setLoading(false);
    }, [user]);

    const fetchMessages = useCallback(async () => {
        if (!user || !partnerId) return;
        setLoading(true);

        const sb = supabase as any;
        const { data } = await sb
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true })
            .limit(30);

        const rows = (data || []).map(toMessage);
        setMessages(capMessages(rows));
        setHasMoreMessages(rows.length >= 30);

        await supabase
            .from('private_messages')
            .update({ is_read: true })
            .eq('sender_id', partnerId)
            .eq('receiver_id', user.id)
            .eq('is_read', false);

        setLoading(false);
    }, [partnerId, toMessage, user]);

    const loadOlderMessages = useCallback(async () => {
        if (!user || !partnerId || loadingMore || !hasMoreMessages) return;
        const oldest = messages[0];
        if (!oldest) return;

        setLoadingMore(true);
        const sb = supabase as any;
        const { data } = await sb
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
            .lt('created_at', oldest.created_at)
            .order('created_at', { ascending: false })
            .limit(20);

        const older = ((data || []) as any[]).reverse().map(toMessage);
        setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return capMessages([...older.filter((m) => !ids.has(m.id)), ...prev]);
        });
        setHasMoreMessages(older.length >= 20);
        setLoadingMore(false);
    }, [capMessages, hasMoreMessages, loadingMore, messages, partnerId, toMessage, user]);

    const sendTypingState = useCallback((isTyping: boolean) => {
        if (!user || !partnerId || !dmRoomId || !channelRef.current) return;
        void channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                roomId: dmRoomId,
                userId: user.id,
                username: user.user_metadata?.username || 'User',
                isTyping,
            },
        });
    }, [dmRoomId, partnerId, user]);

    const uploadAttachments = useCallback(async (files: File[]) => {
        if (!user || files.length === 0) return [] as MessageAttachment[];

        const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
        if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
            throw new Error('Total attachment size exceeds 200MB.');
        }

        const uploaded: MessageAttachment[] = [];
        for (let i = 0; i < files.length; i += 1) {
            const sourceFile = files[i];
            if (sourceFile.size > MAX_FILE_SIZE_BYTES) {
                throw new Error(`${sourceFile.name} exceeds 100MB upload limit.`);
            }

            const file = await compressImage(sourceFile);
            const ext = file.name.split('.').pop() || 'bin';
            const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('chat-media').upload(path, file, {
                upsert: false,
                cacheControl: '3600',
            });
            if (error) {
                throw new Error(error.message || 'Attachment upload failed');
            }

            const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
            const mimeType = file.type || 'application/octet-stream';
            const kind: MessageAttachment['kind'] = mimeType.startsWith('image/')
                ? 'image'
                : mimeType.startsWith('video/')
                    ? 'video'
                    : mimeType.startsWith('audio/')
                        ? 'audio'
                        : 'file';

            uploaded.push({
                id: crypto.randomUUID(),
                name: file.name,
                url: data.publicUrl,
                mimeType,
                size: file.size,
                kind,
            });
            setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }

        return uploaded;
    }, [compressImage, user]);

    useEffect(() => {
        if (!partnerId) {
            void fetchConversations();
            return;
        }

        void fetchMessages();
        void getMessagePermission(partnerId).then(setMessagePermission);

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`dm-${user?.id}-${partnerId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'private_messages',
            }, (payload) => {
                const row = toMessage(payload.new);
                const isInThread =
                    (row.sender_id === user?.id && row.receiver_id === partnerId) ||
                    (row.sender_id === partnerId && row.receiver_id === user?.id);
                if (!isInThread) return;

                setMessages((prev) => {
                    if (prev.some((m) => m.id === row.id)) return prev;
                    if (row.client_id) {
                        const optimisticIndex = prev.findIndex((m) => m.client_id === row.client_id);
                        if (optimisticIndex >= 0) {
                            const next = [...prev];
                            next[optimisticIndex] = { ...row, status: row.is_read ? 'read' : 'delivered' };
                            return next;
                        }
                    }
                    return capMessages([...prev, row]);
                });

                if (row.sender_id === partnerId) {
                    void getMessagePermission(partnerId).then(setMessagePermission);
                    void supabase.from('private_messages')
                        .update({ is_read: true })
                        .eq('id', row.id)
                        .eq('receiver_id', user?.id || '');
                } else {
                    void fetchConversations();
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'private_messages',
            }, (payload) => {
                const row = toMessage(payload.new);
                const isInThread =
                    (row.sender_id === user?.id && row.receiver_id === partnerId) ||
                    (row.sender_id === partnerId && row.receiver_id === user?.id);
                if (!isInThread) return;

                setMessages((prev) => prev.map((m) => (
                    m.id === row.id ? { ...m, ...row, status: row.is_read ? 'read' : 'delivered' } : m
                )));
            })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (!dmRoomId) return;
                if (payload.roomId !== dmRoomId) return;
                if (payload.userId === user?.id) return;

                const typingUser = payload.username as string;
                setTypingUsers((prev) => (prev.includes(typingUser) ? prev : [...prev, typingUser]));

                if (typingTimeoutsRef.current[typingUser]) {
                    window.clearTimeout(typingTimeoutsRef.current[typingUser]);
                }
                typingTimeoutsRef.current[typingUser] = window.setTimeout(() => {
                    setTypingUsers((prev) => prev.filter((name) => name !== typingUser));
                    delete typingTimeoutsRef.current[typingUser];
                }, payload.isTyping ? 1800 : 100);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            Object.values(typingTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
            typingTimeoutsRef.current = {};
            setTypingUsers([]);
        };
    }, [capMessages, dmRoomId, fetchConversations, fetchMessages, getMessagePermission, partnerId, toMessage, user]);

    const sendMessage = useCallback(async (params: SendMessageParams) => {
        const { receiverId, content, files = [], replyToId = null, sticker = null } = params;
        if (!user) return { error: new Error('Not authenticated') };

        const trimmed = content.trim();
        if (!trimmed && files.length === 0 && !sticker) {
            return { error: new Error('Message is empty') };
        }

        const clientId = params.clientId || crypto.randomUUID();
        if (inFlightClientIdsRef.current.has(clientId)) {
            return { error: new Error('Duplicate message ignored'), ignored: true };
        }

        const permission = await getMessagePermission(receiverId);
        setMessagePermission(permission);
        if (!permission.canSend) {
            if (permission.kind === 'request_required') {
                return { error: new Error('Send a friend request first before messaging this user.') };
            }
            return { error: new Error('You can only send one message until your friend request is accepted.') };
        }

        inFlightClientIdsRef.current.add(clientId);
        setUploadProgress(0);

        const optimisticId = `tmp-${clientId}`;
        const optimisticMessage: PrivateMessage = {
            id: optimisticId,
            client_id: clientId,
            sender_id: user.id,
            receiver_id: receiverId,
            content: sticker || trimmed,
            message_type: sticker ? 'sticker' : files.length > 0 ? 'file' : 'text',
            attachments: [],
            reply_to_id: replyToId,
            reactions: {},
            is_read: false,
            created_at: new Date().toISOString(),
            status: 'sending',
            error: null,
        };

        setMessages((prev) => capMessages([...prev, optimisticMessage]));

        try {
            const attachments = await uploadAttachments(files);
            const messageType: PrivateMessage['message_type'] = sticker
                ? 'sticker'
                : attachments.length === 0
                    ? 'text'
                    : attachments[0].kind === 'image'
                        ? 'image'
                        : attachments[0].kind === 'video'
                            ? 'video'
                            : attachments[0].kind === 'audio'
                                ? 'audio'
                                : 'file';

            const sb = supabase as any;
            const { data, error } = await sb
                .from('private_messages')
                .upsert({
                    sender_id: user.id,
                    receiver_id: receiverId,
                    client_id: clientId,
                    content: sticker || trimmed,
                    message_type: messageType,
                    attachments,
                    reply_to_id: replyToId,
                }, { onConflict: 'sender_id,client_id' })
                .select('*')
                .single();

            if (error) {
                setMessages((prev) => prev.map((m) => (
                    m.id === optimisticId ? { ...m, status: 'failed', error: error.message || 'Send failed' } : m
                )));
                return { error: error as Error, clientId, optimisticId };
            }

            setMessages((prev) => prev.map((m) => (
                m.id === optimisticId ? { ...toMessage(data), status: 'sent' } : m
            )));
            setUploadProgress(100);

            await awardXP('send_message');
            await supabase.from('notifications').insert({
                user_id: receiverId,
                type: 'message',
                title: 'New Message',
                body: sticker ? 'Sticker' : trimmed.slice(0, 80) || (attachments[0]?.name ? `Attachment: ${attachments[0].name}` : 'Attachment'),
            });

            const nextPermission = await getMessagePermission(receiverId);
            setMessagePermission(nextPermission);
            return { error: null, clientId, optimisticId };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Send failed';
            setMessages((prev) => prev.map((m) => (
                m.id === optimisticId ? { ...m, status: 'failed', error: msg } : m
            )));
            return { error: new Error(msg), clientId, optimisticId };
        } finally {
            inFlightClientIdsRef.current.delete(clientId);
        }
    }, [awardXP, capMessages, getMessagePermission, toMessage, uploadAttachments, user]);

    const retryFailedMessage = useCallback(async (message: PrivateMessage) => {
        const target = messages.find((m) => m.id === message.id || (message.client_id && m.client_id === message.client_id));
        if (!target) return { error: new Error('Message no longer exists') };

        setMessages((prev) => prev.filter((m) => m.id !== target.id));
        return sendMessage({
            receiverId: target.receiver_id,
            content: target.content,
            files: [],
            replyToId: target.reply_to_id || null,
            clientId: target.client_id || crypto.randomUUID(),
        });
    }, [messages, sendMessage]);

    const reactToMessage = useCallback(async (messageId: string, emoji: string) => {
        if (!user) return;

        const target = messages.find((m) => m.id === messageId);
        if (!target) return;

        const reactions = { ...(target.reactions || {}) };
        const users = new Set(reactions[emoji] || []);
        if (users.has(user.id)) users.delete(user.id);
        else users.add(user.id);
        reactions[emoji] = Array.from(users);

        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
        const sb = supabase as any;
        await sb.from('private_messages').update({ reactions }).eq('id', messageId);
    }, [messages, user]);

    const deleteMessageForEveryone = useCallback(async (messageId: string) => {
        if (!user) return;
        const sb = supabase as any;
        await sb.from('private_messages').update({
            deleted_for_everyone: true,
            content: 'This message was deleted',
            attachments: [],
        }).eq('id', messageId).eq('sender_id', user.id);
    }, [user]);

    const deleteMessageForMe = useCallback((messageId: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }, []);

    const forwardMessage = useCallback(async (message: PrivateMessage, targetUserId: string) => {
        const content = message.content
            ? `Forwarded: ${message.content}`
            : `Forwarded attachment${(message.attachments || []).length > 1 ? 's' : ''}`;
        return sendMessage({
            receiverId: targetUserId,
            content,
            files: [],
            replyToId: null,
        });
    }, [sendMessage]);

    const saveMessage = useCallback((message: PrivateMessage) => {
        if (!user) return;
        const key = `saved-messages:${user.id}`;
        const existing = localStorage.getItem(key);
        const parsed: PrivateMessage[] = existing ? JSON.parse(existing) : [];
        if (parsed.some((m) => m.id === message.id)) return;
        localStorage.setItem(key, JSON.stringify([message, ...parsed].slice(0, 500)));
    }, [user]);

    const reportMessage = useCallback(async (message: PrivateMessage, reason: string) => {
        if (!user) return;
        await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'system',
            title: 'Message reported',
            body: `Report submitted for message ${message.id}. Reason: ${reason}`,
        });
    }, [user]);

    return {
        conversations,
        messages,
        typingUsers,
        uploadProgress,
        hasMoreMessages,
        loadingMore,
        messagePermission,
        loading,
        fetchConversations,
        fetchMessages,
        loadOlderMessages,
        sendTypingState,
        sendMessage,
        retryFailedMessage,
        reactToMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        forwardMessage,
        saveMessage,
        reportMessage,
    };
}
