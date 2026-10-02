'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Target, Hash, TrendingUp, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

type Dashboard={summary:{joined:number;finished:number;wins:number;average_score:number;average_accuracy:number;total_points:number;correct_answers:number;answers:number};quizzes:Array<any>};
export default function DashboardPage(){
 const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState('');
 useEffect(()=>{fetch('/api/dashboard').then(async r=>{const j=await r.json(); if(r.status===401){location.href='/login?redirectTo=/dashboard';return;} if(!r.ok)throw new Error(j.error);setData(j);}).catch(e=>setError(e.message));},[]);
 if(error)return <div className="container page"><div className="card center"><p className="error">{error}</p></div></div>;
 if(!data)return <div className="container page"><div className="skeleton" style={{height:180}}/></div>;
 const s=data.summary;
 return <div className="container page"><div><h1 className="h1">Your dashboard</h1><p className="lead">Your quiz history, scores, accuracy and wins in one place.</p></div>
 <div className="kpis" style={{marginTop:28}}>{[[Trophy,'Wins',s.wins],[Hash,'Quizzes joined',s.joined],[Target,'Average accuracy',`${s.average_accuracy}%`],[TrendingUp,'Average score',s.average_score]].map(([I,l,v],i)=>{const Icon=I as any;return <motion.div className="card kpi" key={String(l)} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.05}}><Icon size={20}/><b style={{marginTop:8}}>{v as any}</b><span>{l as string}</span></motion.div>})}</div>
 <div className="card" style={{marginTop:16}}><div className="row between"><h2 className="h2">Quiz history</h2><span className="pill">{s.total_points} total points</span></div>{!data.quizzes.length?<p className="muted" style={{marginTop:14}}>No quizzes joined yet. <Link href="/lobbies" style={{color:'#b6b0ff'}}>Browse public lobbies</Link>.</p>:<div style={{overflowX:'auto'}}><table className="table" style={{marginTop:8}}><thead><tr><th>Quiz</th><th>Topic</th><th>Status</th><th>Accuracy</th><th>Score</th><th>Rank</th></tr></thead><tbody>{data.quizzes.map(q=>{const acc=q.total_answers?Math.round(q.correct_answers/q.total_answers*100):0; const rank=Number(q.better_count)+1;return <tr key={q.quiz_id}><td><b>{q.title}</b></td><td className="muted">{q.topic_name||'—'}</td><td><span className={'pill '+q.status}>{q.status}</span></td><td>{acc}%</td><td className="score">{q.score}</td><td>{q.status==='finished'?(rank===1?'🏆 #1':`#${rank}`):'—'}</td></tr>})}</tbody></table></div>}</div>
 <div className="row" style={{marginTop:18}}><Link className="btn" href="/lobbies">Find a quiz <ArrowRight size={16}/></Link><Link className="btn ghost" href="/join">Enter a private code</Link></div>
 </div>;
}
