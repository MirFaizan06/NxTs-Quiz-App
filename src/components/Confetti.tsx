'use client';
import { useEffect, useRef } from 'react';

/** Fires one confetti burst whenever `fire` changes to a new truthy value. */
export function Confetti({ fire, big = false }: { fire: unknown; big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr), h = (canvas.height = window.innerHeight * dpr);
    const colors = ['#6d5efc', '#22d3ee', '#ff4d8d', '#fbbf24', '#34d399', '#ffffff'];
    const count = big ? 220 : 90;
    const bursts = big ? [[0.2, 0.9], [0.8, 0.9], [0.5, 0.6]] : [[0.5, 0.7]];
    type C = { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; life: number };
    const parts: C[] = [];
    bursts.forEach(([bx, by]) => {
      for (let i = 0; i < count / bursts.length; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5, sp = (6 + Math.random() * 10) * dpr;
        parts.push({ x: bx * w, y: by * h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: (5 + Math.random() * 6) * dpr,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], life: 1 });
      }
    });
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.28 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
        if (p.life <= 0 || p.y > h + 40) continue;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, big]);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
