'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Rocket, Search, CheckSquare, Square, Users, IndianRupee, Globe2 } from 'lucide-react';
import { filterQuizQuestions } from '@/lib/quiz-filter';

type Q = { id: string; question_text: string; difficulty: string; points: number; topic_id: string | null; topics: { name: string } | null };
type Topic = { id: string; name: string };
type Quiz = { id: string; title: string; room_code: string; status: string };

export default function Admin() {
  const [qs, setQs] = useState<Q[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [publicQuiz, setPublicQuiz] = useState(false);
  const [description, setDescription] = useState('');
  const [quizTopicId, setQuizTopicId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Array<{id:string;name:string;username:string|null;role:string}>>([]);

  async function load() {
    const [a, b, topicResponse, userResponse] = await Promise.all([
      fetch('/api/questions'),
      fetch('/api/quizzes'),
      fetch('/api/topics'),
      fetch('/api/admin/users'),
    ]);
    const [aj, bj, topicData, userData] = await Promise.all([a.json(), b.json(), topicResponse.json(), userResponse.json()]);
    if (a.ok) setQs(aj);
    if (b.ok) setQuizzes(bj);
    if (topicResponse.ok) setTopics(topicData);
    if (userResponse.ok) setUsers(userData);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch('/api/quizzes', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ title, questionIds: selected, is_public: publicQuiz, description, topic_id: quizTopicId || null, max_players: maxPlayers ? Number(maxPlayers) : null }) 
    });
    const j = await r.json();
    if (!r.ok) setMsg({ t: j.error, ok: false });
    else { 
      setMsg({ t: `Room ${j.room_code} is ready.`, ok: true }); 
      setTitle(''); 
      setSelected([]);
      setPublicQuiz(false); setDescription(''); setQuizTopicId(''); setMaxPlayers('');
      load(); 
    }
  }

  // Filter questions based on search input
  const filteredQs = useMemo(() => {
    return filterQuizQuestions(qs, topicFilter, search);
  }, [qs, search, topicFilter]);

  // Check if all filtered questions are currently selected
  const isAllFilteredSelected = filteredQs.length > 0 && filteredQs.every(q => selected.includes(q.id));

  // Toggle selection for all filtered questions
  function toggleSelectAll() {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredQs.map(q => q.id));
      setSelected(s => s.filter(id => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredQs.map(q => q.id);
      setSelected(s => Array.from(new Set([...s, ...filteredIds])));
    }
  }

  const live = quizzes.filter(q => q.status === 'live').length;

  return (
    <div className="container page">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="row between wrap">
        <div>
          <h1 className="h1">Control center</h1>
          <p className="lead">Build rounds from your question bank and run them live.</p>
        </div>
        <Link className="btn" href="/admin/questions"><BookOpen size={18} /> Question bank</Link><div className="row wrap" style={{marginLeft:8}}><Link className="btn ghost sm" href="/admin/users"><Users size={14}/> Users</Link><Link className="btn ghost sm" href="/admin/monetization"><IndianRupee size={14}/> Monetization</Link></div>
      </motion.div>

      <div className="kpis" style={{ marginTop: 28 }}>
        {[['Questions', qs.length], ['Rooms', quizzes.length], ['Live now', live]].map(([l, v], i) => (
          <motion.div key={l as string} className="card kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
            <b>{v}</b><span>{l}</span>
          </motion.div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}><div className="row between"><div><h2 className="h2">Registered users</h2><p className="muted" style={{marginTop:6}}>{users.length} account{users.length===1?'':'s'} · {users.filter(u=>u.role==='admin').length} admin{users.filter(u=>u.role==='admin').length===1?'':'s'}</p></div><Link className="btn ghost sm" href="/admin/users"><Users size={14}/> Manage users</Link></div><div className="row wrap" style={{marginTop:14}}>{users.slice(0,8).map(u=><span className="pill" key={u.id}>{u.name} {u.role==='admin'?'· admin':''}</span>)}</div></div>

      <div className="grid admin-split" style={{ gridTemplateColumns: '1.2fr 1fr', marginTop: 16, alignItems: 'start' }}>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="h2">New quiz</h2>
          <div className="field" style={{ margin: '16px 0' }}>
            <label className="label" htmlFor="qt">Title</label>
            <input id="qt" className="input" placeholder="Week 4 · Pointers and memory" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Label + Select All Controls */}
          <div className="row between" style={{ marginBottom: 8 }}>
            <p className="label" style={{ margin: 0 }}>Pick questions ({selected.length} selected)</p>
            {filteredQs.length > 0 && (
              <button 
                type="button" 
                className="btn ghost sm" 
                onClick={toggleSelectAll}
                style={{ padding: '2px 8px', fontSize: '0.85rem' }}
              >
                {isAllFilteredSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="quiz-topic-filter">Topic</label>
            <select id="quiz-topic-filter" className="select" value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
              <option value="all">All topics</option>
              {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              <option value="uncategorized">Uncategorized</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="field" style={{ marginBottom: 12 }}><label className="label">Quiz topic</label><select className="select" value={quizTopicId} onChange={e => setQuizTopicId(e.target.value)}><option value="">No topic</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></div>
          <div className="field" style={{ marginBottom: 12 }}><label className="label">Description / showcase text</label><textarea className="textarea" rows={2} placeholder="What will students learn?" value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="row wrap" style={{marginBottom:12}}><label className="row pill" style={{cursor:'pointer'}}><input type="checkbox" checked={publicQuiz} onChange={e=>setPublicQuiz(e.target.checked)}/><Globe2 size={14}/> Publish in public lobby</label>{publicQuiz&&<div className="field" style={{minWidth:150}}><label className="label">Max players</label><input className="input" type="number" min="1" placeholder="Unlimited" value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}/></div>}</div>

          <div className="field" style={{ marginBottom: 12, position: 'relative' }}>
            <input 
              className="input" 
              placeholder="Search questions, difficulty, or topic..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          </div>

          {/* Questions Scroll List */}
          <div className="scroll" style={{ marginTop: 8 }}>
            {loading && [0, 1, 2].map(i => <div key={i} className="skeleton" style={{ marginBottom: 8 }} />)}
            
            {!loading && !qs.length && (
              <p className="muted">Your bank is empty. <Link href="/admin/questions" style={{ color: '#b6b0ff', fontWeight: 700 }}>Add or generate questions</Link> first.</p>
            )}

            {!loading && qs.length > 0 && !filteredQs.length && (
              <p className="muted">No questions match &quot;{search}&quot;.</p>
            )}

            {filteredQs.map(q => (
              <label key={q.id} className={'qrow ' + (selected.includes(q.id) ? 'on' : '')}>
                <input 
                  className="check" 
                  type="checkbox" 
                  checked={selected.includes(q.id)} 
                  onChange={e => setSelected(s => (e.target.checked ? [...s, q.id] : s.filter(x => x !== q.id)))} 
                />
                <span>
                  {q.question_text}<br />
                  <small className="muted">{q.topics?.name ?? 'Uncategorized'} · {q.difficulty} · {q.points} pts</small>
                </span>
              </label>
            ))}
          </div>

          <button className="btn" disabled={!title || !selected.length} onClick={create} style={{ marginTop: 16 }}>
            <Plus size={18} /> Create room
          </button>
          {msg && <p className={msg.ok ? 'success' : 'error'} style={{ marginTop: 12 }}>{msg.t}</p>}
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <h2 className="h2">Rooms</h2>
          <div className="stack" style={{ marginTop: 14 }}>
            {quizzes.map(q => (
              <div key={q.id} className="row between" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <b>{q.title}</b>
                  <div className="row" style={{ marginTop: 6, gap: 8 }}>
                    <span className="mono muted">{q.room_code}</span>
                    <span className={'pill ' + q.status}>{q.status}</span>
                  </div>
                </div>
                <Link className="btn ghost sm" href={'/admin/quizzes/' + q.id}><Rocket size={14} /> Run</Link>
              </div>
            ))}
            {!loading && !quizzes.length && <p className="muted">No rooms yet. Create your first quiz on the left.</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}