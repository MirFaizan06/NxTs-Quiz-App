'use client';
import { useEffect, useRef } from 'react';

type Props = { density?: number; linkDistance?: number; className?: string };

/** Lightweight canvas particle field. Reacts to the pointer, pauses off-screen. */
export function Particles({ density = 0.00007, linkDistance = 130, className = 'fx' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, raf = 0, visible = true;
    const mouse = { x: -9999, y: -9999 };
    const colors = ['#8b7dff', '#22d3ee', '#ff4d8d', '#c7cbff'];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string };
    let ps: P[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(120, Math.max(24, Math.floor(w * h * density)));
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6, c: colors[(Math.random() * colors.length) | 0],
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!reduce) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 150 * 150) {
            const d = Math.sqrt(d2) || 1, f = (150 - d) / 150;
            p.vx += (dx / d) * f * 0.06; p.vy += (dy / d) * f * 0.06;
          }
          p.vx *= 0.985; p.vy *= 0.985;
          p.x += p.vx + (Math.random() - 0.5) * 0.02; p.y += p.vy + (Math.random() - 0.5) * 0.02;
          if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.85; ctx.fill();
        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < linkDistance * linkDistance) {
            ctx.globalAlpha = (1 - Math.sqrt(d) / linkDistance) * 0.28;
            ctx.strokeStyle = '#8b7dff'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => { if (visible) draw(); raf = requestAnimationFrame(loop); };
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const leave = () => { mouse.x = mouse.y = -9999; };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });

    resize(); io.observe(canvas);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerleave', leave);
    if (reduce) draw(); else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', leave);
    };
  }, [density, linkDistance]);

  return <canvas ref={ref} className={className} style={{ pointerEvents: 'none' }} aria-hidden />;
}
