'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Circle, Diamond, Square, Triangle } from 'lucide-react';

const OPTS = [
  { t: 'O(log n)', Icon: Triangle },
  { t: 'O(n)', Icon: Diamond },
  { t: 'O(n log n)', Icon: Circle },
  { t: 'O(n²)', Icon: Square },
];

/** Looping mock of a live question: countdown, an answer lands, points pop. */
export function HeroDemo() {
  const [tick, setTick] = useState(0);
  const total = 10;
  useEffect(() => { const i = setInterval(() => setTick(t => (t + 1) % (total + 4)), 1000); return () => clearInterval(i); }, []);
  const left = Math.max(0, total - tick);
  const picked = tick >= 4 && tick < total + 3;
  const reveal = tick >= 5 && tick < total + 3;

  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 120, damping: 14 });
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const C = 2 * Math.PI * 30;

  return (
    <div className="demo" ref={ref} onPointerMove={onMove} onPointerLeave={() => { mx.set(0); my.set(0); }}>
      <motion.div className="card glow demo-card" style={{ rotateX: rx, rotateY: ry }}
        initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        <div className="row between">
          <span className="pill live"><span className="dot" /> Room <b className="mono">K7Q2PX</b></span>
          <div className="timer-ring" style={{ width: 64, height: 64 }}>
            <svg width="64" height="64" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
              <circle cx="35" cy="35" r="30" fill="none" stroke={left <= 3 ? '#fb7185' : '#22d3ee'} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
            </svg>
            <b style={{ fontSize: 20 }}>{left}</b>
          </div>
        </div>
        <p className="muted" style={{ margin: '20px 0 6px', fontSize: 13, fontWeight: 600 }}>Question 4 of 12</p>
        <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, letterSpacing: '-.025em' }}>What is the time complexity of binary search on a sorted array?</h3>
        <div className="demo-opts">
          {OPTS.map((o, i) => (
            <div key={o.t} className={'opt-demo ' + (reveal && i === 0 ? 'picked' : '')} style={{ opacity: reveal && i !== 0 ? 0.45 : 1 }}>
              <span className={'shape c' + i}><o.Icon size={14} fill="#fff" strokeWidth={0} /></span>{o.t}
            </div>
          ))}
        </div>
        <div style={{ height: 34, marginTop: 16 }}>
          <AnimatePresence>
            {picked && reveal && (
              <motion.div key="pts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="success" style={{ fontWeight: 800, fontSize: 18 }}>
                Correct! +842 points
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div className="card" style={{ position: 'absolute', left: -28, bottom: -34, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}
        animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="avatar" style={{ background: '#ec4899', width: 30, height: 30, fontSize: 12 }}>AK</span>
        <div style={{ fontSize: 13, lineHeight: 1.3 }}><b>Aisha</b> took the lead<br /><span className="muted">3,120 pts</span></div>
      </motion.div>
      <motion.div className="card" style={{ position: 'absolute', right: -14, top: -26, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
        animate={{ y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="success">●</span> 28 players in
      </motion.div>
    </div>
  );
}

const ROWS = [
  { n: 'Aisha K.', c: '#ec4899', s: 3120 }, { n: 'Rohan M.', c: '#3b82f6', s: 2890 },
  { n: 'Sana P.', c: '#10b981', s: 2640 }, { n: 'Dev R.', c: '#f59e0b', s: 2210 }, { n: 'Mira T.', c: '#8b5cf6', s: 1980 },
];

/** Leaderboard that reshuffles itself so the "real-time" claim is visible. */
export function LiveBoard() {
  const [rows, setRows] = useState(ROWS);
  useEffect(() => {
    const i = setInterval(() => setRows(r => [...r.map(x => ({ ...x, s: x.s + Math.floor(Math.random() * 420) }))].sort((a, b) => b.s - a.s)), 2200);
    return () => clearInterval(i);
  }, []);
  const max = Math.max(...rows.map(r => r.s));
  return (
    <div className="lb-demo">
      {rows.map((r, i) => (
        <motion.div layout key={r.n} className="lb-row" transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
          <span className="lb-rank">{i + 1}</span>
          <span className="avatar" style={{ background: r.c, width: 28, height: 28, fontSize: 11 }}>{r.n.split(' ').map(x => x[0]).join('')}</span>
          <span style={{ width: 82, fontWeight: 600, fontSize: 14 }}>{r.n}</span>
          <span className="lb-bar"><i style={{ width: (r.s / max) * 100 + '%' }} /></span>
          <span className="score mono" style={{ fontSize: 14 }}>{r.s.toLocaleString()}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function Topics() {
  const items = ['C++ constructors', 'Big-O analysis', 'Linear algebra', 'Kinematics', 'SQL joins', 'Recursion', 'Boolean logic', 'Thermodynamics',
    'Pointers & memory', 'Probability', 'Operating systems', 'Calculus', 'Networks', 'Data structures', 'Electrostatics', 'Python basics'];
  return (
    <div className="marquee"><div className="marquee-track">
      {[...items, ...items].map((t, i) => <span className="pill" key={i}>{t}</span>)}
    </div></div>
  );
}
