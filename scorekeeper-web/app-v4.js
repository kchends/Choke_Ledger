// REST-only Scorekeeper app bundle v4
(function(){
  const API_KEY = (window && window.__FIRESTORE_API_KEY) || '';
  const PROJECT = 'the-choke-ledger';
  const DB_ID = 'choke';
  const LOCAL_KEY = 'scorekeeper.players';

  function setStatus(s){ const el=document.getElementById('status'); if(el) el.textContent='Status: '+s; }
  function loadLocal(){ try{ const raw=localStorage.getItem(LOCAL_KEY); return raw?JSON.parse(raw):[] }catch(e){console.error(e);return[]} }
  function saveLocal(p){ try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(p)) }catch(e){console.error(e)} }
  function makeId(){ return 'local-'+(Date.now().toString(36)+Math.floor(Math.random()*1000).toString(36)) }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  function render(players){ const ul=document.getElementById('list'); if(!ul) return; ul.innerHTML=''; players.forEach(p=>{
    const li=document.createElement('li'); li.className='item';
    li.innerHTML = `<div><div class="name">${escapeHtml(p.name || 'Unnamed')}</div><div class="sub">${(p.misses||0)} misses — $${(p.misses||0)}</div></div>`;
    const controls=document.createElement('div'); controls.className='controls';
    const dec=document.createElement('button'); dec.textContent='−'; dec.onclick=()=>decPlayer(p.id);
    const inc=document.createElement('button'); inc.textContent='+'; inc.onclick=()=>incPlayer(p.id);
    const rm=document.createElement('button'); rm.textContent='✕'; rm.className='rm'; rm.onclick=()=>removePlayer(p.id);
    controls.appendChild(dec); controls.appendChild(inc); controls.appendChild(rm);
    li.appendChild(controls);
    ul.appendChild(li);
  }) }

  let players = loadLocal(); render(players); setStatus('ready (local)');

  document.getElementById('addBtn').addEventListener('click', ()=>{ const input=document.getElementById('nameInput'); const name=input.value.trim(); if(!name) return; input.value=''; addPlayer(name); });
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('nameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') { const name=e.target.value.trim(); if(name){ e.target.value=''; addPlayer(name); } } });

  function addPlayer(name){ const p={ id: makeId(), name, misses:0, createdAt: Date.now() }; players.push(p); saveLocal(players); render(players); createServerPlayer(p).then(newId=>{ if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); } }).catch(e=>console.error('create failed',e)); }

  function incPlayer(id){ players = players.map(p=> p.id===id? {...p, misses:(p.misses||0)+1}: p); saveLocal(players); render(players); if(!String(id).startsWith('local-')) updateServerPlayer(id,{ misses: players.find(p=>p.id===id).misses }).catch(e=>console.error(e)); }
  function decPlayer(id){ players = players.map(p=> p.id===id? {...p, misses:Math.max(0,(p.misses||0)-1)}: p); saveLocal(players); render(players); if(!String(id).startsWith('local-')) updateServerPlayer(id,{ misses: players.find(p=>p.id===id).misses }).catch(e=>console.error(e)); }
  function removePlayer(id){ players = players.filter(p=> p.id!==id); saveLocal(players); render(players); if(!String(id).startsWith('local-')) deleteServerPlayer(id).catch(e=>console.error(e)); }
  function resetAll(){ if(!confirm('Reset all scores to 0?')) return; players = players.map(p=> ({...p, misses:0})); saveLocal(players); render(players); players.forEach(p=>{ if(!String(p.id).startsWith('local-')) updateServerPlayer(p.id,{ misses:0 }).catch(e=>console.error(e)); }); }
  function exportCSV(){ let csv='Name,Misses,Amount\n'; players.forEach(p=>{ csv += '"'+String(p.name).replace(/"/g,'""')+'",'+(p.misses||0)+','+(p.misses||0)+'\n'; }); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='scores.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }

  // REST helpers
  function docIdFromName(name){ const parts=name.split('/'); return parts[parts.length-1]; }
  function parseDoc(doc){ const data=doc.fields||{}; return { id: docIdFromName(doc.name), name: (data.name && data.name.stringValue) ? data.name.stringValue : undefined, misses: (data.misses && parseInt(data.misses.integerValue||'0'))||0, createdAt: (data.createdAt && parseInt(data.createdAt.integerValue||String(Date.now())))||Date.now() }; }

  async function listServerPlayers(){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players?key=' + API_KEY; const res=await fetch(url); if(!res.ok){ const txt=await res.text(); throw new Error('list failed: '+res.status+' '+txt); } const json=await res.json(); if(!json.documents) return []; return json.documents.map(parseDoc); }catch(e){ console.error('listServerPlayers error', e); return null; } }
  async function createServerPlayer(p){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players?key='+API_KEY; const body={ fields: { name:{ stringValue: String(p.name) }, misses:{ integerValue: String(p.misses||0) }, createdAt:{ integerValue: String(p.createdAt||Date.now()) } } }; const res=await fetch(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const txt=await res.text(); if(!res.ok) throw new Error('create failed: '+res.status+' '+txt); const json=JSON.parse(txt); return docIdFromName(json.name); }catch(e){ console.error('createServerPlayer error', e); return null; } }
  async function updateServerPlayer(id,patch){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players/'+id+'?key='+API_KEY; const bodyFields={}; if(patch.misses!==undefined) bodyFields.misses={ integerValue: String(patch.misses) }; if(patch.name!==undefined) bodyFields.name={ stringValue: String(patch.name) }; const res=await fetch(url,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) }); if(!res.ok){ const txt=await res.text(); throw new Error('update failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('updateServerPlayer error', e); return false; } }
  async function deleteServerPlayer(id){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players/'+id+'?key='+API_KEY; const res=await fetch(url,{ method:'DELETE' }); if(!res.ok){ const txt=await res.text(); throw new Error('delete failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('deleteServerPlayer error', e); return false; } }

  // utility: total and chart
  function updateTotalAndChart(){ const total = players.reduce((s,p)=> s + (p.misses||0), 0); const totalEl = document.getElementById('total'); if(totalEl) totalEl.textContent = 'Total: $' + total; // chart
    try{ if(window.playerChart){ // update
        const labels = players.map(p=> p.name || 'Unnamed'); const data = players.map(p=> p.misses||0); window.playerChart.data.labels = labels; window.playerChart.data.datasets[0].data = data; window.playerChart.update();
      } else { const ctx = document.getElementById('chart'); if(ctx && window.Chart){ window.playerChart = new Chart(ctx.getContext('2d'), { type: 'pie', data: { labels: players.map(p=> p.name || 'Unnamed'), datasets:[{ data: players.map(p=> p.misses||0), backgroundColor: players.map((_,i)=> ['#4dc9f6','#f67019','#f53794','#537bc4','#acc236','#166a8f'][i%6]) }] }, options: { responsive:true, maintainAspectRatio:false } }); } } }catch(e){ console.error('chart update failed', e); }
  }

  // initial sync and poll (offline toggle removed)
  (async function init(){
    const server = await listServerPlayers();
    if(server===null){ setStatus('Firestore REST unreachable'); updateTotalAndChart(); } else {
      setStatus('connected to Firestore (REST)');
      const localOnly = players.filter(p=> String(p.id).startsWith('local-'));
      // merge server and local by id: prefer non-empty server.name, but keep local name if server name missing
      const byId = {};
      for(const l of players){ byId[l.id]=Object.assign({},l); }
      for(const s of server){ const existing = byId[s.id]; if(existing){ byId[s.id] = { id: s.id, name: (s.name && String(s.name).trim()) ? s.name : (existing.name || s.name), misses: (s.misses!==undefined)? s.misses : (existing.misses||0), createdAt: s.createdAt||existing.createdAt }; } else { byId[s.id] = Object.assign({}, s); } }
      players = Object.values(byId);
      // ensure local-only entries are preserved
      players = players.concat(localOnly.filter(p=> !players.find(x=>x.id===p.id)));
      saveLocal(players); render(players); updateTotalAndChart();
      for(const p of localOnly){ const newId = await createServerPlayer(p); if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); updateTotalAndChart(); } }
      if(typeof window !== 'undefined'){ setInterval(async ()=>{ const s = await listServerPlayers(); if(s && Array.isArray(s)){ const localOnly2 = players.filter(p=> String(p.id).startsWith('local-'));
            // merge same as above
            const byId2 = {};
            for(const l of players){ byId2[l.id]=Object.assign({},l); }
            for(const ss of s){ const existing = byId2[ss.id]; if(existing){ byId2[ss.id] = { id: ss.id, name: (ss.name && String(ss.name).trim()) ? ss.name : (existing.name || ss.name), misses: (ss.misses!==undefined)? ss.misses : (existing.misses||0), createdAt: ss.createdAt||existing.createdAt }; } else { byId2[ss.id] = Object.assign({}, ss); } }
            let merged = Object.values(byId2);
            merged = merged.concat(localOnly2.filter(p=> !merged.find(x=>x.id===p.id)));
            players = merged;
            saveLocal(players); render(players); updateTotalAndChart(); setStatus('connected to Firestore (REST)'); } }, 2000); }
    }
  })();

  // server wrappers removed (offline toggle removed)
  // using direct REST helpers defined above (listServerPlayers/createServerPlayer/updateServerPlayer/deleteServerPlayer)

  // override push/update/delete functions to use REST
  function pushToFirestore(p){ return createServerPlayer(p); }
  function updateFirestore(id, patch){ return updateServerPlayer(id, patch); }
  function deleteFirestore(id){ return deleteServerPlayer(id); }

  // no-op for tryInit

})();