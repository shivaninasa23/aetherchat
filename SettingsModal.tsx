import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Shield, Bell, Languages, Database, Volume2, Globe, Trash2, 
  ToggleLeft, ToggleRight, Check, AlertTriangle, ShieldCheck, UserX, Palette,
  Upload, Link as LinkIcon
} from 'lucide-react';
import { User, UserSettings } from '../types';
import { presetWallpapers } from '../data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  users: User[];
  isDark: boolean;
  onClearCache: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  users,
  isDark,
  onClearCache
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'appearance' | 'storage'>('general');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const [wallpaperUploadError, setWallpaperUploadError] = useState('');

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setWallpaperUploadError('File must be a valid image format.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setWallpaperUploadError('Image is too large (max 2MB for local safety).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        onUpdateSettings({
          ...settings,
          chatWallpaper: event.target.result
        });
        setWallpaperUploadError('');
      }
    };
    reader.onerror = () => {
      setWallpaperUploadError('Error reading file. Try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (!customWallpaperUrl.trim()) return;
    if (!customWallpaperUrl.startsWith('http://') && !customWallpaperUrl.startsWith('https://')) {
      setWallpaperUploadError('URL must start with http:// or https://');
      return;
    }
    onUpdateSettings({
      ...settings,
      chatWallpaper: customWallpaperUrl.trim()
    });
    setWallpaperUploadError('');
    setCustomWallpaperUrl('');
  };

  // Storage Stats (simulated based on premium metadata)
  const storageStats = [
    { name: 'Images & GIFs', size: '14.2 MB', color: 'bg-indigo-500', pct: 60 },
    { name: 'Documents & PDFs', size: '4.8 MB', color: 'bg-purple-500', pct: 20 },
    { name: 'Voice Notes & Audio', size: '2.1 MB', color: 'bg-emerald-500', pct: 10 },
    { name: 'Cache / Text Files', size: '1.2 MB', color: 'bg-amber-500', pct: 5 }
  ];

  const handleToggleSound = () => {
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, sound: !settings.notifications.sound }
    });
  };

  const handleToggleBrowser = () => {
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, browser: !settings.notifications.browser }
    });
  };

  const handleTogglePreviews = () => {
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, previews: !settings.notifications.previews }
    });
  };

  const handleLanguageChange = (lang: UserSettings['language']) => {
    onUpdateSettings({ ...settings, language: lang });
  };

  const handleToggleBlocked = (userId: string) => {
    const isBlocked = settings.blockedUsers.includes(userId);
    let newBlocked = [...settings.blockedUsers];
    if (isBlocked) {
      newBlocked = newBlocked.filter(id => id !== userId);
    } else {
      newBlocked.push(userId);
    }
    onUpdateSettings({ ...settings, blockedUsers: newBlocked });
  };

  const handlePrivacyChange = (field: 'lastSeen' | 'profilePhoto', val: 'everyone' | 'contacts' | 'nobody') => {
    onUpdateSettings({
      ...settings,
      privacy: { ...settings.privacy, [field]: val }
    });
  };

  const handleToggleReceipts = () => {
    onUpdateSettings({
      ...settings,
      privacy: { ...settings.privacy, readReceipts: !settings.privacy.readReceipts }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`relative z-10 w-full max-w-2xl h-[520px] rounded-3xl overflow-hidden shadow-2xl flex transition-all duration-300 ${isDark ? 'glass-panel-dark text-white' : 'glass-panel-light text-slate-800'}`}
          >
            {/* Sidebar Tabs */}
            <div className={`w-1/3 p-6 border-r flex flex-col gap-1.5 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-100/40'}`}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 px-3">
                Settings
              </h3>
              
              <button
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'general' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Globe className="h-4 w-4" />
                General & Language
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Bell className="h-4 w-4" />
                Notifications
              </button>

              <button
                onClick={() => setActiveTab('privacy')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'privacy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Shield className="h-4 w-4" />
                Privacy & Security
              </button>

              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'appearance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Palette className="h-4 w-4" />
                Appearance & Wallpapers
              </button>

              <button
                onClick={() => setActiveTab('storage')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'storage' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Database className="h-4 w-4" />
                Storage Usage
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-bold capitalize">{activeTab} Preferences</h4>
                  <button
                    onClick={onClose}
                    className={`p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Tab content definitions */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Interface Language
                      </label>
                      <p className="text-xs text-slate-400 mb-3">
                        Choose your language for the ChatSphere workspace dashboard.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { code: 'en', label: 'English (US)' },
                          { code: 'es', label: 'Español' },
                          { code: 'fr', label: 'Français' },
                          { code: 'de', label: 'Deutsch' },
                          { code: 'it', label: 'Italiano' },
                          { code: 'pt', label: 'Português' },
                        ].map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code as any)}
                            className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-medium border transition-all cursor-pointer ${settings.language === lang.code ? 'border-indigo-500 bg-indigo-500/5 font-bold' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'}`}
                          >
                            <span>{lang.label}</span>
                            {settings.language === lang.code && <Check className="h-4 w-4 text-indigo-500" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200/20 pt-5">
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800/40">
                        <div className="flex flex-col gap-0.5 text-left">
                          <span className="text-xs font-bold">Simulated Bot Replies</span>
                          <span className="text-[10px] text-slate-400">Receive mock auto-replies in direct and group chats. Keep off for real-time testing.</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, autoReplyEnabled: !settings.autoReplyEnabled })} 
                          className="text-indigo-500 cursor-pointer"
                        >
                          {settings.autoReplyEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 mb-4">
                      Configure your notification engine settings. ChatSphere provides secure, low-latency background notifications.
                    </p>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800/40">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">Sound Notifications</span>
                        <span className="text-[10px] text-slate-400">Play tone for incoming secure notifications.</span>
                      </div>
                      <button onClick={handleToggleSound} className="text-indigo-500 cursor-pointer">
                        {settings.notifications.sound ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800/40">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">Browser Push Notifications</span>
                        <span className="text-[10px] text-slate-400">Show native alert cards outside of active browser tab.</span>
                      </div>
                      <button onClick={handleToggleBrowser} className="text-indigo-500 cursor-pointer">
                        {settings.notifications.browser ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800/40">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">Message Previews</span>
                        <span className="text-[10px] text-slate-400">Display message body text inside alerts.</span>
                      </div>
                      <button onClick={handleTogglePreviews} className="text-indigo-500 cursor-pointer">
                        {settings.notifications.previews ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'privacy' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 mb-3">
                      Manage who can see your online status, profile assets, and control delivery checkmarks.
                    </p>

                    <div>
                      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Who can see my last seen status</span>
                      <div className="grid grid-cols-3 gap-2">
                        {['everyone', 'contacts', 'nobody'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handlePrivacyChange('lastSeen', opt as any)}
                            className={`py-2 rounded-xl text-xs font-medium border capitalize transition-all cursor-pointer ${settings.privacy.lastSeen === opt ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500 font-bold' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800/40 mt-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">Read Receipts (Blue Checkmarks)</span>
                        <span className="text-[10px] text-slate-400">Send seen confirmations once message is opened.</span>
                      </div>
                      <button onClick={handleToggleReceipts} className="text-indigo-500 cursor-pointer">
                        {settings.privacy.readReceipts ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                      </button>
                    </div>

                    {/* Two-Factor 2FA Authentication Setup */}
                    <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 mt-4 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-indigo-500 animate-pulse" />
                            Two-Factor Authentication (2FA)
                          </span>
                          <span className="text-[10px] text-slate-400">Add an extra layer of security with code authorization.</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, twoFactorEnabled: !settings.twoFactorEnabled })} 
                          className="text-indigo-500 cursor-pointer"
                        >
                          {settings.twoFactorEnabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-slate-400" />}
                        </button>
                      </div>
                      {settings.twoFactorEnabled && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-indigo-500/10 flex items-center gap-3"
                        >
                          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-500/30">
                            <div className="w-12 h-12 bg-slate-900 flex flex-wrap items-center justify-center p-1 rounded-sm">
                              {/* Beautiful Mock QR Code block */}
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-transparent m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-transparent m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                              <div className="w-2.5 h-2.5 bg-white m-0.5" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-widest">AETHER 2FA KEY</p>
                            <p className="text-xs font-extrabold tracking-wider text-slate-200 select-all">AE91 - 3F8C - ND20 - LXP9</p>
                            <p className="text-[9px] text-slate-400 leading-normal mt-0.5">Scan this key with your Google Authenticator app to protect your AetherChat profile.</p>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="mt-4">
                      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Block List</span>
                      <div className="max-h-24 overflow-y-auto space-y-1.5">
                        {users.filter(u => u.id !== 'self' && u.id !== 'ai_bot').map(u => {
                          const isBlocked = settings.blockedUsers.includes(u.id);
                          return (
                            <div key={u.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-100/30 dark:bg-slate-900/30">
                              <div className="flex items-center gap-2">
                                <img src={u.avatar} alt={u.name} className="w-5 h-5 rounded-full object-cover" />
                                <span>{u.name}</span>
                              </div>
                              <button
                                onClick={() => handleToggleBlocked(u.id)}
                                className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-colors ${isBlocked ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-red-500'}`}
                              >
                                {isBlocked ? 'Blocked' : 'Block'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="space-y-5 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Interface Theme Mode
                      </label>
                      <p className="text-[11px] text-slate-400 mb-2.5">
                        Choose the global visual theme. Accent glows will shift dynamically.
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { id: 'light', name: 'Alabaster', color: 'bg-white border border-slate-300' },
                          { id: 'dark', name: 'Dark Slate', color: 'bg-slate-950 border border-slate-800' },
                          { id: 'cyberpunk', name: 'Cyberpunk', color: 'bg-pink-600' },
                          { id: 'emerald', name: 'Emerald', color: 'bg-emerald-800' },
                          { id: 'sunset', name: 'Sunset', color: 'bg-orange-600' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onUpdateSettings({ ...settings, theme: t.id as any })}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${settings.theme === t.id ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-800/50 hover:border-indigo-500/35'}`}
                          >
                            <span className={`w-4 h-4 rounded-full mb-1.5 ${t.color}`} />
                            <span className="truncate w-full text-center leading-none font-sans">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Chat Ambient Wallpaper (Global Default)
                      </label>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Choose a beautiful background. This will be the fallback for all chats unless customized individually.
                      </p>
                      
                      {/* Presets Grid */}
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Presets
                      </span>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {presetWallpapers.map((w) => {
                          const isSelected = settings.chatWallpaper === w.id || (!settings.chatWallpaper && w.id === 'solid');
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => onUpdateSettings({ ...settings, chatWallpaper: w.id })}
                              className={`p-2 rounded-xl border text-[10px] font-bold text-center transition-all cursor-pointer flex flex-col items-center gap-1 bg-slate-900/10 ${isSelected ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-800/50 text-slate-400 hover:border-indigo-500/35'}`}
                            >
                              {w.type === 'image' ? (
                                <img src={w.value} alt={w.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700/30" />
                              ) : (
                                <div className={`w-8 h-8 rounded-lg border border-slate-700/30 flex items-center justify-center ${
                                  w.id === 'stars' ? 'wallpaper-stars bg-[#05050d]' :
                                  w.id === 'nodes' ? 'wallpaper-nodes bg-[#0f172a]' :
                                  w.id === 'sunset-glow' ? 'wallpaper-sunset-glow bg-[#1f0900]' :
                                  w.id === 'matrix' ? 'wallpaper-matrix bg-[#021c12]' :
                                  'bg-slate-800'
                                }`} />
                              )}
                              <span className="truncate w-full">{w.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Wallpaper Section */}
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Custom Background
                      </span>
                      <div className="space-y-2 bg-slate-100/30 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-200/10 mb-4">
                        {/* URL input */}
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                            <LinkIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <input
                              type="text"
                              placeholder="Paste high-res image URL..."
                              value={customWallpaperUrl}
                              onChange={(e) => setCustomWallpaperUrl(e.target.value)}
                              className="w-full bg-transparent border-0 p-0 outline-hidden focus:ring-0 text-xs text-slate-300 placeholder:text-slate-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyCustomUrl}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition-colors"
                          >
                            Apply Link
                          </button>
                        </div>

                        {/* File Upload */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-[10px] text-slate-400">
                            Or upload a local image file (Max 2MB):
                          </div>
                          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-[11px] font-bold text-slate-300 hover:text-indigo-500 cursor-pointer transition-colors">
                            <Upload className="h-3.5 w-3.5 text-slate-400" />
                            <span>Select Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleWallpaperUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {wallpaperUploadError && (
                          <p className="text-[10px] font-semibold text-red-400 text-left animate-pulse mt-1">
                            {wallpaperUploadError}
                          </p>
                        )}
                      </div>

                      {/* Current Preview Status */}
                      {settings.chatWallpaper && !presetWallpapers.map(p => p.id).includes(settings.chatWallpaper) && (
                        <div className="flex items-center gap-3 p-2 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-xs mb-4">
                          {settings.chatWallpaper.startsWith('data:') ? (
                            <img src={settings.chatWallpaper} className="w-10 h-10 rounded-lg object-cover border border-indigo-500/20" alt="uploaded custom" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-indigo-500/20 overflow-hidden">
                              <img src={settings.chatWallpaper} className="w-full h-full object-cover" alt="url custom" />
                            </div>
                          )}
                          <div className="text-left">
                            <p className="font-bold text-indigo-400 text-[10px]">CURRENT: CUSTOM BACKDROP</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {settings.chatWallpaper.startsWith('data:') ? 'Local Image File (Base64)' : settings.chatWallpaper}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateSettings({ ...settings, chatWallpaper: 'solid' })}
                            className="ml-auto text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Message Bubble Theme Accent
                      </label>
                      <p className="text-[11px] text-slate-400 mb-2.5">
                        Select a beautiful core color accent for your chat bubbles and action buttons.
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'indigo', name: 'Royal Indigo', color: 'bg-indigo-600' },
                          { id: 'pink', name: 'Neon Pink', color: 'bg-pink-600' },
                          { id: 'emerald', name: 'Forest Emerald', color: 'bg-emerald-600' },
                          { id: 'orange', name: 'Sunset Orange', color: 'bg-orange-600' }
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onUpdateSettings({ ...settings, chatThemeColor: c.id })}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${settings.chatThemeColor === c.id || (!settings.chatThemeColor && c.id === 'indigo') ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500' : 'border-slate-200 dark:border-slate-800/50 hover:border-indigo-500/35'}`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${c.color}`} />
                            <span className="truncate leading-none font-sans">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'storage' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-xs mb-1">
                      <span>Total Disk Allocation</span>
                      <span className="font-bold text-indigo-500">22.3 MB / 500 MB</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                      {storageStats.map((stat, idx) => (
                        <div key={idx} className={`h-full ${stat.color}`} style={{ width: `${stat.pct}%` }} />
                      ))}
                    </div>

                    {/* Breakdown List */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {storageStats.map((stat, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/10">
                          <span className={`w-2.5 h-2.5 rounded-full ${stat.color}`} />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400">{stat.name}</span>
                            <span className="text-xs font-bold">{stat.size}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Clear Button */}
                    <div className="pt-2">
                      {!showConfirmClear ? (
                        <button
                          onClick={() => setShowConfirmClear(true)}
                          className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-4 w-4" /> Clear Local Cache Space
                        </button>
                      ) : (
                        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
                          <p className="text-xs text-red-500 font-bold flex items-center justify-center gap-1.5 mb-2">
                            <AlertTriangle className="h-4 w-4" /> Confirm irreversible data clear?
                          </p>
                          <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                            This will clear all local files, star records, call histories, and messages back to factory presets.
                          </p>
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => setShowConfirmClear(false)}
                              className="text-xs bg-slate-200 dark:bg-slate-800 px-3 py-1.5 rounded-xl font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                onClearCache();
                                setShowConfirmClear(false);
                                onClose();
                              }}
                              className="text-xs bg-red-600 text-white px-3.5 py-1.5 rounded-xl font-bold hover:bg-red-700"
                            >
                              Yes, Clear Now
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200/20 text-center">
                <p className="text-[10px] text-slate-400 font-mono">
                  ChatSphere v1.1.0-alpha • Cloud Run Deployment • Secure JWT
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
