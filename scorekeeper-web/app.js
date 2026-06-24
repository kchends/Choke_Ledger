// Minimal static Scorekeeper with Firestore (compat) and localStorage fallback
(function(){
  const firebaseConfig = {
    apiKey: (window && window.__FIRESTORE_API_KEY) || '',
    authDomain: "the-choke-ledger.firebaseapp.com",
    projectId: "the-choke-ledger"
  };

  const LOCAL_KEY = 'scorekeeper.players';
  const statusEl = () => document.getElementById('status');
  const listEl = () => document.getElementById('list');

  function setStatus(s){ const el = statusEl(); if(el) el.textContent = 'Status: '+s; }
  function makeId(){ return 'local-'+(Date.now().toString(36)+Math.floor(Math.random()*1000).toString(36)) }

  // local players structure: [{id,name,misses,createdAt}]
  function loadLocal(){ try{ const raw = localStorage.getItem(LOCAL_KEY); return raw? JSON.parse(raw): []; }catch(e){ console.error(e); return []; } }
  function saveLocal(players){ try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(players)); }catch(e){ console.error(e); } }

  // UI helpers
  function render(players){ const ul = listEl(); if(!ul) return; ul.innerHTML = ''; players.forEach(p=>{
    const li = document.createElement('li'); li.className='item';
    li.innerHTML = `<div><div class="name">${escapeHtml(p.name)}</div><div class="sub">${(p.misses||0)} misses — $${(p.misses||0)}</div></div>`;
    const controls = document.createElement('div'); controls.className='controls';
    const dec = document.createElement('button'); dec.textContent='−'; dec.onclick=()=> decPlayer(p.id);
    const inc = document.createElement('button'); inc.textContent='+'; inc.onclick=()=> incPlayer(p.id);
    const rm = document.createElement('button'); rm.textContent='✕'; rm.className='rm'; rm.onclick=()=> removePlayer(p.id);
    controls.appendChild(dec); controls.appendChild(inc); controls.appendChild(rm);
    li.appendChild(controls);
    ul.appendChild(li);
  })}

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // local store
  let players = loadLocal();
  render(players);
  setStatus('ready (local)');

  // wire UI
  document.getElementById('addBtn').addEventListener('click', addPlayerFromInput);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('nameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') addPlayerFromInput(); });

  function addPlayerFromInput(){ const input = document.getElementById('nameInput'); const name = input.value.trim(); if(!name) return; input.value=''; addPlayer(name); }

  function addPlayer(name){ const p = { id: makeId(), name, misses:0, createdAt: Date.now() }; players.push(p); saveLocal(players); render(players); if(window.appFirestoreReady){ pushToFirestore(p).then(id=>{ if(id){ // replace local id
        players = players.map(x=> x.id===p.id? {...x,id}: x ); saveLocal(players); render(players);
      }}).catch(e=>console.error('push failed',e)); } }

  function incPlayer(id){ players = players.map(p=> p.id===id? {...p,misses:(p.misses||0)+1}: p); saveLocal(players); render(players); if(window.appFirestoreReady && !String(id).startsWith('local-')) updateFirestore(id,{ misses: players.find(p=>p.id===id).misses }); }
  function decPlayer(id){ players = players.map(p=> p.id===id? {...p,misses:Math.max(0,(p.misses||0)-1)}: p); saveLocal(players); render(players); if(window.appFirestoreReady && !String(id).startsWith('local-')) updateFirestore(id,{ misses: players.find(p=>p.id===id).misses }); }
  function removePlayer(id){ players = players.filter(p=> p.id!==id); saveLocal(players); render(players); if(window.appFirestoreReady && !String(id).startsWith('local-')) deleteFirestore(id); }
  function resetAll(){ if(!confirm('Reset all scores to 0?')) return; players = players.map(p=> ({ ...p, misses:0 })); saveLocal(players); render(players); if(window.appFirestoreReady){ players.forEach(p=>{ if(!String(p.id).startsWith('local-')) updateFirestore(p.id,{ misses:0 }); }); } }

  function exportCSV(){ let csv='Name,Misses,Amount\n'; players.forEach(p=>{ csv += '"'+String(p.name).replace(/"/g,'""')+'",'+(p.misses||0)+','+(p.misses||0)+'\n'; }); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='scores.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }

  // Firestore integration via REST API (uses database id 'choke')
  const API_KEY = firebaseConfig.apiKey;
  const PROJECT = firebaseConfig.projectId;
  const DB_ID = 'choke'; // use the database id you created in GCP

  function docIdFromName(name){ // name: projects/PROJECT/databases/DB/documents/players/{docId}
    const parts = name.split('/'); return parts[parts.length-1];
  }

  function parseDoc(doc){
    const data = doc.fields || {};
    return {
      id: docIdFromName(doc.name),
      name: (data.name && data.name.stringValue) || '',
      misses: data.misses && parseInt(data.misses.integerValue || '0') || 0,
      createdAt: data.createdAt && parseInt(data.createdAt.integerValue || String(Date.now())) || Date.now()
    };
  }

  async function listServerPlayers(){
    try{
      const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players?key=' + API_KEY;
      const res = await fetch(url);
      if(!res.ok){ const txt = await res.text(); throw new Error('list failed: '+res.status+' '+txt); }
      const json = await res.json();
      if(!json.documents) return [];
      return json.documents.map(parseDoc);
    }catch(e){ console.error('listServerPlayers error', e); return null; }
  }

  async function createServerPlayer(p){
    try{
      const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players?key=' + API_KEY;
      const body = { fields: { name:{ stringValue: String(p.name) }, misses:{ integerValue: String(p.misses||0) }, createdAt:{ integerValue: String(p.createdAt||Date.now()) } } };
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const txt = await res.text();
      if(!res.ok) throw new Error('create failed: '+res.status+' '+txt);
      const json = JSON.parse(txt);
      return docIdFromName(json.name);
    }catch(e){ console.error('createServerPlayer error', e); return null; }
  }

  async function updateServerPlayer(id, patch){
    try{
      const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + id + '?key=' + API_KEY;
      const bodyFields = {};
      if(patch.misses !== undefined) bodyFields.misses = { integerValue: String(patch.misses) };
      if(patch.name !== undefined) bodyFields.name = { stringValue: String(patch.name) };
      const res = await fetch(url, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) });
      if(!res.ok){ const txt = await res.text(); throw new Error('update failed: '+res.status+' '+txt); }
      return true;
    }catch(e){ console.error('updateServerPlayer error', e); return false; }
  }

  async function deleteServerPlayer(id){
    try{
      const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + id + '?key=' + API_KEY;
      const res = await fetch(url, { method: 'DELETE' });
      if(!res.ok){ const txt = await res.text(); throw new Error('delete failed: '+res.status+' '+txt); }
      return true;
    }catch(e){ console.error('deleteServerPlayer error', e); return false; }
  }

  // poll for server changes every 2s
  let polling = null;
  async function pollServer(){
    const list = await listServerPlayers();
    if(list === null){ setStatus('server unreachable'); return; }
    setStatus('connected to Firestore (REST)');
    // merge: server items first, then local-only
    const localOnly = players.filter(p=> String(p.id).startsWith('local-'));
    players = [...list, ...localOnly];
    saveLocal(players);
    render(players);
  }

  // start polling and attempt to migrate local-only
  (async function initRest(){
    const first = await listServerPlayers();
    if(first === null){ setStatus('Firestore REST unreachable'); }
    else{
      setStatus('connected to Firestore (REST)');
      // replace players with server + local-only
      const localOnly = players.filter(p=> String(p.id).startsWith('local-'));
      players = [...first, ...localOnly]; saveLocal(players); render(players);
      // migrate local-only
      for(const p of localOnly){ const newId = await createServerPlayer(p); if(newId){ players = players.map(x=> x.id===p.id? { ...x, id:newId }: x ); saveLocal(players); render(players); } }
      // start polling
      if(polling) clearInterval(polling);
      polling = setInterval(pollServer, 2000);
    }
  })();

  // override push/update/delete functions to use REST
  function pushToFirestore(p){ return createServerPlayer(p); }
  function updateFirestore(id, patch){ return updateServerPlayer(id, patch); }
  function deleteFirestore(id){ return deleteServerPlayer(id); }

  // no-op for tryInit
  // previously tried SDK init; replaced by REST init above

})();