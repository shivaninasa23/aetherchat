import { User, Chat, Message } from './types';

export const CURRENT_USER_ID = 'self';

export const initialUsers: User[] = [
  {
    id: CURRENT_USER_ID,
    name: 'Alex Rivera',
    username: 'alex_rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Product Designer & Full-stack dev. Building the future of communication 🚀',
    status: 'online',
    phone: '+1 (555) 019-2831',
    email: 'alex.rivera@chatsphere.io',
    createdDate: 'Jan 12, 2025'
  },
  {
    id: 'ai_bot',
    name: 'ChatSphere AI',
    username: 'chatsphere_ai',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Your advanced artificial intelligence assistant, powered by Gemini 3.5. Ask me anything!',
    status: 'online',
    phone: '+1 (800) AI-SPHERE',
    email: 'assistant@chatsphere.ai',
    createdDate: 'Feb 01, 2026'
  },
  {
    id: 'sarah',
    name: 'Sarah Jenkins',
    username: 'sarah_design',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Lead Designer @ ChatSphere. Crafting pixels with absolute love ✨',
    status: 'online',
    phone: '+1 (555) 014-9988',
    email: 'sarah.j@chatsphere.io',
    createdDate: 'Mar 15, 2025'
  },
  {
    id: 'marcus',
    name: 'Marcus Vance',
    username: 'marcus_v',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Product Manager. Coffee enthusiast. Let’s ship this on Monday!',
    status: 'away',
    lastSeen: '10m ago',
    phone: '+1 (555) 017-3344',
    email: 'marcus.v@chatsphere.io',
    createdDate: 'Apr 10, 2025'
  },
  {
    id: 'elena',
    name: 'Elena Rostova',
    username: 'elena_rust',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Systems Architect. Rust & Go lover. I deal with concurrency and high loads.',
    status: 'offline',
    lastSeen: '2h ago',
    phone: '+1 (555) 012-7766',
    email: 'elena.r@chatsphere.io',
    createdDate: 'Jun 22, 2025'
  },
  {
    id: 'liam',
    name: 'Liam Neeson',
    username: 'liam_sec',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    bio: 'Security Operations. "I will find your bugs, and I will patch them."',
    status: 'online',
    phone: '+1 (555) 019-4455',
    email: 'liam.n@chatsphere.io',
    createdDate: 'Sep 05, 2025'
  }
];

export const initialChats: Chat[] = [
  {
    id: 'chat_ai',
    isGroup: false,
    name: 'ChatSphere AI',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80',
    description: 'Autonomous AI Assistant. Answers questions, analyzes files, and acts as your personalized assistant.',
    memberIds: [CURRENT_USER_ID, 'ai_bot'],
    adminIds: [],
    lastMessageTimestamp: '2026-07-04T01:00:00Z',
    unreadCount: 0,
    isPinned: true,
  },
  {
    id: 'group_launch',
    isGroup: true,
    name: '🚀 Launchpad Core Team',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80',
    description: 'Official group chat for ChatSphere launch coordination, designs, and security audits.',
    memberIds: [CURRENT_USER_ID, 'sarah', 'marcus', 'elena', 'liam'],
    adminIds: ['marcus'],
    lastMessageTimestamp: '2026-07-04T00:55:00Z',
    unreadCount: 3,
  },
  {
    id: 'chat_sarah',
    isGroup: false,
    name: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    description: 'One-to-one conversation with Sarah Jenkins.',
    memberIds: [CURRENT_USER_ID, 'sarah'],
    adminIds: [],
    lastMessageTimestamp: '2026-07-04T00:45:00Z',
    unreadCount: 0,
  },
  {
    id: 'chat_marcus',
    isGroup: false,
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    description: 'One-to-one conversation with Marcus Vance.',
    memberIds: [CURRENT_USER_ID, 'marcus'],
    adminIds: [],
    lastMessageTimestamp: '2026-07-03T18:30:00Z',
    unreadCount: 0,
  }
];

export const initialMessages: Message[] = [
  // Chat AI
  {
    id: 'm_ai_1',
    chatId: 'chat_ai',
    senderId: 'ai_bot',
    content: 'Welcome to ChatSphere! I am your AI companion powered by **Gemini 3.5**. I can answer questions, summarize text, draft notes, or help you brainstorm. Try sending me a message!',
    mediaType: 'text',
    timestamp: '2026-07-04T01:00:00Z',
    status: 'seen',
  },

  // Group Launch messages
  {
    id: 'm_g_1',
    chatId: 'group_launch',
    senderId: 'marcus',
    content: 'Team, we are T-minus 48 hours from our public alpha demo. Everyone feeling confident?',
    mediaType: 'text',
    timestamp: '2026-07-03T23:30:00Z',
    status: 'seen',
  },
  {
    id: 'm_g_2',
    chatId: 'group_launch',
    senderId: 'sarah',
    content: 'Absolutely! I just wrapped up the brand-new micro-interactions and glassmorphic layouts. Check this out, it feels so fluid:',
    mediaType: 'text',
    timestamp: '2026-07-03T23:35:00Z',
    status: 'seen',
  },
  {
    id: 'm_g_3',
    chatId: 'group_launch',
    senderId: 'sarah',
    content: 'ChatSphere Dashboard UI Spec',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=400&q=80',
    timestamp: '2026-07-03T23:36:00Z',
    status: 'seen',
  },
  {
    id: 'm_g_4',
    chatId: 'group_launch',
    senderId: 'elena',
    content: 'Backend is fully optimized. Express + WebSockets are scaling beautifully. Liam, how did the penetration testing go?',
    mediaType: 'text',
    timestamp: '2026-07-04T00:50:00Z',
    status: 'seen',
  },
  {
    id: 'm_g_5',
    chatId: 'group_launch',
    senderId: 'liam',
    content: 'Audited all routes, JWT auth schemas, and socket channels. Secure as a vault. Sharing the final security assessment document below.',
    mediaType: 'text',
    timestamp: '2026-07-04T00:52:00Z',
    status: 'seen',
  },
  {
    id: 'm_g_6',
    chatId: 'group_launch',
    senderId: 'liam',
    content: 'Security_Audit_v1.4.pdf',
    mediaType: 'file',
    mediaUrl: '#',
    fileInfo: {
      name: 'Security_Audit_v1.4.pdf',
      size: '2.4 MB',
      extension: 'pdf'
    },
    timestamp: '2026-07-04T00:53:00Z',
    status: 'delivered',
  },
  {
    id: 'm_g_7',
    chatId: 'group_launch',
    senderId: 'sarah',
    content: '🔥 Love it! Let’s crush this launch.',
    mediaType: 'text',
    timestamp: '2026-07-04T00:55:00Z',
    status: 'sent',
  },

  // Sarah chat messages
  {
    id: 'm_s_1',
    chatId: 'chat_sarah',
    senderId: 'sarah',
    content: 'Hey Alex! Did you take a look at the custom stickers I drew for ChatSphere?',
    mediaType: 'text',
    timestamp: '2026-07-04T00:40:00Z',
    status: 'seen',
  },
  {
    id: 'm_s_2',
    chatId: 'chat_sarah',
    senderId: 'sarah',
    content: 'Sticker: Space Panda Rocket',
    mediaType: 'sticker',
    mediaUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=150&h=150&q=80',
    timestamp: '2026-07-04T00:41:00Z',
    status: 'seen',
  },
  {
    id: 'm_s_3',
    chatId: 'chat_sarah',
    senderId: 'self',
    content: 'Oh wow Sarah, that Space Panda is absolutely amazing! I will integrate it into our sticker drawer immediately.',
    mediaType: 'text',
    timestamp: '2026-07-04T00:44:00Z',
    status: 'seen',
  },
  {
    id: 'm_s_4',
    chatId: 'chat_sarah',
    senderId: 'sarah',
    content: 'Awesome! Let me know if we need any other design assets for the call overlay or files drawer.',
    mediaType: 'text',
    timestamp: '2026-07-04T00:45:00Z',
    status: 'seen',
  },

  // Marcus chat messages
  {
    id: 'm_m_1',
    chatId: 'chat_marcus',
    senderId: 'marcus',
    content: 'Hey Alex, here is the coordinates of the coffee shop we are meeting tomorrow morning for the breakfast check-in:',
    mediaType: 'text',
    timestamp: '2026-07-03T18:25:00Z',
    status: 'seen',
  },
  {
    id: 'm_m_2',
    chatId: 'chat_marcus',
    senderId: 'marcus',
    content: 'Stumptown Coffee Roasters, Portland, OR',
    mediaType: 'location',
    locationInfo: {
      latitude: 45.5228,
      longitude: -122.6566,
      address: '1026 SW Stark St, Portland, OR 97205'
    },
    timestamp: '2026-07-03T18:28:00Z',
    status: 'seen',
  },
  {
    id: 'm_m_3',
    chatId: 'chat_marcus',
    senderId: 'self',
    content: 'Perfect, see you there at 9 AM!',
    mediaType: 'text',
    timestamp: '2026-07-03T18:30:00Z',
    status: 'seen',
  }
];

export const stickerList = [
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=150&h=150&q=80', // space panda
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=150&h=150&q=80', // cute anime cat
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=150&h=150&q=80', // nebula
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=150&h=150&q=80', // magical clover
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=150&h=150&q=80', // golden leaf
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=150&h=150&q=80', // electric glitch
];

export const gifList = [
  { name: 'Shipped It!', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3N5YTNwYzRlcnMxZTVuMDlkMzl2ZHJiaXJ1ODRhNTR1dWU3azZvaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2S3Aj8OeK40c0/giphy.gif' },
  { name: 'Thumbs Up', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWRhMmV0MDllZWh6dHA0Nmh0dnI1YTVtdTZnbWZ1cm5rbThzOHAwMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NXS3HBC/giphy.gif' },
  { name: 'Happy Dance', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzB2M2NzbzZ4ODUwdHlyd3F2Z2h4ZXpxdWYyZTVrZWFtN2lyajRkNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3vRlTGCyCOhyUOiA/giphy.gif' },
  { name: 'Mind Blown', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTV5M3pjN280a3l4ZW9nZzV0M2pvaWk4ejcwcWJmd3kzbXZ4ZHMyYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipOdXMclvMGc/giphy.gif' },
];

export interface WallpaperPreset {
  id: string;
  name: string;
  type: 'pattern' | 'image';
  value: string;
}

export const presetWallpapers: WallpaperPreset[] = [
  { id: 'solid', name: 'Slate Solid', type: 'pattern', value: 'solid' },
  { id: 'stars', name: 'Cosmic Stars', type: 'pattern', value: 'stars' },
  { id: 'nodes', name: 'Grid Nodes', type: 'pattern', value: 'nodes' },
  { id: 'sunset-glow', name: 'Sunset Radiance', type: 'pattern', value: 'sunset-glow' },
  { id: 'matrix', name: 'Emerald Matrix', type: 'pattern', value: 'matrix' },
  { id: 'nebula', name: 'Nebula Deep Space', type: 'image', value: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=1200&q=80' },
  { id: 'cyberpunk', name: 'Cyber City Lights', type: 'image', value: 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&w=1200&q=80' },
  { id: 'mountains', name: 'Minimalist Mountains', type: 'image', value: 'https://images.unsplash.com/photo-1486873249359-2731bd6dafc7?auto=format&fit=crop&w=1200&q=80' },
  { id: 'clouds', name: 'Dreamy Pastel Clouds', type: 'image', value: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1200&q=80' }
];

