'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Particles } from '@/components/Particles';

export default function JoinPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/quizzes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json();

      if (res.status === 401) {
        // Redirect to login if user session is missing in current tab
        router.push(`/login?redirectTo=/join`);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Quiz not found');
        setLoading(false);
        return;
      }

      router.push(`/quiz/${data.quizId}`);
    } catch (err) {
      setError('Failed to connect to server');
      setLoading(false);
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 480, marginTop: 40 }}>
      <div className="card glow" style={{ position: 'relative', overflow: 'hidden', padding: 32 }}>
        <Particles density={0.00004} />
        <h1 className="h1" style={{ marginBottom: 8 }}>
          Join a Quiz
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Enter the 6-character room code provided by the host.
        </p>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <input
              type="text"
              placeholder="e.g. 8NSTCX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="input"
              style={{
                fontSize: '1.5rem',
                letterSpacing: '0.25em',
                textAlign: 'center',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
              disabled={loading}
            />
          </div>

          {error && <p className="error" style={{ color: '#ff4d4f', fontSize: '0.9rem' }}>{error}</p>}

          <button type="submit" className="btn lg" disabled={loading || !code.trim()}>
            {loading ? 'Joining...' : 'Enter Room'} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}