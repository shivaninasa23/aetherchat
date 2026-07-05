import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Mail, User as UserIcon, MessageSquare, ArrowRight, 
  Chrome, CheckCircle2, ShieldCheck, Edit3, Image, FileText, ChevronRight 
} from 'lucide-react';
import { User } from '../types';

interface AuthScreenProps {
  onAuthComplete: (user: User) => void;
  isDark: boolean;
}

type AuthStep = 'login' | 'register' | 'forgot' | 'verify' | 'profile-setup' | 'reset-password';

export default function AuthScreen({ onAuthComplete, isDark }: AuthScreenProps) {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('Hey there! I am using ChatSphere.');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80');
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Check for resetToken in URL parameters on boot
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('resetToken');
      if (token) {
        setResetToken(token);
        setStep('reset-password');
        // Clean URL parameters immediately for best user experience and safety
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error("Failed to parse resetToken from query parameters:", err);
    }
  }, []);

  // Handle preset quick-login
  const handlePresetLogin = () => {
    setEmail('demo@chatsphere.io');
    setPassword('password123');
    setError('');
  };

  const validateEmailFormat = (emailStr: string) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailStr);
  };

  const validatePasswordStrengthClient = (passwordStr: string) => {
    const hasLength = passwordStr.length >= 8;
    const hasUpper = /[A-Z]/.test(passwordStr);
    const hasLower = /[a-z]/.test(passwordStr);
    const hasDigit = /\d/.test(passwordStr);
    const hasSpecial = /[@$!%*?&#]/.test(passwordStr);
    return {
      isValid: hasLength && hasUpper && hasLower && hasDigit && hasSpecial,
      checks: { hasLength, hasUpper, hasLower, hasDigit, hasSpecial }
    };
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email || !password) {
      setError('Please fill in both email and password fields.');
      return;
    }
    if (!validateEmailFormat(email)) {
      setError('Please enter a valid email address (e.g., user@example.com).');
      return;
    }
    
    setLoading(true);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe: true })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.unverified) {
          setStep('verify');
        }
        throw new Error(d.error || 'Credentials verification failed.');
      }
      return d;
    })
    .then((user) => {
      setLoading(false);
      onAuthComplete(user);
    })
    .catch((err) => {
      setLoading(false);
      setError(err.message || "Failed to establish authenticated session.");
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email || !password || !confirmPassword || !fullName) {
      setError('All fields are required. Please fill in your name, email, and password.');
      return;
    }
    if (!validateEmailFormat(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    const pwCheck = validatePasswordStrengthClient(password);
    if (!pwCheck.isValid) {
      setError('Password is too weak. Requirements: at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one digit, and one special character (e.g., @$!%*?&#).');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    fetch("/api/auth/register-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'Registration initialization failed.');
      }
      setStep('verify');
    })
    .catch((err) => {
      setError(err.message || "Failed to register account.");
    })
    .finally(() => {
      setLoading(false);
    });
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'Failed to request password reset link.');
      }
      setSuccessMsg(d.message || 'A password reset link has been sent to your email.');
    })
    .catch((err) => {
      setError(err.message || "Could not process password reset.");
    })
    .finally(() => {
      setLoading(false);
    });
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const code = verificationCode.join('');
    if (code.length < 4) {
      setError('Please enter the 4-digit code.');
      return;
    }
    setLoading(true);
    fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'Code verification failed.');
      }
      setStep('profile-setup');
    })
    .catch((err) => {
      setError(err.message || "Invalid verification code.");
    })
    .finally(() => {
      setLoading(false);
    });
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!fullName || !username) {
      setError('Name and Username are required.');
      return;
    }
    setLoading(true);
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        username: username.replace('@', '').toLowerCase(),
        fullName,
        avatar,
        bio
      })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'Could not register user session.');
      }
      return d;
    })
    .then((user) => {
      setLoading(false);
      onAuthComplete(user);
    })
    .catch((err) => {
      setLoading(false);
      setError(err.message || "Could not register user session.");
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    const pwCheck = validatePasswordStrengthClient(newPassword);
    if (!pwCheck.isValid) {
      setError('Your new password is not strong enough! Requirements: at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special symbol (@$!%*?&#).');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match. Please ensure both entries are identical.');
      return;
    }
    setLoading(true);
    fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, newPassword })
    })
    .then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'Failed to reset password.');
      }
      setSuccessMsg(d.message || 'Password reset successfully.');
      setTimeout(() => {
        setStep('login');
        setSuccessMsg('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 3000);
    })
    .catch((err) => {
      setError(err.message || 'An error occurred while resetting your password.');
    })
    .finally(() => {
      setLoading(false);
    });
  };

  const handleGoogleLogin = () => {
    setShowGoogleModal(true);
  };

  const handleSelectGoogleAccount = (googleEmail: string, name: string, pic: string) => {
    setShowGoogleModal(false);
    setLoading(true);
    setError('');
    setSuccessMsg('');
    fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleEmail, name, avatar: pic })
    })
    .then(async (res) => {
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Google handshake failed.');
      }
      return res.json();
    })
    .then((user) => {
      setLoading(false);
      onAuthComplete(user);
    })
    .catch((err) => {
      setLoading(false);
      setError(err.message || "Google Secure Authenticator handshake failed.");
    });
  };

  const preselectedAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Dynamic Ambient Background Blur Circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/15 blur-[120px] dark:bg-indigo-500/10 animate-pulse-subtle" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[120px] dark:bg-purple-500/10 animate-pulse-subtle" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-8 shadow-2xl transition-all duration-300 ${isDark ? 'glass-panel-dark' : 'glass-panel-light'}`}
        id="auth-card"
      >
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <MessageSquare className="h-7 w-7 text-white" />
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border border-white dark:border-slate-950" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
            AetherChat
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Next-generation secure communications platform
          </p>
        </div>

        {/* Auth Steps with Framer Motion AnimatePresence */}
        <AnimatePresence mode="wait">
          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all outline-hidden border ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 focus:shadow-md'}`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setError(''); setStep('forgot'); }}
                      className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all outline-hidden border ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 focus:shadow-md'}`}
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-600/35 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>Sign In <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                {/* Google Sign In */}
                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <span className={`relative px-3 text-xs text-slate-400 uppercase tracking-wider font-semibold ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-3 py-3 rounded-2xl border font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}
                >
                  <Chrome className="h-5 w-5 text-red-500" />
                  Google Cloud Secure Auth
                </button>

                {/* Signup Toggle */}
                <p className="text-center text-xs text-slate-400 mt-6 font-medium">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep('register'); }}
                    className="font-bold text-indigo-500 hover:text-indigo-600"
                  >
                    Create Account
                  </button>
                </p>

                {/* Real-time Multi-User testing profiles */}
                <div className="mt-6 p-4 rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5 text-center">
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold mb-1">
                    Real-time Multi-User Testing Profiles
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    Open this app in <strong>two separate windows/tabs</strong>, log in as different team members, and chat back and forth in real-time!
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'self', name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80', role: 'Alex (Self)' },
                      { id: 'sarah', name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', role: 'Sarah (Design)' },
                      { id: 'marcus', name: 'Marcus Vance', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80', role: 'Marcus (PM)' },
                      { id: 'elena', name: 'Elena Rostova', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80', role: 'Elena (Architect)' },
                    ].map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setLoading(true);
                          const resolvedEmail = member.id === 'self' ? 'demo@chatsphere.io' : `${member.id}@chatsphere.io`;
                          fetch("/api/auth/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: resolvedEmail, password: "password123" })
                          })
                          .then(async (res) => {
                            if (!res.ok) {
                              throw new Error("Handshake failed.");
                            }
                            return res.json();
                          })
                          .then((user) => {
                            setLoading(false);
                            onAuthComplete(user);
                          })
                          .catch((err) => {
                            setLoading(false);
                            setError("Failed to initialize secure testing profile.");
                          });
                        }}
                        className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all hover:scale-[1.02] cursor-pointer ${isDark ? 'border-slate-800 bg-slate-900/40 hover:border-indigo-500' : 'border-slate-200 bg-white hover:border-indigo-500'}`}
                      >
                        <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-lg object-cover" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold truncate leading-tight">{member.name}</span>
                          <span className="text-[8px] text-slate-400 font-mono">{member.role}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Alex Rivera"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@chatsphere.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-600/35 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>Create Account <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                <p className="text-center text-xs text-slate-400 mt-6 font-medium">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep('login'); }}
                    className="font-bold text-indigo-500 hover:text-indigo-600"
                  >
                    Sign In
                  </button>
                </p>
              </form>
            </motion.div>
          )}

          {step === 'forgot' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-400 text-center leading-relaxed mb-4">
                  Enter your email address below and we'll send you an encrypted link to reset your secure credentials.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@chatsphere.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 text-center font-medium">
                    {successMsg}
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setError(''); setSuccessMsg(''); setStep('login'); }}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-indigo-500 mt-4 block"
                >
                  Back to Sign In
                </button>
              </form>
            </motion.div>
          )}

          {step === 'verify' && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold">Two-Factor Email Verification</h3>
              <p className="text-xs text-slate-400 mt-2 mb-6">
                An encrypted security code was dispatched to your email. Enter the 4 digits below.
              </p>

              <form onSubmit={handleVerifySubmit} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      id={`code-${idx}`}
                      type="text"
                      maxLength={1}
                      value={verificationCode[idx]}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newCode = [...verificationCode];
                        newCode[idx] = val;
                        setVerificationCode(newCode);
                        if (val && idx < 3) {
                          document.getElementById(`code-${idx + 1}`)?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !verificationCode[idx] && idx > 0) {
                          document.getElementById(`code-${idx - 1}`)?.focus();
                        }
                      }}
                      className={`w-14 h-14 text-center text-xl font-bold rounded-2xl border transition-all focus:border-indigo-500 outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 text-white' : 'bg-white border-slate-200'}`}
                    />
                  ))}
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg cursor-pointer"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Verify Code'
                  )}
                </button>

                <p className="text-xs text-slate-400">
                  Didn't receive code?{' '}
                  <button type="button" onClick={() => setSuccessMsg('New security token generated.')} className="font-bold text-indigo-500 hover:underline">
                    Resend Code
                  </button>
                </p>
              </form>
            </motion.div>
          )}

          {step === 'profile-setup' && (
            <motion.div
              key="profile-setup"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-bold text-center mb-1">Set Up Your Profile</h3>
              <p className="text-xs text-slate-400 text-center mb-6">
                Personalize your ChatSphere workspace to launch your encrypted session.
              </p>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {/* Avatar Picker */}
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="relative group">
                    <img
                      src={avatar}
                      alt="User Avatar"
                      className="w-20 h-20 rounded-3xl object-cover border-2 border-indigo-500/20"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Image className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">Select prebuilt avatar gradient:</span>
                  <div className="flex gap-2">
                    {preselectedAvatars.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatar(url)}
                        className={`w-7 h-7 rounded-lg overflow-hidden border transition-transform hover:scale-110 ${avatar === url ? 'ring-2 ring-indigo-500 border-transparent' : 'border-slate-200 dark:border-slate-800'}`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Display Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Alex Rivera"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (!username) {
                          setUsername(e.target.value.toLowerCase().replace(/ /g, '_'));
                        }
                      }}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">@</span>
                    <input
                      type="text"
                      placeholder="alex_rivera"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-8 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Bio Status
                  </label>
                  <div className="relative">
                    <Edit3 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="What is on your mind?"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg cursor-pointer"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Launch ChatSphere Session'
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'reset-password' && (
            <motion.div
              key="reset-password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-bold text-center mb-1">Reset Secure Password</h3>
              <p className="text-xs text-slate-400 text-center mb-6">
                Enter your new, strong cryptographic password below.
              </p>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className={`w-full rounded-2xl py-3 pl-11 pr-4 text-sm transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 text-center font-medium">
                    {successMsg}
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 text-center font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Reset Password'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setError(''); setSuccessMsg(''); setStep('login'); }}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-indigo-500 mt-4 block"
                >
                  Cancel and Sign In
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Branded Google OAuth Account Selector Modal */}
      <AnimatePresence>
        {showGoogleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200"
            >
              {/* Google top branding */}
              <div className="p-6 text-center border-b border-slate-100 flex flex-col items-center">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 mb-2">
                  <Chrome className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Sign in with Google</h3>
                <p className="text-xs text-slate-500 mt-1">to continue to AetherChat secure node</p>
              </div>

              <div className="p-5 space-y-3.5 bg-slate-50/50">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select a Google account
                </span>

                {[
                  {
                    email: 'alex.rivera@gmail.com',
                    name: 'Alex Rivera',
                    pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'
                  },
                  {
                    email: 'sarah.jenkins.design@gmail.com',
                    name: 'Sarah Jenkins',
                    pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80'
                  },
                  {
                    email: 'marcus.vance.pm@gmail.com',
                    name: 'Marcus Vance',
                    pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80'
                  }
                ].map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleSelectGoogleAccount(account.email, account.name, account.pic)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={account.pic} alt={account.name} className="w-8 h-8 rounded-full object-cover border border-slate-100" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{account.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{account.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  </button>
                ))}

                <button
                  onClick={() => {
                    const customEmail = prompt("Enter your Google Account Email:", "yourname@gmail.com");
                    if (customEmail && customEmail.includes('@')) {
                      handleSelectGoogleAccount(
                        customEmail,
                        customEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
                      );
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 text-center text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer bg-white"
                >
                  Use another account
                </button>
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200/50 flex justify-between items-center text-[10px] text-slate-500">
                <span>Google Cloud Platform</span>
                <button
                  onClick={() => setShowGoogleModal(false)}
                  className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
