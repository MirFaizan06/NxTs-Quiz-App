'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Plus, Sparkles, Trash2, Upload, Download } from 'lucide-react';
import { ActionDialog } from '@/components/ActionDialog';

type Q = { id: string; question_text: string; question_type: string; options: string[]; correct_answer: unknown; difficulty: string; points: number; time_limit: number; topic_id: string | null; topics: { name: string } | null };
type Topic = { id: string; name: string };
const jsonHeaders = { 'Content-Type': 'application/json' };

export default function Questions() {
  const [qs, setQs] = useState<Q[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [focus, setFocus] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [mq, setMq] = useState('');
  const [mopts, setMopts] = useState('');
  const [mcorrect, setMcorrect] = useState('');
  const [questionToDelete, setQuestionToDelete] = useState<Q | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  async function load() {
    const [questionsResponse, topicsResponse] = await Promise.all([
      fetch('/api/questions'),
      fetch('/api/topics'),
    ]);
    const [questions, availableTopics] = await Promise.all([
      questionsResponse.json(),
      topicsResponse.json(),
    ]);
    if (questionsResponse.ok) setQs(questions);
    if (topicsResponse.ok) {
      setTopics(availableTopics);
      setTopicId(current => current || availableTopics[0]?.id || '');
    }
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/questions/generate', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ topic, topic_id: topicId || null, count, difficulty, focus }) });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else {
      let saved = 0;
      for (const question of j.questions) {
        const saveResponse = await fetch('/api/questions', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(question),
        });
        if (saveResponse.ok) saved += 1;
      }
      setMsg(`Generated and saved ${saved} of ${j.questions.length} questions. Review them before using them in a live room.`);
      await load();
    }
    setBusy(false);
  }
  async function delQuestion() {
    if (!questionToDelete) return;
    setDeleting(true);
    try {
      const r = await fetch('/api/questions', {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ id: questionToDelete.id }),
      });
      const result = await r.json();
      if (!r.ok) setMsg(result.error || 'Unable to delete question.');
      else await load();
    } catch {
      setMsg('Unable to delete question. Check your connection and try again.');
    } finally {
      setDeleting(false);
      setQuestionToDelete(null);
    }
  }
  async function manualAdd() {
    const opts = mopts.split('|').map(x => x.trim()).filter(Boolean);
    const correct = mcorrect.trim();
    if (!mq || opts.length < 2 || !correct) { setMsg('Enter a question, at least two options separated by |, and the exact correct answer.'); return; }
    const r = await fetch('/api/questions', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ question_text: mq, question_type: 'single', options: opts, correct_answer: correct, difficulty: 'medium', points: 100, time_limit: 20, topic_id: topicId || null }) });
    const j = await r.json();
    if (!r.ok) setMsg(j.error);
    else { setMsg('Question added.'); setMq(''); setMopts(''); setMcorrect(''); load(); }
  }

  return (
    <div className="container page">
      <Link href="/admin" className="navlink" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16 }}><ArrowLeft size={16} /> Control center</Link>
      <h1 className="h1">Question bank</h1>
      <p className="lead">Generate questions across science, mathematics, geography, general knowledge, and more.</p>

      <div className="field" style={{ maxWidth: 420, marginTop: 20 }}>
        <label className="label" htmlFor="question-category">Category for new questions</label>
        <select id="question-category" className="select" value={topicId} onChange={e => setTopicId(e.target.value)}>
          <option value="">Uncategorized</option>
          {topics.map(availableTopic => <option key={availableTopic.id} value={availableTopic.id}>{availableTopic.name}</option>)}
        </select>
      </div>

      <div className="grid admin-split" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 28, alignItems: 'start' }}>
        <motion.div className="card glow" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="h2 row"><Sparkles size={18} color="#b6b0ff" /> Generate with Groq</h2>
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 80px', marginTop: 16 }}>
            <div className="field"><label className="label">Subject or focus area</label><input className="input" placeholder="Animal physiology" value={topic} onChange={e => setTopic(e.target.value)} /></div>
            <div className="field"><label className="label">Level</label><select className="select" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option>easy</option><option>medium</option><option>hard</option></select></div>
            <div className="field"><label className="label">Count</label><input className="input" type="number" min={1} max={20} value={count} onChange={e => setCount(+e.target.value)} /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label className="label">Focus (optional)</label><input className="input" placeholder="Copy vs move semantics" value={focus} onChange={e => setFocus(e.target.value)} /></div>
          <button className="btn" style={{ marginTop: 16 }} disabled={busy || !topic} onClick={generate}>{busy ? <><span className="spinner" /> Generating…</> : <><Sparkles size={16} /> Generate and save</>}</button>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="h2">Add one by hand</h2>
          <div className="field" style={{ marginTop: 16 }}><label className="label">Question</label><input className="input" placeholder="What does a destructor do?" value={mq} onChange={e => setMq(e.target.value)} /></div>
          <div className="field" style={{ marginTop: 12 }}><label className="label">Options, separated by |</label><input className="input" placeholder="O(n) | O(log n) | O(n²) | O(1)" value={mopts} onChange={e => setMopts(e.target.value)} /></div>
          <div className="field" style={{ marginTop: 12 }}><label className="label">Correct answer (exactly as written above)</label><input className="input" placeholder="O(log n)" value={mcorrect} onChange={e => setMcorrect(e.target.value)} /></div>
          <button className="btn ghost" style={{ marginTop: 16 }} onClick={manualAdd}><Plus size={16} /> Add question</button>
        </motion.div>
      </div>

      <AnimatePresence>{msg && <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="muted" style={{ marginTop: 16 }}>{msg}</motion.p>}</AnimatePresence>

      <motion.div className="card" style={{ marginTop: 16 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="row between wrap"><div><h2 className="h2">CSV question bank</h2><p className="muted" style={{marginTop:6}}>Import or export the complete bank. Columns: question_text, question_type, options, correct_answer, explanation, difficulty, points, time_limit, topic_name.</p></div><div className="row wrap"><button className="btn ghost sm" onClick={()=>window.location.assign('/api/admin/questions/csv')}><Download size={14}/> Export CSV</button><label className="btn sm" style={{cursor:'pointer'}}><Upload size={14}/> {csvBusy?'Importing…':'Import CSV'}<input type="file" accept=".csv,text/csv" hidden disabled={csvBusy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setCsvBusy(true);const fd=new FormData();fd.append('file',file);const r=await fetch('/api/admin/questions/csv',{method:'POST',body:fd});const j=await r.json();setMsg(r.ok?`Imported ${j.imported} questions.`:(j.error||'Import failed'));if(r.ok)await load();setCsvBusy(false);e.currentTarget.value='';}} /></label></div></div>
      </motion.div>

      <motion.div className="card" style={{ marginTop: 16 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="h2">All questions ({qs.length})</h2>
        {!qs.length ? <p className="muted" style={{ marginTop: 12 }}>Nothing here yet. Generate a set or add one by hand.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>Question</th><th>Category</th><th>Type</th><th>Level</th><th style={{ width: 60 }} /></tr></thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {qs.map(q => (
                    <motion.tr key={q.id} layout exit={{ opacity: 0 }}>
                      <td>{q.question_text}</td>
                      <td className="muted">{q.topics?.name ?? 'Uncategorized'}</td>
                      <td className="muted">{q.question_type}</td>
                      <td><span className="pill">{q.difficulty}</span></td>
                      <td><button className="btn danger sm" aria-label="Delete question" onClick={() => setQuestionToDelete(q)}><Trash2 size={14} /></button></td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
      <ActionDialog
        open={questionToDelete !== null}
        title="Delete this question?"
        message={questionToDelete?.question_text ?? 'This question will be permanently removed from the question bank.'}
        confirmLabel="Delete question"
        destructive
        busy={deleting}
        onConfirm={() => void delQuestion()}
        onClose={() => setQuestionToDelete(null)}
      />
    </div>
  );
}
