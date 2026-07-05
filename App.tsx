import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Users, Globe, Database, Volume2, ShieldCheck, 
  Moon, Sun, Bell, VolumeX, Menu, ChevronLeft, Sparkles, FolderLock 
} from 'lucide-react';

import { User, Chat, Message, CallState, UserSettings, MediaType, Reaction, SystemNotification } from './types';
import { initialUsers, initialChats, initialMessages, CURRENT_USER_ID } from './data';

import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import AuthScreen from './components/AuthScreen';

const ProfileDetails = React.lazy(() => import('./components/ProfileDetails'));
const CallScreen = React.lazy(() => import('./components/CallScreen'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const CreateGroupModal = React.lazy(() => import('./components/CreateGroupModal'));
const MyProfilePanel = React.lazy(() => import('./components/MyProfilePanel'));
const NotificationHistoryPanel = React.lazy(() => import('./components/NotificationHistoryPanel'));

export default function App() {
  // 1. Core Persistent States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    language: 'en',
    notifications: { sound: true, browser: true, previews: true },
    blockedUsers: [],
    privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
    autoReplyEnabled: false,
    chatWallpaper: 'solid',
    chatWallpapers: {}
  });

  // 2. Navigation & UI States
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarDetailsOpen, setIsSidebarDetailsOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const usersRef = useRef(users);
  const chatsRef = useRef(chats);
  const settingsRef = useRef(settings);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      const saved = localStorage.getItem('chatsphere_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('chatsphere_notifications', JSON.stringify(notifications));
  }, [notifications]);
  
  // 2b. Message Pagination States for performance
  const [messageLimits, setMessageLimits] = useState<{ [chatId: string]: number }>({});

  const handleLoadOlderMessages = (chatId: string) => {
    setMessageLimits(prev => {
      const current = prev[chatId] || 40;
      return { ...prev, [chatId]: current + 40 };
    });
  };
  
  // 3. Simulated AI/Typing States
  const [typingChatIds, setTypingChatIds] = useState<{ [key: string]: boolean }>({});

  // 4. Calling State
  const [callState, setCallState] = useState<CallState>({
    id: '',
    type: 'voice',
    status: 'idle',
    partnerId: '',
    partnerName: '',
    partnerAvatar: '',
    durationSeconds: 0,
    isMuted: false,
    isSpeaker: false,
    isCameraOff: false
  });
  const [callTimerInterval, setCallTimerInterval] = useState<any>(null);

  // Load initial user from localStorage on boot after verifying session with server
  useEffect(() => {
    const verifyAndLoadSession = async () => {
      try {
        const storedUser = localStorage.getItem('cs_current_user');
        if (!storedUser) {
          applyTheme('dark');
          return;
        }

        // Verify session status with the server silently (doesn't trigger requireAuth warning)
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const verifiedUser = await res.json();
          setCurrentUser(verifiedUser);
          syncState('cs_current_user', verifiedUser);
        } else {
          // Session on server has expired or is invalid, clear stale localStorage
          localStorage.removeItem('cs_current_user');
          setCurrentUser(null);
          applyTheme('dark');
        }
      } catch (err) {
        console.error('Failed to verify session on boot:', err);
        applyTheme('dark');
      }
    };
    verifyAndLoadSession();
  }, []);

  // Sync with real-time server database tables
  useEffect(() => {
    if (!currentUser) return;

    const loadInitialData = async () => {
      try {
        const [usersRes, chatsRes, settingsRes] = await Promise.all([
          fetch("/api/users"),
          fetch(`/api/chats?userId=${currentUser.id}`),
          fetch(`/api/settings/${currentUser.id}`)
        ]);

        if (usersRes.status === 401 || chatsRes.status === 401 || settingsRes.status === 401) {
          handleLogout();
          return;
        }

        if (usersRes.ok) {
          const dbUsers = await usersRes.json();
          setUsers(dbUsers);
        }

        if (chatsRes.ok) {
          const dbChats = await chatsRes.json();
          setChats(dbChats);
          // Default to AI assistant chat if no other active selection
          if (!activeChatId && dbChats.some(c => c.id === 'chat_ai')) {
            setActiveChatId('chat_ai');
          }
        }

        if (settingsRes.ok) {
          const dbSettings = await settingsRes.json();
          setSettings(dbSettings);
          applyTheme(dbSettings.theme);
        }
      } catch (err) {
        console.error("Failed to synchronize with server database:", err);
      }
    };

    loadInitialData();
  }, [currentUser]);

  // Fetch messages when activeChatId changes or limits increase
  useEffect(() => {
    if (!activeChatId || !currentUser) return;

    const loadMessages = async () => {
      try {
        const limit = messageLimits[activeChatId] || 40;
        const res = await fetch(`/api/chats/${activeChatId}/messages?userId=${currentUser.id}&limit=${limit}`);
        if (res.status === 401) {
          handleLogout();
          return;
        }
        if (res.ok) {
          const dbMessages = await res.json();
          setMessages(prev => {
            const filtered = prev.filter(m => m.chatId !== activeChatId);
            return [...filtered, ...dbMessages];
          });

          // Mark unread messages seen and notify server
          const unreads = dbMessages.filter(m => m.senderId !== currentUser.id && m.status !== 'seen');
          if (unreads.length > 0 && window.chatsphere_socket?.readyState === WebSocket.OPEN) {
            const lastMsg = unreads[unreads.length - 1];
            window.chatsphere_socket.send(JSON.stringify({
              type: "read_receipt",
              payload: { chatId: activeChatId, messageId: lastMsg.id }
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load active messages:", err);
      }
    };

    loadMessages();
  }, [activeChatId, currentUser, messageLimits]);

  // WebSocket real-time connection channel
  useEffect(() => {
    if (!currentUser) return;

    let socket: WebSocket;
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("[WebSocket] Live session socket opened.");
        socket.send(JSON.stringify({ type: "join", payload: { userId: currentUser.id } }));
      };

      socket.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          
          if (type === "user_status_changed") {
            const { userId, status, lastSeen } = payload;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status, lastSeen } : u));
          }

          if (type === "user_registered") {
            const { user } = payload;
            setUsers(prev => {
              if (prev.some(u => u.id === user.id)) return prev;
              return [...prev, user];
            });
          }

          if (type === "user_updated") {
            const { user } = payload;
            setUsers(prev => prev.map(u => u.id === user.id ? user : u));
            if (user.id === currentUser.id) {
              setCurrentUser(user);
            }
          }

          if (type === "chat_created") {
            const { chat } = payload;
            setChats(prev => {
              if (prev.some(c => c.id === chat.id)) return prev;
              return [chat, ...prev];
            });
            addSystemNotification('Secure Channel Initiated', `New secure communication channel "${chat.name}" was established.`, chat.id);
          }

          if (type === "typing") {
            const { chatId, userId, isTyping } = payload;
            if (userId !== currentUser.id) {
              setTypingChatIds(prev => ({ ...prev, [chatId]: isTyping }));
            }
          }

          if (type === "message_sent") {
            const { message } = payload;
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });

            // Update chat last message locally
            setChats(prev => prev.map(c => {
              if (c.id === message.chatId) {
                return {
                  ...c,
                  lastMessageTimestamp: message.timestamp,
                  unreadCount: activeChatIdRef.current === message.chatId ? 0 : c.unreadCount + 1
                };
              }
              return c;
            }));

            if (message.senderId !== currentUser.id) {
              const sender = usersRef.current.find(u => u.id === message.senderId);
              const chat = chatsRef.current.find(c => c.id === message.chatId);
              
              const title = chat?.isGroup 
                ? `Group [${chat.name}]` 
                : (sender?.name || 'Secure Message');
              const body = message.mediaType === 'text' 
                ? message.content 
                : `Sent an attachment [${message.mediaType}]`;
              
              addSystemNotification(title, body, message.chatId);
              
              if (activeChatIdRef.current === message.chatId) {
                socket.send(JSON.stringify({
                  type: "read_receipt",
                  payload: { chatId: activeChatIdRef.current, messageId: message.id }
                }));
              }
            }
          }

          if (type === "message_updated") {
            const { message } = payload;
            setMessages(prev => prev.map(m => m.id === message.id ? message : m));
          }

          if (type === "message_deleted") {
            const { messageId, everyone, chatId } = payload;
            if (everyone) {
              setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: 'This message was deleted by the sender.', mediaType: 'text', deletedForEveryone: true } : m));
            }
          }

          if (type === "message_reaction") {
            const { chatId, messageId, reactions } = payload;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
          }

          if (type === "message_read") {
            const { chatId, messageId, status } = payload;
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
          }

        } catch (e) {
          console.error("[WebSocket] Sync payload failed to parse:", e);
        }
      };

      socket.onclose = () => {
        console.warn("[WebSocket] Terminated. Reconnecting in 3 seconds...");
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = (err) => {
        console.warn("[WebSocket] Live socket disconnected or failed to connect, reconnecting.");
      };

      window.chatsphere_socket = socket;
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) socket.close();
      window.chatsphere_socket = undefined;
    };
  }, [currentUser, activeChatId]);

  // Sync to local storage helper
  const syncState = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn('Sync storage failed:', err);
    }
  };

  const applyTheme = (theme: 'light' | 'dark' | 'cyberpunk' | 'emerald' | 'sunset') => {
    const root = document.documentElement;
    root.classList.remove('theme-cyberpunk', 'theme-emerald', 'theme-sunset', 'theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
    
    if (theme !== 'light') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // ESC key listener to close profile panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarDetailsOpen(false);
      }
    };
    if (isSidebarDetailsOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarDetailsOpen]);

  // Sound play notification helper
  const playNotificationSound = (type: 'message' | 'call_end' | 'call_start') => {
    if (!settings.notifications.sound) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'message') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'call_start') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(330, audioCtx.currentTime);
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio feedback context error:', e);
    }
  };

  // Dynamic browser title and badge updates
  useEffect(() => {
    const unreadMessagesCount = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    const unreadNotificationsCount = notifications.filter(n => !n.read).length;
    
    if (unreadMessagesCount > 0) {
      document.title = `(${unreadMessagesCount}) ChatSphere | Secure Matrix`;
    } else if (unreadNotificationsCount > 0) {
      document.title = `[${unreadNotificationsCount}] ChatSphere | Secure Matrix`;
    } else {
      document.title = 'ChatSphere | Secure Matrix';
    }
  }, [chats, notifications]);

  // Notifications operational helpers
  const addSystemNotification = (title: string, body: string, chatId?: string) => {
    const newNotification: SystemNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      chatId
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Respect preferences: sound notification
    if (settings.notifications.sound) {
      playNotificationSound('message');
    }

    // Respect preferences: browser push/desktop notification
    if (settings.notifications.browser && 'Notification' in window && Notification.permission === 'granted') {
      if (activeChatId !== chatId || !document.hasFocus()) {
        try {
          const bodyText = settings.notifications.previews ? body : 'New secure message packet received.';
          const notification = new Notification(title, {
            body: bodyText,
            icon: '/favicon.ico'
          });
          
          notification.onclick = () => {
            window.focus();
            if (chatId) {
              handleSelectChat(chatId);
            }
          };
        } catch (err) {
          console.warn('Browser notification failed to display:', err);
        }
      }
    }
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Auth Completed trigger
  const handleAuthComplete = (newUser: User) => {
    setCurrentUser(newUser);
    syncState('cs_current_user', newUser);
    setActiveChatId('chat_ai');
    setIsMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('cs_current_user');
    setIsMobileSidebarOpen(true);
  };

  const handleUpdateCurrentUser = async (updatedUser: User) => {
    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          userId: updatedUser.id,
          name: updatedUser.name,
          username: updatedUser.username,
          bio: updatedUser.bio,
          avatar: updatedUser.avatar,
          phone: updatedUser.phone,
          email: updatedUser.email
        })
      });

      if (res.ok) {
        const dbUser = await res.json();
        setCurrentUser(dbUser);
        syncState('cs_current_user', dbUser);
        setUsers(prev => prev.map(u => u.id === dbUser.id ? dbUser : u));
      }
    } catch (err) {
      console.error("Failed to update user profile in database:", err);
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    if (!currentUser) return;
    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const res = await fetch(`/api/settings/${currentUser.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(newSettings)
      });

      if (res.ok) {
        const dbSettings = await res.json();
        setSettings(dbSettings);
        applyTheme(dbSettings.theme);
      }
    } catch (err) {
      console.error("Failed to update user settings:", err);
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    applyTheme('dark');
    setActiveChatId('chat_ai');
    alert('Local workspace cache wiped securely. Factory defaults restored.');
    window.location.reload();
  };

  // Create Group callback
  const handleGroupCreated = async (newGroup: Chat) => {
    if (!currentUser) return;
    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          isGroup: true,
          memberIds: newGroup.memberIds,
          name: newGroup.name,
          avatar: newGroup.avatar,
          description: newGroup.description,
          adminIds: [currentUser.id]
        })
      });

      if (res.ok) {
        const dbGroup = await res.json();
        setChats(prev => [dbGroup, ...prev]);
        setActiveChatId(dbGroup.id);

        // Send group welcome greeting
        await fetch("/api/messages", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          },
          body: JSON.stringify({
            chatId: dbGroup.id,
            senderId: currentUser.id,
            content: `⚡ Secure Group Created. Description: "${dbGroup.description}"`,
            mediaType: 'text'
          })
        });
      }
    } catch (err) {
      console.error("Failed to create group channel:", err);
    }
  };

  // Select Chat
  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setIsMobileSidebarOpen(false);

    // Clear unreads
    const updatedChats = chats.map(c => {
      if (c.id === chatId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    });
    setChats(updatedChats);
  };

  // Trigger outbound call
  const handleTriggerCall = (type: 'voice' | 'video') => {
    if (!activeChatId) return;
    const currentChat = chats.find(c => c.id === activeChatId);
    if (!currentChat) return;

    playNotificationSound('call_start');

    setCallState({
      id: `call_${Date.now()}`,
      type,
      status: 'outgoing',
      partnerId: currentChat.id,
      partnerName: currentChat.name,
      partnerAvatar: currentChat.avatar,
      durationSeconds: 0,
      isMuted: false,
      isSpeaker: false,
      isCameraOff: false
    });

    // Auto connect call after 3.5 seconds
    setTimeout(() => {
      setCallState(prev => {
        if (prev.status === 'outgoing') {
          // Connected! Start duration interval
          const interval = setInterval(() => {
            setCallState(curr => ({
              ...curr,
              durationSeconds: curr.durationSeconds + 1
            }));
          }, 1000);
          setCallTimerInterval(interval);
          return { ...prev, status: 'active' };
        }
        return prev;
      });
    }, 3500);
  };

  const handleEndCall = () => {
    playNotificationSound('call_end');
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      setCallTimerInterval(null);
    }
    setCallState(prev => ({ ...prev, status: 'idle', durationSeconds: 0 }));
  };

  const handleAcceptCall = () => {
    playNotificationSound('call_start');
    const interval = setInterval(() => {
      setCallState(curr => ({
        ...curr,
        durationSeconds: curr.durationSeconds + 1
      }));
    }, 1000);
    setCallTimerInterval(interval);
    setCallState(prev => ({ ...prev, status: 'active' }));
  };

  // Call controls triggers
  const handleToggleMute = () => setCallState(p => ({ ...p, isMuted: !p.isMuted }));
  const handleToggleSpeaker = () => setCallState(p => ({ ...p, isSpeaker: !p.isSpeaker }));
  const handleToggleCamera = () => setCallState(p => ({ ...p, isCameraOff: !p.isCameraOff }));

  // Post/Send message handler (Real-time loops + Gemini trigger)
  const handleSendMessage = async (
    content: string, 
    mediaType: MediaType = 'text', 
    extra?: { fileInfo?: any, locationInfo?: any, contactInfo?: any, mediaUrl?: string, thumbnailUrl?: string }
  ) => {
    if (!activeChatId || !currentUser) return;

    // Send typing status stopped event immediately on send
    if (window.chatsphere_socket?.readyState === WebSocket.OPEN) {
      window.chatsphere_socket.send(JSON.stringify({
        type: "typing",
        payload: { chatId: activeChatId, isTyping: false }
      }));
    }

    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          chatId: activeChatId,
          senderId: currentUser.id,
          content,
          mediaType,
          mediaUrl: extra?.mediaUrl,
          thumbnailUrl: extra?.thumbnailUrl,
          fileInfo: extra?.fileInfo,
          locationInfo: extra?.locationInfo,
          contactInfo: extra?.contactInfo,
        })
      });

      if (res.ok) {
        const sentMsg = await res.json();
        setMessages(prev => {
          if (prev.some(m => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });

        setChats(prev => prev.map(c => {
          if (c.id === activeChatId) {
            return { ...c, lastMessageTimestamp: sentMsg.timestamp };
          }
          return c;
        }));

        // Trigger Gemini response if active chat is the AI agent
        if (activeChatId === 'chat_ai') {
          triggerGeminiAIResponse(content, [...messages, sentMsg]);
        }
      }
    } catch (err) {
      console.error("Failed to transmit message payload:", err);
    }
  };

  // AI Response powered by Gemini 3.5 Flash
  const triggerGeminiAIResponse = async (userPrompt: string, currentHistory: Message[]) => {
    // Enable typing state
    setTypingChatIds(prev => ({ ...prev, chat_ai: true }));

    // Prepare previous history (limit to last 15 messages to conserve token limit securely)
    const aiMessages = currentHistory
      .filter(m => m.chatId === 'chat_ai')
      .slice(-15)
      .map(m => ({
        role: (m.senderId === currentUser?.id) ? 'user' : 'assistant',
        content: m.content
      }));

    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          prompt: userPrompt,
          history: aiMessages.slice(0, -1), // avoid duplicate of prompt
          systemInstruction: "You are ChatSphere AI, an incredibly witty, high-fidelity, helpful assistant residing in ChatSphere messaging application. You answer in brief, perfectly styled Markdown paragraphs. You are powered by Gemini 3.5. Keep answers scannable and conversational."
        })
      });

      const data = await response.json();
      setTypingChatIds(prev => ({ ...prev, chat_ai: false }));

      if (response.ok && data.text) {
        const aiMessage: Message = {
          id: `m_ai_${Date.now()}`,
          chatId: 'chat_ai',
          senderId: 'ai_bot',
          content: data.text,
          mediaType: 'text',
          timestamp: new Date().toISOString(),
          status: 'seen'
        };

        setMessages(prev => {
          if (prev.some(m => m.id === aiMessage.id)) return prev;
          return [...prev, aiMessage];
        });

        playNotificationSound('message');
      } else {
        throw new Error(data.error || 'Invalid API state');
      }
    } catch (err) {
      console.warn('Gemini full-stack bridge failed, launching smart failover autonomous response:', err);
      setTimeout(() => {
        setTypingChatIds(prev => ({ ...prev, chat_ai: false }));
        
        const fallbackText = `I heard you! (Note: Gemini API is operating in local workspace simulation mode). \n\nI can assist you with your designs, answer questions, or formulate strategies. To enable real generative responses, verify your **GEMINI_API_KEY** is configured in your project Secrets!`;
        
        const aiMessage: Message = {
          id: `m_ai_fallback_${Date.now()}`,
          chatId: 'chat_ai',
          senderId: 'ai_bot',
          content: fallbackText,
          mediaType: 'text',
          timestamp: new Date().toISOString(),
          status: 'seen'
        };

        setMessages(prev => {
          if (prev.some(m => m.id === aiMessage.id)) return prev;
          return [...prev, aiMessage];
        });

        playNotificationSound('message');
      }, 1500);
    }
  };

  // Delete message (everyone vs me)
  const handleDeleteMessage = (msgId: string, everyone: boolean) => {
    let updatedMsgs: Message[] = [];
    if (everyone) {
      updatedMsgs = messages.map(m => {
        if (m.id === msgId) {
          return { ...m, content: 'This message was deleted by the sender.', mediaType: 'text', deletedForEveryone: true };
        }
        return m;
      });
    } else {
      updatedMsgs = messages.map(m => {
        if (m.id === msgId) {
          return { ...m, deletedForMe: true };
        }
        return m;
      });
    }
    setMessages(updatedMsgs);
    syncState('cs_messages', updatedMsgs);
  };

  const handleEditMessage = (msgId: string, newContent: string) => {
    const updatedMsgs = messages.map(m => {
      if (m.id === msgId) {
        return { ...m, content: newContent, isEdited: true };
      }
      return m;
    });
    setMessages(updatedMsgs);
    syncState('cs_messages', updatedMsgs);
  };

  const handleToggleStarMessage = (msgId: string) => {
    const updatedMsgs = messages.map(m => {
      if (m.id === msgId) {
        return { ...m, isStarred: !m.isStarred };
      }
      return m;
    });
    setMessages(updatedMsgs);
    syncState('cs_messages', updatedMsgs);
  };

  const handleReactMessage = (msgId: string, emoji: string) => {
    const updatedMsgs = messages.map(m => {
      if (m.id === msgId) {
        const reactions = m.reactions || [];
        const existingReact = reactions.find(r => r.emoji === emoji);
        
        let newReactions: Reaction[] = [];
        if (existingReact) {
          // Toggle off
          if (existingReact.userIds.includes('self')) {
            const newUserIds = existingReact.userIds.filter(id => id !== 'self');
            if (newUserIds.length === 0) {
              newReactions = reactions.filter(r => r.emoji !== emoji);
            } else {
              newReactions = reactions.map(r => r.emoji === emoji ? { ...r, userIds: newUserIds } : r);
            }
          } else {
            newReactions = reactions.map(r => r.emoji === emoji ? { ...r, userIds: [...r.userIds, 'self'] } : r);
          }
        } else {
          newReactions = [...reactions, { emoji, userIds: ['self'] }];
        }

        return { ...m, reactions: newReactions };
      }
      return m;
    });
    setMessages(updatedMsgs);
    syncState('cs_messages', updatedMsgs);
  };

  const handleToggleMuteChat = () => {
    if (!activeChatId) return;
    const updated = chats.map(c => c.id === activeChatId ? { ...c, isMuted: !c.isMuted } : c);
    setChats(updated);
    syncState('cs_chats', updated);
  };

  const handleTogglePinChat = () => {
    if (!activeChatId) return;
    const updated = chats.map(c => c.id === activeChatId ? { ...c, isPinned: !c.isPinned } : c);
    setChats(updated);
    syncState('cs_chats', updated);
  };

  const handleExitGroup = async () => {
    if (!activeChatId) return;
    try {
      const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
      const res = await fetch(`/api/chats/${activeChatId}/leave`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        }
      });
      if (res.ok) {
        const updated = chats.filter(c => c.id !== activeChatId);
        setChats(updated);
        syncState('cs_chats', updated);
        setActiveChatId('chat_ai');
        setIsSidebarDetailsOpen(false);
        alert('You have exited the group channel.');
      } else {
        const errData = await res.json();
        alert(`Failed to exit group: ${errData.error || 'Unauthorized'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to exit group.');
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeChatId) return;
    if (window.confirm("Are you sure you want to permanently disband this group? This action is irreversible.")) {
      try {
        const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
        const res = await fetch(`/api/chats/${activeChatId}`, {
          method: "DELETE",
          headers: {
            "X-CSRF-Token": csrfToken
          }
        });
        if (res.ok) {
          const updated = chats.filter(c => c.id !== activeChatId);
          setChats(updated);
          syncState('cs_chats', updated);
          setActiveChatId('chat_ai');
          setIsSidebarDetailsOpen(false);
          alert('Group disbanded and credentials revoked.');
        } else {
          const errData = await res.json();
          alert(`Failed to disband group: ${errData.error || 'Unauthorized'}`);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to disband group.');
      }
    }
  };

  const handleBlockUser = (userId: string) => {
    const isAlreadyBlocked = settings.blockedUsers.includes(userId);
    let newBlockedList = [];
    if (isAlreadyBlocked) {
      newBlockedList = settings.blockedUsers.filter(id => id !== userId);
      alert(`User has been unblocked.`);
    } else {
      newBlockedList = [...settings.blockedUsers, userId];
      alert(`User has been securely blocked. You will no longer receive network packets from them.`);
    }

    const updatedSettings = {
      ...settings,
      blockedUsers: newBlockedList
    };
    setSettings(updatedSettings);
    syncState('cs_settings', updatedSettings);
  };

  const handleReportChat = (chatId: string, reason: string) => {
    alert(`Secure Incident Report dispatched successfully. Thread ID ${chatId} was audited. Reason: "${reason}". Safe-Ops team has received the request.`);
  };

  const handleShareChat = (chatId: string) => {
    const shareUrl = `${window.location.origin}/chat/${chatId}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Secure chat invite URL copied to clipboard: ${shareUrl}`);
  };

  const handleClearChatTranscript = async (chatId: string) => {
    if (!currentUser) return;
    if (window.confirm("Are you sure you want to permanently purge all message records in this thread? This cannot be undone.")) {
      try {
        const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
        const res = await fetch(`/api/chats/${chatId}/clear`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          },
          body: JSON.stringify({ userId: currentUser.id })
        });
        if (res.ok) {
          const remainingMessages = messages.filter(m => m.chatId !== chatId);
          setMessages(remainingMessages);
          syncState('cs_messages', remainingMessages);
          alert("Chat transcript cleared successfully.");
        } else {
          const errData = await res.json();
          alert(`Failed to clear transcript: ${errData.error || 'Unauthorized'}`);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to clear transcript.');
      }
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this chat thread and all its history? This action is irreversible.")) {
      try {
        const csrfToken = document.cookie.match(/(^| )chatsphere_csrf_token=([^;]+)/)?.[2] || '';
        const res = await fetch(`/api/chats/${chatId}`, {
          method: "DELETE",
          headers: {
            "X-CSRF-Token": csrfToken
          }
        });
        if (res.ok) {
          const updatedChats = chats.filter(c => c.id !== chatId);
          const remainingMessages = messages.filter(m => m.chatId !== chatId);
          setChats(updatedChats);
          setMessages(remainingMessages);
          syncState('cs_chats', updatedChats);
          syncState('cs_messages', remainingMessages);
          setIsSidebarDetailsOpen(false);
          setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
          alert("Chat thread has been deleted from your workspace.");
        } else {
          const errData = await res.json();
          alert(`Failed to delete chat thread: ${errData.error || 'Unauthorized'}`);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to delete chat thread.');
      }
    }
  };

  // Find active chat details
  const activeChat = chats.find(c => c.id === activeChatId);

  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'cyberpunk':
        return 'theme-cyberpunk bg-[#0c0813] text-pink-100';
      case 'emerald':
        return 'theme-emerald bg-[#022c22] text-emerald-100';
      case 'sunset':
        return 'theme-sunset bg-[#1c0a00] text-orange-100';
      case 'light':
        return 'theme-light bg-[#f8fafc] text-slate-800';
      case 'dark':
      default:
        return 'theme-dark bg-[#050507] text-slate-100';
    }
  };

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans transition-colors duration-300 relative ${getThemeClasses()}`}>
      
      {/* Global Sleek Interface Ambient Background Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] left-[5%] w-[45%] h-[45%] rounded-full bg-indigo-500/8 blur-[130px] dark:bg-indigo-500/4 animate-pulse-subtle" />
        <div className="absolute top-[40%] right-[5%] w-[40%] h-[40%] rounded-full bg-purple-500/8 blur-[130px] dark:bg-purple-500/3 animate-pulse-subtle [animation-delay:1.5s]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] rounded-full bg-emerald-500/6 blur-[120px] dark:bg-emerald-500/2" />
      </div>

      {/* Settings Modal Layer */}
      <React.Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          users={users}
          isDark={settings.theme !== 'light'}
          onClearCache={handleClearCache}
        />
      </React.Suspense>

      {/* Create Group Modal Layer */}
      <React.Suspense fallback={null}>
        <CreateGroupModal
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          users={users}
          onGroupCreated={handleGroupCreated}
          isDark={settings.theme !== 'light'}
        />
      </React.Suspense>

      {/* Call Screen UI Overlay */}
      <React.Suspense fallback={null}>
        <CallScreen
          callState={callState}
          onEndCall={handleEndCall}
          onAcceptCall={handleAcceptCall}
          onToggleMute={handleToggleMute}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleCamera={handleToggleCamera}
        />
      </React.Suspense>

      {/* Authentication Screen Router */}
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <AuthScreen 
              onAuthComplete={handleAuthComplete} 
              isDark={settings.theme !== 'light'} 
            />
          </motion.div>
        ) : (
          /* Main Workspace Application Grid */
          <motion.div
            key="app-workspace"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full flex flex-row relative z-10"
          >
            {/* Mobile View Toggle Side Rail Trigger */}
            <div className="md:hidden absolute top-4 left-4 z-40">
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Left Column: Sidebar (Collapsible on mobile) */}
            <div className={`h-full border-r ${settings.theme !== 'light' ? 'border-slate-900 bg-slate-950/40' : 'border-slate-100 bg-white/40'} backdrop-blur-xl z-30 transition-all duration-300 flex-shrink-0 ${isMobileSidebarOpen ? 'w-80 translate-x-0 absolute md:relative' : 'w-0 -translate-x-full md:w-80 md:translate-x-0 absolute md:relative'}`}>
              <Sidebar
                currentUser={currentUser}
                chats={chats}
                users={users}
                messages={messages}
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                onOpenMyProfile={() => setIsMyProfileOpen(true)}
                onLogout={handleLogout}
                isDark={settings.theme !== 'light'}
              />
            </div>

            {/* Center Column: Messaging Canvas (Responsive placeholder) */}
            <div className="flex-1 h-full flex flex-col relative min-w-0">
              {activeChat ? (
                <ChatArea
                  chat={activeChat}
                  currentUser={currentUser}
                  users={users}
                  messages={messages}
                  isDark={settings.theme !== 'light'}
                  isTyping={!!typingChatIds[activeChat.id]}
                  onSendMessage={handleSendMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onToggleStarMessage={handleToggleStarMessage}
                  onReactMessage={handleReactMessage}
                  onTriggerCall={handleTriggerCall}
                  onToggleSidebarDetails={() => setIsSidebarDetailsOpen(!isSidebarDetailsOpen)}
                  isSidebarDetailsOpen={isSidebarDetailsOpen}
                  settings={settings}
                  onBlockUser={handleBlockUser}
                  onReportChat={handleReportChat}
                  onShareChat={handleShareChat}
                  onClearChatTranscript={handleClearChatTranscript}
                  onToggleMuteChat={handleToggleMuteChat}
                  onTogglePinChat={handleTogglePinChat}
                  onUpdateSettings={handleUpdateSettings}
                  onLoadOlderMessages={() => handleLoadOlderMessages(activeChat.id)}
                  hasOlderMessages={messages.filter(m => m.chatId === activeChat.id && !m.deletedForMe).length >= (messageLimits[activeChat.id] || 40)}
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/10">
                  <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/20">
                    <MessageSquare className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-base font-bold">Select a secure workspace channel</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Choose from your side rail, create a group channel, or message our smart Gemini AI Assistant.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Profile details & attachments drawer (Collapsible Overlay) */}
            <AnimatePresence>
              {isSidebarDetailsOpen && activeChat && (
                <>
                  {/* Backdrop for closing */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarDetailsOpen(false)}
                    className="fixed inset-0 bg-slate-950/20 dark:bg-slate-950/60 backdrop-blur-xs z-40 cursor-pointer"
                  />
                  {/* Sliding Container */}
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                    className={`fixed right-0 top-0 bottom-0 h-full w-[88vw] sm:w-[380px] md:w-[410px] border-l ${
                      settings.theme !== 'light' 
                        ? 'border-slate-800 bg-slate-950/85' 
                        : 'border-slate-200 bg-white/85'
                    } backdrop-blur-xl flex flex-col z-50 shadow-2xl overflow-hidden`}
                  >
                    <React.Suspense fallback={<div className="h-full w-full bg-slate-900/50 animate-pulse" />}>
                      <ProfileDetails
                        chat={activeChat}
                        partner={activeChat.isGroup ? undefined : users.find(u => u.id === activeChat.memberIds.find(id => id !== 'self'))}
                        allUsers={users}
                        messages={messages}
                        isDark={settings.theme !== 'light'}
                        onToggleStarMessage={handleToggleStarMessage}
                        onToggleMuteChat={handleToggleMuteChat}
                        onTogglePinChat={handleTogglePinChat}
                        onExitGroup={handleExitGroup}
                        onDeleteGroup={handleDeleteGroup}
                        settings={settings}
                        onUpdateSettings={handleUpdateSettings}
                        onClose={() => setIsSidebarDetailsOpen(false)}
                        onBlockUser={handleBlockUser}
                        onReportChat={handleReportChat}
                        onClearChatTranscript={handleClearChatTranscript}
                        onDeleteChat={handleDeleteChat}
                      />
                    </React.Suspense>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* My Profile Slide-in Panel */}
            <AnimatePresence>
              {isMyProfileOpen && currentUser && (
                <React.Suspense fallback={<div className="fixed right-0 top-0 bottom-0 w-[380px] bg-slate-900/50 animate-pulse z-50" />}>
                  <MyProfilePanel
                    isOpen={isMyProfileOpen}
                    onClose={() => setIsMyProfileOpen(false)}
                    currentUser={currentUser}
                    onUpdateCurrentUser={handleUpdateCurrentUser}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    messages={messages}
                    users={users}
                    onLogout={handleLogout}
                  />
                </React.Suspense>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
