import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Check, Upload, Image as ImageIcon, Palette, Layout, Sparkles, Clock, 
  RotateCcw, AlertCircle, Globe, CheckCircle2, Lock, MessageSquare, ChevronRight
} from 'lucide-react';
import { Chat, UserSettings } from '../types';
import { presetWallpapers } from '../data';

interface ChangeWallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  isDark: boolean;
}

// Modern Custom Gradients
const gradientWallpapers = [
  { id: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #4a044e 100%)', name: 'Twilight Sunset', value: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #4a044e 100%)' },
  { id: 'linear-gradient(135deg, #030712 0%, #0b1528 50%, #1e1b4b 100%)', name: 'Midnight Blue', value: 'linear-gradient(135deg, #030712 0%, #0b1528 50%, #1e1b4b 100%)' },
  { id: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f766e 100%)', name: 'Emerald Aurum', value: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f766e 100%)' },
  { id: 'linear-gradient(135deg, #1c0505 0%, #2d0606 50%, #450a0a 100%)', name: 'Crimson Ember', value: 'linear-gradient(135deg, #1c0505 0%, #2d0606 50%, #450a0a 100%)' },
  { id: 'linear-gradient(135deg, #1a0b2e 0%, #3b0764 60%, #701a75 100%)', name: 'Nebula Purple', value: 'linear-gradient(135deg, #1a0b2e 0%, #3b0764 60%, #701a75 100%)' },
  { id: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)', name: 'Deep Sea Blue', value: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)' },
];

// Solid Colors
const solidWallpapers = [
  { id: '#090d16', name: 'Absolute Dark', value: '#090d16' },
  { id: '#0f172a', name: 'Slate Gray', value: '#0f172a' },
  { id: '#111827', name: 'Dark Velvet', value: '#111827' },
  { id: '#022c22', name: 'Forest Green', value: '#022c22' },
  { id: '#3b0712', name: 'Deep Crimson', value: '#3b0712' },
  { id: '#1e1b4b', name: 'Deep Indigo', value: '#1e1b4b' },
  { id: '#1c1917', name: 'Warm Stone', value: '#1c1917' },
  { id: '#312e81', name: 'Electric Violet', value: '#312e81' },
];

// Patterns mapping
const patternWallpapers = [
  { id: 'stars', name: 'Cosmic Stars', type: 'pattern', value: 'stars' },
  { id: 'nodes', name: 'Grid Nodes', type: 'pattern', value: 'nodes' },
  { id: 'sunset-glow', name: 'Sunset Radiance', type: 'pattern', value: 'sunset-glow' },
  { id: 'matrix', name: 'Emerald Matrix', type: 'pattern', value: 'matrix' },
  { id: 'solid', name: 'Standard Solid', type: 'pattern', value: 'solid' },
];

export default function ChangeWallpaperModal({
  isOpen,
  onClose,
  chat,
  settings,
  onUpdateSettings,
  isDark
}: ChangeWallpaperModalProps) {
  const [activeCategory, setActiveCategory] = useState<'presets' | 'gradients' | 'solids' | 'patterns' | 'upload' | 'recent'>('presets');
  
  // Per-chat active wallpaper lookup
  const initialWallpaper = settings.chatWallpapers?.[chat.id] || settings.chatWallpaper || 'solid';
  
  // Selection/Preview state
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(initialWallpaper);
  
  // Custom URL inputs
  const [customUrl, setCustomUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recently used wallpapers cache loaded from localStorage
  const [recentWallpapers, setRecentWallpapers] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cs_recently_used_wallpapers');
      if (stored) {
        setRecentWallpapers(JSON.parse(stored));
      } else {
        // Load initial defaults
        const defaults = ['stars', 'nodes', 'nebula', 'mountains'];
        setRecentWallpapers(defaults);
        localStorage.setItem('cs_recently_used_wallpapers', JSON.stringify(defaults));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update selected default state when opening modal
  useEffect(() => {
    if (isOpen) {
      setSelectedWallpaper(initialWallpaper);
      setErrorMsg('');
      setCustomUrl('');
    }
  }, [isOpen, initialWallpaper]);

  if (!isOpen) return null;

  // Add selected wallpaper to recently used list upon successful Apply
  const saveToRecent = (wallpaperVal: string) => {
    let updated = [wallpaperVal, ...recentWallpapers.filter(w => w !== wallpaperVal)];
    updated = updated.slice(0, 6); // keep top 6
    setRecentWallpapers(updated);
    localStorage.setItem('cs_recently_used_wallpapers', JSON.stringify(updated));
  };

  const handleApply = () => {
    const updatedWallpapers = {
      ...(settings.chatWallpapers || {}),
      [chat.id]: selectedWallpaper
    };
    onUpdateSettings({
      ...settings,
      chatWallpapers: updatedWallpapers
    });
    saveToRecent(selectedWallpaper);
    onClose();
  };

  const handleResetToDefault = () => {
    const updatedWallpapers = { ...(settings.chatWallpapers || {}) };
    delete updatedWallpapers[chat.id];
    onUpdateSettings({
      ...settings,
      chatWallpapers: updatedWallpapers
    });
    setSelectedWallpaper(settings.chatWallpaper || 'solid');
    onClose();
  };

  // Base64 file uploader reader with 10MB limit
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Invalid format. Please upload JPG, PNG, or WEBP graphics.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds the 10MB security threshold.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setSelectedWallpaper(event.target.result);
        setErrorMsg('');
      }
    };
    reader.onerror = () => {
      setErrorMsg('An error occurred while loading your image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Invalid format. Please drop a valid image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setSelectedWallpaper(event.target.result);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (!customUrl.trim()) return;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      setErrorMsg('Image link must start with http:// or https://');
      return;
    }
    setSelectedWallpaper(customUrl.trim());
    setErrorMsg('');
    setCustomUrl('');
  };

  // Helper to resolve wallpaper preview style for a selected ID/value
  const getWallpaperStyles = (id: string): { className: string, style?: React.CSSProperties } => {
    const isImage = id.startsWith('http://') || id.startsWith('https://') || id.startsWith('data:');
    const isGradient = id.startsWith('linear-gradient');
    const isHex = id.startsWith('#');

    const preset = presetWallpapers.find(p => p.id === id);

    if (preset) {
      if (preset.type === 'image') {
        return { 
          className: '', 
          style: { backgroundImage: `url("${preset.value}")`, backgroundSize: 'cover', backgroundPosition: 'center' } 
        };
      } else {
        const cls = preset.id === 'stars' ? 'wallpaper-stars bg-[#05050d]' :
                    preset.id === 'nodes' ? 'wallpaper-nodes bg-[#0f172a]' :
                    preset.id === 'sunset-glow' ? 'wallpaper-sunset-glow bg-[#1f0900]' :
                    preset.id === 'matrix' ? 'wallpaper-matrix bg-[#021c12]' :
                    'bg-[#0f172a]';
        return { className: cls };
      }
    }

    if (isImage) {
      return { 
        className: '', 
        style: { backgroundImage: `url("${id}")`, backgroundSize: 'cover', backgroundPosition: 'center' } 
      };
    }

    if (isGradient) {
      return { className: '', style: { background: id } };
    }

    if (isHex) {
      return { className: '', style: { backgroundColor: id } };
    }

    // Default fallback
    return { className: 'bg-[#0f172a]' };
  };

  const currentPreviewStyles = getWallpaperStyles(selectedWallpaper);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay with extreme blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Main container card */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          className={`relative w-full max-w-4xl h-[85vh] sm:h-[75vh] md:h-[650px] rounded-3xl border flex flex-col overflow-hidden shadow-2xl ${
            isDark 
              ? 'bg-slate-950/90 border-slate-800 text-slate-200' 
              : 'bg-white/95 border-slate-200 text-slate-800'
          } backdrop-blur-xl`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200/10 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-400" />
                <span>Change Chat Wallpaper</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Customize background style for <strong>{chat.name}</strong> independently.
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-100/10 transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Core Body: Two Columns on Desktop */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            
            {/* Left Column: Selector controls */}
            <div className="flex-1 flex flex-col p-5 min-h-0">
              
              {/* Category tabs scroll rail */}
              <div className="flex gap-1 overflow-x-auto pb-3 flex-shrink-0 custom-scrollbar border-b border-slate-200/5">
                {[
                  { id: 'presets', label: 'Defaults', icon: Layout },
                  { id: 'gradients', label: 'Gradients', icon: Sparkles },
                  { id: 'solids', label: 'Solids', icon: Palette },
                  { id: 'patterns', label: 'Patterns', icon: RotateCcw },
                  { id: 'upload', label: 'Custom Upload', icon: Upload },
                  { id: 'recent', label: 'Recent', icon: Clock },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isCatActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                        isCatActive 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                          : 'bg-slate-100/5 hover:bg-slate-100/10 hover:text-slate-200 text-slate-400'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selection Content Panel Area */}
              <div className="flex-1 overflow-y-auto mt-4 pr-1 custom-scrollbar min-h-0">
                <AnimatePresence mode="wait">
                  
                  {/* Category: Default Presets */}
                  {activeCategory === 'presets' && (
                    <motion.div
                      key="presets"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    >
                      {presetWallpapers.map((p) => {
                        const isSelected = selectedWallpaper === p.id;
                        const cardStyles = getWallpaperStyles(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedWallpaper(p.id)}
                            className={`aspect-video rounded-2xl overflow-hidden relative border transition-all cursor-pointer group flex flex-col justify-end text-left p-2.5 ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/45' 
                                : 'border-slate-200/10 hover:border-indigo-500/50 hover:scale-[1.02]'
                            }`}
                          >
                            {/* Visual Canvas background preview */}
                            <div className={`absolute inset-0 z-0 ${cardStyles.className}`} style={cardStyles.style} />
                            
                            {/* Glass overlay */}
                            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors z-5" />

                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-white tracking-tight truncate max-w-[80%] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                {p.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-slate-950/80 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Category: Gradients */}
                  {activeCategory === 'gradients' && (
                    <motion.div
                      key="gradients"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    >
                      {gradientWallpapers.map((g) => {
                        const isSelected = selectedWallpaper === g.value;
                        const cardStyles = getWallpaperStyles(g.value);
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedWallpaper(g.value)}
                            className={`aspect-video rounded-2xl overflow-hidden relative border transition-all cursor-pointer group flex flex-col justify-end text-left p-2.5 ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/45' 
                                : 'border-slate-200/10 hover:border-indigo-500/50 hover:scale-[1.02]'
                            }`}
                          >
                            <div className="absolute inset-0 z-0" style={cardStyles.style} />
                            <div className="absolute inset-0 bg-slate-950/10 group-hover:bg-transparent transition-colors z-5" />

                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-white tracking-tight truncate max-w-[80%] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                {g.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-slate-950/80 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Category: Solids */}
                  {activeCategory === 'solids' && (
                    <motion.div
                      key="solids"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    >
                      {solidWallpapers.map((s) => {
                        const isSelected = selectedWallpaper === s.value;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedWallpaper(s.value)}
                            className={`aspect-video rounded-2xl overflow-hidden relative border transition-all cursor-pointer group flex flex-col justify-end text-left p-2.5 ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/45' 
                                : 'border-slate-200/10 hover:border-indigo-500/50 hover:scale-[1.02]'
                            }`}
                            style={{ backgroundColor: s.value }}
                          >
                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-white tracking-tight truncate max-w-[80%] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                {s.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-slate-950/80 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Category: Patterns */}
                  {activeCategory === 'patterns' && (
                    <motion.div
                      key="patterns"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    >
                      {patternWallpapers.map((p) => {
                        const isSelected = selectedWallpaper === p.value;
                        const cardStyles = getWallpaperStyles(p.value);
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedWallpaper(p.value)}
                            className={`aspect-video rounded-2xl overflow-hidden relative border transition-all cursor-pointer group flex flex-col justify-end text-left p-2.5 ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/45' 
                                : 'border-slate-200/10 hover:border-indigo-500/50 hover:scale-[1.02]'
                            }`}
                          >
                            <div className={`absolute inset-0 z-0 ${cardStyles.className}`} />
                            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors z-5" />

                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-[10px] font-bold text-white tracking-tight truncate max-w-[80%] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                {p.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-slate-950/80 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Category: Custom Upload */}
                  {activeCategory === 'upload' && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4 text-xs"
                    >
                      {/* Drag & Drop uploader area */}
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          dragActive 
                            ? 'border-indigo-500 bg-indigo-500/5' 
                            : isDark
                              ? 'border-slate-800 bg-slate-900/20 hover:bg-slate-900/40 hover:border-indigo-500/50'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-500/50'
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
                          <Upload className="h-5 w-5 animate-pulse" />
                        </div>
                        <p className="font-bold text-slate-300">Drag & drop your custom wallpaper</p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                          Supports PNG, JPG, or WEBP up to 10MB file size.
                        </p>
                        <span className="mt-3.5 text-[10px] bg-indigo-600/10 text-indigo-400 font-bold px-2.5 py-1 rounded-lg border border-indigo-500/10">
                          Select Local File
                        </span>
                      </div>

                      {/* Direct URL Input paste */}
                      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          Or enter public image URL
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative flex items-center">
                            <Globe className="absolute left-2.5 h-3.5 w-3.5 text-slate-500" />
                            <input
                              type="text"
                              placeholder="Paste a link (e.g. https://images.unsplash.com/...)"
                              value={customUrl}
                              onChange={(e) => setCustomUrl(e.target.value)}
                              className="w-full text-[10px] pl-8 pr-3 py-2 bg-slate-950/40 border border-slate-200/10 rounded-xl outline-hidden text-slate-200 placeholder-slate-600 focus:border-indigo-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyCustomUrl}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl cursor-pointer"
                          >
                            Preview URL
                          </button>
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <p className="text-[10px] font-medium leading-relaxed">{errorMsg}</p>
                        </div>
                      )}

                      {/* Base64 / URL current state preview if selected */}
                      {selectedWallpaper.startsWith('data:') && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-emerald-400">
                          <span className="font-bold font-mono text-[9px] uppercase tracking-wider">Custom Base64 Image Loaded</span>
                          <button 
                            onClick={() => setSelectedWallpaper('solid')}
                            className="text-[9px] font-bold underline hover:text-emerald-300"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Category: Recently Used */}
                  {activeCategory === 'recent' && (
                    <motion.div
                      key="recent"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <p className="text-[10px] text-slate-400">Recently selected backgrounds on this workspace:</p>
                      {recentWallpapers.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-4">No recently applied wallpapers found.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {recentWallpapers.map((rId, idx) => {
                            const isSelected = selectedWallpaper === rId;
                            const cardStyles = getWallpaperStyles(rId);
                            const label = rId.startsWith('data:') 
                              ? 'Uploaded Image' 
                              : rId.startsWith('linear-gradient') 
                                ? 'Custom Gradient' 
                                : presetWallpapers.find(p => p.id === rId)?.name || 'Custom Theme';
                            return (
                              <button
                                key={`${rId}-${idx}`}
                                onClick={() => setSelectedWallpaper(rId)}
                                className={`aspect-video rounded-2xl overflow-hidden relative border transition-all cursor-pointer group flex flex-col justify-end text-left p-2.5 ${
                                  isSelected 
                                    ? 'border-indigo-500 ring-2 ring-indigo-500/45' 
                                    : 'border-slate-200/10 hover:border-indigo-500/50 hover:scale-[1.02]'
                                }`}
                              >
                                <div className={`absolute inset-0 z-0 ${cardStyles.className}`} style={cardStyles.style} />
                                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors z-5" />

                                <div className="relative z-10 flex items-center justify-between w-full">
                                  <span className="text-[9px] font-bold text-white tracking-tight truncate max-w-[80%] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs font-mono">
                                    {label}
                                  </span>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-slate-950/80 shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: Dynamic Live Preview Canvas */}
            <div className={`w-full md:w-[320px] p-5 border-t md:border-t-0 md:border-l ${isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50/50'} flex flex-col justify-between flex-shrink-0 min-h-0`}>
              <div className="flex-1 flex flex-col min-h-0">
                <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">
                  Live Preview
                </span>

                {/* Simulated mobile/chat container with selected wallpaper background */}
                <div 
                  className={`flex-1 min-h-[220px] rounded-2xl border ${isDark ? 'border-slate-800' : 'border-slate-300'} relative overflow-hidden flex flex-col justify-between shadow-inner ${currentPreviewStyles.className}`}
                  style={currentPreviewStyles.style}
                >
                  {/* Mock Chat Header */}
                  <div className="p-2.5 bg-slate-950/70 border-b border-slate-200/10 backdrop-blur-md flex items-center gap-2 relative z-10">
                    <img src={chat.avatar} alt="Avatar" className="w-6 h-6 rounded-lg object-cover" />
                    <div className="text-left overflow-hidden">
                      <p className="text-[9px] font-extrabold text-white truncate leading-tight">{chat.name}</p>
                      <p className="text-[7px] text-emerald-400 leading-none mt-0.5 animate-pulse">Encrypted Session</p>
                    </div>
                  </div>

                  {/* Mock Chat Conversation Body */}
                  <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-end overflow-hidden relative z-10">
                    {/* Partner Message bubble */}
                    <div className="flex items-start gap-1.5 max-w-[85%] self-start text-left">
                      <div className="p-2.5 rounded-2xl rounded-tl-xs bg-slate-900/80 border border-slate-200/10 text-[9px] leading-relaxed text-slate-200 backdrop-blur-md shadow-md">
                        <p className="font-semibold text-indigo-400 text-[8px] mb-0.5">@{chat.isGroup ? 'member' : 'contact'}</p>
                        <span>How does this new wallpaper look in our private session? 🌌</span>
                      </div>
                    </div>

                    {/* Self Message bubble */}
                    <div className="flex items-end gap-1.5 max-w-[85%] self-end text-right">
                      <div className="p-2.5 rounded-2xl rounded-tr-xs bg-indigo-600/90 text-[9px] leading-relaxed text-white shadow-md">
                        <span>Looks absolutely magnificent! Pristine contrast and premium layout. Let's lock this in! 🔒</span>
                      </div>
                    </div>
                  </div>

                  {/* Mock Input Bar */}
                  <div className="p-2 bg-slate-950/60 border-t border-slate-200/10 backdrop-blur-md flex gap-1 relative z-10">
                    <div className="flex-1 bg-slate-900/50 rounded-lg px-2 py-1 border border-slate-200/5 text-left">
                      <span className="text-[8px] text-slate-500">Secure dispatch envelope...</span>
                    </div>
                    <div className="w-5 h-5 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons panel */}
              <div className="space-y-2 mt-4 flex-shrink-0 text-xs font-bold">
                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-extrabold cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Apply to {chat.isGroup ? 'Group' : 'Chat'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="py-2.5 rounded-xl border border-dashed border-red-500/30 text-red-400 hover:bg-red-500/10 active:scale-[0.98] transition-all font-bold cursor-pointer flex items-center justify-center gap-1 text-[10px]"
                    title="Reset to global workspace default style"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Default</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className={`py-2.5 rounded-xl font-bold active:scale-[0.98] transition-all cursor-pointer text-[10px] border ${
                      isDark 
                        ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
