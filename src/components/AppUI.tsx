"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  User,
  TerminalSquare,
  Send,
  MessageSquarePlus,
  LogOut,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LogIn,
  UserPlus,
  Compass,
  Eye,
  EyeOff,
  Zap,
  Scale,
  BookOpen,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMarkdown } from '@/lib/formatMarkdown';

const PIPELINE_STEPS = [
  { id: 'v1', label: 'Agent Alpha: Proposal (V1)', icon: BrainCircuit },
  { id: 'eval1', label: 'Agent Beta: Critique', icon: Sparkles },
  { id: 'v2', label: 'Agent Beta: Refinement (V2)', icon: BrainCircuit },
  { id: 'eval2', label: 'Chairman: Final Verification', icon: Sparkles },
  { id: 'v3', label: 'Chairman: Synthesis (V3)', icon: CheckCircle2 }
];

type DepthMode = 'brief' | 'moderate' | 'detailed';

type Turn = {
  id: string;
  prompt: string;
  depth?: DepthMode;
  v1: string;
  eval1: string;
  change1: string;
  v2: string;
  eval2: string;
  change2: string;
  v3: string;
  status: 'running' | 'completed';
  currentStepIndex: number;
  activeTab: 'v1' | 'v2' | 'v3';
};

type Session = {
  id: string;
  title: string;
  updatedAt: number;
  turns: Turn[];
};

type ConclaveSessionRow = {
  id: string;
  user_email: string;
  title: string;
  updated_at: number;
  turns: Turn[];
};

interface StoredAccount {
  name: string;
  email: string;
  password?: string;
  createdAt: number;
}

export default function AppUI() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Deliberation Input State
  const [input, setInput] = useState('');
  const [responseDepth, setResponseDepth] = useState<DepthMode>('moderate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Authentication State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  // Initialize from saved session
  useEffect(() => {
    async function initAuth() {
      const savedUser = localStorage.getItem('ac_user');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          setUser(u);
          await loadUserSessions(u.email);
        } catch {
          // ignore corrupted local data
        }
      }
      setMounted(true);
    }
    initAuth();
  }, []);

  const loadUserSessions = async (email: string) => {
    setIsLoadingHistory(true);
    try {
      // 1. Try Supabase
      const { data } = await supabase
        .from('conclave_sessions')
        .select('*')
        .eq('user_email', email)
        .order('updated_at', { ascending: false });

      if (data && data.length > 0) {
        const loadedSessions: Session[] = (data as unknown as ConclaveSessionRow[]).map((d) => ({
          id: d.id,
          title: d.title,
          updatedAt: Number(d.updated_at),
          turns: d.turns || []
        }));
        setSessions(loadedSessions);
        setActiveSessionId(loadedSessions[0].id);
        // Backup locally
        localStorage.setItem(`ac_sessions_${email}`, JSON.stringify(loadedSessions));
        return;
      }
    } catch {
      // Supabase unavailable, fallback to local backup
    } finally {
      setIsLoadingHistory(false);
    }

    // 2. Fallback to Local Backup
    try {
      const cached = localStorage.getItem(`ac_sessions_${email}`);
      if (cached) {
        const parsed: Session[] = JSON.parse(cached);
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  // Save changes to Supabase & LocalStorage (Only when stream is completed)
  useEffect(() => {
    if (mounted && user && !isProcessing && sessions.length > 0) {
      // Save local backup immediately
      localStorage.setItem(`ac_sessions_${user.email}`, JSON.stringify(sessions));

      // Sync active session with Supabase
      const active = sessions.find((s) => s.id === activeSessionId);
      if (active && user.email !== 'guest@conclave.local') {
        supabase
          .from('conclave_sessions')
          .upsert({
            id: active.id,
            user_email: user.email,
            title: active.title,
            updated_at: active.updatedAt,
            turns: active.turns
          })
          .then(({ error }) => {
            if (error) console.warn('Supabase sync note:', error.message);
          });
      }
    }
  }, [sessions, activeSessionId, mounted, user, isProcessing]);

  // Active Session & Turn Helpers
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const turns = activeSession?.turns || [];
  const activeTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  // Authentication Handlers
  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = ((fd.get('email') as string) || '').trim().toLowerCase();
    const password = ((fd.get('password') as string) || '').trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError('Please enter a valid email address.');
      setAuthLoading(false);
      return;
    }

    // Get stored accounts
    let accounts: Record<string, StoredAccount> = {};
    try {
      const rawAccounts = localStorage.getItem('ac_accounts');
      if (rawAccounts) accounts = JSON.parse(rawAccounts);
    } catch {
      accounts = {};
    }

    if (authMode === 'register') {
      const name = ((fd.get('name') as string) || '').trim();
      const confirmPassword = ((fd.get('confirmPassword') as string) || '').trim();

      if (!name) {
        setAuthError('Please enter your full name.');
        setAuthLoading(false);
        return;
      }

      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        setAuthLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setAuthError('Passwords do not match.');
        setAuthLoading(false);
        return;
      }

      if (accounts[email]) {
        setAuthError('An account with this email already exists. Please Sign In.');
        setAuthLoading(false);
        return;
      }

      // Check Supabase for existing user
      try {
        const { data } = await supabase
          .from('conclave_users')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (data?.email) {
          setAuthError('An account with this email already exists. Please Sign In.');
          setAuthLoading(false);
          return;
        }
      } catch {
        // ignore if table doesn't exist
      }

      // Save account locally
      accounts[email] = {
        name,
        email,
        password,
        createdAt: Date.now()
      };
      localStorage.setItem('ac_accounts', JSON.stringify(accounts));

      // Attempt save to Supabase
      try {
        await supabase.from('conclave_users').upsert({
          email,
          name,
          password,
          created_at: Date.now()
        });
      } catch {
        // ignore if offline
      }

      const newUser = { name, email };
      setUser(newUser);
      localStorage.setItem('ac_user', JSON.stringify(newUser));
      setSessions([]);
      setActiveSessionId(null);
    } else {
      // 🔒 STRICT SIGN IN (LOGIN)
      if (!password) {
        setAuthError('Please enter your password.');
        setAuthLoading(false);
        return;
      }

      let existingAccount = accounts[email];

      // Check Supabase conclave_users if not found in local browser
      if (!existingAccount) {
        try {
          const { data, error } = await supabase
            .from('conclave_users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (data && !error && data.email) {
            existingAccount = {
              name: data.name,
              email: data.email,
              password: data.password,
              createdAt: Number(data.created_at) || Date.now()
            };
            accounts[email] = existingAccount;
            localStorage.setItem('ac_accounts', JSON.stringify(accounts));
          }
        } catch {
          // ignore if table doesn't exist
        }
      }

      // STRICT CHECK: IF NOT REGISTERED, DENY ACCESS!
      if (!existingAccount) {
        setAuthError('No account found with this email. Please click "Register" above to create an account.');
        setAuthLoading(false);
        return;
      }

      // STRICT CHECK: VERIFY PASSWORD
      if (existingAccount.password !== password) {
        setAuthError('Incorrect password. Please try again.');
        setAuthLoading(false);
        return;
      }

      // Successful login
      const loggedInUser = { name: existingAccount.name, email };
      setUser(loggedInUser);
      localStorage.setItem('ac_user', JSON.stringify(loggedInUser));
      await loadUserSessions(email);
    }

    setAuthLoading(false);
  };

  const handleGuestEntry = () => {
    const guestUser = { name: 'Guest Explorer', email: 'guest@conclave.local' };
    setUser(guestUser);
    setSessions([]);
    setActiveSessionId(null);
  };

  const handleLogout = () => {
    setUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setAuthError(null);
    localStorage.removeItem('ac_user');
  };

  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: 'New Deliberation',
      updatedAt: Date.now(),
      turns: []
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (user && user.email !== 'guest@conclave.local') {
      supabase
        .from('conclave_sessions')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.warn('Supabase delete error:', error);
        });
    }
  };

  const startAnalysis = async () => {
    if (!input.trim() || isProcessing) return;

    // Ensure we have an active session
    let currentSessionId = activeSessionId;
    if (!currentSessionId || !activeSession) {
      const newSession: Session = {
        id: Date.now().toString(),
        title: input.slice(0, 32) + '...',
        updatedAt: Date.now(),
        turns: []
      };
      setSessions([newSession, ...sessions]);
      currentSessionId = newSession.id;
      setActiveSessionId(currentSessionId);
    } else if (activeSession.turns.length === 0) {
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, title: input.slice(0, 32) + '...' } : s))
      );
    }

    const promptRef = input;
    const chosenDepth = responseDepth;

    const newTurn: Turn = {
      id: Date.now().toString(),
      prompt: input,
      depth: chosenDepth,
      v1: '',
      eval1: '',
      change1: '',
      v2: '',
      eval2: '',
      change2: '',
      v3: '',
      status: 'running',
      currentStepIndex: 0,
      activeTab: 'v1'
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          return { ...s, updatedAt: Date.now(), turns: [...s.turns, newTurn] };
        }
        return s;
      })
    );

    setInput('');
    setIsProcessing(true);

    const history = turns.map((t) => ({
      user: t.prompt,
      assistant: t.v3
    }));

    try {
      const res = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptRef, depth: chosenDepth, history })
      });

      if (!res.body) throw new Error('No response stream received.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== currentSessionId) return s;
                  const updatedTurns = [...s.turns];
                  const active = { ...updatedTurns[updatedTurns.length - 1] };

                  if (data.step === 'v1') {
                    active.currentStepIndex = 0;
                    active.activeTab = 'v1';
                    active.v1 += data.chunk;
                  } else if (data.step === 'eval1') {
                    active.currentStepIndex = 1;
                    active.eval1 += data.chunk;
                  } else if (data.step === 'change1') {
                    active.change1 = data.chunk;
                  } else if (data.step === 'v2') {
                    active.currentStepIndex = 2;
                    active.activeTab = 'v2';
                    active.v2 += data.chunk;
                  } else if (data.step === 'eval2') {
                    active.currentStepIndex = 3;
                    active.eval2 += data.chunk;
                  } else if (data.step === 'change2') {
                    active.change2 = data.chunk;
                  } else if (data.step === 'v3') {
                    active.currentStepIndex = 4;
                    active.activeTab = 'v3';
                    active.v3 += data.chunk;
                  } else if (data.step === 'completed') {
                    active.status = 'completed';
                  }

                  updatedTurns[updatedTurns.length - 1] = active;
                  return { ...s, turns: updatedTurns };
                })
              );
            } catch {
              // Ignore parse chunk fragments
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          const updatedTurns = [...s.turns];
          updatedTurns[updatedTurns.length - 1].status = 'completed';
          return { ...s, turns: updatedTurns };
        })
      );
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  if (!mounted) return null;

  // 🚪 FLAWLESS LOGIN & REGISTER PORTAL
  if (!user) {
    return (
      <div className="flex flex-col lg:flex-row h-full w-full bg-surface-dark items-center justify-center p-6 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-48 bg-gold/15 blur-[120px] pointer-events-none" />

        <div className="z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Brand & Introduction */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-medium tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> Multi-Agent Deliberation Engine
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-foreground tracking-tight leading-tight">
              The multi-agent <br />
              <span className="text-gold italic">intelligence engine.</span>
            </h1>
            <p className="text-base sm:text-lg text-foreground/70 font-sans max-w-xl leading-relaxed">
              AI Conclave deliberates across autonomous models with real-time web grounding and zero hallucinations.
              Choose between brief, moderate, or exhaustive deep-dive resolutions.
            </p>

            {/* 3 Response Depth Highlights */}
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg">
              <div className="p-3 rounded-2xl bg-surface border border-border text-left">
                <span className="inline-flex items-center gap-1 text-gold text-xs font-semibold mb-1">
                  <Zap className="w-3.5 h-3.5" /> Brief
                </span>
                <p className="text-[11px] text-foreground/60 leading-tight">High-impact summary & core points.</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-gold/30 bg-gold/5 text-left">
                <span className="inline-flex items-center gap-1 text-gold text-xs font-semibold mb-1">
                  <Scale className="w-3.5 h-3.5" /> Moderate
                </span>
                <p className="text-[11px] text-foreground/60 leading-tight">Balanced analysis & practical nuance.</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border text-left">
                <span className="inline-flex items-center gap-1 text-gold text-xs font-semibold mb-1">
                  <BookOpen className="w-3.5 h-3.5" /> Detailed
                </span>
                <p className="text-[11px] text-foreground/60 leading-tight">Exhaustive architectural breakdown.</p>
              </div>
            </div>
          </div>

          {/* Unified Login & Register Card */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-surface border border-border shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-sm relative">
              {/* Tab Selector */}
              <div className="flex bg-surface-dark p-1 rounded-2xl border border-border mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === 'login'
                      ? 'bg-gold text-background shadow-md'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === 'register'
                      ? 'bg-gold text-background shadow-md'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Register
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-serif text-foreground mb-1">
                  {authMode === 'login' ? 'Welcome Back' : 'Create an Account'}
                </h2>
                <p className="text-xs text-foreground/60 font-sans mb-4">
                  {authMode === 'login'
                    ? 'Sign in to access your past deliberations and persistent history.'
                    : 'Register your profile to preserve and organize multi-agent deliberations.'}
                </p>
              </div>

              {/* Error Alert with 1-click switcher */}
              {authError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex flex-col gap-1.5 font-sans">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                  {authError.includes('Register') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      className="text-gold hover:underline font-semibold text-left text-xs pl-6 cursor-pointer"
                    >
                      &rarr; Click here to Register with this email
                    </button>
                  )}
                  {authError.includes('Sign In') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className="text-gold hover:underline font-semibold text-left text-xs pl-6 cursor-pointer"
                    >
                      &rarr; Click here to Sign In
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                {authMode === 'register' && (
                  <div>
                    <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Full Name</label>
                    <input
                      required
                      name="name"
                      type="text"
                      placeholder="e.g. Rohit Kopalle"
                      className="w-full px-4 py-2.5 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Email Address</label>
                  <input
                    required
                    name="email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      required
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        required
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-foreground text-background py-3 rounded-xl font-medium hover:bg-foreground/90 transition-all shadow-md mt-1 flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : authMode === 'login' ? (
                    <>
                      Sign In & Continue <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Create Account <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-border/60 flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGuestEntry}
                  className="text-xs text-foreground/60 hover:text-gold transition-colors font-medium flex items-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5" /> Continue as Guest (explore without syncing)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 💬 MAIN CHAT & DELIBERATION WORKSPACE
  return (
    <div className="flex w-full h-full bg-surface-dark text-foreground overflow-hidden">
      {/* Session History Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-r border-border bg-surface flex flex-col z-10 overflow-hidden shrink-0"
          >
            <div className="h-20 p-4 border-b border-border flex items-center justify-center shrink-0">
              <button
                onClick={createNewSession}
                className="w-full flex items-center gap-2 bg-foreground text-background justify-center py-2.5 rounded-lg hover:bg-foreground/90 transition-all shadow-sm font-medium text-sm"
              >
                <MessageSquarePlus className="w-4 h-4" /> New Deliberation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest px-2 pb-2 pt-2">
                Recent Conclaves
              </p>
              {isLoadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-foreground/40 p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading sessions...
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      activeSessionId === s.id
                        ? 'bg-gold/10 text-gold font-medium'
                        : 'hover:bg-surface-dark/80 text-foreground/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(e, s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-foreground/40 transition-opacity rounded"
                      title="Delete deliberation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
              {!isLoadingHistory && sessions.length === 0 && (
                <p className="text-[13px] text-foreground/40 px-2 italic pt-2">No past sessions.</p>
              )}
            </div>

            <div className="p-4 border-t border-border mt-auto flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold shrink-0 text-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="truncate flex flex-col justify-center">
                  <p className="text-sm font-medium truncate leading-tight">{user?.name}</p>
                  <p className="text-xs text-foreground/50 truncate leading-tight mt-0.5">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-surface-dark rounded-md text-foreground/50 hover:text-foreground transition-colors shrink-0"
                title="Log out"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Deliberation Tracker Sidebar (Middle Layer) */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-surface shadow-sm z-20 shrink-0 relative">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-3.5 top-[28px] bg-surface border border-border rounded-full p-1.5 shadow-md hover:text-gold transition-colors z-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="h-20 px-6 py-4 border-b border-border flex flex-col justify-center shrink-0">
          <h2 className="font-serif text-[17px] font-medium tracking-tight">Active Deliberation</h2>
          <p className="text-[12px] text-foreground/50 mt-0.5">Real-time agent progression</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto no-scrollbar px-6">
          {activeTurn ? (
            !activeTurn.v1 && activeTurn.v3 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-sm font-medium mb-1">Direct Assistant Response</h3>
                <p className="text-xs text-foreground/50 leading-relaxed">
                  Council debate is paused for conversational greetings. Submit a problem or scenario to activate deliberation.
                </p>
              </div>
            ) : (
              <div className="space-y-6 relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-border/50" />
                {PIPELINE_STEPS.map((step, index) => {
                  const isActive = activeTurn.currentStepIndex === index && activeTurn.status === 'running';
                  const isPast = activeTurn.currentStepIndex > index || activeTurn.status === 'completed';
                  const Icon = step.icon;

                  return (
                    <motion.div
                      key={step.id + activeTurn.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`relative flex items-start gap-4 ${
                        isPast ? 'opacity-80' : isActive ? 'opacity-100' : 'opacity-30'
                      }`}
                    >
                      <div
                        className={`z-10 w-8 h-8 rounded-full flex items-center justify-center bg-surface border-2 transition-all ${
                          isActive
                            ? 'border-gold text-gold shadow-[0_0_12px_rgba(180,155,92,0.4)]'
                            : isPast
                            ? 'border-foreground text-foreground'
                            : 'border-border text-border/50'
                        }`}
                      >
                        {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <div className="pt-1">
                        <p className={`font-medium text-[13px] ${isActive ? 'text-gold' : ''}`}>{step.label}</p>
                        {isActive && <span className="text-[11px] text-gold/80 animate-pulse">Processing...</span>}
                      </div>
                    </motion.div>
                  );
                })}

                {(activeTurn.status === 'completed' || activeTurn.currentStepIndex > 1) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-12 space-y-4 relative z-10 bg-surface"
                  >
                    <h3 className="font-serif text-[15px] border-b border-border pb-2 text-foreground/80">Evolution Log</h3>

                    {activeTurn.change1 && (
                      <div className="bg-gold/5 border border-gold/20 p-3 rounded-xl text-xs shadow-sm">
                        <p className="text-foreground/80 leading-relaxed font-sans">{activeTurn.change1}</p>
                      </div>
                    )}

                    {activeTurn.change2 && activeTurn.currentStepIndex >= 4 && (
                      <div className="bg-gold/5 border border-gold/20 p-3 rounded-xl text-xs shadow-sm mt-3">
                        <p className="text-foreground/80 leading-relaxed font-sans">{activeTurn.change2}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <TerminalSquare className="w-10 h-10 mb-2" />
              <p className="text-xs px-2">Awaiting your query.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col relative h-full bg-surface-dark overflow-hidden">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 bg-surface border border-border rounded-lg p-2 shadow-sm hover:text-gold transition-colors z-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {turns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-y-auto">
            <div className="max-w-3xl w-full text-center space-y-8 z-10 mt-[-5vh]">
              <div className="bg-gold text-background w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xl mb-6">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <h1 className="text-4xl md:text-5xl font-serif text-foreground tracking-tight leading-tight">
                Start a New <span className="text-gold italic">Conclave</span>
              </h1>
              <p className="text-base text-foreground/60 font-sans max-w-lg mx-auto">
                Submit a complex, multifaceted problem. Watch as three autonomous agents debate, refine, and synthesize
                the ultimate resolution with verified facts.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-smooth py-8 px-4 md:px-8 relative no-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 pb-44">
              {turns.map((turn) => (
                <div key={turn.id} className="space-y-8">
                  {/* User Message Bubble with Depth Indicator */}
                  <div className="flex items-start gap-4 justify-end">
                    <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
                      {turn.depth && (
                        <span className="text-[11px] font-medium text-gold/80 px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold/20 flex items-center gap-1">
                          {turn.depth === 'brief' && <Zap className="w-3 h-3" />}
                          {turn.depth === 'moderate' && <Scale className="w-3 h-3" />}
                          {turn.depth === 'detailed' && <BookOpen className="w-3 h-3" />}
                          {turn.depth === 'brief' ? 'Brief Deliberation' : turn.depth === 'detailed' ? 'Detailed Deep-Dive' : 'Moderate Deliberation'}
                        </span>
                      )}
                      <div className="bg-foreground text-background px-6 py-4 rounded-3xl rounded-tr-sm shadow-md">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-sans">{turn.prompt}</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-foreground/70" />
                    </div>
                  </div>

                  {/* Assistant Document View */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0 border border-gold/30">
                      <BrainCircuit className="w-5 h-5 text-gold" />
                    </div>

                    <div className="flex-1 bg-surface border border-border rounded-3xl p-6 shadow-sm overflow-hidden">
                      {/* Tabs for this turn */}
                      <div className="flex border-b border-border pb-3 gap-6 mb-6 overflow-x-auto no-scrollbar">
                        {(['v1', 'v2', 'v3'] as const).map((tab) => {
                          const isActive = turn.activeTab === tab;
                          const isVisible =
                            (tab === 'v1' && turn.v1 && turn.currentStepIndex >= 0) ||
                            (tab === 'v2' && turn.v2 && turn.currentStepIndex >= 2) ||
                            (tab === 'v3' && (turn.v3 || turn.currentStepIndex >= 4));
                          if (!isVisible) return null;

                          return (
                            <button
                              key={tab}
                              onClick={() => {
                                setSessions((prev) =>
                                  prev.map((s) => {
                                    if (s.id !== activeSessionId) return s;
                                    return {
                                      ...s,
                                      turns: s.turns.map((t) => (t.id === turn.id ? { ...t, activeTab: tab } : t))
                                    };
                                  })
                                );
                              }}
                              className={`whitespace-nowrap font-medium text-sm transition-colors relative pb-1 ${
                                isActive ? 'text-gold' : 'text-foreground/50 hover:text-foreground/80'
                              }`}
                            >
                              {tab === 'v1' ? 'Agent Alpha (V1)' : tab === 'v2' ? 'Agent Beta (V2)' : (turn.v1 ? 'Synthesis (V3)' : 'Assistant')}
                              {isActive && (
                                <motion.div
                                  layoutId={`tab_${turn.id}`}
                                  className="absolute -bottom-3 left-0 right-0 h-0.5 bg-gold"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Terminology Header */}
                      <h3 className="text-xl font-serif text-foreground/80 mb-6">
                        {turn.activeTab === 'v1' && "Alpha's Initial Proposal"}
                        {turn.activeTab === 'v2' && "Beta's Refined Architecture"}
                        {turn.activeTab === 'v3' && (turn.v1 ? "Chairman's Final Synthesis" : "Conclave Assistant")}
                      </h3>

                      {/* Content Body */}
                      <div className="text-[15px] leading-relaxed space-y-3 font-sans text-foreground/90 pb-2">
                        {turn.activeTab === 'v1' &&
                          (turn.v1 ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(turn.v1) }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Alpha is formulating proposal...
                            </span>
                          ))}
                        {turn.activeTab === 'v2' &&
                          (turn.v2 ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(turn.v2) }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Beta is auditing and refining...
                            </span>
                          ))}
                        {turn.activeTab === 'v3' &&
                          (turn.v3 ? (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(turn.v3) }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Chairman is synthesizing final verdict...
                            </span>
                          ))}
                      </div>

                      {/* Embedded Critique if generating next step */}
                      {turn.activeTab === 'v1' && turn.currentStepIndex === 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 p-5 bg-gold/5 rounded-2xl border border-gold/20 border-l-4 border-l-gold"
                        >
                          <h4 className="font-serif text-sm font-semibold mb-2 flex items-center gap-2 text-gold">
                            <Sparkles className="w-4 h-4" /> Beta&apos;s Active Critique
                          </h4>
                          <div className="text-foreground/70 font-sans text-[14px] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMarkdown(turn.eval1) }} />
                        </motion.div>
                      )}
                      {turn.activeTab === 'v2' && turn.currentStepIndex === 3 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 p-5 bg-gold/5 rounded-2xl border border-gold/20 border-l-4 border-l-gold"
                        >
                          <h4 className="font-serif text-sm font-semibold mb-2 flex items-center gap-2 text-gold">
                            <CheckCircle2 className="w-4 h-4" /> Chairman&apos;s Verification
                          </h4>
                          <div className="text-foreground/70 font-sans text-[14px] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMarkdown(turn.eval2) }} />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} className="h-4" />
            </div>
          </div>
        )}

        {/* 🎛️ Sticky Bottom Input Area with 3-Option Depth Control */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-surface-dark via-surface-dark to-transparent pt-16">
          <div className="max-w-4xl mx-auto bg-surface border border-border rounded-3xl shadow-xl p-2.5 flex flex-col focus-within:ring-2 focus-within:ring-gold/50 transition-all focus-within:border-gold/50">
            {/* 3 User Depth Options Selector */}
            <div className="flex items-center justify-between px-3 pt-1 pb-2 border-b border-border/40">
              <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wider font-mono">
                Response Mode:
              </span>
              <div className="flex items-center gap-1 bg-surface-dark p-0.5 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setResponseDepth('brief')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    responseDepth === 'brief'
                      ? 'bg-gold text-background shadow-sm'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                  title="Brief: Direct, concise summary with key bullet points (~250 words)"
                >
                  <Zap className="w-3.5 h-3.5" /> Brief
                </button>
                <button
                  type="button"
                  onClick={() => setResponseDepth('moderate')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    responseDepth === 'moderate'
                      ? 'bg-gold text-background shadow-sm'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                  title="Moderate: Balanced, structured analysis without excess (~600 words)"
                >
                  <Scale className="w-3.5 h-3.5" /> Moderate
                </button>
                <button
                  type="button"
                  onClick={() => setResponseDepth('detailed')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    responseDepth === 'detailed'
                      ? 'bg-gold text-background shadow-sm'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                  title="Detailed: Comprehensive, deep-dive architectural synthesis (~1200+ words)"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Detailed
                </button>
              </div>
            </div>

            {/* Input Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startAnalysis();
                }
              }}
              disabled={isProcessing}
              placeholder={
                isProcessing
                  ? 'Agents are deliberating with real-time grounding...'
                  : responseDepth === 'brief'
                  ? 'Ask a question for a razor-sharp, concise brief...'
                  : responseDepth === 'detailed'
                  ? 'Enter a complex scenario for an exhaustive deep dive...'
                  : 'Enter a problem or question for a balanced deliberation...'
              }
              className="w-full bg-transparent p-4 min-h-[50px] max-h-[180px] outline-none resize-none font-sans text-[15px] text-foreground placeholder:text-foreground/40 disabled:opacity-50"
              rows={1}
              autoFocus
            />

            <div className="flex justify-between items-center px-4 pb-1.5 pt-1 border-t border-border/40 mt-1">
              <span className="text-[11px] text-foreground/40 font-mono tracking-wider uppercase">
                Press Enter to send
              </span>
              <button
                onClick={startAnalysis}
                disabled={!input.trim() || isProcessing}
                className="bg-gold hover:bg-gold-light text-background p-2.5 rounded-full transition-all disabled:opacity-40 shadow-md"
              >
                <Send className="w-4 h-4 translate-x-px translate-y-px" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
