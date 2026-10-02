import Link from 'next/link';
import { ArrowRight, Zap, Timer, ShieldCheck, Sparkles, Radio, Trophy } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { Particles } from '@/components/Particles';
import { Reveal } from '@/components/Reveal';
import { HeroDemo, LiveBoard, Topics } from '@/components/landing';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'NxT Quiz';

export default async function Home() {
  const { user } = await getUser();
  const primary = user ? { href: '/join', label: 'Join a quiz' } : { href: '/login', label: 'Create your account' };

  return (
    <>
      <section className="hero">
        <Particles />
        <div className="container hero-grid" style={{ position: 'relative' }}>
          <div>
            <Reveal y={12}><span className="pill"><Sparkles size={14} /> Built for classrooms, labs and study groups</span></Reveal>
            <Reveal delay={0.08}>
              <h1><span className="gradient-text">Quizzes that feel like a game night.</span></h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="sub">Start a room, share a six-letter code, and watch your class race through programming, maths and physics questions with a leaderboard that moves as answers come in.</p>
            </Reveal>
            <Reveal delay={0.24} className="row wrap">
              <Link href={primary.href} className="btn lg">{primary.label} <ArrowRight size={18} /></Link>
              <Link href="/#how" className="btn lg ghost">See how it works</Link>
            </Reveal>
            <Reveal delay={0.32} className="stats">
              <div className="stat"><b>Live</b><span>leaderboard, no refresh</span></div>
              <div className="stat"><b>20–100%</b><span>points by answer speed</span></div>
              <div className="stat"><b>3 types</b><span>single, multiple, true/false</span></div>
            </Reveal>
          </div>
          <HeroDemo />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 56, paddingBottom: 24 }}>
        <Topics />
      </section>

      <section className="section" id="features">
        <div className="container">
          <Reveal className="section-head">
            <h2>Everything a live round needs, nothing it doesn&apos;t.</h2>
            <p>Hosts run the room from one screen. Students need a phone and a code.</p>
          </Reveal>
          <div className="bento">
            <Reveal className="tile t-a">
              <span className="ico"><Trophy size={22} /></span>
              <h3>A leaderboard that actually moves</h3>
              <p>Scores stream in over Supabase Realtime, so rankings shift the moment someone locks an answer. No refresh, no separate socket server.</p>
              <LiveBoard />
            </Reveal>
            <Reveal className="tile t-b" delay={0.08}>
              <span className="ico"><Timer size={22} /></span>
              <h3>Speed counts</h3>
              <p>A correct answer is worth between 20% and 100% of its points, depending on how fast it lands.</p>
              <div className="decay">
                <div><i style={{ width: '100%' }} /><span>fast</span></div>
                <div><i style={{ width: '62%', opacity: .85 }} /><span>mid</span></div>
                <div><i style={{ width: '22%', opacity: .7 }} /><span>last second</span></div>
              </div>
            </Reveal>
            <Reveal className="tile t-c">
              <span className="ico"><ShieldCheck size={22} /></span>
              <h3>Answers stay on the server</h3>
              <p>Questions reach students without the correct answer. Checking happens in a Postgres function behind row-level security.</p>
            </Reveal>
            <Reveal className="tile t-d" delay={0.08}>
              <span className="ico"><Zap size={22} /></span>
              <h3>Questions on demand</h3>
              <p>Type a topic and Groq drafts a set of questions into your bank. Review them, then drop them into a room.</p>
            </Reveal>
            <Reveal className="tile t-e" delay={0.16}>
              <span className="ico"><Radio size={22} /></span>
              <h3>Host-paced rounds</h3>
              <p>You decide when to start and when to move on. Everyone sees the next question at the same instant.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <Reveal className="section-head"><h2>From empty room to final podium in three moves.</h2></Reveal>
          <div className="steps">
            <Reveal className="step"><h3>Build the round</h3><p>Pick questions from your bank or generate a fresh set, name the quiz, and get a room code.</p></Reveal>
            <Reveal className="step" delay={0.1}><h3>Let them in</h3><p>Students sign in, type the code and land in a live lobby while you wait for stragglers.</p></Reveal>
            <Reveal className="step" delay={0.2}><h3>Run it live</h3><p>Start the quiz, advance when you are ready, and finish on a final leaderboard with confetti.</p></Reveal>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <Reveal className="cta">
            <Particles density={0.00005} />
            <div style={{ position: 'relative' }}>
              <h2 className="gradient-text">Your next class starts with a code.</h2>
              <p className="lead" style={{ maxWidth: 520, margin: '0 auto 30px' }}>Make an account, create a room, and see how fast a quiet room gets loud.</p>
              <Link href={primary.href} className="btn lg">{primary.label} <ArrowRight size={18} /></Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="footer">
        <div className="container row between wrap">
          <span>{appName} · Next.js, Supabase and Groq</span>
          <span>Made for people who teach with code.</span>
        </div>
      </footer>
    </>
  );
}
