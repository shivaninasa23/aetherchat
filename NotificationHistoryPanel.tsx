import React from 'react';
import { motion } from 'motion/react';
import { X, CheckCheck, Trash2, Bell, Check, ExternalLink, ShieldAlert, ShieldCheck, MessageSquare, Info } from 'lucide-react';
import { SystemNotification, UserSettings } from '../types';

interface NotificationHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectChat?: (chatId: string) => void;
  settings: UserSettings;
}

export default function NotificationHistoryPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectChat,
  settings
}: NotificationHistoryPanelProps) {
  const isDark = settings.theme !== 'light';

  // Helper to format timestamp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.95 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className={`fixed right-0 top-0 bottom-0 w-[380px] max-w-full z-50 shadow-2xl flex flex-col border-l transition-all duration-300 ${
        isDark 
          ? 'bg-slate-950/95 border-slate-900 text-slate-100 backdrop-blur-xl' 
          : 'bg-white/95 border-slate-200 text-slate-800 backdrop-blur-xl'
      }`}
    >
      {/* Panel Header */}
      <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-slate-900' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold tracking-tight">Security Alerts & Log</span>
            <span className="text-[10px] font-mono text-slate-400">
              {unreadCount} pending, {notifications.length} logged
            </span>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-900' : 'text-slate-500 hover:text-black hover:bg-slate-100'
          }`}
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Action Controls Bar */}
      {notifications.length > 0 && (
        <div className={`px-4 py-2.5 flex items-center justify-between border-b text-[11px] font-mono ${
          isDark ? 'bg-slate-900/30 border-slate-900/60' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            onClick={onMarkAllAsRead}
            className={`flex items-center gap-1.5 font-bold transition-colors cursor-pointer ${
              isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'
            }`}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
          </button>
          
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 text-rose-500 hover:text-rose-400 transition-colors font-bold cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Purge Logs
          </button>
        </div>
      )}

      {/* Notifications Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-6">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 border ${
              isDark ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'
            }`}>
              <ShieldCheck className="h-6 w-6 opacity-60" />
            </div>
            <p className="text-xs font-bold">Chronology Clear</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
              No secure network alerts or offline session notifications recorded.
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.read;
            const isCall = notif.title.toLowerCase().includes('call');
            const isChat = notif.chatId !== undefined;

            return (
              <div
                key={notif.id}
                className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                  isUnread
                    ? isDark 
                      ? 'bg-slate-900/40 border-indigo-500/20 shadow-md shadow-indigo-500/5'
                      : 'bg-indigo-50/30 border-indigo-100 shadow-md shadow-indigo-100/5'
                    : isDark
                      ? 'bg-slate-950/40 border-slate-900/60 text-slate-300'
                      : 'bg-white border-slate-100 text-slate-600'
                }`}
              >
                {/* Unread Accent Bar */}
                {isUnread && (
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />
                )}

                <div className="flex items-start gap-2.5">
                  {/* Left Icon Badge based on alert category */}
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                    isUnread
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : isDark
                        ? 'bg-slate-900/40 text-slate-400 border-slate-800/40'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    {isCall ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : isChat ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-bold truncate leading-snug ${
                        isUnread ? 'text-indigo-400' : isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {notif.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 flex-shrink-0">
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>
                    
                    <p className={`text-[10px] leading-relaxed mt-1 break-words ${
                      isUnread ? 'text-slate-200 dark:text-slate-100 font-medium' : 'text-slate-400'
                    }`}>
                      {notif.body}
                    </p>

                    {/* Navigation or Mark Read footer controls */}
                    <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-200/10 text-[10px] font-mono">
                      {isChat && notif.chatId && onSelectChat && (
                        <button
                          onClick={() => {
                            if (notif.chatId) {
                              onSelectChat(notif.chatId);
                              onMarkAsRead(notif.id);
                              onClose();
                            }
                          }}
                          className={`flex items-center gap-1 font-bold tracking-tight transition-colors cursor-pointer ${
                            isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'
                          }`}
                        >
                          <ExternalLink className="h-3 w-3" /> Connect Secure Route
                        </button>
                      )}

                      {isUnread && (
                        <button
                          onClick={() => onMarkAsRead(notif.id)}
                          className={`flex items-center gap-1 font-bold ml-auto transition-colors cursor-pointer ${
                            isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'
                          }`}
                        >
                          <Check className="h-3 w-3" /> Mark Read
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Status Footer */}
      <div className={`p-4 text-center border-t text-[9px] font-mono tracking-wider uppercase opacity-60 ${
        isDark ? 'border-slate-900 bg-slate-950' : 'border-slate-100 bg-slate-50'
      }`}>
        🔒 Chatsphere Secure Protocol Active
      </div>
    </motion.div>
  );
}
