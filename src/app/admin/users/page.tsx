'use client';
import { useEffect,useState } from 'react';
import { ShieldCheck, UserRoundCog } from 'lucide-react';

type User={id:string;name:string;username:string|null;role:'student'|'admin';created_at:string};
export default function UsersPage(){const [users,setUsers]=useState<User[]>([]);const [msg,setMsg]=useState('');
 async function load(){const r=await fetch('/api/admin/users');const j=await r.json();if(r.ok)setUsers(j);else setMsg(j.error||'Unable to load users');}
 useEffect(()=>{load()},[]);
 async function setRole(userId:string,role:string){const r=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,role})});const j=await r.json();if(!r.ok)setMsg(j.error);else {setMsg(`${j.name} is now ${j.role}.`);load();}}
 return <div className="container page"><div className="row between wrap"><div><h1 className="h1">Registered users</h1><p className="lead">Review accounts and assign or remove administrator access.</p></div><span className="pill"><ShieldCheck size={14}/> Admin-only</span></div>{msg&&<p className="success" style={{marginTop:14}}>{msg}</p>}<div className="card" style={{marginTop:20,overflowX:'auto'}}><table className="table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th><th>Access</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b></td><td className="muted">{u.username||'—'}</td><td><span className={'pill '+(u.role==='admin'?'live':'')}>{u.role}</span></td><td className="muted">{new Date(u.created_at).toLocaleDateString()}</td><td>{u.role==='admin'?<button className="btn ghost sm" onClick={()=>setRole(u.id,'student')}><UserRoundCog size={14}/> Make student</button>:<button className="btn sm" onClick={()=>setRole(u.id,'admin')}><ShieldCheck size={14}/> Make admin</button>}</td></tr>)}</tbody></table>{!users.length&&<p className="muted">No registered profiles found.</p>}</div></div>}
