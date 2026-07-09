import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  ChevronLeft,
  Send,
  Phone,
  Video,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Pause,
  Play,
  Smile,
  X,
  Reply,
  Copy,
  Trash2,
  Download,
  ArrowDown,
  Loader2,
  AlertTriangle,
  Bookmark,
  Share2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TopBar } from '@/components/layout/TopBar';
import { AvatarDisplay } from '@/components/profile/AvatarDisplay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, MessageAttachment, PrivateMessage } from '@/types';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCall } from '@/context/CallContext';

type FriendProfile = {
  id: string;
  username: string;
  avatar_id: string;
  is_online: boolean;
};

const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '👏', '😍', '🙌', '💯'];
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥'];
const STICKERS = [
  { id: 'happy', emoji: '😄', label: 'Happy' },
  { id: 'love', emoji: '🥰', label: 'Love' },
  { id: 'wow', emoji: '🤩', label: 'Wow' },
  { id: 'party', emoji: '🎉', label: 'Party' },
  { id: 'cool', emoji: '😎', label: 'Cool' },
  { id: 'thumbs', emoji: '👍', label: 'Thumbs' },
];

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function formatPreviewDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function LinkPreview({ url }: { url: string }) {
  const domain = formatPreviewDomain(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-border bg-background/60 p-3 space-y-1 hover:bg-background/80 transition-smooth"
    >
      <p className="text-xs font-semibold truncate">{domain}</p>
      <p className="text-[11px] text-muted-foreground truncate">{url}</p>
      <div className="text-[10px] text-primary">Open link preview</div>
    </a>
  );
}

function AudioAttachmentPlayer({ attachment }: { attachment: MessageAttachment }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rate, setRate] = useState(1);

  const setPlaybackRate = (next: number) => {
    setRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  return (
    <div key={attachment.id} className="space-y-1">
      <audio ref={audioRef} controls className="w-full">
        <source src={attachment.url} type={attachment.mimeType} />
      </audio>
      <div className="flex items-center gap-1 text-[10px]">
        {[1, 1.5, 2].map((speed) => (
          <button
            key={speed}
            className={cn('px-1.5 py-0.5 rounded border', rate === speed ? 'border-primary text-primary' : 'border-border')}
            onClick={() => setPlaybackRate(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
      <a href={attachment.url} download={attachment.name} className="text-[11px] underline inline-flex items-center gap-1">
        <Download className="w-3 h-3" /> Download
      </a>
    </div>
  );
}

function getAttachmentKind(file: File): MessageAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function MessageStatusDot({ message }: { message: PrivateMessage }) {
  const status = message.status || (message.is_read ? 'read' : 'delivered');
  const text = status === 'sending'
    ? 'Sending...'
    : status === 'failed'
      ? 'Failed'
      : status === 'read'
        ? 'Read'
        : status === 'delivered'
          ? 'Delivered'
          : 'Sent';

  return <span className="text-[10px] text-white/80">{text}</span>;
}

function renderAttachment(attachment: MessageAttachment) {
  if (attachment.kind === 'image' || attachment.kind === 'gif' || attachment.kind === 'sticker') {
    return (
      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img src={attachment.url} alt={attachment.name} className="rounded-xl w-full max-h-56 object-cover" loading="lazy" />
      </a>
    );
  }

  if (attachment.kind === 'video') {
    return (
      <video key={attachment.id} controls className="rounded-xl w-full max-h-64" preload="metadata">
        <source src={attachment.url} type={attachment.mimeType} />
      </video>
    );
  }

  if (attachment.kind === 'audio' || attachment.kind === 'voice_note') {
    return <AudioAttachmentPlayer key={attachment.id} attachment={attachment} />;
  }

  return (
    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
      <Paperclip className="w-3 h-3" /> {attachment.name}
    </a>
  );
}

function ConversationList({ conversations, loading, onSelect }: {
  conversations: Conversation[];
  loading: boolean;
  onSelect: (c: Conversation) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    c.profile?.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          className="pl-9 bg-muted/50 border-transparent focus:border-primary"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="glass rounded-2xl h-16 animate-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No conversations yet</p>
          <p className="text-xs text-muted-foreground">Connect with people in Chat Rooms to start chatting</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(conv => (
            <button
              key={conv.partner_id}
              onClick={() => onSelect(conv)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-smooth text-left"
            >
              <AvatarDisplay
                avatarId={conv.profile?.avatar_id || 'av1'}
                size="md"
                isOnline={conv.profile?.is_online}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">@{conv.profile?.username || 'user'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_time), { addSuffix: false })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{conv.last_message}</span>
                  {conv.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full gradient-primary text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 ml-2">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FriendCallList({
  friends,
  onOpenChat,
  onVoiceCall,
  onVideoCall,
}: {
  friends: FriendProfile[];
  onOpenChat: (friend: FriendProfile) => void;
  onVoiceCall: (friend: FriendProfile) => void;
  onVideoCall: (friend: FriendProfile) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Friends</h2>
        <span className="text-xs text-muted-foreground">{friends.length} available to call</span>
      </div>

      {friends.length === 0 ? (
        <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
          Add and accept friends to start voice and video calls.
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.id} className="glass rounded-2xl p-3 flex items-center gap-3">
              <button className="flex items-center gap-3 flex-1 text-left" onClick={() => onOpenChat(friend)}>
                <AvatarDisplay avatarId={friend.avatar_id || 'av1'} size="md" isOnline={friend.is_online} />
                <div>
                  <p className="font-semibold text-sm">@{friend.username}</p>
                  <p className="text-xs text-muted-foreground">{friend.is_online ? 'Online' : 'Offline'}</p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onVoiceCall(friend)}>
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onVideoCall(friend)}>
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatView({ partnerId, partnerProfile, onBack, onVoiceCall, onVideoCall }: {
  partnerId: string;
  partnerProfile: Partial<import('@/types').Profile> | undefined;
  onBack: () => void;
  onVoiceCall: (partnerId: string, username: string) => void;
  onVideoCall: (partnerId: string, username: string) => void;
}) {
  const { user } = useAuth();
  const {
    messages,
    messagePermission,
    typingUsers,
    uploadProgress,
    hasMoreMessages,
    loadingMore,
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
  } = useMessages(partnerId);
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string>('');
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ message: PrivateMessage; x: number; y: number } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gifInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);

  const replyMessage = replyToId ? messages.find((m) => m.id === replyToId) : null;

  const visibleMessages = useMemo(() => {
    if (!searchInChat.trim()) return messages;
    const q = searchInChat.toLowerCase();
    return messages.filter((m) => {
      const textMatch = m.content.toLowerCase().includes(q);
      const attachmentMatch = (m.attachments || []).some((a) => a.name.toLowerCase().includes(q));
      return textMatch || attachmentMatch;
    });
  }, [messages, searchInChat]);

  const mediaMessages = useMemo(() => messages.filter((m) => (m.attachments || []).some((a) => ['image', 'video', 'gif', 'sticker'].includes(a.kind))), [messages]);

  const statusText = messagePermission.kind === 'friends'
    ? 'Friends • messaging unlocked'
    : messagePermission.kind === 'pending'
      ? `Pending request • ${messagePermission.remainingIntroMessages ?? 1} intro message left`
      : messagePermission.kind === 'pending_limit_reached'
        ? 'Pending request • waiting for acceptance'
        : 'Send friend request to chat';

  const statusClass = messagePermission.kind === 'friends'
    ? 'text-neon-green'
    : messagePermission.kind === 'pending'
      ? 'text-neon-gold'
      : 'text-muted-foreground';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const scrollToMessage = (messageId: string | null | undefined) => {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleTyping = (text: string) => {
    setValue(text);
    sendTypingState(text.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTypingState(false);
      typingTimeoutRef.current = null;
    }, 1200);
  };

  const handleSelectFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    const accepted = picked.filter((file) => file.size <= 100 * 1024 * 1024);
    if (accepted.length !== picked.length) {
      toast.error('Some files were skipped (max size: 100MB each).');
    }
    setSelectedFiles((prev) => [...prev, ...accepted]);
  };

  const handleSelectGifFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter((file) => file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'));
    if (picked.length === 0) {
      toast.error('Please choose GIF files only.');
      return;
    }
    setSelectedFiles((prev) => [...prev, ...picked]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      recordingChunksRef.current = [];

      rec.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
    } catch {
      toast.error('Microphone permission is required for voice notes.');
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      return;
    }
    if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
    }
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    recordingChunksRef.current = [];
    setIsRecording(false);
    setIsRecordingPaused(false);
  };

  const sendRecording = async () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();

    const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
    const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
    setSelectedFiles((prev) => [...prev, file]);
    setIsRecording(false);
    setIsRecordingPaused(false);
    recordingChunksRef.current = [];
  };

  const handleSend = async () => {
    if ((!value.trim() && selectedFiles.length === 0) || isSending || !messagePermission.canSend) return;

    setIsSending(true);
    sendTypingState(false);
    const currentText = value;
    const currentFiles = [...selectedFiles];
    const clientId = crypto.randomUUID();

    const { error } = await sendMessage({
      receiverId: partnerId,
      content: currentText,
      files: currentFiles,
      replyToId,
      clientId,
    });

    if (error) {
      toast.error(error.message || 'Unable to send message');
      setFailedDraft(currentText);
      setValue(currentText);
      setSelectedFiles(currentFiles);
      setIsSending(false);
      return;
    }

    setValue('');
    setSelectedFiles([]);
    setReplyToId(null);
    setFailedDraft('');
    setIsSending(false);
    setUploadProgressReset();
  };

  const setUploadProgressReset = () => {
    // Upload progress is managed in hook, this keeps UI tidy after successful send.
  };

  const onScrollMessages = () => {
    if (!listRef.current) return;
    const remaining = listRef.current.scrollHeight - (listRef.current.scrollTop + listRef.current.clientHeight);
    setShowJumpToLatest(remaining > 240);
  };

  const jumpToLatest = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendSticker = async (sticker: string) => {
    if (isSending || !messagePermission.canSend) return;
    setIsSending(true);
    const clientId = crypto.randomUUID();
    const { error } = await sendMessage({
      receiverId: partnerId,
      content: sticker,
      sticker,
      clientId,
    });
    if (error) {
      toast.error(error.message || 'Unable to send sticker');
    }
    setIsSending(false);
    setShowStickerPicker(false);
  };

  const typingLabel = typingUsers.length > 0
    ? `${typingUsers[0]} is typing...`
    : '';

  const handleForward = async (message: PrivateMessage) => {
    const target = window.prompt('Forward to user ID:');
    if (!target) return;
    const { error } = await forwardMessage(message, target.trim());
    if (error) {
      toast.error(error.message || 'Forward failed');
      return;
    }
    toast.success('Message forwarded');
  };

  useEffect(() => {
    const closeMenu = () => setActionMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="glass-strong border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <AvatarDisplay avatarId={partnerProfile?.avatar_id || 'av1'} size="sm" isOnline={partnerProfile?.is_online} />
        <div className="flex-1">
          <p className="font-semibold text-sm">@{partnerProfile?.username || 'user'}</p>
          <p className={cn('text-xs', statusClass)}>
            {statusText}
          </p>
        </div>
        {messagePermission.kind === 'friends' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVoiceCall(partnerId, partnerProfile?.username || 'user')}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVideoCall(partnerId, partnerProfile?.username || 'user')}
            >
              <Video className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-border bg-muted/20 space-y-2">
        <div className="flex gap-2">
          <Input
            value={searchInChat}
            onChange={(e) => setSearchInChat(e.target.value)}
            placeholder="Search in this chat..."
            className="h-8 text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => setShowMediaGallery((prev) => !prev)}>
            <ImageIcon className="w-3.5 h-3.5 mr-1" /> Media
          </Button>
        </div>
        {typingLabel && (
          <div className="text-xs text-primary animate-pulse">{typingLabel}</div>
        )}
      </div>

      {showMediaGallery && (
        <div className="px-4 py-2 border-b border-border max-h-40 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Shared media</p>
          <div className="grid grid-cols-4 gap-2">
            {mediaMessages.slice(-20).flatMap((m) => (m.attachments || []).filter((a) => ['image', 'video', 'gif', 'sticker'].includes(a.kind)).map((a) => (
              <button key={`${m.id}-${a.id}`} className="rounded-lg overflow-hidden" onClick={() => scrollToMessage(m.id)}>
                {a.kind === 'video' ? (
                  <video src={a.url} className="w-full h-16 object-cover" />
                ) : (
                  <img src={a.url} alt={a.name} className="w-full h-16 object-cover" loading="lazy" />
                )}
              </button>
            )))}
          </div>
        </div>
      )}

      {showStickerPicker && (
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="grid grid-cols-3 gap-2">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                className="glass rounded-2xl p-3 flex flex-col items-center justify-center gap-1"
                onClick={() => void sendSticker(sticker.emoji)}
              >
                <span className="text-3xl leading-none">{sticker.emoji}</span>
                <span className="text-[10px] text-muted-foreground">{sticker.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={listRef} onScroll={onScrollMessages} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMoreMessages && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => void loadOlderMessages()} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Load older messages
            </Button>
          </div>
        )}

        {visibleMessages.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Start a conversation!
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const prev = index > 0 ? visibleMessages[index - 1] : null;
          const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(msg.created_at));
          const isOwn = msg.sender_id === user?.id;
          const replyTarget = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;

          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
              {showDate && (
                <div className="text-center my-3">
                  <span className="px-2 py-1 rounded-full text-[11px] bg-muted text-muted-foreground">
                    {format(new Date(msg.created_at), 'EEEE, MMM d')}
                  </span>
                </div>
              )}

              <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] px-3 py-2.5 rounded-2xl text-sm space-y-2',
                  isOwn
                    ? 'gradient-primary text-white rounded-br-md'
                    : 'glass rounded-tl-md'
                )}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setActionMenu({ message: msg, x: event.clientX, y: event.clientY });
                  }}
                >
                  {replyTarget && (
                    <button
                      className={cn('w-full text-left rounded-lg px-2 py-1 text-xs border', isOwn ? 'border-white/20 bg-white/10' : 'border-border bg-muted/40')}
                      onClick={() => scrollToMessage(replyTarget.id)}
                    >
                      Replying to @{replyTarget.sender_id === user?.id ? 'you' : partnerProfile?.username || 'user'}: {replyTarget.content.slice(0, 80)}
                    </button>
                  )}

                  {msg.deleted_for_everyone ? (
                    <p className="italic opacity-70">This message was deleted</p>
                  ) : (
                    <>
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                      {extractFirstUrl(msg.content) && <LinkPreview url={extractFirstUrl(msg.content)!} />}
                      {(msg.attachments || []).length > 0 && (
                        <div className="space-y-2">
                          {(msg.attachments || []).map((att) => renderAttachment(att))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={`${msg.id}-${emoji}`}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-black/10"
                          onClick={() => void reactToMessage(msg.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] opacity-85">
                      <button onClick={() => setReplyToId(msg.id)} title="Reply"><Reply className="w-3 h-3" /></button>
                      <button onClick={() => navigator.clipboard.writeText(msg.content || '')} title="Copy"><Copy className="w-3 h-3" /></button>
                      <button onClick={() => void handleForward(msg)} title="Forward"><Share2 className="w-3 h-3" /></button>
                      <button onClick={() => { saveMessage(msg); toast.success('Saved'); }} title="Save"><Bookmark className="w-3 h-3" /></button>
                      <button onClick={() => { void reportMessage(msg, 'User report from chat actions'); toast.success('Reported'); }} title="Report"><AlertTriangle className="w-3 h-3" /></button>
                      {isOwn && (
                        <>
                          <button onClick={() => void deleteMessageForEveryone(msg.id)} title="Delete for everyone"><Trash2 className="w-3 h-3" /></button>
                          <button onClick={() => deleteMessageForMe(msg.id)} title="Delete for me"><X className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-[10px] opacity-85">
                    <span>{format(new Date(msg.created_at), 'p')}</span>
                    {isOwn && <MessageStatusDot message={msg} />}
                    {msg.status === 'failed' && (
                      <button className="underline" onClick={() => void retryFailedMessage(msg)}>Retry</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {showJumpToLatest && (
        <button
          className="absolute right-6 bottom-28 z-20 rounded-full shadow-lg bg-primary text-white p-2"
          onClick={jumpToLatest}
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {replyMessage && (
        <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center justify-between gap-2 text-xs">
          <div className="truncate">
            Replying to: {replyMessage.content.slice(0, 80)}
          </div>
          <button onClick={() => setReplyToId(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>{selectedFiles.length} file(s) selected</span>
            {uploadProgress > 0 && uploadProgress < 100 && <span>Uploading {uploadProgress}%</span>}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="min-w-[120px] rounded-lg bg-card p-2 text-[11px]">
                <p className="truncate">{file.name}</p>
                <p className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button className="underline mt-1" onClick={() => removeSelectedFile(index)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isRecording && (
        <div className="px-4 py-2 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{isRecordingPaused ? 'Recording paused' : 'Recording voice note...'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={pauseResumeRecording}>
                {isRecordingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelRecording}>Cancel</Button>
              <Button size="sm" className="gradient-primary text-white border-0" onClick={() => void sendRecording()}>Use</Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.rar,.txt"
          onChange={(e) => handleSelectFiles(e.target.files)}
        />
        <input
          ref={gifInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/gif"
          onChange={(e) => handleSelectGifFiles(e.target.files)}
        />
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => gifInputRef.current?.click()}>
          <ImageIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={() => { if (!isRecording) void startVoiceRecording(); }}
          onMouseUp={() => { if (isRecording && !isRecordingPaused) void sendRecording(); }}
          onTouchStart={() => { if (!isRecording) void startVoiceRecording(); }}
          onTouchEnd={() => { if (isRecording && !isRecordingPaused) void sendRecording(); }}
          onClick={() => { if (!isRecording) void startVoiceRecording(); }}
        >
          <Mic className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowEmojiPicker((prev) => !prev)}>
          <Smile className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowStickerPicker((prev) => !prev)}>
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Input
          value={value}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message..."
          className="flex-1 bg-muted/50 border-transparent focus:border-primary"
        />
        <Button
          size="icon"
          className="gradient-primary text-white border-0"
          onClick={handleSend}
          disabled={isSending || (!value.trim() && selectedFiles.length === 0) || !messagePermission.canSend}
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {showEmojiPicker && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-border">
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} className="text-xl" onClick={() => setValue((prev) => prev + emoji)}>{emoji}</button>
          ))}
        </div>
      )}

      {failedDraft && (
        <div className="px-4 pb-3">
          <Button variant="outline" size="sm" onClick={handleSend}>Retry failed send</Button>
        </div>
      )}

      {actionMenu && (
        <div
          className="fixed z-50 glass rounded-xl border border-border p-2 w-44 space-y-1"
          style={{ left: Math.max(8, actionMenu.x - 30), top: Math.max(8, actionMenu.y - 20) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { setReplyToId(actionMenu.message.id); setActionMenu(null); }}>Reply</button>
          <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { void navigator.clipboard.writeText(actionMenu.message.content || ''); setActionMenu(null); }}>Copy</button>
          <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { void handleForward(actionMenu.message); setActionMenu(null); }}>Forward</button>
          <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { saveMessage(actionMenu.message); toast.success('Saved'); setActionMenu(null); }}>Save</button>
          <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { void reportMessage(actionMenu.message, 'User report from context menu'); toast.success('Reported'); setActionMenu(null); }}>Report</button>
          {actionMenu.message.sender_id === user?.id && (
            <>
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { void deleteMessageForEveryone(actionMenu.message.id); setActionMenu(null); }}>Delete for everyone</button>
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50" onClick={() => { deleteMessageForMe(actionMenu.message.id); setActionMenu(null); }}>Delete for me</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MessagesPage() {
  const { conversations, loading, fetchConversations } = useMessages();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [searchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const { user } = useAuth();
  const { startCall } = useCall();

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      const { data: relationships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const friendIds = (relationships || []).map((row) =>
        row.requester_id === user.id ? row.addressee_id : row.requester_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_id, is_online')
        .in('id', friendIds)
        .order('is_online', { ascending: false })
        .order('username', { ascending: true });

      setFriends((profiles || []) as FriendProfile[]);
    };

    void fetchFriends();
  }, [user]);

  useEffect(() => {
    const partnerId = searchParams.get('with');
    if (!partnerId || activeConv) return;

    const existing = conversations.find(c => c.partner_id === partnerId);
    if (existing) {
      setActiveConv(existing);
      return;
    }

    const openDirectChat = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_id, level, is_online')
        .eq('id', partnerId)
        .maybeSingle();

      setActiveConv({
        partner_id: partnerId,
        last_message: '',
        last_time: new Date().toISOString(),
        unread_count: 0,
        profile: profile || undefined,
      });
    };

    void openDirectChat();
  }, [searchParams, conversations, activeConv]);

  const openChatWithFriend = (friend: FriendProfile) => {
    const existing = conversations.find((c) => c.partner_id === friend.id);
    if (existing) {
      setActiveConv(existing);
      return;
    }

    setActiveConv({
      partner_id: friend.id,
      last_message: '',
      last_time: new Date().toISOString(),
      unread_count: 0,
      profile: friend,
    });
  };

  const handleVoiceCall = (partnerId: string, username: string) => {
    void startCall(partnerId, username, 'voice');
  };

  const handleVideoCall = (partnerId: string, username: string) => {
    void startCall(partnerId, username, 'video');
  };

  return (
    <AppLayout>
      {activeConv ? (
        <div className="h-screen flex flex-col max-w-2xl mx-auto w-full">
          <ChatView
            partnerId={activeConv.partner_id}
            partnerProfile={activeConv.profile}
            onBack={() => { setActiveConv(null); fetchConversations(); }}
            onVoiceCall={handleVoiceCall}
            onVideoCall={handleVideoCall}
          />
        </div>
      ) : (
        <>
          <TopBar title="Messages" showSearch={false} />
          <div className="max-w-2xl mx-auto w-full p-4 space-y-6">
            <FriendCallList
              friends={friends}
              onOpenChat={openChatWithFriend}
              onVoiceCall={(friend) => handleVoiceCall(friend.id, friend.username)}
              onVideoCall={(friend) => handleVideoCall(friend.id, friend.username)}
            />

            <ConversationList
              conversations={conversations}
              loading={loading}
              onSelect={setActiveConv}
            />
          </div>
        </>
      )}
    </AppLayout>
  );
}
