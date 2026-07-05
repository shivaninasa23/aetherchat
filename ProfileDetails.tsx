import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Info, Image as ImageIcon, FileText, Link as LinkIcon, Star, 
  ChevronRight, VolumeX, Pin, Trash2, LogOut, ShieldAlert, Download, ExternalLink,
  Upload, Palette, Phone, Mail, Calendar, Eye, Search, AlertCircle, Shield,
  Lock, MessageSquare, AlertTriangle, Check
} from 'lucide-react';
import { Chat, User, Message, UserSettings } from '../types';
import { presetWallpapers } from '../data';
import ChangeWallpaperModal from './ChangeWallpaperModal';

interface ProfileDetailsProps {
  chat: Chat;
  partner?: User;
  allUsers: User[];
  messages: Message[];
  isDark: boolean;
  onToggleStarMessage: (msgId: string) => void;
  onToggleMuteChat: () => void;
  onTogglePinChat: () => void;
  onExitGroup?: () => void;
  onDeleteGroup?: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onClose: () => void;
  onBlockUser: (userId: string) => void;
  onReportChat: (chatId: string, reason: string) => void;
  onClearChatTranscript: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ProfileDetails({
  chat,
  partner,
  allUsers,
  messages,
  isDark,
  onToggleStarMessage,
  onToggleMuteChat,
  onTogglePinChat,
  onExitGroup,
  onDeleteGroup,
  settings,
  onUpdateSettings,
  onClose,
  onBlockUser,
  onReportChat,
  onClearChatTranscript,
  onDeleteChat
}: ProfileDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'files' | 'starred'>('info');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const [wallpaperUploadError, setWallpaperUploadError] = useState('');
  const [showWallpaperControls, setShowWallpaperControls] = useState(false);
  const [showAdvancedWallpaperModal, setShowAdvancedWallpaperModal] = useState(false);
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('spam');

  const handleSetChatWallpaper = (value: string) => {
    const updatedWallpapers = {
      ...(settings.chatWallpapers || {}),
      [chat.id]: value
    };
    onUpdateSettings({
      ...settings,
      chatWallpapers: updatedWallpapers
    });
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setWallpaperUploadError('File must be an image format.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setWallpaperUploadError('Image is too large (max 2MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        handleSetChatWallpaper(event.target.result);
        setWallpaperUploadError('');
      }
    };
    reader.onerror = () => {
      setWallpaperUploadError('Error reading file.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (!customWallpaperUrl.trim()) return;
    if (!customWallpaperUrl.startsWith('http://') && !customWallpaperUrl.startsWith('https://')) {
      setWallpaperUploadError('URL must start with http:// or https://');
      return;
    }
    handleSetChatWallpaper(customWallpaperUrl.trim());
    setWallpaperUploadError('');
    setCustomWallpaperUrl('');
  };

  // Filter messages for current chat
  const chatMessages = messages.filter(m => m.chatId === chat.id && !m.deletedForEveryone);

  // Extract shared media (images, stickers, gifs)
  const sharedMedia = chatMessages.filter(
    m => m.mediaType === 'image' || m.mediaType === 'gif' || m.mediaType === 'sticker'
  );

  // Extract shared files (PDF, ZIP, DOCX, files)
  const sharedFiles = chatMessages.filter(m => m.mediaType === 'file' && m.fileInfo);

  // Extract shared links (messages containing http/https or custom location addresses)
  const sharedLinks = chatMessages.filter(
    m => m.content.includes('http') || m.mediaType === 'location'
  );

  // Extract starred messages
  const starredMessages = chatMessages.filter(m => m.isStarred);

  // Find group members
  const groupMembers = allUsers.filter(u => chat.memberIds.includes(u.id));

  // Determine chat partner details
  const resolvedPartner = partner || allUsers.find(u => u.id === chat.memberIds.find(id => id !== 'self')) || allUsers[0];

  // Dynamic status details
  const isOnline = !chat.isGroup && resolvedPartner.status === 'online';
  const statusColor = chat.isGroup 
    ? 'bg-indigo-500' 
    : resolvedPartner.status === 'online' 
      ? 'bg-emerald-500 animate-pulse' 
      : resolvedPartner.status === 'away' 
        ? 'bg-amber-500' 
        : 'bg-slate-400';

  // Custom privacy checker
  // Elena Rostova (Systems Architect) and Liam Neeson (Security Ops) have restricted privacy profiles
  const hasContactPrivacy = !chat.isGroup && (resolvedPartner.username === 'elena_rust' || resolvedPartner.username === 'liam_sec');

  // Trigger search in conversation
  const handleTriggerSearchInConversation = () => {
    window.dispatchEvent(new CustomEvent('chatsphere-open-search'));
    onClose();
  };

  const submitReport = () => {
    const reasonsMap: { [key: string]: string } = {
      spam: 'Spam, bot-like repetitive messaging, or phishing activity.',
      harassment: 'Harassment, hate speech, or abusive content.',
      suspicious: 'Suspicious operations or hacking simulation attempts.',
      other: 'General workspace policy violation.'
    };
    onReportChat(chat.id, reasonsMap[reportReason] || 'Unspecified reason');
    setShowReportDialog(false);
  };

  return (
    <div className="h-full flex flex-col justify-between relative bg-transparent select-none">
      
      {/* Dynamic Profile Lightbox modal */}
      <AnimatePresence>
        {isPhotoLightboxOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md"
            onClick={() => setIsPhotoLightboxOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative max-w-full max-h-[80vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={chat.isGroup ? chat.avatar : resolvedPartner.avatar} 
                alt="Fullscreen Profile" 
                className="max-w-[90vw] max-h-[70vh] rounded-2xl object-contain shadow-2xl border border-white/10"
              />
              <div className="mt-4 flex flex-col items-center text-center">
                <h3 className="text-sm font-bold text-white">{chat.isGroup ? chat.name : resolvedPartner.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">{chat.isGroup ? 'Group Channel Image' : `@${resolvedPartner.username}`}</p>
                <div className="flex gap-2.5 mt-3.5">
                  <a 
                    href={chat.isGroup ? chat.avatar : resolvedPartner.avatar} 
                    download 
                    target="_blank" 
                    rel="noreferrer" 
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Image</span>
                  </a>
                  <button 
                    onClick={() => setIsPhotoLightboxOpen(false)}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold px-4 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Report Modal Dialog */}
      <AnimatePresence>
        {showReportDialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setShowReportDialog(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className={`p-5 rounded-2xl max-w-sm w-full border text-left shadow-2xl ${isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-red-500 mb-3">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="font-bold text-sm">Report Security Threat</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                You are initiating a workspace threat dispatch audit for <strong>{chat.name}</strong>. Please select the primary audit reason:
              </p>
              
              <div className="space-y-2 text-xs">
                {[
                  { value: 'spam', label: 'Spam, bot activity, or advertising' },
                  { value: 'harassment', label: 'Harassment, hate speech, or abuse' },
                  { value: 'suspicious', label: 'Suspicious hacking or telemetry simulation' },
                  { value: 'other', label: 'Other workspace policy violation' }
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/5 hover:bg-slate-100/5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="reportReason" 
                      value={opt.value}
                      checked={reportReason === opt.value}
                      onChange={() => setReportReason(opt.value)}
                      className="accent-indigo-500"
                    />
                    <span className="font-medium text-slate-300">{opt.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-5 text-xs font-bold">
                <button 
                  onClick={() => setShowReportDialog(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-100/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitReport}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  File Incident Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Header Row */}
      <div className="p-4 border-b border-slate-200/10 flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-400" />
          <span>{chat.isGroup ? 'Group Info' : 'Contact Info'}</span>
        </h3>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-100/10 transition-colors cursor-pointer"
          title="Close profile details (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Profile Large Picture Banner Block */}
        <div className="flex flex-col items-center text-center p-6 border-b border-slate-200/10 relative">
          <div className="relative mb-3 group cursor-pointer" onClick={() => setIsPhotoLightboxOpen(true)}>
            <img
              src={chat.isGroup ? chat.avatar : resolvedPartner.avatar}
              alt={chat.name}
              className="w-24 h-24 rounded-3xl object-cover border-2 border-indigo-500/20 shadow-lg group-hover:scale-105 transition-transform duration-300"
            />
            {/* View photo indicator on hover */}
            <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="h-5 w-5" />
            </div>
            {/* Online status indicator dot */}
            {!chat.isGroup && (
              <span className={`absolute -bottom-1 -right-1 h-4.5 w-4.5 rounded-full border-2 border-slate-900 ${statusColor}`} />
            )}
          </div>
          
          <h4 className="text-sm font-extrabold tracking-tight">{chat.isGroup ? chat.name : resolvedPartner.name}</h4>
          <p className="text-[11px] text-slate-400 font-mono mt-1">
            {chat.isGroup ? `${chat.memberIds.length} members` : `@${resolvedPartner.username}`}
          </p>
          
          {/* Status subtext */}
          <div className="mt-2.5 flex items-center gap-1.5 bg-slate-100/5 dark:bg-slate-950/20 px-2.5 py-1 rounded-full border border-slate-200/5 text-[10px] text-slate-400">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />
            <span className="capitalize">{chat.isGroup ? 'Active Group' : resolvedPartner.status}</span>
            {!chat.isGroup && resolvedPartner.status !== 'online' && resolvedPartner.lastSeen && (
              <span className="text-slate-500">• Seen {resolvedPartner.lastSeen}</span>
            )}
          </div>
        </div>

        {/* Tab Selection Navigation Row */}
        <div className="flex border-b border-slate-200/10 text-[11px] text-slate-400 font-bold">
          {[
            { id: 'info', label: 'Details', icon: Info },
            { id: 'media', label: 'Media', icon: ImageIcon },
            { id: 'files', label: 'Files', icon: FileText },
            { id: 'starred', label: 'Saved', icon: Star },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 border-b-2 font-bold cursor-pointer transition-all ${activeTab === tab.id ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5' : 'border-transparent hover:text-slate-200'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Selection Contents */}
        <div className="p-4 text-left">
          <AnimatePresence mode="wait">
            {activeTab === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* About Bio Block */}
                <div className="p-3 rounded-2xl bg-slate-100/10 dark:bg-slate-900/40 border border-slate-200/10 dark:border-slate-800/40">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5">
                    About / Bio
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {chat.isGroup 
                      ? (chat.description || 'Secure communication and coordination room.')
                      : (resolvedPartner.bio || 'No bio status set.')}
                  </p>
                </div>

                {/* Shared Contact Meta Details Block (Phone, Email, Registered) */}
                <div className="p-3 rounded-2xl bg-slate-100/10 dark:bg-slate-900/40 border border-slate-200/10 dark:border-slate-800/40 space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                    Identity Details
                  </span>

                  {/* Phone number row */}
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/10">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wide leading-none">Phone Number</span>
                      {hasContactPrivacy ? (
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1 font-mono">
                          <Lock className="h-3 w-3 text-red-400" />
                          <span>•••••••••• (Private)</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold font-mono mt-1 text-slate-200 block">
                          {resolvedPartner.phone || '+1 (555) 019-2831'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email row */}
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/10">
                      <Mail className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wide leading-none">Secure Email</span>
                      {hasContactPrivacy ? (
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1 font-mono">
                          <Lock className="h-3 w-3 text-red-400" />
                          <span>•••••••••• (Private)</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold font-mono mt-1 text-slate-200 block">
                          {resolvedPartner.email || `${resolvedPartner.username || 'user'}@chatsphere.io`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Registered/Created row */}
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/10">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] text-slate-400 uppercase font-bold tracking-wide leading-none">
                        {chat.isGroup ? 'Group Created Date' : 'Account Created'}
                      </span>
                      <span className="text-xs font-semibold font-mono mt-1 text-slate-200 block">
                        {chat.isGroup ? 'Oct 18, 2025' : (resolvedPartner.createdDate || 'Jan 12, 2025')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp-Style "Media, Links & Documents" section */}
                <div className="p-3 rounded-2xl bg-slate-100/10 dark:bg-slate-900/40 border border-slate-200/10 dark:border-slate-800/40">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-bold text-slate-300">Media, Links & Docs</span>
                    <button 
                      onClick={() => setActiveTab('media')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>See All</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  
                  {/* Horizontal Recent Images Strip */}
                  {sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                      {sharedMedia.slice(0, 4).map((m) => (
                        <div 
                          key={m.id} 
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200/10 bg-slate-950 cursor-pointer relative group"
                          onClick={() => {
                            setActiveTab('media');
                          }}
                          title="Click to view shared graphic"
                        >
                          <img src={m.mediaUrl || m.content} alt="recent" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 py-2.5 text-center bg-slate-950/20 rounded-xl mb-2.5 border border-slate-200/5">No media shared in this channel</p>
                  )}

                  {/* Summary Counters Row */}
                  <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-200/5 pt-2 mt-2">
                    <div className="flex items-center gap-1 bg-indigo-500/5 border border-indigo-500/10 rounded-md px-1.5 py-0.5">
                      <ImageIcon className="h-3 w-3 text-indigo-400" />
                      <span>Graphics: {sharedMedia.length}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/10 rounded-md px-1.5 py-0.5">
                      <FileText className="h-3 w-3 text-emerald-400" />
                      <span>Files: {sharedFiles.length}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-500/5 border border-amber-500/10 rounded-md px-1.5 py-0.5">
                      <LinkIcon className="h-3 w-3 text-amber-400" />
                      <span>Links: {sharedLinks.length}</span>
                    </div>
                  </div>
                </div>

                {/* Group Members List (Only if Group Chat) */}
                {chat.isGroup && (
                  <div className="p-3 rounded-2xl bg-slate-100/10 dark:bg-slate-900/40 border border-slate-200/10 dark:border-slate-800/40">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
                      Group Members ({groupMembers.length})
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {groupMembers.map((member) => {
                        const isAdmin = chat.adminIds.includes(member.id);
                        return (
                          <div key={member.id} className="flex justify-between items-center text-xs p-1.5 rounded-xl hover:bg-slate-100/5 dark:hover:bg-slate-950/30">
                            <div className="flex items-center gap-2">
                              <img src={member.avatar} alt={member.name} className="w-7 h-7 rounded-lg object-cover" />
                              <div className="flex flex-col text-left">
                                <span className="font-bold">{member.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono">@{member.username}</span>
                              </div>
                            </div>
                            {isAdmin && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/25 uppercase tracking-wider font-mono">
                                Admin
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Extracted Web Links summary view */}
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    Extracted Web Links ({sharedLinks.length})
                  </span>
                  {sharedLinks.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-2 bg-slate-100/10 dark:bg-slate-900/10 rounded-xl">No links shared in this thread.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {sharedLinks.map((link) => (
                        <div key={link.id} className="p-2 rounded-xl bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/10 flex justify-between items-center">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <LinkIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                            <p className="text-xs font-mono font-medium truncate text-slate-400">
                              {link.mediaType === 'location' ? link.locationInfo?.address : link.content}
                            </p>
                          </div>
                          {link.mediaType === 'location' ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 uppercase tracking-wider">
                              GPS Map
                            </span>
                          ) : (
                            <a
                              href={link.content.match(/https?:\/\/[^\s]+/)?.[0] || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-500 p-1 rounded hover:bg-slate-100/5 flex-shrink-0"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Chat Wallpaper Block */}
                <div className="border-t border-slate-200/15 pt-3">
                  <button
                    onClick={() => setShowAdvancedWallpaperModal(true)}
                    className="w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-xl bg-slate-100/5 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <Palette className="h-4 w-4 text-indigo-400" />
                      Customize Chat Wallpaper
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </div>

                {/* 100% WhatsApp Action controls panel block */}
                <div className="space-y-2.5 pt-3 border-t border-slate-200/10">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    Action Controls
                  </span>
                  
                  {/* View profile photo button */}
                  <button
                    onClick={() => setIsPhotoLightboxOpen(true)}
                    className="w-full flex items-center gap-3 text-xs px-3 py-2.5 rounded-xl border border-slate-200/10 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all cursor-pointer font-bold"
                  >
                    <Eye className="h-4 w-4 text-indigo-400" />
                    <span>View Profile Photo</span>
                  </button>

                  {/* Search in conversation button */}
                  <button
                    onClick={handleTriggerSearchInConversation}
                    className="w-full flex items-center gap-3 text-xs px-3 py-2.5 rounded-xl border border-slate-200/10 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all cursor-pointer font-bold"
                  >
                    <Search className="h-4 w-4 text-indigo-400" />
                    <span>Search in Conversation</span>
                  </button>

                  {/* Mute toggle button */}
                  <button
                    onClick={onToggleMuteChat}
                    className={`w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${chat.isMuted ? 'border-red-500/20 bg-red-500/5 text-red-500 font-bold' : 'border-slate-200/20 hover:bg-slate-100/10 dark:hover:bg-slate-900/50'}`}
                  >
                    <span className="flex items-center gap-3">
                      <VolumeX className="h-4 w-4" />
                      <span>Mute Notifications</span>
                    </span>
                    <span className="text-[10px] font-mono tracking-wider bg-slate-100/5 px-2 py-0.5 rounded-md">{chat.isMuted ? 'MUTED' : 'ACTIVE'}</span>
                  </button>

                  {/* Pin toggle button */}
                  <button
                    onClick={onTogglePinChat}
                    className={`w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${chat.isPinned ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-bold' : 'border-slate-200/20 hover:bg-slate-100/10 dark:hover:bg-slate-900/50'}`}
                  >
                    <span className="flex items-center gap-3">
                      <Pin className="h-4 w-4 rotate-45" />
                      <span>Pin to Workspace</span>
                    </span>
                    <span className="text-[10px] font-mono tracking-wider bg-slate-100/5 px-2 py-0.5 rounded-md">{chat.isPinned ? 'PINNED' : 'NORMAL'}</span>
                  </button>

                  {/* Block user button (Disabled for groups) */}
                  {!chat.isGroup && (
                    <button
                      onClick={() => onBlockUser(resolvedPartner.id)}
                      className={`w-full flex items-center gap-3 text-xs px-3 py-2.5 rounded-xl border transition-colors font-bold cursor-pointer ${settings.blockedUsers.includes(resolvedPartner.id) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25' : 'bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/15'}`}
                    >
                      <Lock className="h-4 w-4" />
                      <span>{settings.blockedUsers.includes(resolvedPartner.id) ? 'Unblock Secure Contact' : 'Block Secure Contact'}</span>
                    </button>
                  )}

                  {/* Report user/channel button */}
                  <button
                    onClick={() => setShowReportDialog(true)}
                    className="w-full flex items-center gap-3 text-xs text-red-400 border border-red-500/20 hover:bg-red-500/15 px-3 py-2.5 rounded-xl transition-all font-bold cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Report User / Channel</span>
                  </button>

                  {/* Clear Chat transcript history */}
                  <button
                    onClick={() => onClearChatTranscript(chat.id)}
                    className="w-full flex items-center gap-3 text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 px-3 py-2.5 rounded-xl transition-all font-bold cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear Chat Transcript</span>
                  </button>

                  {/* Delete chat completely button */}
                  <button
                    onClick={() => onDeleteChat(chat.id)}
                    className="w-full flex items-center gap-3 text-xs text-red-500 border border-red-500/30 hover:bg-red-500/20 px-3 py-2.5 rounded-xl transition-all font-bold cursor-pointer bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Chat Thread</span>
                  </button>

                  {chat.isGroup && onExitGroup && (
                    <button
                      onClick={onExitGroup}
                      className="w-full flex items-center gap-3 text-xs text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 px-3 py-2.5 rounded-xl transition-colors font-bold cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" /> 
                      <span>Exit Group Channel</span>
                    </button>
                  )}

                  {chat.isGroup && onDeleteGroup && chat.adminIds.includes('self') && (
                    <button
                      onClick={onDeleteGroup}
                      className="w-full flex items-center gap-3 text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 px-3 py-2.5 rounded-xl transition-colors font-bold cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" /> 
                      <span>Disband Group for Everyone</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div
                key="media"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  Shared Media & Graphics ({sharedMedia.length})
                </span>
                {sharedMedia.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-100/5 dark:bg-slate-900/10 border border-slate-200/5">
                    <ImageIcon className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-[11px] text-slate-400">No shared images or graphics found in this chat.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 p-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {sharedMedia.map((m) => (
                      <div key={m.id} className="aspect-square rounded-xl overflow-hidden group relative border border-slate-200/10 bg-slate-900 shadow-md">
                        <img src={m.mediaUrl || m.content} alt="shared asset" className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <a 
                            href={m.mediaUrl || m.content} 
                            download 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-1.5 rounded-lg bg-slate-950/90 text-white hover:bg-indigo-600 transition-colors"
                            title="Download Shared Image"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'files' && (
              <motion.div
                key="files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2.5"
              >
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  Shared Documents & Files ({sharedFiles.length})
                </span>
                {sharedFiles.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-100/5 dark:bg-slate-900/10 border border-slate-200/5">
                    <FileText className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-[11px] text-slate-400">No shared attachments or documents found.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                    {sharedFiles.map((m) => (
                      <div key={m.id} className="p-3 rounded-2xl bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200/10 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="h-9 w-9 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col text-left overflow-hidden">
                            <span className="text-xs font-bold truncate max-w-[170px] text-slate-200">{m.fileInfo?.name || 'document.pdf'}</span>
                            <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">
                              {m.fileInfo?.extension || 'DOC'} • {m.fileInfo?.size || '0 KB'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => alert(`Simulated document download initiated for file: ${m.fileInfo?.name}`)}
                          className="p-1.5 rounded-lg bg-slate-100/5 hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-200/10"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'starred' && (
              <motion.div
                key="starred"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2.5"
              >
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  Starred Reference Messages ({starredMessages.length})
                </span>
                {starredMessages.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-100/5 dark:bg-slate-900/10 border border-slate-200/5">
                    <Star className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-[11px] text-slate-400">Star messages in chat to easily reference them here.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                    {starredMessages.map((m) => (
                      <div key={m.id} className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col gap-2 relative">
                        <div className="flex justify-between items-center border-b border-slate-200/10 pb-1.5">
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={() => onToggleStarMessage(m.id)}
                            className="p-1 rounded text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                            title="Unstar message"
                          >
                            <Star className="h-3.5 w-3.5 fill-current" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed text-left">
                          {m.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ChangeWallpaperModal
        isOpen={showAdvancedWallpaperModal}
        onClose={() => setShowAdvancedWallpaperModal(false)}
        chat={chat}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        isDark={isDark}
      />
    </div>
  );
}
