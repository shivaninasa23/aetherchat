import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { User, Chat, Message, SystemNotification, UserSettings } from "./src/types";
import { Logger } from "./server-logger";

const DB_FILE = path.join(process.cwd(), "database.json");

export interface UserCredential {
  email: string;
  passwordHash: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  failedAttempts: number;
  lockUntil?: string;
}

export interface PendingRegistration {
  email: string;
  passwordHash: string;
  fullName: string;
  verificationCode: string;
  verificationCodeExpires: string;
}

export interface UserSession {
  id: string;
  userId: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

interface DatabaseSchema {
  users: { [id: string]: User };
  chats: { [id: string]: Chat };
  messages: Message[];
  notifications: SystemNotification[];
  settings: { [userId: string]: UserSettings };
  credentials: { [email: string]: UserCredential };
  pendingRegistrations: { [email: string]: PendingRegistration };
  sessions: { [sessionId: string]: UserSession };
  uploads?: { [sha256: string]: { filename: string; originalName: string; mimeType: string; size: number; thumbnail?: string } };
}

// Default settings helper
function createDefaultSettings(userId: string): UserSettings {
  return {
    theme: "dark",
    language: "en",
    notifications: { sound: true, browser: true, previews: true },
    blockedUsers: [],
    privacy: { lastSeen: "everyone", profilePhoto: "everyone", readReceipts: true },
    autoReplyEnabled: true,
    chatWallpaper: "solid",
    chatWallpapers: {},
  };
}

// Initial seed data to populate the database tables on first launch (so we have a live team to message)
const seedUsers: User[] = [
  {
    id: "ai_bot",
    name: "ChatSphere AI",
    username: "chatsphere_ai",
    avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Your advanced artificial intelligence assistant, powered by Gemini. Ask me anything!",
    status: "online",
    phone: "+1 (800) AI-SPHERE",
    email: "assistant@chatsphere.ai",
    createdDate: "Feb 01, 2026",
  },
  {
    id: "sarah",
    name: "Sarah Jenkins",
    username: "sarah_design",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Lead Designer @ ChatSphere. Crafting pixels with absolute love ✨",
    status: "online",
    phone: "+1 (555) 014-9988",
    email: "sarah@chatsphere.io",
    createdDate: "Mar 15, 2025",
  },
  {
    id: "marcus",
    name: "Marcus Vance",
    username: "marcus_v",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Product Manager. Coffee enthusiast. Let’s ship this on Monday!",
    status: "away",
    lastSeen: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    phone: "+1 (555) 017-3344",
    email: "marcus@chatsphere.io",
    createdDate: "Apr 10, 2025",
  },
  {
    id: "elena",
    name: "Elena Rostova",
    username: "elena_rust",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Systems Architect. Rust & Go lover. I deal with concurrency and high loads.",
    status: "offline",
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    phone: "+1 (555) 012-7766",
    email: "elena@chatsphere.io",
    createdDate: "Jun 22, 2025",
  },
  {
    id: "liam",
    name: "Liam Neeson",
    username: "liam_sec",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Security Operations. \"I will find your bugs, and I will patch them.\"",
    status: "online",
    phone: "+1 (555) 019-4455",
    email: "liam@chatsphere.io",
    createdDate: "Sep 05, 2025",
  },
  {
    id: "alex_rivera",
    name: "Alex Rivera",
    username: "alex_rivera",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    bio: "Hey there! I am using ChatSphere.",
    status: "online",
    phone: "+1 (555) 011-2233",
    email: "demo@chatsphere.io",
    createdDate: "Jul 04, 2026",
  },
];

class FileDatabase {
  private cache: DatabaseSchema = {
    users: {},
    chats: {},
    messages: [],
    notifications: [],
    settings: {},
    credentials: {},
    pendingRegistrations: {},
    sessions: {},
  };

  // --- Optimized In-Memory Index Maps ---
  private userByEmailIndex = new Map<string, User>();
  private userByUsernameIndex = new Map<string, User>();
  private chatByIdIndex = new Map<string, Chat>();
  private chatsByMemberIndex = new Map<string, Set<string>>(); // userId -> Set of chatIds
  private messagesByChatIndex = new Map<string, Message[]>();  // chatId -> messages array
  private settingsByUserIdIndex = new Map<string, UserSettings>();
  private credentialsByEmailIndex = new Map<string, UserCredential>();
  private credentialsByResetTokenIndex = new Map<string, UserCredential>();
  private sessionsBySessionIdIndex = new Map<string, UserSession>();
  private sessionsByUserIdIndex = new Map<string, Set<string>>(); // userId -> Set of sessionIds
  private notificationsByUserIdIndex = new Map<string, SystemNotification[]>(); // userId -> notifications array

  constructor() {
    this.load();
  }

  private rebuildIndexes() {
    this.userByEmailIndex.clear();
    this.userByUsernameIndex.clear();
    this.chatByIdIndex.clear();
    this.chatsByMemberIndex.clear();
    this.messagesByChatIndex.clear();
    this.settingsByUserIdIndex.clear();
    this.credentialsByEmailIndex.clear();
    this.credentialsByResetTokenIndex.clear();
    this.sessionsBySessionIdIndex.clear();
    this.sessionsByUserIdIndex.clear();
    this.notificationsByUserIdIndex.clear();

    // Index Users
    if (this.cache.users) {
      for (const u of Object.values(this.cache.users)) {
        if (u.email) this.userByEmailIndex.set(u.email.toLowerCase(), u);
        this.userByUsernameIndex.set(u.username.toLowerCase(), u);
      }
    }

    // Index Chats
    if (this.cache.chats) {
      for (const c of Object.values(this.cache.chats)) {
        this.chatByIdIndex.set(c.id, c);
        for (const mId of c.memberIds) {
          if (!this.chatsByMemberIndex.has(mId)) {
            this.chatsByMemberIndex.set(mId, new Set());
          }
          this.chatsByMemberIndex.get(mId)!.add(c.id);
        }
      }
    }

    // Index Messages
    if (this.cache.messages) {
      for (const m of this.cache.messages) {
        if (!this.messagesByChatIndex.has(m.chatId)) {
          this.messagesByChatIndex.set(m.chatId, []);
        }
        this.messagesByChatIndex.get(m.chatId)!.push(m);
      }
    }

    // Index Settings
    if (this.cache.settings) {
      for (const [uId, s] of Object.entries(this.cache.settings)) {
        this.settingsByUserIdIndex.set(uId, s);
      }
    }

    // Index Credentials
    if (this.cache.credentials) {
      for (const [email, cred] of Object.entries(this.cache.credentials)) {
        this.credentialsByEmailIndex.set(email.toLowerCase(), cred);
        if (cred.resetToken) {
          this.credentialsByResetTokenIndex.set(cred.resetToken, cred);
        }
      }
    }

    // Index Sessions
    if (this.cache.sessions) {
      for (const [sId, s] of Object.entries(this.cache.sessions)) {
        this.sessionsBySessionIdIndex.set(sId, s);
        if (!this.sessionsByUserIdIndex.has(s.userId)) {
          this.sessionsByUserIdIndex.set(s.userId, new Set());
        }
        this.sessionsByUserIdIndex.get(s.userId)!.add(sId);
      }
    }

    // Index Notifications
    if (this.cache.notifications) {
      for (const n of this.cache.notifications) {
        const uId = n.id.split('_')[0];
        if (uId) {
          if (!this.notificationsByUserIdIndex.has(uId)) {
            this.notificationsByUserIdIndex.set(uId, []);
          }
          this.notificationsByUserIdIndex.get(uId)!.push(n);
        }
      }
    }
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.cache = JSON.parse(raw);
        if (!this.cache.credentials) this.cache.credentials = {};
        if (!this.cache.pendingRegistrations) this.cache.pendingRegistrations = {};
        if (!this.cache.sessions) this.cache.sessions = {};
        Logger.info(`Loaded database from file: ${DB_FILE}`);
        this.rebuildIndexes();
      } else {
        this.seed();
      }
    } catch (err) {
      Logger.dbError("Failed to load database from file, starting fresh", err, { filePath: DB_FILE });
      this.seed();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (err) {
      Logger.dbError("Failed to save database to file", err, { filePath: DB_FILE });
    }
  }

  private seed() {
    console.log("[Database] Seeding fresh database...");
    this.cache = {
      users: {},
      chats: {},
      messages: [],
      notifications: [],
      settings: {},
      credentials: {},
      pendingRegistrations: {},
      sessions: {},
    };

    // Add seed users & default credentials hashed
    const defaultHash = bcrypt.hashSync("password123", 10);
    for (const u of seedUsers) {
      this.cache.users[u.id] = u;
      this.cache.settings[u.id] = createDefaultSettings(u.id);
      if (u.email) {
        this.cache.credentials[u.email.toLowerCase()] = {
          email: u.email.toLowerCase(),
          passwordHash: defaultHash,
          isVerified: true,
          failedAttempts: 0
        };
      }
    }

    // Default system conversations
    const systemChats: Chat[] = [
      {
        id: "chat_ai",
        isGroup: false,
        name: "ChatSphere AI",
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        description: "Autonomous AI Assistant. Answers questions, analyzes files, and acts as your personalized assistant.",
        memberIds: ["ai_bot"], // other member IDs will be added dynamically when users start a session
        adminIds: [],
        lastMessageTimestamp: "2026-07-04T01:00:00Z",
        unreadCount: 0,
        isPinned: true,
      },
    ];

    for (const c of systemChats) {
      this.cache.chats[c.id] = c;
    }

    // Initial message from AI companion
    this.cache.messages.push({
      id: "m_ai_1",
      chatId: "chat_ai",
      senderId: "ai_bot",
      content: "Welcome to ChatSphere! I am your AI companion powered by Gemini. I can answer questions, summarize text, draft notes, or help you brainstorm. Try sending me a message!",
      mediaType: "text",
      timestamp: new Date().toISOString(),
      status: "seen",
    });

    this.rebuildIndexes();
    this.save();
  }

  // --- Users Table operations ---
  public getUsers(): User[] {
    return Object.values(this.cache.users);
  }

  public getUser(id: string): User | undefined {
    return this.cache.users[id];
  }

  public getUserByUsername(username: string): User | undefined {
    return this.userByUsernameIndex.get(username.toLowerCase());
  }

  public getUserByEmail(email: string): User | undefined {
    return this.userByEmailIndex.get(email.toLowerCase());
  }

  public addUser(user: User): User {
    this.cache.users[user.id] = user;
    if (user.email) {
      this.userByEmailIndex.set(user.email.toLowerCase(), user);
    }
    this.userByUsernameIndex.set(user.username.toLowerCase(), user);
    if (!this.cache.settings[user.id]) {
      const settings = createDefaultSettings(user.id);
      this.cache.settings[user.id] = settings;
      this.settingsByUserIdIndex.set(user.id, settings);
    }
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User {
    const existing = this.cache.users[id];
    const oldEmail = existing?.email;
    const oldUsername = existing?.username;

    const updated = { ...existing, ...updates, id } as User;
    this.cache.users[id] = updated;

    // Maintain indexes
    if (oldEmail && oldEmail.toLowerCase() !== updated.email?.toLowerCase()) {
      this.userByEmailIndex.delete(oldEmail.toLowerCase());
    }
    if (updated.email) {
      this.userByEmailIndex.set(updated.email.toLowerCase(), updated);
    }

    if (oldUsername && oldUsername.toLowerCase() !== updated.username.toLowerCase()) {
      this.userByUsernameIndex.delete(oldUsername.toLowerCase());
    }
    this.userByUsernameIndex.set(updated.username.toLowerCase(), updated);

    this.save();
    return updated;
  }

  // --- Cascading User Deletion (Foreign Keys Optimization) ---
  public deleteUser(userId: string) {
    if (!this.cache.users[userId]) return;

    // 1. Clean up settings
    delete this.cache.settings[userId];
    this.settingsByUserIdIndex.delete(userId);

    // 2. Clean up credentials
    const user = this.cache.users[userId];
    if (user.email) {
      const lowerEmail = user.email.toLowerCase();
      delete this.cache.credentials[lowerEmail];
      this.credentialsByEmailIndex.delete(lowerEmail);
    }

    // 3. Clean up sessions
    this.deleteSessionsForUser(userId);

    // 4. Clean up notifications
    this.cache.notifications = this.cache.notifications.filter(n => !n.id.startsWith(`${userId}_`));
    this.notificationsByUserIdIndex.delete(userId);

    // 5. Clean up chats and membership index
    const userChats = this.getChatsForUser(userId);
    for (const chat of userChats) {
      if (chat.isGroup) {
        // Remove user from group chat
        const newMembers = chat.memberIds.filter(id => id !== userId);
        const newAdmins = chat.adminIds.filter(id => id !== userId);
        if (newMembers.length === 0) {
          this.deleteChat(chat.id);
        } else {
          this.updateChat(chat.id, { memberIds: newMembers, adminIds: newAdmins });
        }
      } else {
        // Direct messages are deleted when one user is deleted
        this.deleteChat(chat.id);
      }
    }

    // 6. Delete user record and indexes
    delete this.cache.users[userId];
    if (user.email) this.userByEmailIndex.delete(user.email.toLowerCase());
    this.userByUsernameIndex.delete(user.username.toLowerCase());

    this.save();
  }

  // --- Chats Table operations ---
  public getChats(): Chat[] {
    return Object.values(this.cache.chats);
  }

  public getChatsForUser(userId: string): Chat[] {
    const chatIds = this.chatsByMemberIndex.get(userId);
    if (!chatIds) return [];
    
    const chats: Chat[] = [];
    for (const cId of chatIds) {
      const c = this.cache.chats[cId];
      if (c) chats.push(c);
    }
    return chats;
  }

  public getChat(id: string): Chat | undefined {
    return this.cache.chats[id];
  }

  public addChat(chat: Chat): Chat {
    this.cache.chats[chat.id] = chat;
    this.chatByIdIndex.set(chat.id, chat);

    for (const mId of chat.memberIds) {
      if (!this.chatsByMemberIndex.has(mId)) {
        this.chatsByMemberIndex.set(mId, new Set());
      }
      this.chatsByMemberIndex.get(mId)!.add(chat.id);
    }

    this.save();
    return chat;
  }

  public updateChat(id: string, updates: Partial<Chat>): Chat {
    const existing = this.cache.chats[id];
    if (!existing) throw new Error(`Chat ${id} not found`);

    const oldMemberIds = existing.memberIds;
    const updated = { ...existing, ...updates } as Chat;
    this.cache.chats[id] = updated;
    this.chatByIdIndex.set(id, updated);

    // If membership changed, update indexing accordingly
    if (updates.memberIds) {
      const newMemberSet = new Set(updates.memberIds);
      for (const mId of oldMemberIds) {
        if (!newMemberSet.has(mId)) {
          this.chatsByMemberIndex.get(mId)?.delete(id);
        }
      }
      for (const mId of updates.memberIds) {
        if (!this.chatsByMemberIndex.has(mId)) {
          this.chatsByMemberIndex.set(mId, new Set());
        }
        this.chatsByMemberIndex.get(mId)!.add(id);
      }
    }

    this.save();
    return updated;
  }

  public deleteChat(id: string) {
    const chat = this.cache.chats[id];
    if (chat) {
      delete this.cache.chats[id];
      this.chatByIdIndex.delete(id);

      // Clean up membership indexing references
      for (const mId of chat.memberIds) {
        this.chatsByMemberIndex.get(mId)?.delete(id);
      }

      // Also delete all messages for this chat (Cascading Delete / Referential Integrity)
      this.cache.messages = this.cache.messages.filter((m) => m.chatId !== id);
      this.messagesByChatIndex.delete(id);

      this.save();
    }
  }

  // --- Messages Table operations ---
  public getMessages(): Message[] {
    return this.cache.messages;
  }

  public getMessagesForChat(chatId: string): Message[] {
    return this.messagesByChatIndex.get(chatId) || [];
  }

  public getMessage(id: string): Message | undefined {
    // Highly optimized index scan or array search fallback
    const chatId = id.split('_')[0]; // message IDs are formatted like m_ai_1 or m_172021111_1
    if (chatId && this.messagesByChatIndex.has(chatId)) {
      const found = this.messagesByChatIndex.get(chatId)!.find(m => m.id === id);
      if (found) return found;
    }
    return this.cache.messages.find((m) => m.id === id);
  }

  public addMessage(message: Message): Message {
    this.cache.messages.push(message);
    if (!this.messagesByChatIndex.has(message.chatId)) {
      this.messagesByChatIndex.set(message.chatId, []);
    }
    this.messagesByChatIndex.get(message.chatId)!.push(message);
    this.save();
    return message;
  }

  public updateMessage(id: string, updates: Partial<Message>): Message {
    const index = this.cache.messages.findIndex((m) => m.id === id);
    if (index === -1) throw new Error(`Message ${id} not found`);
    
    const original = this.cache.messages[index];
    const updated = { ...original, ...updates } as Message;
    this.cache.messages[index] = updated;

    // Update index references
    const chatMsgs = this.messagesByChatIndex.get(original.chatId);
    if (chatMsgs) {
      const idxInChat = chatMsgs.findIndex(m => m.id === id);
      if (idxInChat !== -1) {
        chatMsgs[idxInChat] = updated;
      }
    }

    this.save();
    return updated;
  }

  // --- Notifications Table operations ---
  public getNotificationsForUser(userId: string): SystemNotification[] {
    return this.notificationsByUserIdIndex.get(userId) || [];
  }

  public addNotification(userId: string, notification: Omit<SystemNotification, "id">): SystemNotification {
    const id = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullNotification = { ...notification, id };
    this.cache.notifications.push(fullNotification);

    if (!this.notificationsByUserIdIndex.has(userId)) {
      this.notificationsByUserIdIndex.set(userId, []);
    }
    this.notificationsByUserIdIndex.get(userId)!.push(fullNotification);

    this.save();
    return fullNotification;
  }

  public markNotificationsAsRead(userId: string) {
    this.cache.notifications = this.cache.notifications.map((n) => {
      if (n.id.startsWith(`${userId}_`)) {
        return { ...n, read: true };
      }
      return n;
    });

    const userNotifs = this.notificationsByUserIdIndex.get(userId);
    if (userNotifs) {
      for (const n of userNotifs) {
        n.read = true;
      }
    }

    this.save();
  }

  // --- Settings Table operations ---
  public getSettings(userId: string): UserSettings {
    let settings = this.settingsByUserIdIndex.get(userId);
    if (!settings) {
      settings = createDefaultSettings(userId);
      this.cache.settings[userId] = settings;
      this.settingsByUserIdIndex.set(userId, settings);
      this.save();
    }
    return settings;
  }

  public updateSettings(userId: string, updates: Partial<UserSettings>): UserSettings {
    const existing = this.getSettings(userId);
    const updated = { ...existing, ...updates } as UserSettings;
    this.cache.settings[userId] = updated;
    this.settingsByUserIdIndex.set(userId, updated);
    this.save();
    return updated;
  }

  public ensureUserSeededConversations(userId: string) {
    if (userId === "ai_bot") return;

    let modified = false;

    // 1. Private AI Chat
    const aiChatId = `chat_ai_${userId}`;
    if (!this.cache.chats[aiChatId]) {
      this.cache.chats[aiChatId] = {
        id: aiChatId,
        isGroup: false,
        name: "ChatSphere AI",
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80",
        description: "Autonomous AI Assistant. Answers questions, analyzes files, and acts as your personalized assistant.",
        memberIds: ["ai_bot", userId],
        adminIds: [],
        lastMessageTimestamp: new Date().toISOString(),
        unreadCount: 0,
        isPinned: true,
      };

      // Seed initial AI message
      this.cache.messages.push({
        id: `m_ai_${userId}_1`,
        chatId: aiChatId,
        senderId: "ai_bot",
        content: "Welcome to ChatSphere! I am your AI companion powered by Gemini. I can answer questions, summarize text, draft notes, or help you brainstorm. Try sending me a message!",
        mediaType: "text",
        timestamp: new Date().toISOString(),
        status: "seen",
      });
      modified = true;
    }

    // 2. Direct Chat with Sarah Jenkins
    const sarahChatId = `chat_sarah_${userId}`;
    if (userId !== "sarah" && !this.cache.chats[sarahChatId]) {
      this.cache.chats[sarahChatId] = {
        id: sarahChatId,
        isGroup: false,
        name: "Sarah Jenkins",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
        description: "One-to-one conversation with Sarah Jenkins.",
        memberIds: [userId, "sarah"],
        adminIds: [],
        lastMessageTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        unreadCount: 0,
      };

      // Seed Sarah's historical messages
      this.cache.messages.push(
        {
          id: `m_s_${userId}_1`,
          chatId: sarahChatId,
          senderId: "sarah",
          content: "Hey! Did you take a look at the custom stickers I drew for ChatSphere?",
          mediaType: "text",
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_s_${userId}_2`,
          chatId: sarahChatId,
          senderId: "sarah",
          content: "Sticker: Space Panda Rocket",
          mediaType: "sticker",
          mediaUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=150&h=150&q=80",
          timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_s_${userId}_3`,
          chatId: sarahChatId,
          senderId: userId,
          content: "Oh wow Sarah, that Space Panda is absolutely amazing! I will integrate it into our sticker drawer immediately.",
          mediaType: "text",
          timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_s_${userId}_4`,
          chatId: sarahChatId,
          senderId: "sarah",
          content: "Awesome! Let me know if we need any other design assets for the call overlay or files drawer.",
          mediaType: "text",
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          status: "seen",
        }
      );
      modified = true;
    }

    // 3. Direct Chat with Marcus Vance
    const marcusChatId = `chat_marcus_${userId}`;
    if (userId !== "marcus" && !this.cache.chats[marcusChatId]) {
      this.cache.chats[marcusChatId] = {
        id: marcusChatId,
        isGroup: false,
        name: "Marcus Vance",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
        description: "One-to-one conversation with Marcus Vance.",
        memberIds: [userId, "marcus"],
        adminIds: [],
        lastMessageTimestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        unreadCount: 0,
      };

      this.cache.messages.push(
        {
          id: `m_m_${userId}_1`,
          chatId: marcusChatId,
          senderId: "marcus",
          content: "Hey, here is the coordinates of the coffee shop we are meeting tomorrow morning for the breakfast check-in:",
          mediaType: "text",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_m_${userId}_2`,
          chatId: marcusChatId,
          senderId: "marcus",
          content: "Stumptown Coffee Roasters, Portland, OR",
          mediaType: "location",
          locationInfo: {
            latitude: 45.5228,
            longitude: -122.6566,
            address: "1026 SW Stark St, Portland, OR 97205"
          },
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_m_${userId}_3`,
          chatId: marcusChatId,
          senderId: userId,
          content: "Perfect, see you there at 9 AM!",
          mediaType: "text",
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          status: "seen",
        }
      );
      modified = true;
    }

    // 4. Group Chat - Launchpad Core Team
    const groupChatId = `group_launch_${userId}`;
    if (!this.cache.chats[groupChatId]) {
      this.cache.chats[groupChatId] = {
        id: groupChatId,
        isGroup: true,
        name: "🚀 Launchpad Core Team",
        avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80",
        description: "Official group chat for ChatSphere launch coordination, designs, and security audits.",
        memberIds: [userId, "sarah", "marcus", "elena", "liam"],
        adminIds: ["marcus"],
        lastMessageTimestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        unreadCount: 3,
      };

      this.cache.messages.push(
        {
          id: `m_g_${userId}_1`,
          chatId: groupChatId,
          senderId: "marcus",
          content: "Team, we are T-minus 48 hours from our public alpha demo. Everyone feeling confident?",
          mediaType: "text",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_g_${userId}_2`,
          chatId: groupChatId,
          senderId: "sarah",
          content: "Absolutely! I just wrapped up the brand-new micro-interactions and glassmorphic layouts. Check this out, it feels so fluid:",
          mediaType: "text",
          timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_g_${userId}_3`,
          chatId: groupChatId,
          senderId: "sarah",
          content: "ChatSphere Dashboard UI Spec",
          mediaType: "image",
          mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=400&q=80",
          timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_g_${userId}_4`,
          chatId: groupChatId,
          senderId: "elena",
          content: "Backend is fully optimized. Express + WebSockets are scaling beautifully. Liam, how did the penetration testing go?",
          mediaType: "text",
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_g_${userId}_5`,
          chatId: groupChatId,
          senderId: "liam",
          content: "Audited all routes, JWT auth schemas, and socket channels. Secure as a vault. Sharing the final security assessment document below.",
          mediaType: "text",
          timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          status: "seen",
        },
        {
          id: `m_g_${userId}_6`,
          chatId: groupChatId,
          senderId: "liam",
          content: "Security_Audit_v1.4.pdf",
          mediaType: "file",
          mediaUrl: "#",
          fileInfo: {
            name: "Security_Audit_v1.4.pdf",
            size: "2.4 MB",
            extension: "pdf"
          },
          timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
          status: "delivered",
        },
        {
          id: `m_g_${userId}_7`,
          chatId: groupChatId,
          senderId: "sarah",
          content: "🔥 Love it! Let’s crush this launch.",
          mediaType: "text",
          timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          status: "sent",
        }
      );
      modified = true;
    }

    if (modified) {
      this.rebuildIndexes();
      this.save();
    }
  }

  // --- Credentials operations ---
  public getCredential(email: string): UserCredential | undefined {
    return this.credentialsByEmailIndex.get(email.toLowerCase());
  }

  public setCredential(email: string, cred: Partial<UserCredential>): UserCredential {
    if (!this.cache.credentials) this.cache.credentials = {};
    const lowerEmail = email.toLowerCase();
    const existing = this.credentialsByEmailIndex.get(lowerEmail) || {
      email: lowerEmail,
      passwordHash: "",
      isVerified: false,
      failedAttempts: 0
    };
    const updated = { ...existing, ...cred } as UserCredential;
    this.cache.credentials[lowerEmail] = updated;
    this.credentialsByEmailIndex.set(lowerEmail, updated);

    if (updated.resetToken) {
      this.credentialsByResetTokenIndex.set(updated.resetToken, updated);
    }

    this.save();
    return updated;
  }

  public deleteCredential(email: string) {
    if (!this.cache.credentials) this.cache.credentials = {};
    const lowerEmail = email.toLowerCase();
    const cred = this.credentialsByEmailIndex.get(lowerEmail);
    if (cred) {
      delete this.cache.credentials[lowerEmail];
      this.credentialsByEmailIndex.delete(lowerEmail);
      if (cred.resetToken) {
        this.credentialsByResetTokenIndex.delete(cred.resetToken);
      }
      this.save();
    }
  }

  public getCredentialByResetToken(token: string): UserCredential | undefined {
    return this.credentialsByResetTokenIndex.get(token);
  }

  // --- Pending Registrations operations ---
  public getPendingRegistration(email: string): PendingRegistration | undefined {
    if (!this.cache.pendingRegistrations) this.cache.pendingRegistrations = {};
    return this.cache.pendingRegistrations[email.toLowerCase()];
  }

  public setPendingRegistration(email: string, reg: PendingRegistration | undefined): PendingRegistration | undefined {
    if (!this.cache.pendingRegistrations) this.cache.pendingRegistrations = {};
    const lowerEmail = email.toLowerCase();
    if (reg === undefined) {
      delete this.cache.pendingRegistrations[lowerEmail];
    } else {
      this.cache.pendingRegistrations[lowerEmail] = reg;
    }
    this.save();
    return reg;
  }

  // --- Sessions operations ---
  public getSession(sessionId: string): UserSession | undefined {
    return this.sessionsBySessionIdIndex.get(sessionId);
  }

  public setSession(sessionId: string, session: UserSession | undefined): UserSession | undefined {
    if (!this.cache.sessions) this.cache.sessions = {};
    const existing = this.sessionsBySessionIdIndex.get(sessionId);

    if (session === undefined) {
      if (existing) {
        delete this.cache.sessions[sessionId];
        this.sessionsBySessionIdIndex.delete(sessionId);
        this.sessionsByUserIdIndex.get(existing.userId)?.delete(sessionId);
      }
    } else {
      this.cache.sessions[sessionId] = session;
      this.sessionsBySessionIdIndex.set(sessionId, session);
      
      if (!this.sessionsByUserIdIndex.has(session.userId)) {
        this.sessionsByUserIdIndex.set(session.userId, new Set());
      }
      this.sessionsByUserIdIndex.get(session.userId)!.add(sessionId);
    }
    this.save();
    return session;
  }

  public deleteSessionsForUser(userId: string) {
    if (!this.cache.sessions) this.cache.sessions = {};
    const sessionIds = this.sessionsByUserIdIndex.get(userId);
    if (sessionIds) {
      for (const sId of sessionIds) {
        delete this.cache.sessions[sId];
        this.sessionsBySessionIdIndex.delete(sId);
      }
      this.sessionsByUserIdIndex.delete(userId);
      this.save();
    }
  }

  // --- Uploads operations ---
  public getUploadByHash(sha256: string): { filename: string; originalName: string; mimeType: string; size: number; thumbnail?: string } | undefined {
    if (!this.cache.uploads) this.cache.uploads = {};
    return this.cache.uploads[sha256];
  }

  public addUpload(sha256: string, data: { filename: string; originalName: string; mimeType: string; size: number; thumbnail?: string }) {
    if (!this.cache.uploads) this.cache.uploads = {};
    this.cache.uploads[sha256] = data;
    this.save();
  }

  // --- Optimized Query and Search Helper APIs ---
  public searchUsers(query: string): User[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.getUsers();

    return Object.values(this.cache.users).filter(
      (u) =>
        u.name.toLowerCase().includes(lowerQuery) ||
        u.username.toLowerCase().includes(lowerQuery) ||
        (u.bio && u.bio.toLowerCase().includes(lowerQuery)) ||
        (u.email && u.email.toLowerCase().includes(lowerQuery))
    );
  }

  public searchMessagesInChat(chatId: string, query: string): Message[] {
    const messages = this.getMessagesForChat(chatId);
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return messages;

    return messages.filter((m) => m.content.toLowerCase().includes(lowerQuery));
  }

  public getUnreadMessageCountForUser(userId: string): number {
    const userChats = this.getChatsForUser(userId);
    const chatIds = new Set(userChats.map(c => c.id));
    
    let count = 0;
    for (const [chatId, messages] of this.messagesByChatIndex) {
      if (chatIds.has(chatId)) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (m.senderId !== userId && m.status !== 'seen') {
            count++;
          }
        }
      }
    }
    return count;
  }
}

export const db = new FileDatabase();
