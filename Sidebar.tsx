import React, { useState } from 'react';
import { 
  Search, Pin, VolumeX, MessageSquare, Plus, Settings, LogOut,
  Sparkles, Filter, Archive, CheckCheck, FolderKanban, ShieldAlert,
  UserCheck
} from 'lucide-react';
import { Chat, User, Message } from '../types';

interface SidebarProps {
  currentUser: User;
  chats: Chat[];
  users: User[];
  messages: Message[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onOpenCreateGroup: () => void;
  onOpenMyProfile: () => void;
  onLogout: () => void;
  isDark: boolean;
}

type FilterType = 'all' | 'personal' | 'groups' | 'unread' | 'pinned';

export default function Sidebar({
  currentUser,
  chats,
  users,
  messages,
  activeChatId,
  onSelectChat,
  onOpenSettings,
  onOpenCreateGroup,
  onOpenMyProfile,
  onLogout,
  isDark
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter and search logic
  const filteredChats = chats.filter((chat) => {
    // 1. Search Query filter (matches chat name or description)
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (chat.description && chat.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    // 2. Active Tab Filters
    if (activeFilter === 'pinned') return chat.isPinned;
    if (activeFilter === 'groups') return chat.isGroup;
    if (activeFilter === 'personal') return !chat.isGroup;
    if (activeFilter === 'unread') return chat.unreadCount > 0;
    
    return true; // 'all' filter
  });

  // Sort chats: Pinned first, then by last message timestamp (most recent first)
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    const timeA = new Date(a.lastMessageTimestamp).getTime();
    const timeB = new Date(b.lastMessageTimestamp).getTime();
    return timeB - timeA;
  });

  // Helper to find last message in a chat
  const getLastMessage = (chatId: string): Message | null => {
    const chatMsgs = messages.filter(m => m.chatId === chatId && !m.deletedForEveryone);
    if (chatMsgs.length === 0) return null;
    return chatMsgs[chatMsgs.length - 1];
  };

  // Helper to format last message timestamp
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
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Helper to render last message preview
  const renderMessagePreview = (chatId: string) => {
    const lastMsg = getLastMessage(chatId);
    if (!lastMsg) return <span className="text-slate-400 italic">No messages yet</span>;
    
    // If message is deleted
    if (lastMsg.deletedForEveryone) {
      return <span className="text-slate-400 italic">This message was deleted</span>;
    }

    const sender = users.find(u => u.id === lastMsg.senderId);
    const prefix = (lastMsg.senderId === currentUser.id || lastMsg.senderId === 'self') ? 'You: ' : sender ? `${sender.name.split(' ')[0]}: ` : '';

    if (lastMsg.mediaType === 'text') {
      return <span>{prefix}{lastMsg.content}</span>;
    }
    if (lastMsg.mediaType === 'image') {
      return <span className="text-indigo-400 font-medium">📷 Image Attachment</span>;
    }
    if (lastMsg.mediaType === 'gif') {
      return <span className="text-indigo-400 font-medium">✨ GIF Animation</span>;
    }
    if (lastMsg.mediaType === 'sticker') {
      return <span className="text-indigo-400 font-medium">🌸 Sticker</span>;
    }
    if (lastMsg.mediaType === 'file') {
      return <span className="text-purple-400 font-medium">📁 Document file</span>;
    }
    if (lastMsg.mediaType === 'location') {
      return <span className="text-emerald-400 font-medium">📍 Live Location</span>;
    }
    if (lastMsg.mediaType === 'contact') {
      return <span className="text-amber-400 font-medium">👤 Contact Profile</span>;
    }
    if (lastMsg.mediaType === 'voice') {
      return <span className="text-emerald-400 font-medium">🎙️ Voice Note</span>;
    }

    return <span>{lastMsg.content}</span>;
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-transparent select-none">
      
      {/* Upper Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* User Profile Header (Glassmorphic Top) */}
        <div className={`p-4 flex justify-between items-center border-b ${isDark ? 'border-slate-900/40 bg-transparent' : 'border-slate-100/40 bg-transparent'}`}>
          <div 
            onClick={onOpenMyProfile}
            title="My Profile"
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all group select-none"
          >
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-2xl object-cover border border-indigo-500/10 shadow-md group-hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold leading-tight truncate max-w-[110px] group-hover:text-indigo-400 transition-colors">{currentUser.name}</span>
              <span className="text-[10px] text-emerald-500 font-bold font-mono tracking-wide uppercase">ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* My Profile Button */}
            <button
              onClick={onOpenMyProfile}
              title="My Profile"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <UserCheck className="h-4.5 w-4.5" />
            </button>

            {/* Create Group FAB */}
            <button
              onClick={onOpenCreateGroup}
              title="Assemble Group Channel"
              className="p-2 rounded-xl text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              title="Settings Preferences"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              title="Terminate Secure Session"
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Search Conversation Bar */}
        <div className="p-4">
          <div className={`relative flex items-center rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-800/80 focus-within:border-indigo-500' : 'bg-slate-100/50 border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white'} transition-all`}>
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats, files, links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-3 pl-10 pr-4 bg-transparent outline-hidden focus:ring-0"
            />
          </div>
        </div>

        {/* Filters Panel Horizontal Scroller */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {[
            { id: 'all', label: 'All' },
            { id: 'personal', label: 'Direct' },
            { id: 'groups', label: 'Groups' },
            { id: 'pinned', label: 'Pinned' },
            { id: 'unread', label: 'Unread' },
          ].map((filt) => (
            <button
              key={filt.id}
              onClick={() => setActiveFilter(filt.id as any)}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap border ${activeFilter === filt.id ? 'bg-indigo-500 text-white border-transparent shadow-md shadow-indigo-500/20' : 'border-slate-200/40 dark:border-slate-800/40 hover:bg-slate-100/10 hover:text-indigo-500'}`}
            >
              {filt.label}
            </button>
          ))}
        </div>

        {/* Recent Chats Scroller List */}
        <div className="flex-1 overflow-y-auto space-y-1 px-2.5">
          {sortedChats.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-3">
                <FolderKanban className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold">No channels match query</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">
                Create a group or search for active members above.
              </p>
            </div>
          ) : (
            sortedChats.map((chat) => {
              const isActive = activeChatId === chat.id;
              const lastMsg = getLastMessage(chat.id);
              const unread = chat.unreadCount > 0;
              
              // Find partner user metadata for direct chat
              let partnerUser: User | undefined;
              if (!chat.isGroup) {
                const partnerId = chat.memberIds.find(id => id !== currentUser.id);
                partnerUser = users.find(u => u.id === partnerId);
              }

              const resolvedChatAvatar = chat.isGroup ? chat.avatar : (partnerUser?.avatar || chat.avatar);
              const resolvedChatName = chat.isGroup ? chat.name : (partnerUser?.name || chat.name);

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`group flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${isActive ? 'bg-indigo-600 border-transparent text-white shadow-lg shadow-indigo-600/20' : isDark ? 'hover:bg-slate-900/60 border-transparent text-slate-200' : 'hover:bg-slate-50 border-transparent text-slate-800'}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar with Status Pin */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={resolvedChatAvatar}
                        alt={resolvedChatName}
                        className={`w-10 h-10 rounded-2xl object-cover ${isActive ? 'border-2 border-white' : 'border border-slate-200/20'}`}
                        referrerPolicy="no-referrer"
                      />
                      {/* Only display online indicator for non-groups and if not active selected to save visual space */}
                      {!chat.isGroup && partnerUser && partnerUser.status !== 'offline' && (
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 ${isActive ? 'border-indigo-600' : 'border-white dark:border-slate-950'} ${partnerUser.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      )}
                    </div>

                    {/* Chat Name and Msg Preview */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {chat.isGroup && <FolderKanban className={`h-3 w-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-indigo-400'}`} />}
                        {chat.id === 'chat_ai' && <Sparkles className={`h-3 w-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-indigo-400 animate-pulse'}`} />}
                        <span className={`text-xs font-bold truncate leading-tight ${unread && !isActive ? 'text-slate-900 dark:text-white font-extrabold' : ''}`}>
                          {resolvedChatName}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate mt-1 leading-tight ${isActive ? 'text-indigo-100' : unread ? 'text-indigo-500 dark:text-indigo-400 font-semibold' : 'text-slate-400'}`}>
                        {renderMessagePreview(chat.id)}
                      </p>
                    </div>
                  </div>

                  {/* Badges Right and Timestamp */}
                  <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
                    <span className={`text-[9px] font-mono leading-none ${isActive ? 'text-indigo-100' : unread ? 'text-indigo-500 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                      {lastMsg ? formatTime(lastMsg.timestamp) : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      {chat.isPinned && <Pin className={`h-3 w-3 ${isActive ? 'text-white' : 'text-indigo-400 rotate-45'}`} />}
                      {chat.isMuted && <VolumeX className="h-3 w-3 text-slate-400" />}
                      {unread && !isActive && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white px-1 shadow-md animate-pulse">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Micro Status Margin Footer */}
      <div className={`p-3 text-center border-t text-[10px] font-mono tracking-wider ${isDark ? 'border-slate-900/40 bg-transparent text-slate-500' : 'border-slate-100/40 bg-transparent text-slate-400'}`}>
        <span>CHATSPHERE CONNECTED SSL SECURE</span>
      </div>
    </div>
  );
}
