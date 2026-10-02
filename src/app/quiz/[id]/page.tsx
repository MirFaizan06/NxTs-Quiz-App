'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Crown, Loader2, X } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { usePlayers, type Player } from '@/lib/usePlayers';
import { colorFor, initials, optionLetters } from '@/lib/ui';
import { remainingQuestionSeconds } from '@/lib/quiz-timer';
import { Confetti } from '@/components/Confetti';
import { Particles } from '@/components/Particles';

type Question = { id: string; question_text: string; question_type: 'single' | 'multiple' | 'boolean'; options: string[]; points: number; time_limit: number; position: number };
type Quiz = { id: string; title: string; status: string; current_question: number; question_started_at: string | null };
type Result = { correct: boolean; points: number };

const shapeColors = ['c0', 'c1', 'c2', 'c3', 'c0', 'c1'];

function Avatar({ p, size = 34 }: { p: Player; size?: number }) {
  return <span className="avatar" style={{ background: colorFor(p.user_id), width: size, height: size, fontSize: size * 0.4 }}>{initials(p.name)}</span>;
}

function Board({ players, meId, limit }: { players: Player[]; meId: string; limit?: number }) {
  const list = limit ? players.slice(0, limit) : players;
  return (
    <div className="stack" style={{ marginTop: 14 }}>
      {list.map((p, i) => (
        <motion.div layout key={p.id} className={'lb-item ' + (p.user_id === meId ? 'me' : '')} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <span className="lb-rank" style={{ width: 22 }}>{i === 0 ? <Crown size={16} color="#fbbf24" /> : i + 1}</span>
          <Avatar p={p} size={30} />
          <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.user_id === meId && <span className="muted"> (you)</span>}</span>
          <b className="score">{p.score.toLocaleString()}</b>
        </motion.div>
      ))}
    </div>
  );
}

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const C = 2 * Math.PI * 30;
  const low = seconds <= 5;
  return (
    <div className="timer-ring">
      <svg width="76" height="76" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <circle cx="35" cy="35" r="30" fill="none" stroke={low ? '#fb7185' : '#22d3ee'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, seconds / Math.max(1, total)))} style={{ transition: 'stroke-dashoffset .3s linear, stroke .3s' }} />
      </svg>
      <b style={{ color: low ? '#fda4af' : undefined }}>{seconds}</b>
    </div>
  );
}

export default function Play({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [burst, setBurst] = useState(0);
  const [finale, setFinale] = useState(0);
  const finishedOnce = useRef(false);
  const { players, meId } = usePlayers(id);

  useEffect(() => { params.then(x => setId(x.id)); }, [params]);

  async function load() {
    if (!id) return;
    const r = await fetch('/api/quizzes/' + id + '/current');
    const j = await r.json();
    if (!r.ok) {
      if (r.status === 404) {
        setRemoved(true);
        setQ(null);
        return;
      }
      setError(j.error);
      return;
    }
    setQuiz(j.quiz); setQ(j.question); setSelected([]); setSubmitted(false); setResult(null);
    setSeconds(j.quiz.status === 'live' && j.question
      ? remainingQuestionSeconds(j.question.time_limit, j.quiz.question_started_at)
      : 0);
  }

  useEffect(() => {
    if (!id) return;
    const s = createSupabaseBrowser();
    load();
    const ch = s.channel('play-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: 'id=eq.' + id }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quizzes' }, payload => {
        if (payload.old.id !== id) return;
        setRemoved(true);
        setQ(null);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void load();
      });
    return () => { s.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!quiz || !q || quiz.status !== 'live') { setSeconds(0); return; }
    const tick = () => {
      setSeconds(remainingQuestionSeconds(q.time_limit, quiz.question_started_at));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [quiz?.question_started_at, q?.id, quiz?.status, q]);

  useEffect(() => {
    if (quiz?.status === 'finished' && !finishedOnce.current) { finishedOnce.current = true; setFinale(Date.now()); }
  }, [quiz?.status]);

  const me = useMemo(() => players.find(p => p.user_id === meId), [players, meId]);
  const myRank = useMemo(() => players.findIndex(p => p.user_id === meId) + 1, [players, meId]);

  if (removed) {
    return (
      <div className="container page">
        <div className="card glow center" style={{ maxWidth: 560, margin: '40px auto', padding: 48 }}>
          <h1 className="h1" style={{ fontSize: 32 }}>The quiz was ended.</h1>
          <p className="lead">The host removed this quiz. You have been taken out of the room.</p>
          <a className="btn ghost" href="/join" style={{ marginTop: 24 }}>Join another quiz</a>
        </div>
      </div>
    );
  }

  async function answer() {
    if (submitted || !q) return;
    setSubmitted(true);
    const a = q.question_type === 'multiple' ? selected : selected[0];
    try {
      const r = await fetch('/api/quizzes/' + id + '/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: a }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResult(j);
      if (j.correct) setBurst(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    }
  }
  function toggle(v: string) {
    if (submitted) return;
    if (q?.question_type === 'multiple') setSelected(s => (s.includes(v) ? s.filter(x => x !== v) : [...s, v]));
    else setSelected([v]);
  }

  if (error && !quiz) return (
    <div className="container page"><div className="card center" style={{ maxWidth: 520, margin: '60px auto' }}>
      <h1 className="h1" style={{ fontSize: 28 }}>Can&apos;t open this quiz</h1><p className="error" style={{ marginTop: 12 }}>{error}</p>
      <a className="btn ghost" style={{ marginTop: 18 }} href="/join">Enter another code</a>
    </div></div>
  );

  if (!quiz) return <div className="container page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><Loader2 className="spinner" style={{ border: 0 }} size={28} /></div>;

  const podium = players.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]];
  const heights = [110, 150, 84];
  const medal = ['#cbd5e1', '#fbbf24', '#d6946a'];

  return (
    <div className="container page">
      <Confetti fire={burst} />
      <Confetti fire={finale} big />

      {quiz.status === 'lobby' && (
        <motion.div className="card glow center" style={{ padding: '72px 24px', position: 'relative', overflow: 'hidden' }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <Particles density={0.00005} />
          <div style={{ position: 'relative' }}>
            <div className="radar"><i /><i /><i />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span className="avatar" style={{ width: 56, height: 56, fontSize: 20, background: 'linear-gradient(135deg,#7b6dff,#22d3ee)' }}>{players.length}</span>
              </div>
            </div>
            <h1 className="h1" style={{ marginTop: 16 }}>You&apos;re in. Waiting for the host.</h1>
            <p className="lead">{quiz.title}</p>
            <div className="row wrap" style={{ justifyContent: 'center', marginTop: 28, gap: 8 }}>
              <AnimatePresence>
                {players.slice(0, 24).map(p => (
                  <motion.span key={p.id} className="pill" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '5px 12px 5px 6px' }}>
                    <Avatar p={p} size={22} /> {p.name}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      {quiz.status === 'live' && !q && <div className="card center" style={{ padding: 56 }}><p className="muted">Loading the next question…</p></div>}

      {quiz.status === 'live' && q && (
        <div className="play-grid">
          <AnimatePresence mode="wait">
            <motion.div key={q.id} className="card glow" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <div className="row between">
                <div className="row wrap">
                  <span className="pill">Question {q.position + 1}</span>
                  <span className="pill">{q.points} pts</span>
                  {q.question_type === 'multiple' && <span className="pill lobby">Pick all that apply</span>}
                </div>
                <TimerRing seconds={seconds} total={q.time_limit} />
              </div>
              <h1 className="q-text">{q.question_text}</h1>
              <div className={'opts ' + (q.options.length > 4 ? 'one' : '')}>
                {q.options.map((o, i) => {
                  const on = selected.includes(o);
                  return (
                    <motion.button key={o} className={'option ' + (on ? 'selected ' : '') + (submitted && !on ? 'dim' : '')} onClick={() => toggle(o)} disabled={submitted || seconds <= 0}
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: submitted && !on ? 0.45 : 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.4 }} whileTap={{ scale: 0.98 }}>
                      <span className={'shape ' + shapeColors[i % 6]}>{optionLetters[i]}</span>
                      <span style={{ flex: 1 }}>{o}</span>
                      {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={18} /></motion.span>}
                    </motion.button>
                  );
                })}
              </div>
              <button className="btn lg block" style={{ marginTop: 18 }} disabled={!selected.length || submitted || seconds <= 0} onClick={answer}>
                {submitted ? 'Answer locked in' : seconds <= 0 ? "Time's up" : 'Lock in answer'}
              </button>
              <AnimatePresence>
                {result && (
                  <motion.div initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="row" style={{ marginTop: 18, fontSize: 20, fontWeight: 800, color: result.correct ? '#86efac' : '#fda4af' }}>
                    {result.correct ? <><Check /> Correct! +{result.points} points</> : <><X /> Not this time. +0 points</>}
                  </motion.div>
                )}
              </AnimatePresence>
              {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
            </motion.div>
          </AnimatePresence>

          <div className="card">
            <div className="row between">
              <h2 className="h2">Leaderboard</h2>
              {me && <span className="pill">You: #{myRank} · {me.score.toLocaleString()}</span>}
            </div>
            <Board players={players} meId={meId} limit={8} />
          </div>
        </div>
      )}

      {quiz.status === 'finished' && (
        <motion.div className="card glow center" style={{ padding: '56px 20px' }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="h1" style={{ fontSize: 'clamp(32px,5vw,52px)' }}>The quiz was ended.</h1>
          <p className="lead">{me ? `You finished #${myRank} with ${me.score.toLocaleString()} points.` : quiz.title}</p>
          <div className="podium">
            {order.map((p, i) => p && (
              <motion.div key={p.id} className="col" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + (i === 1 ? 0.5 : i === 0 ? 0.2 : 0), duration: 0.6 }}>
                <Avatar p={p} size={48} />
                <div style={{ fontWeight: 700, margin: '8px 0 2px', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div className="muted score" style={{ fontSize: 13, marginBottom: 8 }}>{p.score.toLocaleString()}</div>
                <motion.div className="block" initial={{ height: 0 }} animate={{ height: heights[i] }} transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: `linear-gradient(180deg, ${medal[i]}55, ${medal[i]}11)`, border: `1px solid ${medal[i]}66`, borderBottom: 0, color: medal[i] }}>
                  {i === 1 ? 1 : i === 0 ? 2 : 3}
                </motion.div>
              </motion.div>
            ))}
          </div>
          <div style={{ maxWidth: 560, margin: '24px auto 0', textAlign: 'left' }}>
            <Board players={players} meId={meId} />
          </div>
          <a className="btn ghost" href="/join" style={{ marginTop: 28 }}>Join another quiz</a>
        </motion.div>
      )}
    </div>
  );
}
