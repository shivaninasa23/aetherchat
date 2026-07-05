import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, Video, Search, MoreVertical, Send, Smile, Paperclip, 
  MapPin, User as UserIcon, Image, Film, Music, FileText, X, 
  Reply, CornerUpLeft, Star, Edit3, Trash2, Copy, Share, Pin, 
  Check, CheckCheck, Play, Pause, Sticker, Disc, Mic, MicOff, CheckCircle, MessageSquare, ShieldAlert, Palette
} from 'lucide-react';
import { Chat, User, Message, MediaType, FileInfo, LocationInfo, ContactInfo, Reaction, UserSettings } from '../types';
import { presetWallpapers, stickerList, gifList } from '../data';
import ChangeWallpaperModal from './ChangeWallpaperModal';

interface ChatAreaProps {
  chat: Chat;
  currentUser: User;
  users: User[];
  messages: Message[];
  isDark: boolean;
  isTyping: boolean;
  onSendMessage: (content: string, type?: MediaType, extra?: { fileInfo?: FileInfo, locationInfo?: LocationInfo, contactInfo?: ContactInfo, mediaUrl?: string, thumbnailUrl?: string }) => void;
  onDeleteMessage: (msgId: string, everyone: boolean) => void;
  onEditMessage: (msgId: string, newContent: string) => void;
  onToggleStarMessage: (msgId: string) => void;
  onReactMessage: (msgId: string, emoji: string) => void;
  onTriggerCall: (type: 'voice' | 'video') => void;
  onToggleSidebarDetails: () => void;
  isSidebarDetailsOpen: boolean;
  settings: UserSettings;
  onBlockUser: (userId: string) => void;
  onReportChat: (chatId: string, reason: string) => void;
  onShareChat: (chatId: string) => void;
  onClearChatTranscript: (chatId: string) => void;
  onToggleMuteChat: () => void;
  onTogglePinChat: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onLoadOlderMessages?: () => void;
  hasOlderMessages?: boolean;
}

export default function ChatArea({
  chat,
  currentUser,
  users,
  messages,
  isDark,
  isTyping,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleStarMessage,
  onReactMessage,
  onTriggerCall,
  onToggleSidebarDetails,
  isSidebarDetailsOpen,
  settings,
  onBlockUser,
  onReportChat,
  onShareChat,
  onClearChatTranscript,
  onToggleMuteChat,
  onTogglePinChat,
  onUpdateSettings,
  onLoadOlderMessages,
  hasOlderMessages = false
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiMenuId, setShowEmojiMenuId] = useState<string | null>(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [activeSelectorType, setActiveSelectorType] = useState<'gif' | 'sticker' | null>(null);
  
  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<any>(null);
  
  // Real Audio Device references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Playback states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  
  // Real File Upload references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<'image' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Listen for external command to open search (from profile panel)
  useEffect(() => {
    const handleOpenSearch = () => {
      setShowChatSearch(true);
    };
    window.addEventListener('chatsphere-open-search', handleOpenSearch);
    return () => {
      window.removeEventListener('chatsphere-open-search', handleOpenSearch);
    };
  }, []);

  // Active custom/procedural wallpaper resolver
  const chatSpecificWallpaper = settings.chatWallpapers?.[chat.id];
  const activeWallpaperId = chatSpecificWallpaper !== undefined ? chatSpecificWallpaper : (settings.chatWallpaper || 'solid');

  const matchedPreset = presetWallpapers.find(p => p.id === activeWallpaperId);
  const isImageWallpaper = (matchedPreset && matchedPreset.type === 'image') || 
    activeWallpaperId.startsWith('http://') || 
    activeWallpaperId.startsWith('https://') || 
    activeWallpaperId.startsWith('data:');

  const isGradientWallpaper = activeWallpaperId.startsWith('linear-gradient');
  const isSolidColorWallpaper = activeWallpaperId.startsWith('#');

  const wallpaperUrl = matchedPreset && matchedPreset.type === 'image' ? matchedPreset.value : activeWallpaperId;

  const wallpaperClass = (!isImageWallpaper && !isGradientWallpaper && !isSolidColorWallpaper) ? (
    activeWallpaperId === 'stars' ? 'wallpaper-stars bg-[#05050d]/90' :
    activeWallpaperId === 'nodes' ? 'wallpaper-nodes' :
    activeWallpaperId === 'sunset-glow' ? 'wallpaper-sunset-glow bg-[#1f0900]/80' :
    activeWallpaperId === 'matrix' ? 'wallpaper-matrix bg-[#021c12]/80' :
    ''
  ) : '';

  let wallpaperStyle: React.CSSProperties | undefined = undefined;
  if (isImageWallpaper) {
    wallpaperStyle = {
      backgroundImage: `url("${wallpaperUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  } else if (isGradientWallpaper) {
    wallpaperStyle = {
      background: activeWallpaperId
    };
  } else if (isSolidColorWallpaper) {
    wallpaperStyle = {
      backgroundColor: activeWallpaperId
    };
  }

  const getAccentColor = (type: 'bg' | 'text' | 'border' | 'hoverBg' | 'hoverText') => {
    const c = settings.chatThemeColor || 'indigo';
    if (type === 'bg') {
      if (c === 'pink') return 'bg-pink-600';
      if (c === 'emerald') return 'bg-emerald-600';
      if (c === 'orange') return 'bg-orange-600';
      return 'bg-indigo-600';
    }
    if (type === 'text') {
      if (c === 'pink') return 'text-pink-500';
      if (c === 'emerald') return 'text-emerald-500';
      if (c === 'orange') return 'text-orange-500';
      return 'text-indigo-500';
    }
    if (type === 'border') {
      if (c === 'pink') return 'border-pink-500/20 focus-within:border-pink-500';
      if (c === 'emerald') return 'border-emerald-500/20 focus-within:border-emerald-500';
      if (c === 'orange') return 'border-orange-500/20 focus-within:border-orange-500';
      return 'border-indigo-500/20 focus-within:border-indigo-500';
    }
    if (type === 'hoverBg') {
      if (c === 'pink') return 'hover:bg-pink-700';
      if (c === 'emerald') return 'hover:bg-emerald-700';
      if (c === 'orange') return 'hover:bg-orange-700';
      return 'hover:bg-indigo-700';
    }
    if (type === 'hoverText') {
      if (c === 'pink') return 'hover:text-pink-500';
      if (c === 'emerald') return 'hover:text-emerald-500';
      if (c === 'orange') return 'hover:text-orange-500';
      return 'hover:text-indigo-500';
    }
    return 'bg-indigo-600';
  };

  const typingTimeoutRef = useRef<any>(null);
  const [isTypingSent, setIsTypingSent] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (window.chatsphere_socket && window.chatsphere_socket.readyState === WebSocket.OPEN) {
      if (!isTypingSent && val.trim().length > 0) {
        setIsTypingSent(true);
        window.chatsphere_socket.send(JSON.stringify({
          type: "typing",
          payload: { chatId: chat.id, isTyping: true }
        }));
      }

      // Reset typing status after 2.5 seconds of inactivity
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (window.chatsphere_socket && window.chatsphere_socket.readyState === WebSocket.OPEN) {
          window.chatsphere_socket.send(JSON.stringify({
            type: "typing",
            payload: { chatId: chat.id, isTyping: false }
          }));
        }
        setIsTypingSent(false);
      }, 2500);
    }
  };

  // Ensure typing status stops if active chat changes
  useEffect(() => {
    setIsTypingSent(false);
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, [chat.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatMessages = messages.filter(m => m.chatId === chat.id && !m.deletedForMe);

  // Scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, chat.id]);

  // Handle Voice Recording timer
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      setRecordingInterval(interval);
    } else {
      if (recordingInterval) clearInterval(recordingInterval);
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingInterval) clearInterval(recordingInterval);
    };
  }, [isRecording]);

  // Find partner for direct chats
  let chatPartner: User | undefined;
  if (!chat.isGroup) {
    const partnerId = chat.memberIds.find(id => id !== currentUser.id);
    chatPartner = users.find(u => u.id === partnerId);
  }

  const resolvedChatAvatar = chat.isGroup ? chat.avatar : (chatPartner?.avatar || chat.avatar);
  const resolvedChatName = chat.isGroup ? chat.name : (chatPartner?.name || chat.name);

  const handleSend = () => {
    if (!inputText.trim()) return;

    if (chatPartner && settings.blockedUsers.includes(chatPartner.id)) {
      alert(`This contact is blocked. Unblock ${chatPartner.name} from the top options menu to send messages.`);
      return;
    }

    if (editingMessageId) {
      onEditMessage(editingMessageId, inputText);
      setEditingMessageId(null);
    } else {
      onSendMessage(inputText, 'text');
    }
    
    setInputText('');
    setReplyingMessageId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle voice note unmount cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Real browser microphone recording voice note trigger
  const handleToggleRecord = async () => {
    if (chatPartner && settings.blockedUsers.includes(chatPartner.id)) {
      alert(`This contact is blocked. Unblock ${chatPartner.name} to send voice notes.`);
      return;
    }
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            // Send the real base64 audio URL so other tabs/clients can play it
            onSendMessage('🎙️ Voice Note', 'voice', { mediaUrl: base64Audio });
          };
          // Stop all audio tracks to release the microphone device
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Microphone access denied or browser interface error, initiating high-end mock voice simulation:', err);
        // Fallback simulation if mic is blocked or unavailable
        setIsRecording(true);
      }
    } else {
      setIsRecording(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        // Fallback send if mic was blocked
        onSendMessage('🎙️ Voice Note (Simulated Audio Recording)', 'voice');
      }
    }
  };

  const triggerFilePicker = (type: 'image' | 'file') => {
    if (chatPartner && settings.blockedUsers.includes(chatPartner.id)) {
      alert(`This contact is blocked. Unblock ${chatPartner.name} to share files.`);
      return;
    }
    setCurrentUploadType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : '*';
      fileInputRef.current.click();
    }
  };

  const uploadFileWithProgress = (
    file: File,
    type: 'image' | 'file',
    onProgress: (progress: number) => void
  ): Promise<{ url: string; filename: string; thumbnail?: string; fileInfo?: FileInfo }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const errRes = JSON.parse(xhr.responseText);
            reject(new Error(errRes.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      xhr.send(formData);
    });
  };

  const handleRealFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    setUploadError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const approvedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'doc', 'docx', 'zip', 'txt', 'mp3', 'mp4'];
    if (!approvedExts.includes(ext)) {
      setUploadError("Blocked file extension. Approved types are: Images (jpg, jpeg, png, webp, gif, svg), PDF, DOCX, ZIP, TXT, MP3, MP4.");
      setUploadProgress(null);
      e.target.value = '';
      return;
    }

    const maxSize = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSize) {
      setUploadError("File size exceeds 25 MB limit. Please select a smaller file.");
      setUploadProgress(null);
      e.target.value = '';
      return;
    }

    let cleanName = file.name.replace(/[\/\\]/g, ""); // strip directories
    cleanName = cleanName.replace(/\.{2,}/g, "."); // strip multi-dot path traversal
    cleanName = cleanName.replace(/[^a-zA-Z0-9 _.-]/g, ""); // allow alphanumeric, space, dot, underscore, dash
    cleanName = cleanName.trim().replace(/^[ ._-]+/, ""); // trim leading spaces/dots
    if (!cleanName) cleanName = 'file_' + Date.now();

    try {
      const result = await uploadFileWithProgress(file, currentUploadType === 'image' ? 'image' : 'file', (progress) => {
        setUploadProgress(progress);
      });

      if (currentUploadType === 'image') {
        onSendMessage(`📷 ${cleanName}`, 'image', { 
          mediaUrl: result.url,
          thumbnailUrl: result.thumbnail,
          fileInfo: result.fileInfo
        });
      } else {
        const fileInfo: FileInfo = result.fileInfo || {
          name: cleanName,
          size: formatBytes(file.size),
          extension: ext
        };
        onSendMessage(cleanName, 'file', { 
          fileInfo, 
          mediaUrl: result.url 
        });
      }
      
      setTimeout(() => setUploadProgress(null), 1000);

    } catch (err: any) {
      console.error("[Upload] Error during file upload:", err);
      setUploadError(err.message || "An error occurred during file upload.");
      setUploadProgress(null);
    } finally {
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Handle rich attachments trigger
  const handleAttachMock = (type: MediaType) => {
    setShowAttachmentMenu(false);
    if (chatPartner && settings.blockedUsers.includes(chatPartner.id)) {
      alert(`This contact is blocked. Unblock ${chatPartner.name} to send attachments.`);
      return;
    }
    
    if (type === 'image') {
      triggerFilePicker('image');
    } else if (type === 'file') {
      triggerFilePicker('file');
    } else if (type === 'gif') {
      setActiveSelectorType('gif');
    } else if (type === 'sticker') {
      setActiveSelectorType('sticker');
    } else if (type === 'location') {
      const address = prompt("Enter GPS Location Address to Share:", "1600 Amphitheatre Pkwy, Mountain View, CA");
      if (address) {
        const locationInfo: LocationInfo = {
          latitude: 37.4220,
          longitude: -122.0841,
          address: address
        };
        onSendMessage(`📍 Shared Location: ${address}`, 'location', { locationInfo });
      }
    } else if (type === 'contact') {
      const name = prompt("Enter Contact Full Name:", "Marcus Vance");
      if (name) {
        const phone = prompt("Enter Contact Phone Number:", "+1 (555) 019-2831");
        const email = prompt("Enter Contact Email:", `${name.toLowerCase().replace(/ /g, '')}@gmail.com`);
        const contactInfo: ContactInfo = {
          name: name,
          phone: phone || '+1 (555) 019-2831',
          email: email || ''
        };
        onSendMessage(`👤 Shared Contact card: ${name}`, 'contact', { contactInfo });
      }
    }
  };

  // Helper to format record seconds to MM:SS
  const formatRecordTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('Message content copied to secure clipboard!');
  };

  // Real Audio device play or falling back to animation simulator
  const handleSimulateAudioPlay = (msgId: string) => {
    if (playingAudioId === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      const msg = messages.find(m => m.id === msgId);
      if (msg && msg.mediaUrl && msg.mediaUrl.startsWith('data:audio')) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const playAudio = new Audio(msg.mediaUrl);
        audioRef.current = playAudio;
        setPlayingAudioId(msgId);
        playAudio.play().catch(e => console.error("Could not play audio track:", e));

        playAudio.ontimeupdate = () => {
          const progress = (playAudio.currentTime / (playAudio.duration || 1)) * 100;
          setAudioProgress(prev => ({ ...prev, [msgId]: progress }));
        };

        playAudio.onended = () => {
          setPlayingAudioId(null);
          setAudioProgress(prev => ({ ...prev, [msgId]: 0 }));
        };
      } else {
        // Fallback animated progress simulation
        setPlayingAudioId(msgId);
        let currentProgress = audioProgress[msgId] || 0;
        const progressInterval = setInterval(() => {
          setAudioProgress(prev => {
            const prog = (prev[msgId] || 0) + 10;
            if (prog >= 100) {
              clearInterval(progressInterval);
              setPlayingAudioId(null);
              return { ...prev, [msgId]: 0 };
            }
            return { ...prev, [msgId]: prog };
          });
        }, 500);
      }
    }
  };

  // Find any pinned message in current thread
  const pinnedMessage = activeChatMessages.find(m => m.isStarred); // using starred as pins too for premium visual

  // Quick Emoji reactions bank
  const emojiReactions = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

  return (
    <div className="h-full flex flex-col justify-between bg-transparent relative select-none">
      
      {/* 1. Chat Window Header */}
      <div className={`p-4 flex justify-between items-center border-b ${isDark ? 'border-slate-800/40 bg-transparent' : 'border-slate-200/40 bg-transparent'} backdrop-blur-md z-10`}>
        <div 
          onClick={onToggleSidebarDetails}
          title="Click to view contact/group profile info"
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition-opacity active:scale-[0.99]"
        >
          <img
            src={resolvedChatAvatar}
            alt={resolvedChatName}
            className="w-10 h-10 rounded-2xl object-cover border border-slate-200/10 shadow-sm"
          />
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs font-bold truncate leading-tight hover:text-indigo-400 transition-colors">{resolvedChatName}</span>
            {isTyping ? (
              <span className="text-[10px] text-indigo-500 font-semibold animate-pulse">Typing secure response...</span>
            ) : chat.isGroup ? (
              <span className="text-[10px] text-slate-400 truncate">{chat.memberIds.length} users online</span>
            ) : chatPartner ? (
              <span className="text-[10px] text-slate-400 capitalize">{chatPartner.status} {chatPartner.status !== 'online' && chatPartner.lastSeen ? `• Last seen ${chatPartner.lastSeen}` : ''}</span>
            ) : (
              <span className="text-[10px] text-slate-400">Encrypted workspace</span>
            )}
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1">
          {/* Search conversation */}
          <button
            onClick={() => setShowChatSearch(!showChatSearch)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${showChatSearch ? 'bg-indigo-500/10 text-indigo-500' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100/10'}`}
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          {/* Voice Call Button (UI simulation) */}
          <button
            onClick={() => onTriggerCall('voice')}
            className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100/10 transition-colors cursor-pointer"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>

          {/* Video Call Button (UI simulation) */}
          <button
            onClick={() => onTriggerCall('video')}
            className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-100/10 transition-colors cursor-pointer"
          >
            <Video className="h-4.5 w-4.5" />
          </button>

          {/* Three Dots Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMoreDropdown(!showMoreDropdown)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${showMoreDropdown ? 'bg-indigo-500/10 text-indigo-500' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100/10'}`}
              title="More options"
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </button>

            <AnimatePresence>
              {showMoreDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 mt-2 w-52 rounded-2xl border shadow-2xl p-2 z-50 transition-colors ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {/* View Info */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        onToggleSidebarDetails();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4 text-slate-400" />
                      <span>View Chat Info</span>
                    </button>

                    {/* Change Chat Wallpaper */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        setShowWallpaperModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <Palette className="h-4 w-4 text-slate-400" />
                      <span>Change Chat Wallpaper</span>
                    </button>

                    {/* Mute */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        onToggleMuteChat();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="h-4 w-4 text-slate-400" />
                        <span>Mute Notifications</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{chat.isMuted ? 'On' : 'Off'}</span>
                    </button>

                    {/* Pin */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        onTogglePinChat();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Pin className="h-4 w-4 text-slate-400" />
                        <span>Pin Channel</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{chat.isPinned ? 'On' : 'Off'}</span>
                    </button>

                    <div className="h-px bg-slate-200/20 my-1.5" />

                    {/* Block (Only if not a group) */}
                    {!chat.isGroup && chatPartner && (
                      <button
                        onClick={() => {
                          setShowMoreDropdown(false);
                          onBlockUser(chatPartner.id);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                          settings.blockedUsers.includes(chatPartner.id)
                            ? 'text-emerald-500 hover:bg-emerald-500/10 font-bold'
                            : 'text-red-500 hover:bg-red-500/10 font-bold'
                        }`}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span>{settings.blockedUsers.includes(chatPartner.id) ? 'Unblock Contact' : 'Block Contact'}</span>
                      </button>
                    )}

                    {/* Report */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        const reason = prompt("Enter secure audit and reporting reason:", "Inappropriate message or malicious credentials");
                        if (reason) {
                          onReportChat(chat.id, reason);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="h-4 w-4 text-red-400" />
                      <span>Report Threat</span>
                    </button>

                    {/* Share */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        onShareChat(chat.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <Share className="h-4 w-4 text-slate-400" />
                      <span>Share Deep Invite Link</span>
                    </button>

                    {/* Export / Transcript */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        const chatTrans = activeChatMessages
                          .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.senderId === 'self' ? 'You' : 'Partner'}: ${m.content}`)
                          .join('\n');
                        const blob = new Blob([chatTrans], { type: 'text/plain' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `AetherChat_Transcript_${chat.name.replace(/ /g, '_')}.txt`;
                        link.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>Export Transcript (.txt)</span>
                    </button>

                    {/* Clear Transcript */}
                    <button
                      onClick={() => {
                        setShowMoreDropdown(false);
                        onClearChatTranscript(chat.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-red-500/25 text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Purge Transcript</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search Box Overlay */}
      <AnimatePresence>
        {showChatSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-md z-10`}
          >
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search words, coordinates, files in this channel..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="flex-1 text-xs py-1 bg-transparent border-0 outline-hidden focus:ring-0"
              autoFocus
            />
            {chatSearchQuery && (
              <button onClick={() => setChatSearchQuery('')} className="p-1 rounded text-slate-400 hover:text-indigo-500 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Pinned Message banner bar (Framer Motion) */}
      <AnimatePresence>
        {pinnedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-2.5 px-4 border-b flex items-center justify-between text-xs cursor-pointer ${isDark ? 'bg-indigo-950/25 border-slate-850' : 'bg-indigo-50/50 border-slate-150'}`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Pin className="h-3.5 w-3.5 text-indigo-500 rotate-45 flex-shrink-0" />
              <div className="text-left overflow-hidden">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Starred Reference</p>
                <p className="text-slate-400 truncate text-[11px] mt-0.5 max-w-md">{pinnedMessage.content}</p>
              </div>
            </div>
            <button onClick={() => onToggleStarMessage(pinnedMessage.id)} className="text-slate-400 hover:text-red-500 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Scrollable Messages Panel */}
      <div 
        className={`flex-1 overflow-y-auto p-4 space-y-3 relative ${wallpaperClass}`}
        style={wallpaperStyle}
      >
        {activeChatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold">End-to-End Encrypted Session</h4>
            <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
              Every package is audited with secure key handshakes. Type a message or trigger attachments below.
            </p>
          </div>
        ) : (
          <>
            {hasOlderMessages && onLoadOlderMessages && (
              <div className="flex justify-center pb-2.5">
                <button
                  onClick={onLoadOlderMessages}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-mono border transition-all duration-200 cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900/40 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40' 
                      : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  Load Older Decrypted Packets
                </button>
              </div>
            )}
            {activeChatMessages
              .filter(m => {
                if (!chatSearchQuery) return true;
                return m.content.toLowerCase().includes(chatSearchQuery.toLowerCase());
              })
              .map((msg, idx) => {
                const isSelf = msg.senderId === currentUser.id || msg.senderId === 'self';
                const sender = users.find(u => u.id === msg.senderId);
                
                return (
                  <MemoizedMessageItem
                    key={msg.id}
                    msg={msg}
                    isSelf={isSelf}
                    sender={sender}
                    currentUser={currentUser}
                    chat={chat}
                    isDark={isDark}
                    showEmojiMenuId={showEmojiMenuId}
                    setShowEmojiMenuId={setShowEmojiMenuId}
                    setReplyingMessageId={setReplyingMessageId}
                    onDeleteMessage={onDeleteMessage}
                    onReactMessage={onReactMessage}
                    onToggleStarMessage={onToggleStarMessage}
                    playingAudioId={playingAudioId}
                    audioProgressValue={audioProgress[msg.id] || 15}
                    handleSimulateAudioPlay={handleSimulateAudioPlay}
                    emojiReactions={emojiReactions}
                    settings={settings}
                  />
                );
              })}
          </>
        )}

        {/* Live Typing Status */}
        {isTyping && (
          <div className="flex items-center gap-2">
            <img src={chat.avatar} alt="Typing" className="w-6 h-6 rounded-lg object-cover" />
            <div className="p-3 bg-slate-950/20 rounded-2xl rounded-bl-none flex gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. Input Action Panel */}
      <div className={`p-4 border-t ${isDark ? 'border-slate-800/40 bg-transparent' : 'border-slate-200/40 bg-transparent'} backdrop-blur-md relative`}>
        
        {/* Upload Progress Indicator */}
        {uploadProgress !== null && (
          <div className="mb-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-1.5 animate-pulse">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-indigo-500">Uploading file to server...</span>
              <span className="font-mono text-[10px] text-indigo-400 font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200/10 dark:bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload Error Alert */}
        {uploadError && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex justify-between items-center text-xs">
            <span className="font-medium text-red-400">{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="p-1 text-slate-400 hover:text-red-400 cursor-pointer">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Reply Indicator banner */}
        {replyingMessageId && (
          <div className="flex justify-between items-center bg-indigo-500/5 p-2 rounded-xl mb-3 border border-indigo-500/10">
            <div className="flex items-center gap-2 text-xs text-indigo-500">
              <CornerUpLeft className="h-4 w-4" />
              <span>Replying to message preview: <span className="italic font-medium text-slate-400">"{messages.find(m => m.id === replyingMessageId)?.content}"</span></span>
            </div>
            <button onClick={() => setReplyingMessageId(null)} className="p-1 rounded text-slate-400 hover:text-indigo-500 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Floating Attachment Menu */}
        <AnimatePresence>
          {showAttachmentMenu && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className={`absolute bottom-20 left-4 z-40 p-4 w-48 rounded-2xl border shadow-2xl grid grid-cols-2 gap-3 transition-colors ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
            >
              {[
                { type: 'image', label: 'Graphic', icon: Image, color: 'bg-indigo-500/15 text-indigo-500' },
                { type: 'sticker', label: 'Sticker', icon: Sticker, color: 'bg-indigo-500/15 text-indigo-500' },
                { type: 'file', label: 'File', icon: FileText, color: 'bg-purple-500/15 text-purple-500' },
                { type: 'location', label: 'Location', icon: MapPin, color: 'bg-emerald-500/15 text-emerald-500' },
                { type: 'contact', label: 'Contact', icon: UserIcon, color: 'bg-amber-500/15 text-amber-500' },
                { type: 'gif', label: 'GIF', icon: Disc, color: 'bg-pink-500/15 text-pink-500' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleAttachMock(item.type as MediaType)}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-900 transition-colors gap-1.5 cursor-pointer"
                  >
                    <div className={`p-2 rounded-xl ${item.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Sticker/GIF Tray */}
        <AnimatePresence>
          {activeSelectorType && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 210, marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className={`rounded-2xl border flex flex-col overflow-hidden ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} shadow-xl z-30 relative`}
            >
              {/* Header */}
              <div className={`px-4 py-2 flex items-center justify-between border-b text-xs font-bold ${isDark ? 'border-slate-800 text-slate-300 bg-slate-900/50' : 'border-slate-100 text-slate-600 bg-slate-50/50'}`}>
                <span className="capitalize">{activeSelectorType} Drawer</span>
                <button 
                  onClick={() => setActiveSelectorType(null)}
                  className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid content */}
              <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                {activeSelectorType === 'sticker' ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {stickerList.map((stickerUrl, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          onSendMessage(`🌸 Shared Sticker: #${index + 1}`, 'sticker', {
                            mediaUrl: stickerUrl
                          });
                          setActiveSelectorType(null);
                        }}
                        className={`aspect-square p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center ${isDark ? 'hover:bg-slate-900 bg-slate-900/30' : 'hover:bg-slate-100 bg-slate-50'}`}
                      >
                        <img 
                          src={stickerUrl} 
                          alt={`Sticker ${index + 1}`} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain max-h-14 transition-transform hover:scale-110 duration-200" 
                        />
                        <span className="text-[9px] text-slate-400 mt-1 truncate max-w-full text-center">Sticker {index + 1}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col h-full gap-2">
                    {/* Search inside the tray */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Filter available GIFs..."
                        id="gif-tray-search"
                        className={`w-full py-1.5 px-3 pr-8 text-xs rounded-lg outline-none transition-all ${
                          isDark 
                            ? 'bg-slate-900 text-white placeholder-slate-500 border border-slate-800 focus:border-indigo-500/50' 
                            : 'bg-slate-100 text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-indigo-500/50'
                        }`}
                        onChange={(e) => {
                          const query = e.target.value.toLowerCase();
                          const items = document.querySelectorAll('.gif-selector-item');
                          items.forEach(el => {
                            const name = el.getAttribute('data-name')?.toLowerCase() || '';
                            if (name.includes(query)) {
                              el.classList.remove('hidden');
                            } else {
                              el.classList.add('hidden');
                            }
                          });
                        }}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 overflow-y-auto mt-1 flex-1">
                      {gifList.map((gif) => (
                        <button
                          key={gif.url}
                          data-name={gif.name}
                          onClick={() => {
                            onSendMessage(`✨ Shared GIF: ${gif.name}`, 'gif', {
                              mediaUrl: gif.url
                            });
                            setActiveSelectorType(null);
                          }}
                          className="gif-selector-item relative rounded-xl overflow-hidden aspect-video transition-transform hover:scale-102 group cursor-pointer border border-slate-500/5"
                        >
                          <img 
                            src={gif.url} 
                            alt={gif.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5 justify-center">
                            <span className="text-[10px] text-white font-medium truncate max-w-full">{gif.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {chatPartner && settings.blockedUsers.includes(chatPartner.id) ? (
          <div className="w-full flex flex-col items-center justify-center p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-center gap-1.5">
            <ShieldAlert className="h-6 w-6 text-red-500 animate-pulse" />
            <span className="text-xs font-bold text-red-500">You have blocked this contact</span>
            <span className="text-[10px] text-slate-400">Unblock {chatPartner.name} in the options menu (three dots dropdown in top right) to exchange messages again.</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRealFileChange}
              className="hidden"
            />
            {/* Attach Button */}
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`p-3 rounded-2xl transition-colors cursor-pointer border ${showAttachmentMenu ? `bg-indigo-600/10 ${getAccentColor('border')} ${getAccentColor('text')}` : `bg-slate-100/30 dark:bg-slate-900/30 border-slate-200/10 hover:${getAccentColor('border')} text-slate-400 ${getAccentColor('hoverText')}`}`}
              title="Attach packet files"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>

            {/* Text Input Block */}
            <div className={`flex-1 flex items-center rounded-2xl border ${isDark ? `bg-slate-900/40 border-slate-850 focus-within:${getAccentColor('border')}` : `bg-slate-100/40 border-slate-200 focus-within:${getAccentColor('border')} focus-within:bg-white`} transition-all`}>
              
              {/* Mock Mic recorder active style */}
              {isRecording ? (
                <div className="flex-1 px-4 py-3 flex items-center gap-3 text-red-500 text-xs font-bold animate-pulse">
                  <Mic className="h-4.5 w-4.5 animate-bounce" />
                  <span>Simulated Voice Recorder Live: {formatRecordTime(recordingSeconds)}</span>
                  <span className="text-slate-400 text-[10px] ml-auto">Click Mic again to finalize and send...</span>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Secure end-to-end messaging..."
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  className="w-full text-xs py-3.5 px-4 bg-transparent outline-hidden focus:ring-0"
                />
              )}

              {/* Quick Sticker Drawer Icon Trigger */}
              <button
                onClick={() => handleAttachMock('sticker')}
                title="Add Sticker"
                className={`p-2.5 text-slate-400 ${getAccentColor('hoverText')} cursor-pointer`}
              >
                <Sticker className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Voice recorder / Mic Button */}
            {!inputText.trim() ? (
              <button
                onClick={handleToggleRecord}
                className={`p-3.5 rounded-2xl text-white font-medium hover:scale-105 cursor-pointer transition-all ${isRecording ? 'bg-red-500 shadow-md shadow-red-500/20' : `${getAccentColor('bg')} shadow-md ${getAccentColor('hoverBg')} shadow-indigo-600/20`}`}
                title="Record voice packet"
              >
                {isRecording ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
              </button>
            ) : (
              /* Send Button */
              <button
                onClick={handleSend}
                className={`p-3.5 rounded-2xl ${getAccentColor('bg')} ${getAccentColor('hoverBg')} text-white font-medium hover:scale-105 cursor-pointer transition-all shadow-md shadow-indigo-600/20`}
                title="Dispatch message packet"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            )}

          </div>
        )}

      </div>

      <ChangeWallpaperModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        chat={chat}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        isDark={isDark}
      />

    </div>
  );
}

interface MemoizedMessageItemProps {
  msg: Message;
  isSelf: boolean;
  sender: User | undefined;
  currentUser: User;
  chat: Chat;
  isDark: boolean;
  showEmojiMenuId: string | null;
  setShowEmojiMenuId: (id: string | null) => void;
  setReplyingMessageId: (id: string | null) => void;
  onDeleteMessage: (msgId: string, everyone: boolean) => void;
  onReactMessage: (msgId: string, emoji: string) => void;
  onToggleStarMessage: (msgId: string) => void;
  playingAudioId: string | null;
  audioProgressValue: number;
  handleSimulateAudioPlay: (msgId: string) => void;
  emojiReactions: string[];
  settings: UserSettings;
}

const MemoizedMessageItem = React.memo(function MemoizedMessageItem({
  msg,
  isSelf,
  sender,
  currentUser,
  chat,
  isDark,
  showEmojiMenuId,
  setShowEmojiMenuId,
  setReplyingMessageId,
  onDeleteMessage,
  onReactMessage,
  onToggleStarMessage,
  playingAudioId,
  audioProgressValue,
  handleSimulateAudioPlay,
  emojiReactions,
  settings
}: MemoizedMessageItemProps) {
  const chatThemeColor = settings.chatThemeColor || 'indigo';
  const accentBgClass = chatThemeColor === 'pink' ? 'bg-pink-600 shadow-pink-600/15' :
                        chatThemeColor === 'emerald' ? 'bg-emerald-600 shadow-emerald-600/15' :
                        chatThemeColor === 'orange' ? 'bg-orange-600 shadow-orange-600/15' :
                        'bg-indigo-600 shadow-indigo-600/15';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} relative group w-full`}
    >
      {/* Reply Banner inside bubble */}
      {msg.replyToId && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mb-1 mr-1">
          <Reply className="h-3 w-3" /> Replied to secure packet
        </div>
      )}

      {/* Message Bubble + Context Toolbar Wrapper */}
      <div className={`flex items-end gap-2 max-w-[70%] relative ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* User Profile photo on incoming bubble */}
        {!isSelf && chat.isGroup && (
          <img
            src={sender?.avatar}
            alt={sender?.name}
            className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-slate-200/10 shadow-xs"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Chat Bubble card container */}
        <div className={`p-3.5 rounded-3xl relative overflow-visible ${isSelf ? `${accentBgClass} text-white rounded-br-none shadow-md` : isDark ? 'glass-card-dark text-slate-100 rounded-bl-none' : 'glass-card-light text-slate-800 rounded-bl-none'}`}>
          
          {/* Name tag for group chats */}
          {!isSelf && chat.isGroup && (
            <span className="block text-[10px] font-bold text-indigo-400 mb-1">
              {sender?.name}
            </span>
          )}

          {/* A. Text Message Card with Markdown support */}
          {msg.mediaType === 'text' && (
            <p className="text-xs whitespace-pre-wrap break-words text-left leading-relaxed">
              {msg.content}
            </p>
          )}

          {/* B. Image Card */}
          {msg.mediaType === 'image' && (
            <div className="rounded-2xl overflow-hidden border border-white/10 max-w-xs mb-1 bg-slate-900">
              <img
                src={msg.thumbnailUrl || msg.mediaUrl}
                alt="uploaded graphic"
                className="w-full h-auto object-cover max-h-56"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div className="p-2 text-[10px] font-mono text-left bg-black/40 flex justify-between items-center text-slate-300">
                <span className="truncate max-w-[150px]" title={msg.fileInfo?.name || "Image"}>
                  {msg.fileInfo?.name || "Image spec.png"}
                </span>
                <a href={msg.mediaUrl} download={msg.fileInfo?.name || "image.png"} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Download</a>
              </div>
            </div>
          )}

          {/* C. GIF Card */}
          {msg.mediaType === 'gif' && (
            <div className="rounded-2xl overflow-hidden max-w-xs mb-1 bg-slate-900 border border-slate-800">
              <img src={msg.mediaUrl} alt="animated gif" className="w-full h-auto max-h-56" loading="lazy" referrerPolicy="no-referrer" />
            </div>
          )}

          {/* D. Sticker Card */}
          {msg.mediaType === 'sticker' && (
            <div className="max-w-[120px] p-1">
              <img src={msg.mediaUrl} alt="custom sticker" className="w-full h-auto rounded-xl object-contain" loading="lazy" referrerPolicy="no-referrer" />
            </div>
          )}

          {/* E. Document Card */}
          {msg.mediaType === 'file' && msg.fileInfo && (
            <a 
              href={msg.mediaUrl} 
              download={msg.fileInfo.name} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-3 p-2 rounded-2xl bg-black/10 dark:bg-slate-900/40 border border-white/5 text-left hover:bg-black/20 dark:hover:bg-slate-900/60 transition-all cursor-pointer block"
            >
              <div className="h-9 w-9 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20 flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex flex-col overflow-hidden text-slate-200">
                <span className="text-xs font-bold truncate max-w-[150px]">{msg.fileInfo.name}</span>
                <span className="text-[9px] font-mono opacity-80">{msg.fileInfo.size} • {msg.fileInfo.extension?.toUpperCase()} • Click to download</span>
              </div>
            </a>
          )}

          {/* F. GPS Location Card */}
          {msg.mediaType === 'location' && msg.locationInfo && (
            <div className="flex flex-col gap-2 p-1.5 rounded-2xl bg-black/10 dark:bg-slate-900/40 text-left">
              <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-800 relative">
                {/* Map wireframe drawing */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 opacity-60">
                  <MapPin className="h-8 w-8 text-indigo-500 animate-bounce" />
                  <span className="text-[9px] font-mono mt-1 text-slate-300">GPS COORDINATES LOADED</span>
                </div>
              </div>
              <div className="p-1">
                <span className="block text-xs font-bold leading-tight truncate">{msg.locationInfo.address}</span>
                <span className="block text-[9px] text-slate-400 font-mono mt-0.5">Lat: {msg.locationInfo.latitude}, Lng: {msg.locationInfo.longitude}</span>
              </div>
            </div>
          )}

          {/* G. Contacts Card */}
          {msg.mediaType === 'contact' && msg.contactInfo && (
            <div className="p-3 rounded-2xl bg-black/10 dark:bg-slate-900/40 border border-white/5 text-left flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <UserIcon className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{msg.contactInfo.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{msg.contactInfo.phone}</span>
                </div>
              </div>
              <button
                onClick={() => alert(`Saved contact: ${msg.contactInfo?.name}`)}
                className="w-full py-1.5 rounded-xl bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider"
              >
                Add to Contacts
              </button>
            </div>
          )}

          {/* H. Voice Note Player */}
          {msg.mediaType === 'voice' && (
            <div className="flex items-center gap-3 py-1 px-2.5 bg-black/10 dark:bg-slate-900/40 border border-white/5 rounded-2xl text-left">
              <button
                onClick={() => handleSimulateAudioPlay(msg.id)}
                className="h-8 w-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-pointer"
              >
                {playingAudioId === msg.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <div className="flex flex-col gap-1 w-32">
                {/* Simulated waveform progress bar */}
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${audioProgressValue}%` }} />
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                  <span>🎙️ Voice packet</span>
                  <span>0:08</span>
                </div>
              </div>
            </div>
          )}

          {/* Foot Timestamp and Read Receipts */}
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <span className={`text-[9px] font-mono tracking-tight opacity-70 ${isSelf ? 'text-indigo-100' : 'text-slate-400'}`}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isSelf && (
              <span className="text-indigo-100 opacity-90">
                {msg.status === 'sent' ? (
                  <Check className="h-3 w-3" />
                ) : msg.status === 'delivered' ? (
                  <CheckCheck className="h-3 w-3 text-slate-300" />
                ) : (
                  <CheckCheck className="h-3 w-3 text-emerald-400" />
                )}
              </span>
            )}
            {msg.isStarred && (
              <Star className="h-3 w-3 text-amber-400 fill-current ml-0.5" />
            )}
          </div>

          {/* Reaction Badges Row */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className={`absolute -bottom-2 ${isSelf ? 'left-2' : 'right-2'} flex gap-1 bg-slate-900 border border-slate-800 rounded-full px-1.5 py-0.5 shadow-md z-10`}>
              {msg.reactions.map((react, rIdx) => (
                <span key={rIdx} className="text-xs" title={`${react.userIds.length} users reacted`}>
                  {react.emoji}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Context hovering menus */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
          {/* React emoji popover */}
          <button
            onClick={() => setShowEmojiMenuId(showEmojiMenuId === msg.id ? null : msg.id)}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-indigo-500 hover:shadow-xs border border-slate-200/10 cursor-pointer"
            title="Add Reaction"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>

          {/* Reply button */}
          <button
            onClick={() => setReplyingMessageId(msg.id)}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-indigo-500 hover:shadow-xs border border-slate-200/10 cursor-pointer"
            title="Reply to message"
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDeleteMessage(msg.id, true)}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:shadow-xs border border-slate-200/10 cursor-pointer"
            title="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* Reaction floating bar trigger */}
      <AnimatePresence>
        {showEmojiMenuId === msg.id && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute z-30 flex gap-2 p-1.5 rounded-full border shadow-xl bg-slate-900 border-slate-800 ${isSelf ? 'right-0 top-10' : 'left-0 top-10'}`}
          >
            {emojiReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReactMessage(msg.id, emoji);
                  setShowEmojiMenuId(null);
                }}
                className="hover:scale-125 transition-transform text-sm cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
});
