"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, Sparkles, CheckCircle2, User, TerminalSquare, Send, MessageSquarePlus, LogOut, MessageSquare, ArrowRight, ChevronLeft, ChevronRight, LogIn, UserPlus, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PIPELINE_STEPS = [
  { id: 'v1', label: 'Agent Alpha: Proposal (V1)', icon: BrainCircuit },
  { id: 'eval1', label: 'Agent Beta: Critique', icon: Sparkles },
  { id: 'v2', label: 'Agent Beta: Refinement (V2)', icon: BrainCircuit },
  { id: 'eval2', label: 'Chairman: Final Verification', icon: Sparkles },
  { id: 'v3', label: 'Chairman: Synthesis (V3)', icon: CheckCircle2 }
];

type Turn = {
  id: string;
  prompt: string;
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

export default function AppUI() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Initialize from saved user session
  useEffect(() => {
    async function initAuth() {
      const savedUser = localStorage.getItem('ac_user');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          setUser(u);
          await loadUserSessions(u.email);
        } catch {
          // ignore corrupted storage
        }
      }
      setMounted(true);
    }
    initAuth();
  }, []);

  const loadUserSessions = async (email: string) => {
    setIsLoadingHistory(true);
    try {
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
      } else {
        setSessions([]);
        setActiveSessionId(null);
      }
    } catch {
      // offline or network error fallback
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save changes to Supabase (Only when stream is completed to prevent rate limiting)
  useEffect(() => {
    if (mounted && user && !isProcessing && sessions.length > 0) {
      const active = sessions.find(s => s.id === activeSessionId);
      if (active && user.email !== 'guest@conclave.local') {
        supabase.from('conclave_sessions').upsert({
          id: active.id,
          user_email: user.email,
          title: active.title,
          updated_at: active.updatedAt,
          turns: active.turns
        }).then(({ error }) => { if (error) console.warn("Supabase sync error:", error); });
      }
    }
  }, [sessions, activeSessionId, mounted, user, isProcessing]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const turns = activeSession?.turns || [];

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = ((fd.get('email') as string) || '').trim().toLowerCase();
    if (!email) return;

    const rawName = (fd.get('name') as string) || '';
    const name = rawName.trim() || email.split('@')[0];
    const u = { name, email };

    setUser(u);
    localStorage.setItem('ac_user', JSON.stringify(u));
    await loadUserSessions(email);
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
    localStorage.removeItem('ac_user');
  };

  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: 'New Deliberation',
      updatedAt: Date.now(),
      turns: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const startAnalysis = async () => {
    if (!input.trim() || isProcessing) return;

    // Ensure we have an active session
    let currentSessionId = activeSessionId;
    if (!currentSessionId || !activeSession) {
      const newSession: Session = {
        id: Date.now().toString(),
        title: input.slice(0, 30) + '...',
        updatedAt: Date.now(),
        turns: []
      };
      setSessions([newSession, ...sessions]);
      currentSessionId = newSession.id;
      setActiveSessionId(currentSessionId);
    } else if (activeSession.turns.length === 0) {
      // update title of empty session
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: input.slice(0, 30) + '...' } : s));
    }

    const promptRef = input;

    const newTurn: Turn = {
      id: Date.now().toString(),
      prompt: input,
      v1: '', eval1: '', change1: '', v2: '', eval2: '', change2: '', v3: '',
      status: 'running',
      currentStepIndex: 0,
      activeTab: 'v1'
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) return { ...s, updatedAt: Date.now(), turns: [...s.turns, newTurn] };
      return s;
    }));

    setInput('');
    setIsProcessing(true);

    const history = turns.map(t => ({
      user: t.prompt,
      assistant: t.v3
    }));

    try {
      const res = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptRef, history })
      });

      if (!res.body) throw new Error('No body');

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

              setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const updatedTurns = [...s.turns];
                const active = { ...updatedTurns[updatedTurns.length - 1] };

                if (data.step === 'v1') {
                  active.currentStepIndex = 0; active.activeTab = 'v1'; active.v1 += data.chunk;
                } else if (data.step === 'eval1') {
                  active.currentStepIndex = 1; active.eval1 += data.chunk;
                } else if (data.step === 'change1') {
                  active.change1 += data.chunk;
                } else if (data.step === 'v2') {
                  active.currentStepIndex = 2; active.activeTab = 'v2'; active.v2 += data.chunk;
                } else if (data.step === 'eval2') {
                  active.currentStepIndex = 3; active.eval2 += data.chunk;
                } else if (data.step === 'change2') {
                  active.change2 += data.chunk;
                } else if (data.step === 'v3') {
                  active.currentStepIndex = 4; active.activeTab = 'v3'; active.v3 += data.chunk;
                } else if (data.step === 'completed') {
                  active.status = 'completed';
                }

                updatedTurns[updatedTurns.length - 1] = active;
                return { ...s, turns: updatedTurns };
              }));

            } catch {
              // Ignore parse errors from chunking
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      setSessions(prev => prev.map(s => {
        if (s.id !== currentSessionId) return s;
        const updatedTurns = [...s.turns];
        updatedTurns[updatedTurns.length - 1].status = 'completed';
        return { ...s, turns: updatedTurns };
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  if (!mounted) return null;

  // Streamlined, unified Sign In / Sign Up portal (no redundant intermediate splash screen)
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
              AI Conclave is a self-improving deliberation system. Submit complex problems and watch as autonomous agents debate, critique, and synthesize the ultimate resolution.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-4 max-w-lg">
              <div className="p-3.5 rounded-2xl bg-surface border border-border">
                <span className="font-serif font-bold text-gold text-lg block">V1</span>
                <span className="text-xs text-foreground/60 font-sans">Alpha Proposal</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-surface border border-border">
                <span className="font-serif font-bold text-gold text-lg block">V2</span>
                <span className="text-xs text-foreground/60 font-sans">Beta Critique</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-surface border border-border">
                <span className="font-serif font-bold text-gold text-lg block">V3</span>
                <span className="text-xs text-foreground/60 font-sans">Executive Synthesis</span>
              </div>
            </div>
          </div>

          {/* Unified Sign In & Sign Up Card */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-surface border border-border shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-sm relative">
              {/* Tabs: Sign In vs Sign Up */}
              <div className="flex bg-surface-dark p-1 rounded-2xl border border-border mb-6">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === 'signin'
                      ? 'bg-gold text-background shadow-md'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === 'register'
                      ? 'bg-gold text-background shadow-md'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Sign Up
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-serif text-foreground mb-1">
                  {authMode === 'signin' ? 'Welcome Back' : 'Create an Account'}
                </h2>
                <p className="text-xs text-foreground/60 font-sans mb-6">
                  {authMode === 'signin'
                    ? 'Enter your email to load your previous deliberations.'
                    : 'Register with your name and email to save your deliberations.'}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Full Name</label>
                    <input
                      required
                      name="name"
                      type="text"
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-foreground/80 ml-1 block mb-1">Email Address</label>
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-border outline-none focus:ring-2 focus:ring-gold/50 transition-all font-sans text-sm text-foreground placeholder:text-foreground/40"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-foreground text-background py-3.5 rounded-xl font-medium hover:bg-foreground/90 transition-all shadow-md mt-2 flex justify-center items-center gap-2 text-sm"
                >
                  {authMode === 'signin' ? 'Sign In & Continue' : 'Create Account'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-border/60 flex flex-col items-center gap-3">
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
                sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${
                      activeSessionId === s.id
                        ? 'bg-gold/10 text-gold font-medium'
                        : 'hover:bg-surface-dark/80 text-foreground/70'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{s.title}</span>
                  </button>
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
                    className={`relative flex items-start gap-4 ${isPast ? 'opacity-80' : isActive ? 'opacity-100' : 'opacity-30'}`}
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 space-y-4 relative z-10 bg-surface">
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
                Submit a complex, multifaceted problem. Watch as three autonomous agents debate, refine, and synthesize the ultimate resolution.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-smooth py-8 px-4 md:px-8 relative no-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 pb-32">
              {turns.map((turn) => (
                <div key={turn.id} className="space-y-8">
                  {/* User Message Bubble */}
                  <div className="flex items-start gap-4 justify-end">
                    <div className="bg-foreground text-background px-6 py-4 rounded-3xl rounded-tr-sm max-w-[85%] shadow-md">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-sans">{turn.prompt}</p>
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
                            (tab === 'v1' && turn.currentStepIndex >= 0) ||
                            (tab === 'v2' && turn.currentStepIndex >= 2) ||
                            (tab === 'v3' && turn.currentStepIndex >= 4);
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
                              {tab === 'v1' ? 'Agent Alpha (V1)' : tab === 'v2' ? 'Agent Beta (V2)' : 'Synthesis (V3)'}
                              {isActive && (
                                <motion.div layoutId={`tab_${turn.id}`} className="absolute -bottom-3 left-0 right-0 h-0.5 bg-gold" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Terminology Header */}
                      <h3 className="text-xl font-serif text-foreground/80 mb-6">
                        {turn.activeTab === 'v1' && "Alpha's Initial Proposal"}
                        {turn.activeTab === 'v2' && "Beta's Refined Architecture"}
                        {turn.activeTab === 'v3' && "Chairman's Final Synthesis"}
                      </h3>

                      {/* Content Body */}
                      <div className="text-[15px] leading-relaxed space-y-4 font-sans text-foreground/90 pb-2">
                        {turn.activeTab === 'v1' &&
                          (turn.v1 ? (
                            <div dangerouslySetInnerHTML={{ __html: turn.v1.replace(/\n/g, '<br/>') }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Alpha is writing...
                            </span>
                          ))}
                        {turn.activeTab === 'v2' &&
                          (turn.v2 ? (
                            <div dangerouslySetInnerHTML={{ __html: turn.v2.replace(/\n/g, '<br/>') }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Beta is refining...
                            </span>
                          ))}
                        {turn.activeTab === 'v3' &&
                          (turn.v3 ? (
                            <div dangerouslySetInnerHTML={{ __html: turn.v3.replace(/\n/g, '<br/>') }} />
                          ) : (
                            <span className="text-foreground/40 animate-pulse flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Chairman is synthesizing...
                            </span>
                          ))}
                      </div>

                      {/* Embedded Critique if generating next step */}
                      {turn.activeTab === 'v1' && turn.currentStepIndex === 1 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-5 bg-gold/5 rounded-2xl border border-gold/20 border-l-4 border-l-gold">
                          <h4 className="font-serif text-sm font-semibold mb-2 flex items-center gap-2 text-gold">
                            <Sparkles className="w-4 h-4" /> Beta&apos;s Active Critique
                          </h4>
                          <p className="text-foreground/70 font-sans text-[14px] leading-relaxed">{turn.eval1}</p>
                        </motion.div>
                      )}
                      {turn.activeTab === 'v2' && turn.currentStepIndex === 3 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-5 bg-gold/5 rounded-2xl border border-gold/20 border-l-4 border-l-gold">
                          <h4 className="font-serif text-sm font-semibold mb-2 flex items-center gap-2 text-gold">
                            <CheckCircle2 className="w-4 h-4" /> Chairman&apos;s Verification
                          </h4>
                          <p className="text-foreground/70 font-sans text-[14px] leading-relaxed">{turn.eval2}</p>
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

        {/* Sticky Bottom Input Field */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-surface-dark via-surface-dark to-transparent pt-20">
          <div className="max-w-4xl mx-auto bg-surface border border-border rounded-3xl shadow-lg p-2 flex flex-col focus-within:ring-2 focus-within:ring-gold/50 transition-all focus-within:border-gold/50">
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
              placeholder={isProcessing ? "Agents are deliberating..." : "Ask a follow-up or enter a new complex scenario..."}
              className="w-full bg-transparent p-4 min-h-[50px] max-h-[200px] outline-none resize-none font-sans text-[15px] text-foreground placeholder:text-foreground/40 disabled:opacity-50"
              rows={1}
              autoFocus
            />
            <div className="flex justify-between items-center px-4 pb-2 pt-1 border-t border-border/40 mt-1">
              <span className="text-[11px] text-foreground/40 font-mono tracking-wider uppercase">Press Enter to send</span>
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
