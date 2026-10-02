'use client';
import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowser } from './supabase-browser';

export type Player = {
  id: string; user_id: string; score: number; correct_answers: number; total_answers: number; name: string;
};

/** Loads the participants of a quiz with display names, and keeps them live via Realtime. */
export function usePlayers(quizId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [meId, setMeId] = useState('');

  const load = useCallback(async () => {
    if (!quizId) return;
    const s = createSupabaseBrowser();
    const { data } = await s.from('participants').select('id,user_id,score,correct_answers,total_answers')
      .eq('quiz_id', quizId).order('score', { ascending: false });
    if (!data) return;
    const ids = data.map(p => p.user_id);
    const { data: profs } = ids.length ? await s.from('profiles').select('id,name').in('id', ids) : { data: [] as { id: string; name: string | null }[] };
    const names = new Map((profs ?? []).map(p => [p.id, p.name]));
    setPlayers(data.map(p => ({ ...p, name: names.get(p.user_id) || 'Player ' + p.user_id.slice(0, 4) })));
  }, [quizId]);

  useEffect(() => { createSupabaseBrowser().auth.getUser().then(({ data }) => setMeId(data.user?.id ?? '')); }, []);

  useEffect(() => {
    if (!quizId) return;
    const s = createSupabaseBrowser();
    void fetch('/api/me').catch(() => undefined).then(load);
    const ch = s.channel('players-' + quizId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: 'quiz_id=eq.' + quizId }, load)
      .subscribe();
    return () => { s.removeChannel(ch); };
  }, [quizId, load]);

  return { players, meId, reload: load };
}
