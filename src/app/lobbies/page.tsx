'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Users, Radio, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

type Lobby = { id:string; title:string; description:string|null; room_code:string; topic_name:string|null; topic_description:string|null; participant_count:number; max_players:number|null; created_at:string };

export default function LobbiesPage() {
  const [lobbies,setLobbies]=useState<Lobby[]>([]); const [loading,setLoading]=useState(true); const [msg,setMsg]=useState(''); const router=useRouter();
  async function load(){setLoading(true); const r=await fetch('/api/lobbies'); const j=await r.json(); if(r.ok)setLobbies(j); else setMsg(j.error||'Unable to load lobbies'); setLoading(false);}
  useEffect(()=>{load();},[]);
  async function join(code:string){setMsg(''); const r=await fetch('/api/lobbies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}); const j=await r.json(); if(r.status===401){router.push('/login?redirectTo=/lobbies');return;} if(!r.ok){setMsg(j.error||'Unable to join');return;} router.push('/quiz/'+j.quizId);}
  return <div className="container page"><div className="row between wrap"><div><h1 className="h1">Public lobbies</h1><p className="lead">Browse live-ready quizzes published by admins. Private quizzes remain code-only.</p></div><button className="btn ghost" onClick={load}>Refresh</button></div>
    {msg&&<p className="error" style={{marginTop:14}}>{msg}</p>}
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',marginTop:28}}>
      {loading ? [1,2,3].map(i=><div className="card skeleton" key={i}/>) : lobbies.map((l,i)=><motion.div className="card glow" key={l.id} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:i*.05}}>
        <div className="row between"><span className="pill live"><Radio size={13}/> Public lobby</span><span className="muted row"><Users size={14}/> {l.participant_count}{l.max_players?`/${l.max_players}`:''}</span></div>
        <h2 className="h2" style={{fontSize:22,marginTop:18}}>{l.title}</h2>
        {l.topic_name&&<div className="pill" style={{marginTop:10}}>{l.topic_name}</div>}
        <p className="muted" style={{lineHeight:1.6,minHeight:52}}>{l.description||l.topic_description||'An admin-hosted quiz. Join the lobby to see the room.'}</p>
        <button className="btn block" onClick={()=>join(l.room_code)}><ArrowRight size={16}/> Join lobby</button>
      </motion.div>)}
    </div>
    {!loading&&!lobbies.length&&<div className="card center" style={{marginTop:28,padding:48}}><LockKeyhole size={28}/><h2 className="h2" style={{marginTop:12}}>No public lobbies right now</h2><p className="muted">Ask your admin for a private room code, or check back later.</p></div>}
  </div>;
}
