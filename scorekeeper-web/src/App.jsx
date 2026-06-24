import React, { useEffect, useState } from 'react'
import { db, playersCol } from './firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'

const LOCAL_KEY = 'scorekeeper.players'
function csvEscape(s){ return '"'+String(s).replace(/"/g,'""')+'"' }
function makeId(){ return Date.now().toString(36) + Math.floor(Math.random()*1000).toString(36) }

export default function App(){
  const [players, setPlayers] = useState([])
  const [newName, setNewName] = useState('')

  // load from localStorage first so UI works offline or when firestore isn't available
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(LOCAL_KEY)
      if(raw){ setPlayers(JSON.parse(raw)) }
    }catch(e){ console.error('load local error', e) }

    const q = query(playersCol, orderBy('createdAt'))
    const unsub = onSnapshot(q, snap=>{
      const items = []
      snap.forEach(d=> items.push({ id: d.id, ...d.data() }))
      // only overwrite if snapshot returned docs (i.e., firestore active)
      if(items.length > 0){
        setPlayers(items)
        try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(items)) }catch(e){}
      }
    }, err=> console.error('snapshot err', err))
    return ()=> unsub()
  }, [])

  // keep a local copy for quick reloads
  useEffect(()=>{
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(players)) }catch(e){ console.error('save local error', e) }
  }, [players])

  async function addPlayer(){
    const name = newName.trim(); if(!name) return
    const tempId = 'local-'+makeId()
    const newPlayer = { id: tempId, name, misses: 0, createdAt: Date.now() }
    setPlayers(prev=>[...prev, newPlayer])
    setNewName('')

    try{
      const docRef = await addDoc(playersCol, { name, misses: 0, createdAt: Date.now() })
      // replace temp id with server id
      setPlayers(prev=> prev.map(p=> p.id===tempId ? { ...p, id: docRef.id } : p ))
    }catch(e){
      console.error('addDoc failed', e)
      alert('Could not save to server — saved locally only')
    }
  }

  async function inc(id){
    setPlayers(prev=> prev.map(p=> p.id===id ? { ...p, misses: (p.misses||0)+1 } : p ))
    // only update server if this has a server id
    if(String(id).startsWith('local-')) return
    try{
      const p = players.find(x=>x.id===id)
      await updateDoc(doc(db, 'players', id), { misses: (p?.misses||0)+1 })
    }catch(e){ console.error('inc failed', e); alert('Server update failed') }
  }

  async function dec(id){
    setPlayers(prev=> prev.map(p=> p.id===id ? { ...p, misses: Math.max(0,(p.misses||0)-1) } : p ))
    if(String(id).startsWith('local-')) return
    try{
      const p = players.find(x=>x.id===id)
      await updateDoc(doc(db, 'players', id), { misses: Math.max(0,(p?.misses||0)-1) })
    }catch(e){ console.error('dec failed', e); alert('Server update failed') }
  }

  async function remove(id){
    setPlayers(prev=> prev.filter(p=>p.id!==id))
    if(String(id).startsWith('local-')) return
    try{ await deleteDoc(doc(db,'players',id)) }catch(e){ console.error('delete failed', e); alert('Server delete failed') }
  }

  async function resetAll(){
    setPlayers(prev=> prev.map(p=> ({ ...p, misses: 0 })))
    // try server updates, but don't block UI
    for(const p of players){
      if(String(p.id).startsWith('local-')) continue
      try{ await updateDoc(doc(db,'players',p.id), { misses: 0 }) }catch(e){ console.error('reset failed for', p.id, e) }
    }
  }

  function exportCSV(){
    let csv = 'Name,Misses,Amount\n'
    for(const p of players){ csv += `${csvEscape(p.name)},${p.misses||0},${p.misses||0}\n` }
    return csv
  }

  async function share(){
    const csv = exportCSV()
    // download as file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'scores.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header>
        <h1>Scorekeeper</h1>
      </header>
      <main>
        <div className="addRow">
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Player name" />
          <button onClick={addPlayer} disabled={!newName.trim()}>Add</button>
        </div>

        <ul className="list">
          {players.map(p=> (
            <li key={p.id} className="item">
              <div>
                <div className="name">{p.name}</div>
                <div className="sub">{(p.misses||0)} misses — ${(p.misses||0)}</div>
              </div>
              <div className="controls">
                <button onClick={()=>dec(p.id)}>-</button>
                <button onClick={()=>inc(p.id)}>+</button>
                <button className="rm" onClick={()=>remove(p.id)}>✕</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="footer">
          <button className="danger" onClick={resetAll}>Reset All</button>
          <button onClick={share}>Export CSV</button>
        </div>
      </main>
    </div>
  )
}
