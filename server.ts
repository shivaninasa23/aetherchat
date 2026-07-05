import express from "express";
import path from "path";
import http from "http";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { db } from "./server-db";
import { Logger } from "./server-logger";
import { Chat } from "./src/types";
import fs from "fs";
import multer from "multer";
import { Jimp } from "jimp";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
  const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  }

  app.use(express.json());
  app.use(cookieParser());

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully.");
  } else {
    console.warn("WARNING: GEMINI_API_KEY is not defined. AI Assistant features will be unavailable.");
  }

  // --- REST API Endpoints ---

  // CSRF Protection Middleware
  app.use((req, res, next) => {
    // 1. Generate CSRF token for GET requests if not present
    if (req.method === 'GET') {
      let token = req.cookies['chatsphere_csrf_token'];
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        res.cookie('chatsphere_csrf_token', token, {
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https',
          path: '/'
        });
      }
    }

    // 2. Validate CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const cookieToken = req.cookies['chatsphere_csrf_token'];
      const headerToken = req.headers['x-csrf-token'];

      if (req.path.startsWith('/api/') && req.path !== '/api/auth/logout') {
        if (!cookieToken || !headerToken || cookieToken !== headerToken) {
          const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
          Logger.securityWarning(`CSRF verification failed for ${req.path}`, {
            path: req.path,
            ip,
            userAgent: req.headers['user-agent'],
          });
          return res.status(403).json({ error: "State-changing request blocked: Invalid or missing CSRF token." });
        }
      }
    }
    next();
  });

  // --- Robust Rate Limiting and Abuse Prevention System ---

  class RateLimiter {
    private store = new Map<string, { count: number; resetTime: number }>();

    constructor(
      private windowMs: number,
      private maxRequests: number,
      private errorMessage: string,
      private logType: "security" | "upload" | "app"
    ) {}

    public check(key: string, ip: string, metadata: any = {}): { blocked: boolean; error?: string; resetInSeconds?: number } {
      const now = Date.now();
      const record = this.store.get(key);

      if (!record || now > record.resetTime) {
        this.store.set(key, { count: 1, resetTime: now + this.windowMs });
        return { blocked: false };
      }

      if (record.count >= this.maxRequests) {
        const resetInSeconds = Math.ceil((record.resetTime - now) / 1000);
        if (record.count === this.maxRequests) {
          const msg = `Rate limit exceeded: ${this.errorMessage} (Key: ${key})`;
          if (this.logType === "security") {
            Logger.securityWarning(msg, { ip, key, ...metadata, resetInSeconds });
          } else if (this.logType === "upload") {
            Logger.uploadFailure(msg, new Error("Rate limit exceeded"), { ip, key, ...metadata, resetInSeconds });
          } else {
            Logger.info(msg, { ip, key, ...metadata, resetInSeconds });
          }
        }
        record.count++;
        return { blocked: true, error: this.errorMessage, resetInSeconds };
      }

      record.count++;
      return { blocked: false };
    }
  }

  // Rate Limiter Instances
  const globalLimiter = new RateLimiter(60 * 1000, 150, "Too many requests. Please try again later.", "security");
  const loginLimiter = new RateLimiter(5 * 60 * 1000, 5, "Too many login attempts. Please try again in 5 minutes.", "security");
  const registerLimiter = new RateLimiter(15 * 60 * 1000, 3, "Too many registration attempts. Please try again in 15 minutes.", "security");
  const messageLimiter = new RateLimiter(60 * 1000, 30, "Too many messages sent. Please slow down.", "security");
  const uploadLimiter = new RateLimiter(60 * 1000, 5, "Too many file uploads. Please try again in a minute.", "upload");
  const searchLimiter = new RateLimiter(60 * 1000, 20, "Too many search queries. Please try again in a minute.", "security");

  // Message duplication and rapid-fire spam detector
  interface MessageTracker {
    lastTimestamp: number;
    lastContentHash: string;
    lastChatId: string;
  }
  const messageTrackerStore = new Map<string, MessageTracker>(); // key: userId / IP

  function preventMessageSpam(userId: string, ip: string, content: string, chatId: string): { blocked: boolean; error?: string } {
    const key = userId || ip;
    const now = Date.now();
    const tracker = messageTrackerStore.get(key);
    
    // Hash content to easily compare long messages
    const contentHash = crypto.createHash('md5').update((content || '').trim().toLowerCase()).digest('hex');

    if (!tracker) {
      messageTrackerStore.set(key, { lastTimestamp: now, lastContentHash: contentHash, lastChatId: chatId });
      return { blocked: false };
    }

    // 1. Rapid fire: Less than 500ms between messages
    if (now - tracker.lastTimestamp < 500) {
      Logger.securityWarning(`Rapid message submission spam detected for User/IP: ${key}`, { userId, ip, chatId });
      return { blocked: true, error: "Please slow down. Do not send messages so quickly." };
    }

    // 2. Exact duplicates: Same message within 3 seconds to same chat
    if (now - tracker.lastTimestamp < 3000 && tracker.lastContentHash === contentHash && tracker.lastChatId === chatId) {
      Logger.securityWarning(`Duplicate message submission spam detected for User/IP: ${key}`, { userId, ip, chatId, contentSnippet: (content || '').slice(0, 50) });
      return { blocked: true, error: "Duplicate message detected. Please wait a moment before resending." };
    }

    // Update tracker
    tracker.lastTimestamp = now;
    tracker.lastContentHash = contentHash;
    tracker.lastChatId = chatId;
    return { blocked: false };
  }

  // --- Specific Middlewares ---

  // 1. Global API Flooding protection middleware
  app.use("/api/*", (req, res, next) => {
    // Exclude static assets or files if served under /api/files (let's only rate-limit stateful/dynamic routes or include them under limits)
    // But serving files can be heavy, so let's allow files retrieving but limit everything else. Let's exclude GET /api/files/:filename from strict global limit but still rate limit if needed.
    if (req.method === 'GET' && req.path.startsWith('/api/files/')) {
      return next();
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    // Use session cookie / authorization if available as part of key, fallback to IP
    const key = req.cookies['chatsphere_session'] || ip;

    const result = globalLimiter.check(key, ip, { path: req.baseUrl + req.path, method: req.method });
    if (result.blocked) {
      return res.status(429).json({ error: result.error, resetInSeconds: result.resetInSeconds });
    }
    next();
  });

  // Legacy rateLimitMiddleware mapped to loginLimiter
  function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = req.body.email ? `login:${req.body.email.toLowerCase().trim()}` : ip;

    const result = loginLimiter.check(key, ip, { email: req.body.email });
    if (result.blocked) {
      return res.status(429).json({ error: result.error, resetInSeconds: result.resetInSeconds });
    }
    next();
  }

  // Registration Limiter Middleware
  function registrationLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = req.body.email ? `register:${req.body.email.toLowerCase().trim()}` : ip;

    const result = registerLimiter.check(key, ip, { email: req.body.email });
    if (result.blocked) {
      return res.status(429).json({ error: result.error, resetInSeconds: result.resetInSeconds });
    }
    next();
  }

  // Search & Retrieval Limiter Middleware
  function searchLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = req.cookies['chatsphere_session'] || ip;

    // Only apply if they are actually requesting search/query/filter or fetching list/users/chats repeatedly
    const result = searchLimiter.check(key, ip, { path: req.path, query: req.query });
    if (result.blocked) {
      return res.status(429).json({ error: result.error, resetInSeconds: result.resetInSeconds });
    }
    next();
  }


  // Input Sanitization and Validation
  function preventSqlInjection(str: any): string {
    if (typeof str !== 'string') return '';
    const sqlRegex = /union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table|update\s+.*\s+set|delete\s+from|or\s+1\s*=\s*1|['"`;\-\-]/gi;
    return str.replace(sqlRegex, (match) => {
      return `[neutralized:${match.replace(/['"`;]/g, '')}]`;
    });
  }

  function validateEmail(email: any): boolean {
    if (typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }

  function validateUsername(username: any): boolean {
    if (typeof username !== 'string') return false;
    const re = /^[a-zA-Z0-9_.]{3,20}$/;
    if (!re.test(username)) return false;
    const reserved = ['ai_bot', 'chatsphere_ai', 'admin', 'system', 'root', 'moderator', 'support', 'chatsphere'];
    if (reserved.includes(username.toLowerCase())) return false;
    return true;
  }

  function validatePasswordStrength(password: any): boolean {
    if (typeof password !== 'string') return false;
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return re.test(password);
  }

  function validatePhone(phone: any): boolean {
    if (!phone) return true; // Optional field
    if (typeof phone !== 'string') return false;
    const re = /^\+?(\d[\d-.() ]{5,18}\d)$/;
    return re.test(phone);
  }

  function sanitizeString(str: any): string {
    if (typeof str !== 'string') return '';
    let val = str.trim();
    val = preventSqlInjection(val);
    return val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  function sanitizeFilename(filename: any): string {
    if (typeof filename !== 'string') return 'file_' + Date.now();
    let name = filename.replace(/[\/\\]/g, "");
    name = name.replace(/\.{2,}/g, ".");
    name = name.replace(/[^a-zA-Z0-9 _.-]/g, "");
    name = name.trim().replace(/^[ ._-]+/, "");
    if (!name) name = "file_" + Date.now();
    return name;
  }

  // Session Helper
  function createSessionAndSetCookie(res: express.Response, userId: string, rememberMe: boolean, req: express.Request) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const duration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000; // 30 days vs 2 hours
    const expiresAt = new Date(Date.now() + duration).toISOString();

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    db.setSession(sessionId, {
      id: sessionId,
      userId,
      expiresAt,
      ip,
      userAgent
    });

    res.cookie('chatsphere_session', sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https',
      path: '/',
      maxAge: duration
    });

    return sessionId;
  }

  // Require Auth Middleware
  function requireAuth(req: any, res: any, next: any) {
    const sessionId = req.cookies['chatsphere_session'];
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    
    if (!sessionId) {
      Logger.securityWarning(`Authentication failed: Missing session cookie on ${req.method} ${req.path}`, { ip });
      return res.status(401).json({ error: "Authentication required." });
    }

    const session = db.getSession(sessionId);
    if (!session || Date.now() > new Date(session.expiresAt).getTime()) {
      if (session) db.setSession(sessionId, undefined);
      res.clearCookie('chatsphere_session');
      Logger.securityWarning(`Authentication failed: Expired or invalid session ${sessionId} on ${req.method} ${req.path}`, { ip });
      return res.status(401).json({ error: "Session expired or invalid." });
    }

    const currentUserAgent = req.headers['user-agent'] || '';
    if (session.userAgent && session.userAgent !== currentUserAgent) {
      Logger.securityWarning(`Session hijacking detected: User agent mismatch for user ${session.userId}. Original: "${session.userAgent}", Current: "${currentUserAgent}"`, {
        userId: session.userId,
        ip,
        originalUserAgent: session.userAgent,
        currentUserAgent,
      });
      db.setSession(sessionId, undefined);
      res.clearCookie('chatsphere_session');
      return res.status(401).json({ error: "Security validation failed. Session terminated." });
    }

    req.userId = session.userId;
    next();
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Auth: Check Session (Me)
  app.get("/api/auth/me", (req, res) => {
    const sessionId = req.cookies['chatsphere_session'];
    if (!sessionId) return res.status(401).json({ error: "No session active" });

    const session = db.getSession(sessionId);
    if (!session || Date.now() > new Date(session.expiresAt).getTime()) {
      if (session) db.setSession(sessionId, undefined);
      res.clearCookie('chatsphere_session');
      return res.status(401).json({ error: "Session expired" });
    }

    const user = db.getUser(session.userId);
    if (!user) return res.status(404).json({ error: "User profile not found" });

    res.json(user);
  });

  // Auth: Login
  app.post("/api/auth/login", rateLimitMiddleware, async (req, res, next) => {
    try {
      const { email, password, rememberMe } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

      if (!email || !password) {
        Logger.securityWarning("Login attempt failed: Missing email or password", { ip });
        return res.status(400).json({ error: "Email and password are required." });
      }

      const lowerEmail = email.toLowerCase();
      const cred = db.getCredential(lowerEmail);
      if (!cred) {
        Logger.securityWarning(`Login attempt failed: Invalid email not found: "${lowerEmail}"`, { ip, email: lowerEmail });
        return res.status(401).json({ error: "Invalid email or password." });
      }

      // Check temporary lock
      if (cred.lockUntil && Date.now() < new Date(cred.lockUntil).getTime()) {
        const minutesLeft = Math.ceil((new Date(cred.lockUntil).getTime() - Date.now()) / 60000);
        Logger.securityWarning(`Login attempt failed: Account is temporarily locked for: "${lowerEmail}"`, { ip, email: lowerEmail });
        return res.status(403).json({ error: `Account temporarily locked due to multiple failed attempts. Please try again in ${minutesLeft} minutes.` });
      }

      // Compare Password
      const match = await bcrypt.compare(password, cred.passwordHash);
      if (!match) {
        const failedAttempts = cred.failedAttempts + 1;
        const updates: Partial<typeof cred> = { failedAttempts };

        if (failedAttempts >= 5) {
          updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          db.setCredential(lowerEmail, updates);
          Logger.securityWarning(`Account has been temporarily locked due to multiple failed login attempts for: "${lowerEmail}"`, { ip, email: lowerEmail, failedAttempts });
          return res.status(403).json({ error: "Account has been temporarily locked due to multiple failed login attempts. Please try again in 15 minutes." });
        } else {
          db.setCredential(lowerEmail, updates);
          Logger.securityWarning(`Login attempt failed: Invalid password for: "${lowerEmail}"`, { ip, email: lowerEmail, failedAttempts });
          return res.status(401).json({ error: "Invalid email or password." });
        }
      }

      // Check Email Verification
      if (!cred.isVerified) {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        db.setPendingRegistration(lowerEmail, {
          email: lowerEmail,
          passwordHash: cred.passwordHash,
          fullName: db.getUserByEmail(lowerEmail)?.name || "User",
          verificationCode: code,
          verificationCodeExpires: expires
        });

        Logger.securityWarning(`Login attempt failed: Email unverified for: "${lowerEmail}". New code generated.`, { ip, email: lowerEmail });

        console.log(`\n======================================================`);
        console.log(`[Security] EMAIL VERIFICATION REQUIRED FOR ${lowerEmail}`);
        console.log(`[Security] VERIFICATION CODE: ${code}`);
        console.log(`======================================================\n`);

        return res.status(403).json({
          error: "Your email address is unverified. A verification code has been dispatched.",
          unverified: true
        });
      }

      // Success - reset attempts
      db.setCredential(lowerEmail, { failedAttempts: 0, lockUntil: undefined });

      const user = db.getUserByEmail(lowerEmail);
      if (!user) {
        Logger.securityWarning(`Login attempt failed: User profile not found for: "${lowerEmail}"`, { ip, email: lowerEmail });
        return res.status(404).json({ error: "User profile not found." });
      }

      // Prevent Session Fixation: Clear any existing session cookie
      const existingSession = req.cookies['chatsphere_session'];
      if (existingSession) {
        db.setSession(existingSession, undefined);
      }

      createSessionAndSetCookie(res, user.id, !!rememberMe, req);
      Logger.info(`User logged in securely: ${user.name}`, { userId: user.id, email: lowerEmail, ip });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // Auth: Start Register (Verify Dispatch)
  app.post("/api/auth/register-start", registrationLimitMiddleware, async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const lowerEmail = email.toLowerCase();
    const existingCred = db.getCredential(lowerEmail);
    if (existingCred && existingCred.isVerified) {
      return res.status(400).json({ error: "An account with this email address already exists." });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const passwordHash = await bcrypt.hash(password, 10);

    db.setPendingRegistration(lowerEmail, {
      email: lowerEmail,
      passwordHash,
      fullName: sanitizeString(fullName),
      verificationCode: code,
      verificationCodeExpires: expires
    });

    console.log(`\n======================================================`);
    console.log(`[Security] EMAIL VERIFICATION TOKEN FOR ${lowerEmail}`);
    console.log(`[Security] VERIFICATION CODE: ${code}`);
    console.log(`======================================================\n`);

    res.json({ success: true, message: "Verification code dispatched to your email." });
  });

  // Auth: Verify Code
  app.post("/api/auth/verify-code", registrationLimitMiddleware, async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }

    const lowerEmail = email.toLowerCase();
    const pending = db.getPendingRegistration(lowerEmail);
    if (!pending) {
      return res.status(400).json({ error: "No pending registration found for this email address." });
    }

    if (Date.now() > new Date(pending.verificationCodeExpires).getTime()) {
      return res.status(400).json({ error: "The verification code has expired. Please register again." });
    }

    if (pending.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    res.json({ success: true, message: "Code verified successfully." });
  });

  // Auth: Complete Register
  app.post("/api/auth/register", registrationLimitMiddleware, async (req, res) => {
    const { email, username, fullName, avatar, bio } = req.body;
    if (!email || !username || !fullName) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const lowerEmail = email.toLowerCase();
    const pending = db.getPendingRegistration(lowerEmail);
    if (!pending) {
      return res.status(400).json({ error: "Verification process not completed or session expired." });
    }

    const normalizedUsername = username.replace("@", "").toLowerCase();
    if (!validateUsername(normalizedUsername)) {
      return res.status(400).json({ error: "Username must be 3-20 characters long and contain only alphanumeric characters, underscores, or periods. No reserved names allowed." });
    }

    if (db.getUserByUsername(normalizedUsername)) {
      return res.status(400).json({ error: "Username is already taken by another user." });
    }

    const id = "user_" + Date.now();
    const user = db.addUser({
      id,
      name: sanitizeString(fullName),
      username: normalizedUsername,
      avatar: avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`,
      bio: bio ? sanitizeString(bio) : "Hey there! I am using ChatSphere.",
      status: "online",
      email: lowerEmail,
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });

    db.setCredential(lowerEmail, {
      email: lowerEmail,
      passwordHash: pending.passwordHash,
      isVerified: true,
      failedAttempts: 0
    });

    db.setPendingRegistration(lowerEmail, undefined);

    createSessionAndSetCookie(res, user.id, false, req);
    console.log(`[Auth] Registered and logged in user: ${user.name}`);
    broadcast("user_registered", { user });
    res.json(user);
  });

  // Auth: Google Sign-in
  app.post("/api/auth/google", (req, res) => {
    const { email, name, avatar } = req.body;
    if (!email || !name) return res.status(400).json({ error: "Missing Google credentials" });

    const lowerEmail = email.toLowerCase();
    let user = db.getUserByEmail(lowerEmail);
    if (!user) {
      const id = "user_" + Date.now();
      const username = lowerEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      user = db.addUser({
        id,
        name: sanitizeString(name),
        username,
        avatar: avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`,
        bio: "LoggedIn securely with Google Cloud OAuth 2.0",
        status: "online",
        email: lowerEmail,
        createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hash = bcrypt.hashSync(randomPassword, 10);
      db.setCredential(lowerEmail, {
        email: lowerEmail,
        passwordHash: hash,
        isVerified: true,
        failedAttempts: 0
      });

      console.log(`[Auth] Google Registered user: ${user.name}`);
      broadcast("user_registered", { user });
    }

    createSessionAndSetCookie(res, user.id, true, req);
    res.json(user);
  });

  // Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.cookies['chatsphere_session'];
    if (sessionId) {
      db.setSession(sessionId, undefined);
    }
    res.clearCookie('chatsphere_session');
    res.json({ success: true, message: "Logged out successfully." });
  });

  // Auth: Forgot Password Request
  app.post("/api/auth/forgot-password", rateLimitMiddleware, async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const lowerEmail = email.toLowerCase();
    const cred = db.getCredential(lowerEmail);

    if (!cred || !cred.isVerified) {
      return res.json({ success: true, message: "If that email address is registered, a password reset link has been dispatched." });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

    db.setCredential(lowerEmail, {
      resetToken: token,
      resetTokenExpires: expires
    });

    console.log(`\n======================================================`);
    console.log(`[Security] PASSWORD RESET DISPATCHED FOR ${lowerEmail}`);
    console.log(`[Security] RESET LINK: http://localhost:3000/?resetToken=${token}`);
    console.log(`======================================================\n`);

    res.json({ success: true, message: "If that email address is registered, a password reset link has been dispatched." });
  });

  // Auth: Reset Password Submit
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required." });
    }

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const cred = db.getCredentialByResetToken(token);
    if (!cred) {
      return res.status(400).json({ error: "Reset token is invalid or has expired." });
    }

    if (Date.now() > new Date(cred.resetTokenExpires || "").getTime()) {
      return res.status(400).json({ error: "Reset token has expired. Please request a new link." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.setCredential(cred.email, {
      passwordHash,
      resetToken: undefined,
      resetTokenExpires: undefined,
      failedAttempts: 0,
      lockUntil: undefined
    });

    console.log(`[Security] Password successfully reset for: ${cred.email}`);
    res.json({ success: true, message: "Your password has been reset successfully." });
  });

  // Update Profile (Secure)
  app.post("/api/auth/update-profile", requireAuth, (req: any, res: any) => {
    const { userId, name, username, bio, avatar, phone, email } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized access to profile update." });
    }

    if (username) {
      const normalizedUsername = username.replace("@", "").toLowerCase();
      if (!validateUsername(normalizedUsername)) {
        return res.status(400).json({ error: "Username must be 3-20 characters long and contain only alphanumeric characters, underscores, or periods." });
      }
      const existingUser = db.getUserByUsername(normalizedUsername);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Username is already taken by another user." });
      }
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address format." });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: "Please enter a valid phone number (e.g. +15551234567)." });
    }

    const updatedUser = db.updateUser(userId, {
      name: name ? sanitizeString(name) : undefined,
      username: username ? username.replace("@", "").toLowerCase() : undefined,
      bio: bio !== undefined ? sanitizeString(bio) : undefined,
      avatar,
      phone: phone !== undefined ? sanitizeString(phone) : undefined,
      email: email ? email.toLowerCase() : undefined
    });
    console.log(`[Profile] Updated profile for: ${updatedUser.name}`);
    broadcast("user_updated", { user: updatedUser });
    res.json(updatedUser);
  });

  // Get Users List
  app.get("/api/users", requireAuth, searchLimitMiddleware, (req, res) => {
    res.json(db.getUsers());
  });

  // Get Chats List
  app.get("/api/chats", requireAuth, searchLimitMiddleware, (req: any, res: any) => {
    const { userId, q } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if ((req as any).userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized query." });
    }
    
    // Auto-seed real-time database conversations for this user
    db.ensureUserSeededConversations(userId as string);

    let userChats = db.getChatsForUser(userId as string);

    // Optimize search: server-side filtering on query parameter `q`
    if (q && typeof q === "string") {
      const lowerQ = q.toLowerCase();
      userChats = userChats.filter(chat =>
        chat.name.toLowerCase().includes(lowerQ) ||
        (chat.description && chat.description.toLowerCase().includes(lowerQ))
      );
    }
    
    // Map private AI chat id for client compatibility
    const mappedChats = userChats.map(chat => {
      if (chat.id === `chat_ai_${userId}`) {
        return { ...chat, id: "chat_ai" };
      }
      return chat;
    });

    res.json(mappedChats);
  });

  // Start/Get a Chat
  app.post("/api/chats", requireAuth, (req: any, res: any) => {
    let { isGroup, memberIds, name, avatar, description, adminIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds)) return res.status(400).json({ error: "Missing memberIds" });
    
    // Normalize "self" to actual authenticated req.userId to prevent privilege escalation
    memberIds = memberIds.map((id: string) => id === "self" ? req.userId : id);
    if (adminIds && Array.isArray(adminIds)) {
      adminIds = adminIds.map((id: string) => id === "self" ? req.userId : id);
    }

    if (!memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You must be a member of the chat." });
    }
    
    if (isGroup) {
      if (!adminIds || !Array.isArray(adminIds)) {
        adminIds = [req.userId];
      } else if (!adminIds.includes(req.userId)) {
        adminIds.push(req.userId);
      }
    } else {
      adminIds = [];
    }
    
    // For 1-to-1 chats, check if a conversation already exists (OPTIMIZED to check only the user's chats via index)
    if (!isGroup && memberIds.length === 2) {
      const existing = db.getChatsForUser(req.userId).find(c => 
        !c.isGroup && 
        c.memberIds.includes(memberIds[0]) && 
        c.memberIds.includes(memberIds[1])
      );
      if (existing) {
        // Map ID if it is the private AI chat
        let mappedChat = { ...existing };
        const otherId = memberIds.find(id => id !== "ai_bot");
        if (existing.id === `chat_ai_${otherId}`) {
          mappedChat.id = "chat_ai";
        }
        return res.json(mappedChat);
      }
    }

    const id = isGroup ? "group_" + Date.now() : "chat_" + Date.now();
    const chatName = name || (isGroup ? "New Group Channel" : "Direct Message");
    const chatAvatar = avatar || (isGroup 
      ? "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80"
      : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
    );

    const newChat = db.addChat({
      id,
      isGroup,
      name: chatName,
      avatar: chatAvatar,
      description: description || "",
      memberIds,
      adminIds,
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 0,
    });

    console.log(`[Chats] Created new chat: ${chatName}`);
    broadcastToMembers(memberIds, "chat_created", { chat: newChat });
    res.json(newChat);
  });

  // Chat Wallpaper Customization
  app.post("/api/chats/:chatId/wallpaper", requireAuth, (req: any, res: any) => {
    const { chatId } = req.params;
    const { wallpaper, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized request." });
    }

    let targetChatId = chatId;
    if (chatId === "chat_ai") {
      targetChatId = `chat_ai_${userId}`;
    }

    const chat = db.getChat(targetChatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (!chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    const userSettings = db.getSettings(userId);
    const chatWallpapers = { ...(userSettings.chatWallpapers || {}) };
    chatWallpapers[targetChatId] = wallpaper;

    const updatedSettings = db.updateSettings(userId, { chatWallpapers });
    res.json({ success: true, settings: updatedSettings });
  });

  // Get Messages (OPTIMIZED with pagination and server-side search)
  app.get("/api/chats/:chatId/messages", requireAuth, searchLimitMiddleware, (req: any, res: any) => {
    const { chatId } = req.params;
    const { userId, search, limit, before } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized messages request." });
    }

    let targetChatId = chatId;
    if (chatId === "chat_ai" && userId) {
      targetChatId = `chat_ai_${userId}`;
      db.ensureUserSeededConversations(userId as string);
    }

    const chat = db.getChat(targetChatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (!chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    let messages = db.getMessagesForChat(targetChatId);

    // 1. Optimize search: server-side filtering on content query
    if (search && typeof search === "string") {
      const lowerSearch = search.toLowerCase();
      messages = messages.filter(m => m.content.toLowerCase().includes(lowerSearch));
    }

    // 2. Optimize pagination: filtering messages sent BEFORE a specific message ID or timestamp
    if (before && typeof before === "string") {
      const beforeIndex = messages.findIndex(m => m.id === before || m.timestamp === before);
      if (beforeIndex !== -1) {
        messages = messages.slice(0, beforeIndex);
      } else {
        const beforeTime = new Date(before).getTime();
        if (!isNaN(beforeTime)) {
          messages = messages.filter(m => new Date(m.timestamp).getTime() < beforeTime);
        }
      }
    }

    // 3. Optimize pagination: limit the size of the payload returned
    const limitVal = parseInt(limit as string, 10);
    if (!isNaN(limitVal) && limitVal > 0) {
      messages = messages.slice(-limitVal);
    }
    
    // Map messages back to chatId: "chat_ai" for the client's screen view matching
    const mappedMessages = messages.map(msg => {
      if (msg.chatId === `chat_ai_${userId}`) {
        return { ...msg, chatId: "chat_ai" };
      }
      return msg;
    });

    res.json(mappedMessages);
  });

  // --- Production File Upload and Serving System ---
  
  function formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const APPROVED_TYPES: Record<string, { mimes: string[], category: string }> = {
    jpg: { mimes: ['image/jpeg', 'image/pjpeg'], category: 'image' },
    jpeg: { mimes: ['image/jpeg', 'image/pjpeg'], category: 'image' },
    png: { mimes: ['image/png'], category: 'image' },
    webp: { mimes: ['image/webp'], category: 'image' },
    gif: { mimes: ['image/gif'], category: 'image' },
    svg: { mimes: ['image/svg+xml'], category: 'image' },
    pdf: { mimes: ['application/pdf'], category: 'document' },
    doc: { mimes: ['application/msword'], category: 'document' },
    docx: { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], category: 'document' },
    zip: { mimes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/x-zip'], category: 'archive' },
    txt: { mimes: ['text/plain'], category: 'document' },
    mp3: { mimes: ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg-3', 'audio/mpg', 'audio/x-mpg', 'audio/x-mpegaudio'], category: 'audio' },
    mp4: { mimes: ['video/mp4'], category: 'video' }
  };

  function validateMagicBytes(buffer: Buffer, ext: string): boolean {
    if (buffer.length < 4) return false;
    const hex = buffer.toString('hex', 0, 8).toUpperCase();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return hex.startsWith('FFD8FF');
      case 'png':
        return hex.startsWith('89504E47');
      case 'gif':
        return hex.startsWith('47494638');
      case 'pdf':
        return hex.startsWith('25504446');
      case 'zip':
      case 'docx':
        return hex.startsWith('504B0304') || hex.startsWith('504B0506') || hex.startsWith('504B0708');
      case 'mp3':
        return hex.startsWith('494433') || hex.startsWith('FFF3') || hex.startsWith('FFFB') || hex.startsWith('FFF2') || hex.startsWith('FFFA');
      case 'mp4':
        if (buffer.length >= 12) {
          const ftypHex = buffer.toString('hex', 4, 8).toUpperCase();
          return ftypHex === '66747970';
        }
        return true;
      case 'txt':
      case 'svg':
        const peSign = hex.startsWith('4D5A'); // 'MZ'
        const elfSign = hex.startsWith('7F454C46'); // '.ELF'
        return !peSign && !elfSign;
      default:
        return false;
    }
  }

  function isFilenameDangerous(filename: string): boolean {
    const lowercaseName = filename.toLowerCase();
    const dangerousPatterns = [
      '.exe', '.bat', '.cmd', '.sh', '.js', '.ts', '.vbs', '.scr', '.pif', 
      '.com', '.msi', '.jar', '.xhtml', '.html', '.htm', '.php', '.pl', 
      '.py', '.jsp', '.asp', '.aspx', '.htaccess', '.xml'
    ];
    for (const pattern of dangerousPatterns) {
      if (lowercaseName.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB
    }
  });

  // Secure multipart upload endpoint
  app.post("/api/upload", requireAuth, (req: any, res: any, next: any) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userId = req.userId;
    const key = userId || ip;

    const rateLimitCheck = uploadLimiter.check(key, ip);
    if (rateLimitCheck.blocked) {
      return res.status(429).json({ error: rateLimitCheck.error });
    }
    next();
  }, (req: any, res: any) => {
    upload.single('file')(req, res, async (err: any) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userId = req.userId;

      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            Logger.uploadFailure(`Upload blocked: Max file size exceeded (User: ${userId})`, err, { userId, ip });
            return res.status(400).json({ error: "Maximum upload size exceeded. Maximum allowed size is 25 MB." });
          }
          Logger.uploadFailure(`Multer upload error (User: ${userId})`, err, { userId, ip, code: err.code });
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        Logger.uploadFailure(`Unknown upload error (User: ${userId})`, err, { userId, ip });
        return res.status(500).json({ error: `Upload error: ${err.message}` });
      }

      const file = req.file;
      if (!file) {
        Logger.uploadFailure(`Upload failed: No file uploaded (User: ${userId})`, new Error("No file uploaded"), { userId, ip });
        return res.status(400).json({ error: "No file was uploaded." });
      }

      const originalName = file.originalname;
      const cleanOriginalName = path.basename(originalName).replace(/[\/\\]/g, "");
      const ext = cleanOriginalName.split('.').pop()?.toLowerCase() || '';

      if (!ext || !APPROVED_TYPES[ext]) {
        Logger.uploadFailure(`Upload blocked: Unsupported file extension .${ext} (User: ${userId})`, new Error("Unsupported file extension"), { userId, ip, originalName, ext });
        return res.status(400).json({ error: "Unsupported file extension or file type. Approved types are: Images (jpg, jpeg, png, webp, gif, svg), PDF, DOCX, ZIP, TXT, MP3, MP4." });
      }

      const approvedConfig = APPROVED_TYPES[ext];
      if (!approvedConfig.mimes.includes(file.mimetype)) {
        if (ext !== 'txt' && ext !== 'zip') {
          Logger.uploadFailure(`Upload blocked: Invalid MIME type ${file.mimetype} for extension .${ext} (User: ${userId})`, new Error("MIME mismatch"), { userId, ip, ext, mimeType: file.mimetype });
          return res.status(400).json({ error: `Invalid MIME type ${file.mimetype} for file extension .${ext}` });
        }
      }

      if (isFilenameDangerous(cleanOriginalName)) {
        Logger.securityWarning(`Upload blocked: Dangerous filename pattern detected in "${cleanOriginalName}" (User: ${userId})`, { userId, ip, originalName });
        return res.status(400).json({ error: "Upload blocked. The filename contains a dangerous or restricted extension pattern." });
      }

      if (!validateMagicBytes(file.buffer, ext)) {
        Logger.securityWarning(`Upload blocked: Integrity check failed (Magic bytes mismatch) for file "${cleanOriginalName}" with extension .${ext} (User: ${userId})`, { userId, ip, originalName, ext });
        return res.status(400).json({ error: "Upload blocked. File integrity check failed (magic bytes do not match declared file extension)." });
      }

      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const existingUpload = db.getUploadByHash(fileHash);
      if (existingUpload) {
        Logger.uploadInfo(`Duplicate file detected for hash ${fileHash}. Reusing existing file: ${existingUpload.filename} (User: ${userId})`, { userId, ip, originalName, existingFile: existingUpload.filename });
        return res.json({
          url: `/api/files/${existingUpload.filename}`,
          filename: existingUpload.filename,
          thumbnail: existingUpload.thumbnail ? `/api/files/thumbnails/${existingUpload.filename}` : undefined,
          fileInfo: {
            name: cleanOriginalName,
            size: formatBytes(file.size),
            extension: ext
          }
        });
      }

      const randomFilename = crypto.randomBytes(16).toString('hex') + '_' + Date.now() + '.' + ext;
      const targetPath = path.join(UPLOADS_DIR, randomFilename);

      try {
        let savedBuffer = file.buffer;
        let hasThumbnail = false;

        if (approvedConfig.category === 'image' && ext !== 'svg') {
          try {
            const image = await Jimp.read(file.buffer);
            const origWidth = image.bitmap.width;
            const origHeight = image.bitmap.height;

            // Resize original image if exceptionally large to conserve production storage/bandwidth
            if (origWidth > 1600 || origHeight > 1600) {
              if (origWidth > origHeight) {
                image.resize({ w: 1600 });
              } else {
                image.resize({ h: 1600 });
              }
            }

            // Apply quality compression for JPEG formats
            if (ext === 'jpg' || ext === 'jpeg') {
              const anyImage = image as any;
              if (typeof anyImage.quality === 'function') {
                anyImage.quality(80);
              }
            }

            // Get compressed image buffer
            savedBuffer = await image.getBuffer(file.mimetype as any);

            // Generate thumbnail from original image instance
            const thumbImage = image.clone();
            const maxDim = 150;
            const curWidth = thumbImage.bitmap.width;
            const curHeight = thumbImage.bitmap.height;
            if (curWidth > maxDim || curHeight > maxDim) {
              if (curWidth > curHeight) {
                thumbImage.resize({ w: maxDim });
              } else {
                thumbImage.resize({ h: maxDim });
              }
            }

            if (ext === 'jpg' || ext === 'jpeg') {
              const anyThumb = thumbImage as any;
              if (typeof anyThumb.quality === 'function') {
                anyThumb.quality(70);
              }
            }

            const thumbPath = path.join(THUMBNAILS_DIR, randomFilename);
            await thumbImage.write(thumbPath as any);
            hasThumbnail = true;
          } catch (jimpErr) {
            Logger.uploadFailure(`Failed to compress image/generate thumbnail for ${randomFilename} (User: ${userId})`, jimpErr, { userId, randomFilename });
          }
        }

        fs.writeFileSync(targetPath, savedBuffer);

        db.addUpload(fileHash, {
          filename: randomFilename,
          originalName: cleanOriginalName,
          mimeType: file.mimetype,
          size: file.size,
          thumbnail: hasThumbnail ? randomFilename : undefined
        });

        Logger.uploadInfo(`File uploaded successfully: ${randomFilename} as ${cleanOriginalName} (User: ${userId})`, { userId, ip, filename: randomFilename, originalName: cleanOriginalName, size: file.size });

        return res.json({
          url: `/api/files/${randomFilename}`,
          filename: randomFilename,
          thumbnail: hasThumbnail ? `/api/files/thumbnails/${randomFilename}` : undefined,
          fileInfo: {
            name: cleanOriginalName,
            size: formatBytes(file.size),
            extension: ext
          }
        });

      } catch (saveErr: any) {
        Logger.uploadFailure(`Server error saving file or generating thumbnail (User: ${userId})`, saveErr, { userId, ip, originalName: cleanOriginalName });
        return res.status(500).json({ error: "Server error occurred while saving the uploaded file." });
      }
    });
  });

  // Serve Original File (Secure Route with CSP and MIME Sniff protection)
  app.get("/api/files/:filename", requireAuth, (req, res) => {
    const filename = req.params.filename;
    
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(403).json({ error: "Access denied. Illegal filename pattern." });
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const approvedConfig = APPROVED_TYPES[ext];
    
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const mime = approvedConfig ? approvedConfig.mimes[0] : 'application/octet-stream';
    res.setHeader('Content-Type', mime);

    if (approvedConfig && ['image', 'audio', 'video', 'document'].includes(approvedConfig.category) && ext !== 'zip') {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.sendFile(filePath);
  });

  // Serve Thumbnail File
  app.get("/api/files/thumbnails/:filename", requireAuth, (req, res) => {
    const filename = req.params.filename;
    
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(403).json({ error: "Access denied. Illegal filename pattern." });
    }

    const filePath = path.join(THUMBNAILS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      const originalPath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(originalPath)) {
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const approvedConfig = APPROVED_TYPES[ext];
        res.setHeader('Content-Type', approvedConfig ? approvedConfig.mimes[0] : 'image/jpeg');
        res.setHeader('Content-Disposition', 'inline');
        return res.sendFile(originalPath);
      }
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const approvedConfig = APPROVED_TYPES[ext];
    res.setHeader('Content-Type', approvedConfig ? approvedConfig.mimes[0] : 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  });

  // Send Message
  app.post("/api/messages", requireAuth, (req: any, res: any) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = req.userId || ip;

    // 1. Rate Limit Message Sending
    const limitCheck = messageLimiter.check(key, ip, { chatId: req.body.chatId });
    if (limitCheck.blocked) {
      return res.status(429).json({ error: limitCheck.error });
    }

    const { chatId, senderId, content, mediaType, mediaUrl, thumbnailUrl, fileInfo, locationInfo, contactInfo } = req.body;
    if (!chatId || !senderId || content === undefined) {
      return res.status(400).json({ error: "Missing required message parameters" });
    }
    
    const resolvedSenderId = senderId === "self" ? req.userId : senderId;
    if (req.userId !== resolvedSenderId) {
      return res.status(403).json({ error: "Access denied. Cannot send message as another user." });
    }

    let targetChatId = chatId;
    if (chatId === "chat_ai") {
      targetChatId = `chat_ai_${resolvedSenderId}`;
    }

    // 2. Prevent message spam / duplicates
    const spamCheck = preventMessageSpam(req.userId, ip, content, targetChatId);
    if (spamCheck.blocked) {
      return res.status(429).json({ error: spamCheck.error });
    }

    const chat = db.getChat(targetChatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    if (!chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    const messageId = "m_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const timestamp = new Date().toISOString();

    // Sanitize message content to prevent XSS and neutralize malicious SQL syntax
    const sanitizedContent = sanitizeString(content);

    // Sanitize file attachments name
    let sanitizedFileInfo = fileInfo;
    if (fileInfo && typeof fileInfo === 'object') {
      sanitizedFileInfo = {
        ...fileInfo,
        name: fileInfo.name ? sanitizeFilename(fileInfo.name) : 'file_' + Date.now(),
        extension: fileInfo.extension ? sanitizeFilename(fileInfo.extension) : 'dat'
      };
    }

    const newMsg = db.addMessage({
      id: messageId,
      chatId: targetChatId,
      senderId: resolvedSenderId,
      content: sanitizedContent,
      mediaType: mediaType || "text",
      mediaUrl,
      thumbnailUrl,
      fileInfo: sanitizedFileInfo,
      locationInfo,
      contactInfo,
      timestamp,
      status: "sent",
    });

    // Update chat last message timestamp
    db.updateChat(targetChatId, { lastMessageTimestamp: timestamp });

    // Map message chatId to 'chat_ai' for client synchronization
    const mappedMsg = { ...newMsg };
    if (mappedMsg.chatId === `chat_ai_${resolvedSenderId}`) {
      mappedMsg.chatId = "chat_ai";
    }

    // Broadcast to other members
    broadcastToMembers(chat.memberIds, "message_sent", { message: mappedMsg });

    // Handle Gemini bot auto-reply
    if (chatId === "chat_ai" || (chat.memberIds.includes("ai_bot") && resolvedSenderId !== "ai_bot")) {
      handleGeminiAssistantResponse(targetChatId, content, resolvedSenderId);
    } 
    // Handle Team simulated replies to keep the workspace 100% alive (if enabled by autoReply)
    else {
      const senderSettings = db.getSettings(resolvedSenderId);
      if (senderSettings.autoReplyEnabled) {
        triggerTeamAutoReply(chat, resolvedSenderId, content);
      }
    }

    const clientMsg = { ...newMsg };
    if (clientMsg.chatId === `chat_ai_${resolvedSenderId}`) {
      clientMsg.chatId = "chat_ai";
    }
    res.json(clientMsg);
  });

  // Edit Message
  app.put("/api/messages/:id", requireAuth, (req: any, res: any) => {
    const { id } = req.params;
    const { content, userId } = req.body;
    
    const existingMsg = db.getMessage(id);
    if (!existingMsg) return res.status(404).json({ error: "Message not found" });
    if (req.userId !== existingMsg.senderId) {
      return res.status(403).json({ error: "Access denied. Cannot edit someone else's message." });
    }

    const chat = db.getChat(existingMsg.chatId);
    if (!chat || !chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    const updatedMsg = db.updateMessage(id, { content, isEdited: true });
    
    if (chat) {
      const clientMsg = { ...updatedMsg };
      if (clientMsg.chatId.startsWith("chat_ai_")) {
        clientMsg.chatId = "chat_ai";
      }
      broadcastToMembers(chat.memberIds, "message_updated", { message: clientMsg });
    }
    
    const clientMsg = { ...updatedMsg };
    if (clientMsg.chatId.startsWith("chat_ai_")) {
      clientMsg.chatId = "chat_ai";
    }
    res.json(clientMsg);
  });

  // Delete Message
  app.delete("/api/messages/:id", requireAuth, (req: any, res: any) => {
    const { id } = req.params;
    const { everyone, userId } = req.query; // 'true' or 'false'
    
    const existingMsg = db.getMessage(id);
    if (!existingMsg) return res.status(404).json({ error: "Message not found" });
    if (req.userId !== existingMsg.senderId) {
      return res.status(403).json({ error: "Access denied. Cannot delete someone else's message." });
    }

    const chat = db.getChat(existingMsg.chatId);
    if (!chat || !chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    let updatedMsg;
    if (everyone === "true") {
      updatedMsg = db.updateMessage(id, { deletedForEveryone: true });
    } else {
      updatedMsg = db.updateMessage(id, { deletedForMe: true });
    }

    if (chat) {
      const clientChatId = existingMsg.chatId.startsWith("chat_ai_") ? "chat_ai" : existingMsg.chatId;
      broadcastToMembers(chat.memberIds, "message_deleted", { messageId: id, everyone: everyone === "true", chatId: clientChatId });
    }
    res.json({ success: true, messageId: id });
  });

  // Get Settings
  app.get("/api/settings/:userId", requireAuth, (req: any, res: any) => {
    const { userId } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized settings query." });
    }
    res.json(db.getSettings(userId));
  });

  // Update Settings
  app.put("/api/settings/:userId", requireAuth, (req: any, res: any) => {
    const { userId } = req.params;
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized settings update." });
    }
    const updatedSettings = db.updateSettings(userId, req.body);
    res.json(updatedSettings);
  });

  // Clear Chat History
  app.post("/api/chats/:chatId/clear", requireAuth, (req: any, res: any) => {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (req.userId !== userId) {
      return res.status(403).json({ error: "Access denied. Unauthorized request." });
    }

    let targetChatId = chatId;
    if (chatId === "chat_ai") {
      targetChatId = `chat_ai_${userId}`;
    }

    const chat = db.getChat(targetChatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (!chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this chat." });
    }

    // Mark messages belonging to this chat from the user's active view
    const messages = db.getMessages();
    for (const m of messages) {
      if (m.chatId === targetChatId) {
        db.updateMessage(m.id, { deletedForMe: true });
      }
    }
    res.json({ success: true });
  });

  // Leave Group Channel
  app.post("/api/chats/:chatId/leave", requireAuth, (req: any, res: any) => {
    const { chatId } = req.params;
    const chat = db.getChat(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (!chat.memberIds.includes(req.userId)) {
      return res.status(403).json({ error: "Access denied. You are not a member of this group." });
    }

    const updatedMemberIds = chat.memberIds.filter(id => id !== req.userId);
    let updatedAdminIds = chat.adminIds.filter(id => id !== req.userId);

    if (updatedMemberIds.length === 0) {
      db.deleteChat(chatId);
      broadcastToMembers(chat.memberIds, "chat_deleted", { chatId });
      return res.json({ success: true, chatDeleted: true });
    }

    if (chat.isGroup && updatedAdminIds.length === 0 && updatedMemberIds.length > 0) {
      // Promote the next member to admin
      updatedAdminIds = [updatedMemberIds[0]];
    }

    const updatedChat = db.updateChat(chatId, {
      memberIds: updatedMemberIds,
      adminIds: updatedAdminIds
    });

    broadcastToMembers(chat.memberIds, "chat_updated", { chat: updatedChat });
    res.json({ success: true, chat: updatedChat });
  });

  // Disband/Delete Group or Direct Chat
  app.delete("/api/chats/:chatId", requireAuth, (req: any, res: any) => {
    const { chatId } = req.params;
    const chat = db.getChat(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    
    if (chat.isGroup) {
      if (!chat.adminIds.includes(req.userId)) {
        return res.status(403).json({ error: "Access denied. Admin privileges required." });
      }
    } else {
      if (!chat.memberIds.includes(req.userId)) {
        return res.status(403).json({ error: "Access denied. You are not a participant in this chat." });
      }
    }

    db.deleteChat(chatId);
    broadcastToMembers(chat.memberIds, "chat_deleted", { chatId });
    res.json({ success: true });
  });

  // Gemini AI Response implementation
  async function handleGeminiAssistantResponse(chatId: string, userPrompt: string, userSenderId: string) {
    if (!ai) {
      console.warn("Gemini client is currently not configured. AI companion will not answer.");
      return;
    }

    const chat = db.getChat(chatId);
    if (!chat) return;

    // Send typing status for "chat_ai" to match client view
    broadcastToMembers(chat.memberIds, "typing", { chatId: "chat_ai", userId: "ai_bot", isTyping: true });

    try {
      // Fetch latest messages for context
      const chatMessages = db.getMessagesForChat(chatId).filter(m => !m.deletedForEveryone).slice(-15);
      const contents = chatMessages.map(m => ({
        role: m.senderId === "ai_bot" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: "You are ChatSphere AI, an incredibly advanced, smart, helpful, and charming messaging assistant. You are integrated into ChatSphere, a premium messaging app. Answer in markdown. Keep your tone elegant, modern, professional yet friendly, and perfectly suited for instant messaging.",
          temperature: 0.7,
        },
      });

      // Stop typing status
      broadcastToMembers(chat.memberIds, "typing", { chatId: "chat_ai", userId: "ai_bot", isTyping: false });

      // Save and broadcast message
      const aiMessageId = "m_ai_" + Date.now();
      const timestamp = new Date().toISOString();
      const aiMsg = db.addMessage({
        id: aiMessageId,
        chatId, // stored as chat_ai_userId
        senderId: "ai_bot",
        content: response.text || "I am processing your secure transmission. How else can I assist you today?",
        mediaType: "text",
        timestamp,
        status: "seen",
      });

      db.updateChat(chatId, { lastMessageTimestamp: timestamp });
      
      const mappedAiMsg = { ...aiMsg, chatId: "chat_ai" };
      broadcastToMembers(chat.memberIds, "message_sent", { message: mappedAiMsg });

    } catch (error) {
      console.error("Gemini AI API execution failed:", error);
      broadcastToMembers(chat.memberIds, "typing", { chatId: "chat_ai", userId: "ai_bot", isTyping: false });
    }
  }

  // Live active team member simulated replies
  function triggerTeamAutoReply(chat: Chat, originalSenderId: string, content: string) {
    const activeChatId = chat.id;
    // Set respondent
    let respondentId = "sarah";
    const currentUserId = originalSenderId;

    if (chat.isGroup) {
      const possibleMembers = chat.memberIds.filter(id => id !== currentUserId);
      respondentId = possibleMembers[Math.floor(Math.random() * possibleMembers.length)] || "sarah";
    } else {
      respondentId = chat.memberIds.find(id => id !== currentUserId) || "sarah";
    }

    if (respondentId === "ai_bot") return; // AI is handled separately

    const responder = db.getUser(respondentId);
    if (!responder) return;

    // Simulate typing
    setTimeout(() => {
      broadcastToMembers(chat.memberIds, "typing", { chatId: activeChatId, userId: respondentId, isTyping: true });
    }, 1000);

    setTimeout(() => {
      broadcastToMembers(chat.memberIds, "typing", { chatId: activeChatId, userId: respondentId, isTyping: false });

      const respondentName = responder.name.split(" ")[0];
      const replyTexts = [
        `Hey! Got your message. Let's make sure we review this during our team alignment!`,
        `Interesting point! I am wrapping up some launch tasks, but I'll write back in a bit.`,
        `Perfect, that works for me. Let's make sure it's fully secure.`,
        `Let me double check this specification and follow up. Coffee shop review tomorrow? ☕`
      ];
      const text = replyTexts[Math.floor(Math.random() * replyTexts.length)];

      const messageId = "m_incoming_" + Date.now();
      const timestamp = new Date().toISOString();
      const incomingMsg = db.addMessage({
        id: messageId,
        chatId: activeChatId,
        senderId: respondentId,
        content: text,
        mediaType: "text",
        timestamp,
        status: "sent",
      });

      db.updateChat(activeChatId, { lastMessageTimestamp: timestamp });
      broadcastToMembers(chat.memberIds, "message_sent", { message: incomingMsg });

    }, 3500);
  }

  // --- Global Express Error Handling Middleware ---
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const errorId = Logger.error(`Uncaught error on ${req.method} ${req.url}`, err, {
      method: req.method,
      url: req.url,
      ip,
      headers: req.headers,
    });

    // Hide internal details/stack traces, return a clean friendly message with the unique errorId
    res.status(err.status || 500).json({
      error: "An unexpected server error occurred. Please try again later.",
      errorId,
    });
  });

  // --- Vite & Production static servers ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files serving enabled.");
  }

  // --- Server & WebSockets Initialization ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Map to store active WS connections per user
  const connections = new Map<string, WebSocket[]>();

  function broadcast(type: string, payload: any, skipSockets: WebSocket[] = []) {
    const payloadStr = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && !skipSockets.includes(client)) {
        client.send(payloadStr);
      }
    });
  }

  function broadcastToMembers(memberIds: string[], type: string, payload: any, skipSockets: WebSocket[] = []) {
    const payloadStr = JSON.stringify({ type, payload });
    for (const memberId of memberIds) {
      const userConns = connections.get(memberId);
      if (userConns) {
        for (const ws of userConns) {
          if (ws.readyState === WebSocket.OPEN && !skipSockets.includes(ws)) {
            ws.send(payloadStr);
          }
        }
      }
    }
  }

  wss.on("connection", (ws, req) => {
    let currentUserId: string | null = null;

    // Parse session cookie from request headers to authenticate WS connection
    const cookieHeader = req.headers.cookie || "";
    const cookies: { [key: string]: string } = {};
    cookieHeader.split(";").forEach((pair) => {
      const parts = pair.split("=");
      if (parts.length === 2) {
        cookies[parts[0].trim()] = parts[1].trim();
      }
    });

    const sessionId = cookies["chatsphere_session"];
    let authenticatedUserId: string | null = null;
    if (sessionId) {
      const session = db.getSession(sessionId);
      if (session && Date.now() <= new Date(session.expiresAt).getTime()) {
        const userAgent = req.headers["user-agent"] || "";
        if (!session.userAgent || session.userAgent === userAgent) {
          authenticatedUserId = session.userId;
        }
      }
    }

    ws.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const { type, payload } = data;

        if (type === "join") {
          const { userId } = payload;
          
          // Verify WebSocket joining user matches the authenticated session user
          if (!authenticatedUserId || authenticatedUserId !== userId) {
            console.warn(`[Security] Unauthorized WS join attempt. targetUserId: ${userId}, authUserId: ${authenticatedUserId}`);
            ws.send(JSON.stringify({ type: "error", payload: { error: "Access Denied. Invalid session." } }));
            ws.close();
            return;
          }

          currentUserId = userId;
          
          // Store connection
          const conns = connections.get(userId) || [];
          conns.push(ws);
          connections.set(userId, conns);

          // Update status to online in database
          db.updateUser(userId, { status: "online" });

          // Broadcast status change
          broadcast("user_status_changed", { userId, status: "online" });
          console.log(`[WebSocket] User ${userId} joined session.`);

          // Send success receipt
          ws.send(JSON.stringify({ type: "joined", payload: { userId } }));
        }

        if (type === "typing") {
          const { chatId, isTyping } = payload;
          if (currentUserId) {
            let targetChatId = chatId;
            if (chatId === "chat_ai") {
              targetChatId = `chat_ai_${currentUserId}`;
            }
            const chat = db.getChat(targetChatId);
            // Verify membership before broadcasting
            if (chat && chat.memberIds.includes(currentUserId)) {
              const clientChatId = chatId === "chat_ai" ? "chat_ai" : targetChatId;
              broadcastToMembers(chat.memberIds, "typing", { chatId: clientChatId, userId: currentUserId, isTyping }, [ws]);
            }
          }
        }

        if (type === "read_receipt") {
          const { chatId, messageId } = payload;
          if (currentUserId) {
            try {
              let targetChatId = chatId;
              if (chatId === "chat_ai") {
                targetChatId = `chat_ai_${currentUserId}`;
              }
              const msg = db.getMessage(messageId);
              if (msg && msg.status !== 'seen') {
                const chat = db.getChat(targetChatId);
                // Verify membership before writing/broadcasting
                if (chat && chat.memberIds.includes(currentUserId)) {
                  db.updateMessage(messageId, { status: 'seen' });
                  const clientChatId = chatId === "chat_ai" ? "chat_ai" : targetChatId;
                  broadcastToMembers(chat.memberIds, "message_read", { chatId: clientChatId, messageId, status: 'seen' });
                }
              }
            } catch (e) {
              console.error("Failed to mark message read:", e);
            }
          }
        }

        if (type === "react_message") {
          const { chatId, messageId, emoji } = payload;
          if (currentUserId) {
            try {
              let targetChatId = chatId;
              if (chatId === "chat_ai") {
                targetChatId = `chat_ai_${currentUserId}`;
              }
              const message = db.getMessage(messageId);
              if (message) {
                const chat = db.getChat(targetChatId);
                // Verify membership before modifying reactions
                if (chat && chat.memberIds.includes(currentUserId)) {
                  const reactions = message.reactions || [];
                  const rIndex = reactions.findIndex(r => r.emoji === emoji);
                  if (rIndex > -1) {
                    const userIds = reactions[rIndex].userIds;
                    const uIndex = userIds.indexOf(currentUserId);
                    if (uIndex > -1) {
                      userIds.splice(uIndex, 1);
                    } else {
                      userIds.push(currentUserId);
                    }
                    if (userIds.length === 0) {
                      reactions.splice(rIndex, 1);
                    }
                  } else {
                    reactions.push({ emoji, userIds: [currentUserId] });
                  }
                  db.updateMessage(messageId, { reactions });
                  const clientChatId = chatId === "chat_ai" ? "chat_ai" : targetChatId;
                  broadcastToMembers(chat.memberIds, "message_reaction", { chatId: clientChatId, messageId, reactions });
                }
              }
            } catch (e) {
              console.error("Failed to toggle reaction:", e);
            }
          }
        }

      } catch (err) {
        console.error("[WebSocket] Message parsing error:", err);
      }
    });

    ws.on("close", () => {
      if (currentUserId) {
        const conns = connections.get(currentUserId) || [];
        const filteredConns = conns.filter(c => c !== ws);
        if (filteredConns.length === 0) {
          connections.delete(currentUserId);
          const lastSeen = new Date().toISOString();
          db.updateUser(currentUserId, { status: "offline", lastSeen });
          broadcast("user_status_changed", { userId: currentUserId, status: "offline", lastSeen });
          console.log(`[WebSocket] User ${currentUserId} disconnected.`);
        } else {
          connections.set(currentUserId, filteredConns);
        }
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ChatSphere full-stack backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
