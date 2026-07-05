export type UserStatus = 'online' | 'offline' | 'away' | 'dnd';

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  status: UserStatus;
  lastSeen?: string;
  isBlocked?: boolean;
  phone?: string;
  email?: string;
  createdDate?: string;
}

export type MediaType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'voice' 
  | 'file' 
  | 'location' 
  | 'contact' 
  | 'sticker' 
  | 'gif';

export interface FileInfo {
  name: string;
  size: string;
  extension?: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  mediaType: MediaType;
  mediaUrl?: string;
  thumbnailUrl?: string;
  fileInfo?: FileInfo;
  locationInfo?: LocationInfo;
  contactInfo?: ContactInfo;
  timestamp: string;
  status: 'sent' | 'delivered' | 'seen';
  replyToId?: string; // ID of the message being replied to
  isEdited?: boolean;
  isStarred?: boolean;
  deletedForEveryone?: boolean;
  deletedForMe?: boolean;
  reactions?: Reaction[];
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name: string;
  avatar: string;
  description?: string;
  memberIds: string[];
  adminIds: string[]; // only relevant for groups
  lastMessageTimestamp: string;
  unreadCount: number;
  isMuted?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface CallState {
  id: string;
  type: 'voice' | 'video';
  status: 'idle' | 'incoming' | 'outgoing' | 'active';
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  durationSeconds: number;
  isMuted: boolean;
  isSpeaker: boolean;
  isCameraOff: boolean;
}

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  chatId?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'cyberpunk' | 'emerald' | 'sunset';
  language: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';
  notifications: {
    sound: boolean;
    browser: boolean;
    previews: boolean;
  };
  blockedUsers: string[]; // User IDs
  privacy: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    readReceipts: boolean;
  };
  autoReplyEnabled?: boolean;
  chatWallpaper?: string; // CSS style or image url
  chatThemeColor?: string; // tailwind color class or hex value
  chatWallpapers?: { [chatId: string]: string }; // per-chat custom wallpapers mapping
  twoFactorEnabled?: boolean;
}

declare global {
  interface Window {
    chatsphere_socket?: WebSocket;
  }
}
