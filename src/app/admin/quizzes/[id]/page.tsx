'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, CircleStop, Copy, Play, SkipForward, Trash2, Users } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { usePlayers } from '@/lib/usePlayers';
import { colorFor, initials } from '@/lib/ui';
import { Particles } from '@/components/Particles';
import { Confetti } from '@/components/Confetti';
import { ActionDialog } from '@/components/ActionDialog';

type Q = {
  id: string;
  title: string;
  room_code: string;
  status: string;
  current_question: number;
  question_started_at: string | null;
};

export default function Control({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [quiz, setQuiz] = useState<Q | null>(null);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fin, setFin] = useState(0);
  const { players } = usePlayers(id);

  useEffect(() => {
    params.then((x) => setId(x.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const s = createSupabaseBrowser();
    async function load() {
      const r = await fetch('/api/quizzes/' + id + '/current');
      const j = await r.json();
      if (r.ok && j.quiz) setQuiz(j.quiz);
    }
    load();
    const ch = s
      .channel('control-' + id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quizzes', filter: 'id=eq.' + id },
        load
      )
      .subscribe();
    return () => {
      s.removeChannel(ch);
    };
  }, [id]);

  async function act(path: 'start' | 'next' | 'finish') {
    setBusy(true);
    const r = path === 'finish'
      ? await fetch('/api/quizzes/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'finished' }),
        })
      : await fetch('/api/quizzes/' + id + '/' + path, { method: 'POST' });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else {
      setMsg(
        path === 'start' ? 'Quiz started'
          : path === 'finish' ? 'Quiz ended'
          : j.finished
          ? 'Quiz finished'
          : 'Moved to the next question'
      );
      if (path === 'finish') setQuiz((current) => current ? { ...current, status: 'finished' } : current);
      if (j.finished) setFin(Date.now());
    }
    setBusy(false);
  }

  async function deleteQuiz() {
    setBusy(true);
    try {
      const r = await fetch('/api/quizzes/' + id, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || 'Unable to delete quiz');
        setDeleteDialogOpen(false);
        return;
      }

      router.push('/admin');
    } catch {
      setMsg('Unable to delete quiz. Check your connection and try again.');
      setDeleteDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!quiz?.room_code) return;
    await navigator.clipboard.writeText(quiz.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="container page">
      <Confetti fire={fin} big />
      <Link
        href="/admin"
        className="navlink"
        style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16 }}
      >
        <ArrowLeft size={16} /> All rooms
      </Link>
      {!quiz && <div className="skeleton" style={{ height: 240 }} />}
      {quiz && (
        <>
          <motion.div
            className="card glow"
            style={{ position: 'relative', overflow: 'hidden', padding: 32 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Particles density={0.00004} />
            <div
              className="row between wrap"
              style={{ position: 'relative', alignItems: 'flex-end', gap: 24 }}
            >
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <span className={'pill ' + quiz.status}>
                    {quiz.status === 'live' && <span className="dot" />}
                    {quiz.status}
                  </span>
                  {quiz.status === 'live' && (
                    <span className="pill">Question {quiz.current_question + 1}</span>
                  )}
                </div>
                <h1 className="h1" style={{ margin: '14px 0 6px' }}>
                  {quiz.title}
                </h1>
                <p className="muted" style={{ margin: '0 0 10px' }}>
                  Students join with this code
                </p>
                <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
                  <div className="room-code gradient-text">
                    {quiz.room_code || 'No room code available'}
                  </div>
                  <button
                    className="btn ghost sm"
                    onClick={copy}
                    disabled={!quiz.room_code}
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="row wrap">
                <button
                  className="btn lg"
                  disabled={quiz.status !== 'lobby' || busy}
                  onClick={() => act('start')}
                >
                  <Play size={18} /> Start quiz
                </button>
                <button
                  className="btn lg ghost"
                  disabled={quiz.status !== 'live' || busy}
                  onClick={() => act('next')}
                >
                  <SkipForward size={18} /> Next question
                </button>
                <button
                  className="btn lg ghost"
                  disabled={quiz.status === 'finished' || busy}
                  onClick={() => act('finish')}
                >
                  <CircleStop size={18} /> End quiz
                </button>
                <button
                  className="btn lg ghost"
                  disabled={busy}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 size={18} /> Delete
                </button>
              </div>
            </div>
            <AnimatePresence>
              {msg && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="success"
                  style={{ position: 'relative', marginTop: 16 }}
                >
                  {msg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="card"
            style={{ marginTop: 16 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="row between">
              <h2 className="h2">Leaderboard</h2>
              <span className="pill">
                <Users size={14} /> {players.length} players
              </span>
            </div>
            {!players.length ? (
              <p className="muted" style={{ marginTop: 14 }}>
                Nobody has joined yet. Share the code above.
              </p>
            ) : (
              <table className="table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Player</th>
                    <th>Correct</th>
                    <th style={{ textAlign: 'right' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <motion.tr
                      layout
                      key={p.id}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    >
                      <td>{i + 1}</td>
                      <td>
                        <span className="row">
                          <span
                            className="avatar"
                            style={{
                              background: colorFor(p.user_id),
                              width: 28,
                              height: 28,
                              fontSize: 11,
                            }}
                          >
                            {initials(p.name)}
                          </span>
                          {p.name}
                        </span>
                      </td>
                      <td className="muted">
                        {p.correct_answers}/{p.total_answers}
                      </td>
                      <td className="score" style={{ textAlign: 'right' }}>
                        {p.score.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </>
      )}
      <ActionDialog
        open={deleteDialogOpen}
        title="Delete this quiz?"
        message="This permanently removes the quiz and its results for everyone in the room."
        confirmLabel="Delete quiz"
        destructive
        busy={busy}
        onConfirm={() => void deleteQuiz()}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}