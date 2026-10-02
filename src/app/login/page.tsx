'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { Particles } from '@/components/Particles';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const s = createSupabaseBrowser();
    if (mode === 'signup') {
      const { error } = await s.auth.signUp({ email, password, options: { data: { name } } });
      setMsg(error ? { text: error.message, ok: false } : { text: 'Account created. If email confirmation is on, check your inbox before signing in.', ok: true });
    } else {
      const { error } = await s.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: error.message, ok: false }); else { location.href = '/join'; return; }
    }
    setBusy(false);
  }

  return (
    <div className="auth-wrap" style={{ position: 'relative' }}>
      <Particles density={0.00004} />
      <motion.div className="auth card glow" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} style={{ padding: 32, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <h1 className="h1" style={{ fontSize: 32 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="lead">{mode === 'login' ? 'Sign in to join live quizzes.' : 'Your display name is what everyone sees on the leaderboard.'}</p>
          </motion.div>
        </AnimatePresence>

        <form onSubmit={submit} className="grid" style={{ marginTop: 24 }}>
          <AnimatePresence initial={false}>
            {mode === 'signup' && (
              <motion.div key="name" className="field" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', padding: 2 }}>
                <label className="label" htmlFor="name">Display name</label>
                <input id="name" className="input" placeholder="e.g. Aisha K." value={name} onChange={e => setName(e.target.value)} required autoComplete="nickname" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          <button className="btn lg block" disabled={busy}>
            {busy ? <span className="spinner" /> : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={18} /></>}
          </button>
        </form>

        <AnimatePresence>
          {msg && <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={msg.ok ? 'success' : 'error'} style={{ marginTop: 16 }}>{msg.text}</motion.p>}
        </AnimatePresence>

        <p className="muted center" style={{ marginTop: 22, fontSize: 14 }}>
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); }}
            style={{ background: 'none', border: 0, color: '#b6b0ff', cursor: 'pointer', fontWeight: 700 }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
