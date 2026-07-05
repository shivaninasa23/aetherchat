import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, Check, ShieldCheck, Copy, Share, LogOut, Image as ImageIcon, 
  Film, FileText, Link as LinkIcon, Mic, Palette, Lock, Globe, Clock, 
  ChevronRight, Edit3, Trash2, CheckCircle2, Info, AlertTriangle, Cloud, 
  Shield, RefreshCw, QrCode, Download, Eye, EyeOff, CheckCheck, Sparkles, 
  Sliders, UserCheck, Settings, CheckCircle, Database, Bell, Languages, CloudRain
} from 'lucide-react';
import { User, UserSettings, Chat, Message, MediaType } from '../types';
import { presetWallpapers } from '../data';

interface MyProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateCurrentUser: (updatedUser: User) => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  messages: Message[];
  users: User[];
  onLogout: () => void;
}

export default function MyProfilePanel({
  isOpen,
  onClose,
  currentUser,
  onUpdateCurrentUser,
  settings,
  onUpdateSettings,
  messages,
  users,
  onLogout
}: MyProfilePanelProps) {
  // Tabs: 'info' (Personal Info & Profile), 'media' (Media Shared), 'settings' (Account settings)
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'settings'>('info');

  // Inline edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [editBio, setEditBio] = useState(currentUser.bio || '');
  const [editPhone, setEditPhone] = useState(currentUser.phone || '');
  const [editEmail, setEditEmail] = useState(currentUser.email || '');
  const [editCountry, setEditCountry] = useState(currentUser.lastSeen || 'United States'); // storing country here or localState
  const [editTimeZone, setEditTimeZone] = useState('GMT-7 (PDT)');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Toast notice state
  const [toastMessage, setToastMessage] = useState('');
  
  // QR Code Modal
  const [showQrModal, setShowQrModal] = useState(false);

  // Image Cropper Modal
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cropperInputRef = useRef<HTMLInputElement>(null);

  // Media Detail list overlay
  const [selectedMediaCategory, setSelectedMediaCategory] = useState<MediaType | 'links' | null>(null);

  // Simulated Backup states
  const [backupProgress, setBackupProgress] = useState<number | null>(null);
  const [backupStage, setBackupStage] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<string>('Never');

  // Load last backup time from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cs_last_profile_backup');
    if (stored) setLastBackupTime(stored);
  }, []);

  // Keyboard accessibility: ESC key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQrModal) {
          setShowQrModal(false);
        } else if (cropperImageSrc) {
          setCropperImageSrc(null);
        } else if (selectedMediaCategory) {
          setSelectedMediaCategory(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showQrModal, cropperImageSrc, selectedMediaCategory, onClose]);

  if (!isOpen) return null;

  // Show toast utility
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Validate fields
  const handleSaveProfile = () => {
    const errors: { [key: string]: string } = {};
    if (!editName.trim()) errors.name = 'Full name is required.';
    
    if (!editUsername.trim()) {
      errors.username = 'Username is required.';
    } else {
      const cleanUsername = editUsername.replace('@', '').trim().toLowerCase();
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(cleanUsername)) {
        errors.username = 'Username must be 3-20 characters and contain only alphanumeric characters, underscores, or periods.';
      } else {
        const reserved = ['ai_bot', 'chatsphere_ai', 'admin', 'system', 'root', 'moderator', 'support', 'chatsphere'];
        if (reserved.includes(cleanUsername)) {
          errors.username = 'This username is a reserved keyword and cannot be used.';
        }
      }
    }
    
    if (editEmail.trim() && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(editEmail.trim())) {
      errors.email = 'Invalid email address format (e.g. name@domain.com).';
    }

    if (editPhone.trim()) {
      const phoneClean = editPhone.trim();
      const phoneRegex = /^\+?(\d[\d-.() ]{5,18}\d)$/;
      if (!phoneRegex.test(phoneClean)) {
        errors.phone = 'Invalid phone number format. Use digits and optional +, -, spaces, or parentheses (e.g. +1 (555) 019-2834).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      triggerToast('Please resolve validation errors.');
      return;
    }

    setValidationErrors({});
    
    const updatedUser: User = {
      ...currentUser,
      name: editName.trim(),
      username: editUsername.replace('@', '').trim().toLowerCase(),
      bio: editBio.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
    };

    onUpdateCurrentUser(updatedUser);
    setIsEditing(false);
    triggerToast('Profile information saved successfully!');
  };

  // Profile picture triggers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerToast('Invalid file type. Please select a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      triggerToast('File size exceeds the 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        // Open the cropper modal
        setCropperImageSrc(event.target.result);
        setZoom(1);
        setRotation(0);
        setDragOffset({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    if (window.confirm('Are you sure you want to remove your profile photo?')) {
      const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.username || 'default'}`;
      const updatedUser = {
        ...currentUser,
        avatar: defaultAvatar
      };
      onUpdateCurrentUser(updatedUser);
      triggerToast('Profile photo removed.');
    }
  };

  // Drag handles for Canvas Cropper
  const startDrag = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const onDrag = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const endDrag = () => {
    setIsDragging(false);
  };

  // Canvas render crop
  const saveCroppedPhoto = () => {
    if (!cropperImageSrc) return;

    const img = new Image();
    img.src = cropperImageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill with transparent or white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);

      ctx.save();
      // Translate to center
      ctx.translate(150, 150);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Draw image centered, plus custom dragging translate offsets
      // Adjust standard offset divisor to account for scale
      ctx.drawImage(img, -150 + dragOffset.x, -150 + dragOffset.y, 300, 300);
      ctx.restore();

      const base64Url = canvas.toDataURL('image/jpeg', 0.9);
      const updatedUser = {
        ...currentUser,
        avatar: base64Url
      };
      onUpdateCurrentUser(updatedUser);
      setCropperImageSrc(null);
      triggerToast('Custom cropped profile photo updated!');
    };
  };

  // Clipboard Copiers
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`${label} copied to clipboard!`);
  };

  // Media Attachment Scraper
  const myMessages = messages.filter(m => m.senderId === currentUser.id || m.senderId === 'self');
  const photos = myMessages.filter(m => m.mediaType === 'image' || m.mediaType === 'gif' || m.mediaType === 'sticker');
  const videos = myMessages.filter(m => m.mediaType === 'video');
  const files = myMessages.filter(m => m.mediaType === 'file');
  const links = myMessages.filter(m => m.mediaType === 'text' && (m.content.includes('http://') || m.content.includes('https://')));
  const voiceNotes = myMessages.filter(m => m.mediaType === 'voice' || m.mediaType === 'audio');

  const mediaSections = [
    { type: 'image' as MediaType, label: 'Photos & Stickers', count: photos.length, items: photos, icon: ImageIcon, color: 'text-indigo-400' },
    { type: 'video' as MediaType, label: 'Videos', count: videos.length, items: videos, icon: Film, color: 'text-red-400' },
    { type: 'file' as MediaType, label: 'Files & PDFs', count: files.length, items: files, icon: FileText, color: 'text-purple-400' },
    { type: 'links' as const, label: 'Public Links', count: links.length, items: links, icon: LinkIcon, color: 'text-sky-400' },
    { type: 'voice' as MediaType, label: 'Voice Notes', count: voiceNotes.length, items: voiceNotes, icon: Mic, color: 'text-emerald-400' },
  ];

  // Simulated Backup Function
  const handleBackupNow = () => {
    setBackupProgress(0);
    setBackupStage('Assembling data packages...');
    
    const stages = [
      { p: 15, s: 'Loading profile structures...' },
      { p: 35, s: 'Encrypting communication logs...' },
      { p: 60, s: 'Packing custom media references...' },
      { p: 85, s: 'Syncing with secure ChatSphere Cloud Vault...' },
      { p: 100, s: 'Backup Securely Completed!' }
    ];

    stages.forEach((stage, idx) => {
      setTimeout(() => {
        setBackupProgress(stage.p);
        setBackupStage(stage.s);
        if (stage.p === 100) {
          const nowStr = new Date().toLocaleString();
          setLastBackupTime(nowStr);
          localStorage.setItem('cs_last_profile_backup', nowStr);
          setTimeout(() => setBackupProgress(null), 1500);
        }
      }, (idx + 1) * 600);
    });
  };

  // Export profile & chats JSON
  const handleExportDataProfile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      profile: currentUser,
      settings: settings,
      chats_count: messages.length
    }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `chatsphere_profile_${currentUser.username}.json`);
    dlAnchorElem.click();
    triggerToast('Secure profile backup JSON exported!');
  };

  // Render Theme Buttons helper
  const availableThemes: { id: UserSettings['theme']; label: string; color: string }[] = [
    { id: 'dark', label: 'Noir Slate', color: 'bg-slate-900 border-slate-700' },
    { id: 'light', label: 'Pristine Snow', color: 'bg-white border-slate-300' },
    { id: 'cyberpunk', label: 'Neon Grid', color: 'bg-yellow-400 border-yellow-600' },
    { id: 'emerald', label: 'Forest Mint', color: 'bg-emerald-950 border-emerald-700' },
    { id: 'sunset', label: 'Solar Rust', color: 'bg-orange-950 border-orange-700' }
  ];

  const availableLanguages: { id: UserSettings['language']; label: string }[] = [
    { id: 'en', label: 'English (US)' },
    { id: 'es', label: 'Español' },
    { id: 'fr', label: 'Français' },
    { id: 'de', label: 'Deutsch' },
    { id: 'it', label: 'Italiano' },
    { id: 'pt', label: 'Português' }
  ];

  return (
    <>
      {/* Backdrop overlay strictly over the chat workspace area leaving Sidebar clickable */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 md:left-80 bg-slate-950/40 backdrop-blur-xs z-40 cursor-pointer"
        aria-label="Close My Profile Panel"
      />

      {/* Slide in Container Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className={`fixed right-0 top-0 bottom-0 h-full w-full md:w-[calc(100%-320px)] max-w-xl md:max-w-2xl border-l z-45 flex flex-col shadow-2xl overflow-hidden ${
          settings.theme !== 'light' 
            ? 'border-slate-800 bg-slate-950/95 text-slate-100' 
            : 'border-slate-200 bg-slate-50 text-slate-800'
        } backdrop-blur-xl`}
      >
        {/* Profile Toast Banner */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 16, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-indigo-500/30"
            >
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel Header */}
        <div className="p-5 border-b border-slate-200/10 flex items-center justify-between flex-shrink-0 bg-slate-900/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">My Secure Profile</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Manage identity, privacy settings and media catalog</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-100/10 transition-colors cursor-pointer"
            aria-label="Close Profile Panel"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Categories Rail Tabs */}
        <div className="px-5 py-1.5 border-b border-slate-200/5 flex gap-1 bg-slate-900/5">
          {[
            { id: 'info', label: 'Personal Details', count: null },
            { id: 'media', label: 'Media shared', count: myMessages.length },
            { id: 'settings', label: 'Account Preferences', count: null },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                    : 'text-slate-400 hover:bg-slate-100/10 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-100/10 text-slate-500'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Container Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
          
          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Profile Card Header Block */}
              <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden ${
                settings.theme !== 'light' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                {/* Background ambient glow matching theme */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Avatar Camera Area */}
                <div className="relative group flex-shrink-0">
                  <div className="h-24 w-24 rounded-3xl overflow-hidden border-2 border-indigo-500/20 shadow-xl relative bg-slate-950">
                    <img 
                      src={currentUser.avatar} 
                      alt={currentUser.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Hover state overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold text-white gap-1 select-none pointer-events-none">
                      <Camera className="h-5 w-5 text-indigo-400" />
                      <span>EDIT IMAGE</span>
                    </div>
                  </div>

                  {/* Absolute camera button */}
                  <button 
                    onClick={() => cropperInputRef.current?.click()}
                    title="Change Profile Picture"
                    className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-transform active:scale-95 cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input 
                    type="file" 
                    ref={cropperInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden" 
                  />
                </div>

                {/* Main Name / Info text block */}
                <div className="flex-1 text-center sm:text-left overflow-hidden min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center sm:justify-start">
                    <h3 className="text-base font-extrabold truncate">{currentUser.name}</h3>
                    <span className="self-center sm:self-auto px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {currentUser.status}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5 font-semibold">@{currentUser.username}</p>
                  <p className="text-[11px] text-slate-400 mt-2 italic leading-relaxed max-w-sm truncate sm:whitespace-normal sm:line-clamp-2">
                    "{currentUser.bio || 'Product Designer & Full-stack dev.'}"
                  </p>

                  {/* Trigger QR Code button */}
                  <div className="mt-3.5 flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/15 text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>My QR Code</span>
                    </button>

                    <button
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 rounded-lg border border-red-500/10 hover:border-red-500/30 bg-red-500/5 text-red-400 text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Photo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Personal Information Form */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200/10 pb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Information</h4>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit Info</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProfile}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-500/10 px-2 py-0.5 rounded-lg"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditName(currentUser.name);
                          setEditUsername(currentUser.username);
                          setEditBio(currentUser.bio || '');
                          setEditPhone(currentUser.phone || '');
                          setEditEmail(currentUser.email || '');
                          setValidationErrors({});
                        }}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer bg-red-500/10 px-2 py-0.5 rounded-lg"
                      >
                        <X className="h-3 w-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-slate-950/40 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500"
                        />
                        {validationErrors.name && (
                          <p className="text-[9px] text-red-400 font-medium">{validationErrors.name}</p>
                        )}
                      </div>
                    ) : (
                      <p className="py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent font-medium">{currentUser.name}</p>
                    )}
                  </div>

                  {/* Username Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Username</label>
                    {isEditing ? (
                      <div className="space-y-1">
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-indigo-400 text-xs font-mono">@</span>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-full bg-slate-950/40 border border-slate-200/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500 font-mono text-indigo-300"
                          />
                        </div>
                        {validationErrors.username && (
                          <p className="text-[9px] text-red-400 font-medium">{validationErrors.username}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent">
                        <span className="font-semibold text-indigo-400 font-mono">@{currentUser.username}</span>
                        <button 
                          onClick={() => copyText(`@${currentUser.username}`, 'Username')}
                          className="text-slate-500 hover:text-indigo-400"
                          title="Copy Username"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Phone Number</label>
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full bg-slate-950/40 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500"
                        />
                        {validationErrors.phone && (
                          <p className="text-[9px] text-red-400 font-medium">{validationErrors.phone}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent">
                        <span className="font-medium">{currentUser.phone || '+1 (555) 019-2831'}</span>
                        <button 
                          onClick={() => copyText(currentUser.phone || '+1 (555) 019-2831', 'Phone number')}
                          className="text-slate-500 hover:text-indigo-400"
                          title="Copy Phone"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Email Address</label>
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="name@chatsphere.io"
                          className="w-full bg-slate-950/40 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500"
                        />
                        {validationErrors.email && (
                          <p className="text-[9px] text-red-400 font-medium">{validationErrors.email}</p>
                        )}
                      </div>
                    ) : (
                      <p className="py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent font-medium">{currentUser.email || 'alex.rivera@chatsphere.io'}</p>
                    )}
                  </div>

                  {/* Country Field */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Country</label>
                    {isEditing ? (
                      <select
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500"
                      >
                        {['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Brazil', 'Japan', 'Australia'].map(c => (
                          <option key={c} value={c} className="bg-slate-950 text-slate-200">{c}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent font-medium">{editCountry}</p>
                    )}
                  </div>

                  {/* Time Zone Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Time Zone</label>
                    {isEditing ? (
                      <select
                        value={editTimeZone}
                        onChange={(e) => setEditTimeZone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500"
                      >
                        {['GMT-8 (PST)', 'GMT-7 (PDT)', 'GMT-5 (EST)', 'GMT-4 (EDT)', 'GMT+0 (WET)', 'GMT+1 (CET)', 'GMT+9 (JST)', 'GMT+10 (AEST)'].map(tz => (
                          <option key={tz} value={tz} className="bg-slate-950 text-slate-200">{tz}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent font-medium">{editTimeZone}</p>
                    )}
                  </div>
                </div>

                {/* About / Bio Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">About / Biography</label>
                  {isEditing ? (
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950/40 border border-slate-200/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-hidden focus:border-indigo-500 resize-none"
                    />
                  ) : (
                    <p className="py-2 px-3 bg-slate-100/5 rounded-xl border border-transparent font-medium leading-relaxed">{currentUser.bio || 'Product Designer & Full-stack dev. Building the future of communication 🚀'}</p>
                  )}
                </div>

                {/* Date Joined / Metadata details (Read-only) */}
                <div className="pt-2 grid grid-cols-2 gap-4 text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/5">
                    <Clock className="h-4 w-4 text-indigo-400" />
                    <div>
                      <p className="text-[9px] text-slate-500">DATE JOINED</p>
                      <p className="font-bold text-slate-300">{currentUser.createdDate || 'Jan 12, 2025'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/5">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-[9px] text-slate-500">ONLINE STATUS</p>
                      <p className="font-bold text-emerald-400 uppercase tracking-wider">{currentUser.status}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Profile Actions Panel */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/10 pb-1.5">Profile Actions</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                  {/* Share profile simulated trigger */}
                  <button
                    onClick={() => copyText(`https://chatsphere.io/invite/${currentUser.username}`, 'Profile invite link')}
                    className="p-3 rounded-xl border border-slate-200/5 hover:border-indigo-500/30 bg-slate-100/5 hover:bg-indigo-500/5 hover:text-indigo-400 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Share className="h-4 w-4 text-indigo-400" />
                      <span>Share My Invite Link</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  {/* Copy username button */}
                  <button
                    onClick={() => copyText(`@${currentUser.username}`, 'Username')}
                    className="p-3 rounded-xl border border-slate-200/5 hover:border-indigo-500/30 bg-slate-100/5 hover:bg-indigo-500/5 hover:text-indigo-400 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="h-4 w-4 text-indigo-400" />
                      <span>Copy Handle</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  {/* QR Code trigger */}
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="p-3 rounded-xl border border-slate-200/5 hover:border-indigo-500/30 bg-slate-100/5 hover:bg-indigo-500/5 hover:text-indigo-400 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-indigo-400" />
                      <span>Generate QR Badge</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  {/* General Logout */}
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to log out and terminate this session?')) {
                        onLogout();
                        onClose();
                      }
                    }}
                    className="p-3 rounded-xl border border-red-500/10 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      <span>Terminate Session</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MEDIA SHARED (SCRAPED LOGS) */}
          {activeTab === 'media' && (
            <div className="space-y-6 animate-fadeIn text-xs">
              <div>
                <h3 className="text-sm font-extrabold">My Shared Communications</h3>
                <p className="text-[10px] text-slate-400 mt-1">Review, search, or download file assets you have sent across all secure workspace channels.</p>
              </div>

              {/* Grid sections list of files */}
              <div className="space-y-2.5">
                {mediaSections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <button
                      key={sec.type}
                      onClick={() => sec.count > 0 && setSelectedMediaCategory(sec.type)}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between text-left ${
                        sec.count > 0 
                          ? 'border-slate-200/10 hover:border-indigo-500/40 bg-slate-100/5 hover:bg-indigo-500/5 cursor-pointer' 
                          : 'border-slate-200/5 opacity-50 bg-slate-100/2 pointer-events-none'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-slate-950/40 border border-slate-200/10 ${sec.color}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-300">{sec.label}</p>
                          <p className="text-[10px] text-slate-500 font-medium">Platform catalog index</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950/50 border border-slate-200/5 text-[10px] font-mono font-extrabold text-slate-400">
                          {sec.count} files
                        </span>
                        {sec.count > 0 && (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Platform Encryption details card */}
              <div className="p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 text-[10px] text-emerald-400 leading-relaxed flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 mt-0.5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">SECURE FILE ENVELOPE</p>
                  <p className="text-slate-400 mt-1">All shared images, links, transcripts and document attachments are protected with double-ratchet state keys. Files are stored on encrypted sandbox storage buffers.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT PREFERENCES */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn text-xs">
              
              {/* Privacy block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Lock className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Privacy Visibility Settings</h4>
                </div>

                <div className="space-y-3 text-[11px]">
                  {/* Profile photo visibility */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-300">Profile Photo</p>
                      <p className="text-[9px] text-slate-500">Who can see my profile image</p>
                    </div>
                    <select
                      value={settings.privacy.profilePhoto}
                      onChange={(e) => onUpdateSettings({
                        ...settings,
                        privacy: { ...settings.privacy, profilePhoto: e.target.value as any }
                      })}
                      className="bg-slate-950 border border-slate-200/10 rounded-lg px-2.5 py-1 text-[10px] outline-hidden cursor-pointer"
                    >
                      <option value="everyone" className="bg-slate-950">Everyone</option>
                      <option value="contacts" className="bg-slate-950">My Contacts</option>
                      <option value="nobody" className="bg-slate-950">Nobody</option>
                    </select>
                  </div>

                  {/* Last Seen visibility */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-300">Last Seen</p>
                      <p className="text-[9px] text-slate-500">Who can check my last active timestamp</p>
                    </div>
                    <select
                      value={settings.privacy.lastSeen}
                      onChange={(e) => onUpdateSettings({
                        ...settings,
                        privacy: { ...settings.privacy, lastSeen: e.target.value as any }
                      })}
                      className="bg-slate-950 border border-slate-200/10 rounded-lg px-2.5 py-1 text-[10px] outline-hidden cursor-pointer"
                    >
                      <option value="everyone" className="bg-slate-950">Everyone</option>
                      <option value="contacts" className="bg-slate-950">My Contacts</option>
                      <option value="nobody" className="bg-slate-950">Nobody</option>
                    </select>
                  </div>

                  {/* Dynamic Status / Visibility fields */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-300">Contact details (Phone/Email)</p>
                      <p className="text-[9px] text-slate-500">Visibility of email/phone credentials</p>
                    </div>
                    <select
                      defaultValue="contacts"
                      className="bg-slate-950 border border-slate-200/10 rounded-lg px-2.5 py-1 text-[10px] outline-hidden cursor-pointer"
                    >
                      <option value="everyone" className="bg-slate-950">Everyone</option>
                      <option value="contacts" className="bg-slate-950">My Contacts</option>
                      <option value="nobody" className="bg-slate-950">Nobody</option>
                    </select>
                  </div>

                  {/* Read Receipts check */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="font-bold text-slate-300">Read Receipts (Blue Ticks)</p>
                      <p className="text-[9px] text-slate-500">Broadcast seen indicator updates</p>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({
                        ...settings,
                        privacy: { ...settings.privacy, readReceipts: !settings.privacy.readReceipts }
                      })}
                      className="p-1 cursor-pointer"
                    >
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold ${settings.privacy.readReceipts ? 'bg-indigo-600 text-white' : 'bg-slate-100/10 text-slate-400'}`}>
                        {settings.privacy.readReceipts ? 'ACTIVE' : 'MUTED'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Blocked Users section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Blocked Contacts</h4>
                </div>

                {settings.blockedUsers.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No blocked users on this workspace account.</p>
                ) : (
                  <div className="space-y-1.5">
                    {settings.blockedUsers.map(blockedId => {
                      const userObj = users.find(u => u.id === blockedId);
                      return (
                        <div key={blockedId} className="flex justify-between items-center p-2 rounded-xl bg-red-500/5 border border-red-500/10">
                          <span className="font-bold text-slate-300">@{userObj?.username || blockedId}</span>
                          <button
                            onClick={() => {
                              const updatedBlocked = settings.blockedUsers.filter(id => id !== blockedId);
                              onUpdateSettings({ ...settings, blockedUsers: updatedBlocked });
                              triggerToast('Contact unlocked securely!');
                            }}
                            className="text-[9px] font-extrabold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-0.5 rounded-md cursor-pointer"
                          >
                            UNBLOCK
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Interactive Storage block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Database className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sandbox Storage Usage</h4>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Secure Sandboxed Volume used: <strong>22.3 MB</strong></span>
                    <span className="text-indigo-400 font-mono font-bold">2.2% of 1 GB limits</span>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div className="h-3.5 w-full rounded-lg bg-slate-900 border border-slate-200/5 overflow-hidden flex">
                    <div className="h-full bg-indigo-500" style={{ width: '60%' }} title="Images: 14.2MB" />
                    <div className="h-full bg-purple-500" style={{ width: '20%' }} title="Files: 4.8MB" />
                    <div className="h-full bg-emerald-500" style={{ width: '10%' }} title="Audio: 2.1MB" />
                    <div className="h-full bg-amber-500" style={{ width: '10%' }} title="Metadata: 1.2MB" />
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-slate-400">
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> <span>Images (14.2 MB)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" /> <span>Documents (4.8 MB)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> <span>Audio/Voice (2.1 MB)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> <span>Metadata (1.2 MB)</span></div>
                  </div>
                </div>
              </div>

              {/* Theme Settings Selector */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Palette className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Visual Aesthetic Theme</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableThemes.map((th) => {
                    const isThemeActive = settings.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => onUpdateSettings({ ...settings, theme: th.id })}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                          isThemeActive 
                            ? 'border-indigo-500 bg-indigo-600/15' 
                            : 'border-slate-200/10 hover:border-indigo-500/40 bg-slate-100/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`h-3 w-3 rounded-md border shrink-0 ${th.color}`} />
                          <span className="font-extrabold text-[10px] truncate">{th.label}</span>
                        </div>
                        {isThemeActive && (
                          <CheckCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Languages className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">App Language</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableLanguages.map((lang) => {
                    const isLanguageActive = settings.language === lang.id;
                    return (
                      <button
                        key={lang.id}
                        onClick={() => onUpdateSettings({ ...settings, language: lang.id })}
                        className={`p-2 rounded-xl border text-[10px] font-extrabold cursor-pointer transition-all ${
                          isLanguageActive 
                            ? 'border-indigo-500 bg-indigo-600/15 text-indigo-400' 
                            : 'border-slate-200/10 hover:border-indigo-500/40 bg-slate-100/5 text-slate-300'
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notifications Setting */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Bell className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Notifications Settings</h4>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Message Audio Chime', desc: 'Play notification chime upon incoming envelopes', value: settings.notifications.sound, setter: () => onUpdateSettings({ ...settings, notifications: { ...settings.notifications, sound: !settings.notifications.sound } }) },
                    { label: 'Web Browser Banners', desc: 'Dispatch sandbox system notifications', value: settings.notifications.browser, setter: () => onUpdateSettings({ ...settings, notifications: { ...settings.notifications, browser: !settings.notifications.browser } }) },
                    { label: 'Message Content Previews', desc: 'Display content previews in banners', value: settings.notifications.previews, setter: () => onUpdateSettings({ ...settings, notifications: { ...settings.notifications, previews: !settings.notifications.previews } }) },
                  ].map((notif, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-300">{notif.label}</p>
                        <p className="text-[9px] text-slate-500 leading-tight">{notif.desc}</p>
                      </div>
                      <button
                        onClick={notif.setter}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold cursor-pointer ${notif.value ? 'bg-indigo-600 text-white' : 'bg-slate-100/10 text-slate-400'}`}
                      >
                        {notif.value ? 'ACTIVE' : 'MUTED'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Backup and Restore block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/10 pb-1.5">
                  <Cloud className="h-4 w-4 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Backup & Restore Vault</h4>
                </div>

                <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/2 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-300 text-[11px]">Encrypted Cloud Backup</p>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Sync configuration arrays to Cloud Storage Vault.</p>
                      <p className="text-[9px] text-indigo-400/80 font-mono mt-1 font-semibold">Last Vault sync: {lastBackupTime}</p>
                    </div>
                    
                    <button
                      onClick={handleBackupNow}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Backup Now</span>
                    </button>
                  </div>

                  {backupProgress !== null && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[9px] font-bold font-mono">
                        <span className="text-indigo-400 uppercase tracking-wider">{backupStage}</span>
                        <span className="text-indigo-400">{backupProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${backupProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-200/10 pt-2 flex justify-between items-center">
                    <p className="text-[9px] text-slate-500">Restore or export database states locally</p>
                    <button
                      onClick={handleExportDataProfile}
                      className="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Export Profile JSON</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </motion.div>

      {/* QR CODE OVERLAY BADGE */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQrModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className={`relative max-w-sm w-full p-6 rounded-3xl border shadow-2xl flex flex-col items-center text-center ${
                settings.theme !== 'light' 
                  ? 'bg-slate-950/90 border-slate-800 text-slate-100' 
                  : 'bg-white border-slate-200 text-slate-800'
              } backdrop-blur-xl`}
            >
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100/10 text-slate-400"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="mb-4">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono">ChatSphere Connect</span>
                <h3 className="text-base font-extrabold mt-0.5">My Profile QR Code</h3>
              </div>

              {/* Styled Vector SVG QR Badge Matrix */}
              <div className="p-4 bg-white rounded-2xl border-4 border-indigo-600/25 relative shadow-inner overflow-hidden mb-4">
                <svg width="200" height="200" viewBox="0 0 100 100" className="fill-slate-950">
                  {/* Outer Ring corners */}
                  <rect x="5" y="5" width="20" height="20" rx="3" fill="none" stroke="#1e1b4b" strokeWidth="3" />
                  <rect x="9" y="9" width="12" height="12" rx="1.5" fill="#4f46e5" />
                  
                  <rect x="75" y="5" width="20" height="20" rx="3" fill="none" stroke="#1e1b4b" strokeWidth="3" />
                  <rect x="79" y="9" width="12" height="12" rx="1.5" fill="#4f46e5" />

                  <rect x="5" y="75" width="20" height="20" rx="3" fill="none" stroke="#1e1b4b" strokeWidth="3" />
                  <rect x="9" y="79" width="12" height="12" rx="1.5" fill="#4f46e5" />

                  {/* Procedural micro dots resembling a real QR */}
                  <rect x="35" y="5" width="4" height="4" fill="#312e81" />
                  <rect x="45" y="12" width="6" height="4" fill="#1e1b4b" />
                  <rect x="55" y="6" width="4" height="8" fill="#4f46e5" />
                  <rect x="65" y="14" width="4" height="4" fill="#111827" />

                  <rect x="32" y="25" width="8" height="4" fill="#4f46e5" />
                  <rect x="44" y="28" width="4" height="6" fill="#111827" />
                  <rect x="52" y="22" width="12" height="4" fill="#312e81" />
                  <rect x="68" y="26" width="4" height="4" fill="#4f46e5" />

                  <rect x="5" y="32" width="6" height="4" fill="#111827" />
                  <rect x="15" y="38" width="12" height="4" fill="#312e81" />
                  <rect x="5" y="46" width="4" height="8" fill="#4f46e5" />

                  <rect x="75" y="32" width="12" height="4" fill="#4f46e5" />
                  <rect x="75" y="42" width="4" height="8" fill="#111827" />
                  <rect x="85" y="52" width="10" height="4" fill="#312e81" />

                  <rect x="30" y="45" width="40" height="40" rx="4" fill="white" stroke="#4f46e5" strokeWidth="1.5" />
                  {/* Procedural inner grids */}
                  <rect x="34" y="49" width="8" height="8" fill="#312e81" />
                  <rect x="58" y="49" width="8" height="8" fill="#111827" />
                  <rect x="34" y="73" width="8" height="8" fill="#4f46e5" />
                  <rect x="58" y="73" width="8" height="8" fill="#312e81" />

                  <rect x="46" y="54" width="8" height="4" fill="#111827" />
                  <rect x="44" y="62" width="12" height="4" fill="#4f46e5" />
                  <rect x="48" y="70" width="6" height="6" fill="#312e81" />

                  {/* Centered User Mini Avatar Badge */}
                  <foreignObject x="42" y="42" width="16" height="16">
                    <img 
                      src={currentUser.avatar} 
                      alt="Avatar" 
                      className="w-full h-full rounded-md object-cover border border-indigo-500 shadow-md bg-white" 
                    />
                  </foreignObject>
                </svg>
              </div>

              {/* QR Details */}
              <div className="mb-5">
                <p className="font-extrabold text-sm">{currentUser.name}</p>
                <p className="text-[10px] text-indigo-400 font-mono">@{currentUser.username}</p>
                <p className="text-[10px] text-slate-500 mt-1">{currentUser.phone || '+1 (555) 019-2831'}</p>
              </div>

              {/* QR Code Action buttons */}
              <div className="w-full space-y-2 text-xs font-bold">
                <a
                  href={`data:image/svg+xml;utf8,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="350" viewBox="0 0 100 120" fill="white"><rect width="100%" height="100%" fill="%2305050d"/><text x="50" y="15" font-family="sans-serif" font-size="6" font-weight="bold" fill="%234f46e5" text-anchor="middle">CHATSphere CONNECT</text><text x="50" y="110" font-family="sans-serif" font-size="5" fill="white" text-anchor="middle">${currentUser.name}</text><text x="50" y="116" font-family="sans-serif" font-size="4" fill="%234f46e5" text-anchor="middle">@${currentUser.username}</text></svg>`
                  )}`}
                  download={`chatsphere_qr_${currentUser.username}.svg`}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Vector QR Badge</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyText(`https://chatsphere.io/invite/${currentUser.username}`, 'Profile invite link')}
                  className={`w-full py-2.5 rounded-xl border font-bold cursor-pointer transition-colors ${
                    settings.theme !== 'light' 
                      ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Share Profile Link
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMAGE CROPPER / ROTATOR / EDITOR MODAL */}
      <AnimatePresence>
        {cropperImageSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCropperImageSrc(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className={`relative max-w-md w-full p-6 rounded-3xl border shadow-2xl flex flex-col ${
                settings.theme !== 'light' 
                  ? 'bg-slate-950 border-slate-800 text-slate-100' 
                  : 'bg-white border-slate-200 text-slate-800'
              } backdrop-blur-xl overflow-hidden`}
            >
              <div className="mb-4 text-center">
                <h3 className="text-sm font-extrabold flex items-center justify-center gap-1.5">
                  <Camera className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Crop & Edit Profile Photo</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Drag image inside circular mask, adjust sliders to fit.</p>
              </div>

              {/* Crop Box Stage */}
              <div 
                className="w-full aspect-square rounded-2xl bg-black relative border border-slate-800 overflow-hidden flex items-center justify-center select-none cursor-move"
                onMouseDown={startDrag}
                onMouseMove={onDrag}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
              >
                {/* User Image under crop parameters */}
                <div 
                  className="absolute pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  }}
                >
                  <img 
                    src={cropperImageSrc} 
                    alt="Source" 
                    className="max-h-[300px] max-w-[300px] object-contain" 
                  />
                </div>

                {/* Circular Crop Mask Overlay */}
                <div className="absolute inset-0 border-[40px] border-black/60 flex items-center justify-center pointer-events-none">
                  <div className="w-full aspect-square rounded-full border-2 border-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
              </div>

              {/* Cropper controls */}
              <div className="space-y-4 mt-5 text-xs">
                {/* Zoom control */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Zoom Scale</span>
                    <span>{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Rotation control */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Rotation Degrees</span>
                    <span>{rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 font-bold text-xs pt-1.5">
                  <button
                    type="button"
                    onClick={saveCroppedPhoto}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    Apply New Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropperImageSrc(null)}
                    className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CATEGORY MEDIA LIST OVERLAY (SLIDE DOWN FROM TOP/RIGHT) */}
      <AnimatePresence>
        {selectedMediaCategory !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMediaCategory(null)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide in list of media */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className={`relative h-full w-full md:w-[480px] border-l flex flex-col z-55 shadow-2xl overflow-hidden ${
                settings.theme !== 'light' 
                  ? 'border-slate-800 bg-slate-950/98 text-slate-100' 
                  : 'border-slate-200 bg-white text-slate-800'
              } backdrop-blur-xl`}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200/10 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Media Vault</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-bold text-slate-400 capitalize">{selectedMediaCategory} index</span>
                </div>
                <button 
                  onClick={() => setSelectedMediaCategory(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Scanned Items list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {(() => {
                  const items = selectedMediaCategory === 'links' ? links :
                                selectedMediaCategory === 'image' ? photos :
                                selectedMediaCategory === 'video' ? videos :
                                selectedMediaCategory === 'file' ? files :
                                voiceNotes;

                  if (items.length === 0) {
                    return <p className="text-xs text-slate-500 italic py-6 text-center">No catalog records found.</p>;
                  }

                  return (
                    <div className="space-y-3 text-xs">
                      {items.map((item, idx) => (
                        <div 
                          key={`${item.id}-${idx}`}
                          className="p-3.5 rounded-xl border border-slate-200/5 bg-slate-100/5 flex flex-col gap-2 hover:border-indigo-500/30 transition-all text-left"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-mono text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                            {item.mediaUrl && (
                              <a 
                                href={item.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold text-indigo-400 hover:underline"
                              >
                                View File
                              </a>
                            )}
                          </div>

                          <p className="font-semibold leading-relaxed text-slate-200 break-words">{item.content}</p>

                          {/* Previews based on media type */}
                          {item.mediaType === 'image' && item.mediaUrl && (
                            <img 
                              src={item.mediaUrl} 
                              alt="Attachment Preview" 
                              className="w-full max-h-[160px] object-cover rounded-lg border border-slate-800 bg-slate-900 mt-1" 
                            />
                          )}

                          {item.mediaType === 'file' && item.fileInfo && (
                            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-200/5 flex items-center justify-between text-[11px]">
                              <span className="font-mono text-slate-400 truncate max-w-[200px]">{item.fileInfo.name}</span>
                              <span className="font-mono text-slate-500 shrink-0">{item.fileInfo.size}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
