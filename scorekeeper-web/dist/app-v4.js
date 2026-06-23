// REST-only Scorekeeper app bundle v4
(function(){
  const PROD_API_KEY = 'REDACTED_API_KEY';
  const PROD_PROJECT = 'the-choke-ledger';
  const PROD_DB_ID = 'choke';

  // Test DB settings - replace these with your test project credentials
  // use PROD project for localhost but write to players-test collection
  const TEST_API_KEY = PROD_API_KEY;
  const TEST_PROJECT = PROD_PROJECT;
  const TEST_DB_ID = PROD_DB_ID;

  // active settings (defaults to production)
  let API_KEY = PROD_API_KEY;
  let PROJECT = PROD_PROJECT;
  let DB_ID = PROD_DB_ID;
  let COLLECTION = 'players';

  // Auto-select test DB when running on common local hostnames unless forced to production.
  // To force production packaging set window.FORCE_PROD = true or add ?prod=1 to the URL.
  if(typeof window !== 'undefined'){
    const host = window.location.hostname || '';
    const forceProd = (window.location.search && window.location.search.indexOf('prod=1') !== -1) || window.FORCE_PROD === true;
    if((host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) && !forceProd){
      API_KEY = TEST_API_KEY; PROJECT = TEST_PROJECT; DB_ID = TEST_DB_ID; COLLECTION = 'players-test';
    }
  }
  const LOCAL_KEY = 'scorekeeper.players';
  const EDITOR_ID_KEY = 'scorekeeper.editorId';
  const EDITOR_NAME_KEY = 'scorekeeper.editorName';
  let editorId = localStorage.getItem(EDITOR_ID_KEY) || null;
  let editorName = localStorage.getItem(EDITOR_NAME_KEY) || null;
  function ensureEditor(){ if(!editorId){ editorId = 'ed-' + (Date.now().toString(36)+Math.floor(Math.random()*1000).toString(36)); try{ localStorage.setItem(EDITOR_ID_KEY, editorId); }catch(e){} } }
  ensureEditor();
  function setEditorName(name){ editorName = (name||'').trim(); try{ if(editorName) localStorage.setItem(EDITOR_NAME_KEY, editorName); else localStorage.removeItem(EDITOR_NAME_KEY); }catch(e){} }
  // helper to return current editor info
  function currentEditor(){ return { id: editorId || 'unknown', name: editorName || 'Anonymous' }; }

  function setStatus(s){ const el=document.getElementById('status'); if(el) el.textContent='Status: '+s; }
  // debug banner: show active DB and last fetch status
  function setDebugInfo(obj){ /* debug output removed per request */ }
  function loadLocal(){ try{ const raw=localStorage.getItem(LOCAL_KEY); return raw?JSON.parse(raw):[] }catch(e){console.error(e);return[]} }
  function saveLocal(p){ try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(p)) }catch(e){console.error(e)} }
  function makeId(){ return 'local-'+(Date.now().toString(36)+Math.floor(Math.random()*1000).toString(36)) }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // dynamic skill rates persisted in localStorage
  const SKILL_RATES_KEY = 'scorekeeper.skillRates';
  const defaultSkillRates = { '1-2':0, '3':2, '4':4, '5':6, '6':8, '7':10, '8':12, '9':14 };
  function loadSkillRates(){ try{ const raw = localStorage.getItem(SKILL_RATES_KEY); if(raw) return JSON.parse(raw); }catch(e){} return Object.assign({}, defaultSkillRates); }
  function saveSkillRates(rates){ try{ localStorage.setItem(SKILL_RATES_KEY, JSON.stringify(rates)); }catch(e){} }
  let skillRates = loadSkillRates();
  function skillRate(skill){ const s = Number(skill) || 1; if(s<=2) return Number(skillRates['1-2'])||0; return Number(skillRates[String(s)])||0; }

    // Firestore-backed skill rates: document path config/skillRates
    async function fetchServerSkillRates(){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/config/skillRates?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ const txt = await res.text(); console.warn('fetchServerSkillRates failed', res.status, txt); return null; } const json = await res.json(); const f = json.fields || {}; const out = Object.assign({}, defaultSkillRates);
        for(const k of Object.keys(out)){ if(f[k] && f[k].integerValue!==undefined) out[k] = parseInt(f[k].integerValue,10); }
        return out; }catch(e){ console.error('fetchServerSkillRates error', e); return null; } }

    async function saveServerSkillRates(rates){ try{ const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/config/skillRates?key=' + API_KEY; const fields = {}; for(const k of Object.keys(rates)){ fields[k] = { integerValue: String(rates[k]||0) }; }
        const res = await fetch(base, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fields }) }); if(!res.ok){ const txt = await res.text(); throw new Error('saveServerSkillRates failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('saveServerSkillRates error', e); return false; } }

    async function getServerSkillRate(skill){ try{ const rates = await fetchServerSkillRates(); if(rates){ if(Number(skill)<=2) return Number(rates['1-2'])||0; return Number(rates[String(skill)])||0; } return null; }catch(e){ return null; } }

  let editingId = null;
  const expandedPlayers = new Set(); const showAllEvents = new Set();

  async function listMissEvents(playerId){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '/' + encodeURIComponent(playerId) + '/misses?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ const txt = await res.text(); throw new Error('list misses failed: '+res.status+' '+txt); } const json = await res.json(); if(!json.documents) return []; return json.documents.map(parseMissDoc).sort((a,b)=> (a.ts||0)-(b.ts||0)); }catch(e){ console.error('listMissEvents error',e); return []; } }

  function parseMissDoc(doc){ const d = doc.fields || {}; return { id: docIdFromName(doc.name), ts: d.ts ? parseInt(d.ts.integerValue||'0') : 0, tsIso: d.tsIso ? (d.tsIso.stringValue||'') : '', skill: d.skill ? parseInt(d.skill.integerValue||'1') : 1, rate: d.rate ? parseInt(d.rate.integerValue||'0') : 0, amount: d.amount ? parseInt(d.amount.integerValue||'0') : 0, action: d.action ? (d.action.stringValue||'') : undefined, beforeAmount: d.beforeAmount ? parseInt(d.beforeAmount.integerValue||'0') : undefined }; }

  // parse a change/audit doc under players/{id}/changes
  function parseChangeDoc(doc){ try{ const d = doc.fields || {}; const action = d.action ? (d.action.stringValue||'') : ''; const ts = d.ts ? parseInt(d.ts.integerValue||'0') : 0; const tsIso = d.tsIso ? (d.tsIso.stringValue||'') : ''; const patch = d.patch ? (d.patch.stringValue||'') : ''; const snapshot = d.snapshot ? (d.snapshot.stringValue||'') : ''; // attempt to extract skill from patch or snapshot
    let skill = undefined; try{ if(patch){ const p = JSON.parse(patch); if(p.skill!==undefined) skill = Number(p.skill); } if(skill===undefined && snapshot){ const s = JSON.parse(snapshot); if(s.skill!==undefined) skill = Number(s.skill); } }catch(e){}
    return { id: docIdFromName(doc.name), ts, tsIso, action, patch, snapshot, skill }; }catch(e){ return null; } }

  // list change entries for a player (audit trail)
  async function listChangeEntries(playerId){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '/' + encodeURIComponent(playerId) + '/changes?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ const txt = await res.text(); throw new Error('list changes failed: '+res.status+' '+txt); } const json = await res.json(); if(!json.documents) return []; return json.documents.map(parseChangeDoc).filter(x=>x); }catch(e){ console.error('listChangeEntries error',e); return []; } }

  // unified player events: combine miss events and change entries, sorted by ts desc
  async function listPlayerEvents(playerId){ try{ const [misses, changes] = await Promise.all([ listMissEvents(playerId), listChangeEntries(playerId) ]); const mappedChanges = (changes||[]).map(c=>{ return { ts: c.ts||0, tsIso: c.tsIso||'', action: c.action, skill: c.skill, // include patch/snapshot for more detail
        patch: c.patch, snapshot: c.snapshot }; }); const all = (misses||[]).concat(mappedChanges||[]); return all.sort((a,b)=> (Number(b.ts||0) - Number(a.ts||0))); }catch(e){ console.error('listPlayerEvents error', e); return []; } }

  function render(players){ const ul=document.getElementById('list'); if(!ul) return; ul.innerHTML='';
      // sort by misses desc, tie-breaker: highest dollar amount, then newest
      const sorted = (players||[]).slice().sort((a,b)=>{
        const ma = (a.misses||0);
        const mb = (b.misses||0);
        if(mb - ma !== 0) return mb - ma;
        const ama = (a.misses||0) * (a.skill||1);
        const amb = (b.misses||0) * (b.skill||1);
        if(amb - ama !== 0) return amb - ama;
        return (b.createdAt||0) - (a.createdAt||0);
      });
      // determine all top players (ties allowed) by misses then amount
      const topPlayers = [];
      const topDollarPlayers = [];
      if(sorted.length>0){
        const bestMiss = sorted[0].misses||0; const bestAmount = (sorted[0].misses||0) * (sorted[0].skill||1);
        for(const sp of sorted){ if((sp.misses||0) === bestMiss && ((sp.misses||0)*(sp.skill||1)) === bestAmount){ topPlayers.push(sp.id); } else break; }
        // compute highest dollar amount (amountOwed if present, otherwise misses*skill)
        const vals = sorted.map(sp => Number(sp.amountOwed) || ((sp.misses||0)*(sp.skill||1)));
        const bestDollar = Math.max.apply(null, vals);
        for(const sp of sorted){ const val = Number(sp.amountOwed) || ((sp.misses||0)*(sp.skill||1)); if(val === bestDollar) topDollarPlayers.push(sp.id); }
      }
      sorted.forEach(p=>{
        const li=document.createElement('li'); li.className='item';
        if(topPlayers.includes(p.id)) li.classList.add('mvp');
        if(topDollarPlayers.includes(p.id)) li.classList.add('donor');
        const amount = Number(p.amountOwed) || ((p.misses||0) * skillRate(p.skill));
        const safeName = escapeHtml(p.name || 'Unnamed');
        const badgesArr = [];
        if(topPlayers.includes(p.id)) badgesArr.push('<span class="mvp-badge">👑 Choke Champion</span>');
        if(topDollarPlayers.includes(p.id)) badgesArr.push('<span class="donor-badge">💰 Biggest Contributor</span>');
        const badge = badgesArr.join(' ');
        const infoDiv = document.createElement('div'); infoDiv.style.flex = '1';
        if(p.id === editingId){
          const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = p.name || '';
          nameInput.style.padding = '8px'; nameInput.style.borderRadius = '6px'; nameInput.style.marginRight = '8px';
          const skillInput = document.createElement('input'); skillInput.type = 'number'; skillInput.min = '1'; skillInput.max = '9'; skillInput.value = p.skill || 1;
          skillInput.style.width = '80px'; skillInput.style.marginRight = '8px';
                  const missesInput = document.createElement('input'); missesInput.type = 'number'; missesInput.min = '0'; missesInput.value = String(p.misses||0);
                  missesInput.style.width = '80px'; missesInput.style.marginRight = '8px';
                  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.onclick = ()=> saveEdit(p.id, nameInput.value, skillInput.value, missesInput.value);
                  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; cancelBtn.onclick = ()=> { editingId = null; render(players); };
                  infoDiv.appendChild(nameInput);
                  // labeled numeric fields
                  const skillWrapper = document.createElement('div'); skillWrapper.style.display='inline-flex'; skillWrapper.style.alignItems='center'; skillWrapper.style.marginRight = '8px'; const skillLabel = document.createElement('label'); skillLabel.textContent = 'Skill (1-9): '; skillLabel.style.marginRight = '4px'; skillWrapper.appendChild(skillLabel); skillWrapper.appendChild(skillInput);
                  const missesWrapper = document.createElement('div'); missesWrapper.style.display='inline-flex'; missesWrapper.style.alignItems='center'; missesWrapper.style.marginRight = '8px'; const missesLabel = document.createElement('label'); missesLabel.textContent = 'Misses: '; missesLabel.style.marginRight = '4px'; missesWrapper.appendChild(missesLabel); missesWrapper.appendChild(missesInput);
                  infoDiv.appendChild(skillWrapper); infoDiv.appendChild(missesWrapper); infoDiv.appendChild(saveBtn); infoDiv.appendChild(cancelBtn);
                } else {
          const nameDiv = document.createElement('div'); nameDiv.className='name'; nameDiv.innerHTML = safeName + badge; nameDiv.style.cursor = 'pointer'; nameDiv.onclick = async ()=>{ if(expandedPlayers.has(p.id)){ expandedPlayers.delete(p.id); render(players); return; } setStatus('loading events...'); const events = await listPlayerEvents(p.id); p._events = events; expandedPlayers.add(p.id); setStatus('ready'); render(players); }; const subDiv = document.createElement('div'); subDiv.className='sub'; subDiv.textContent = 'Skill: ' + (p.skill||1) + ' — ' + (p.misses||0) + ' misses — $' + amount; infoDiv.appendChild(nameDiv); infoDiv.appendChild(subDiv);
                            if(expandedPlayers.has(p.id)){ const evDiv = document.createElement('div'); evDiv.className='events'; evDiv.style.marginTop='8px'; const allEvents = (p._events || []).slice().sort((a,b)=> (Number(b.ts||0) - Number(a.ts||0))); const showAll = showAllEvents.has(p.id); const events = showAll ? allEvents : allEvents.slice(0,5); if(events.length===0){ const ulEv = document.createElement('ul'); ulEv.style.margin='6px 0'; ulEv.style.paddingLeft='18px'; const liE=document.createElement('li'); liE.textContent='No events found.'; ulEv.appendChild(liE); evDiv.appendChild(ulEv); } else {
                                            // group events by year and display month-day (MM-DD) under year headers
                const groups = {};
                for(const e of events){ const d = new Date(Number(e.ts||0)); const year = d.getFullYear(); if(!groups[year]) groups[year]=[]; groups[year].push(e); }
                // display years in descending order (most recent first)
                const years = Object.keys(groups).map(Number).sort((a,b)=> b-a);
                for(const y of years){ const yearHdr = document.createElement('div'); yearHdr.style.fontWeight='700'; yearHdr.style.marginTop='6px'; yearHdr.textContent = String(y); evDiv.appendChild(yearHdr);
                  const ulYear = document.createElement('ul'); ulYear.style.margin='6px 0'; ulYear.style.paddingLeft='18px';
                  for(const e of groups[y]){ const d = new Date(Number(e.ts||0)); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); const display = mm + '-' + dd; const liE = document.createElement('li');
                    // render different event types
                                                if(e.action === 'paid'){ const prev = (e.beforeAmount!==undefined) ? Number(e.beforeAmount) : (e.amount||0); liE.textContent = display + ' — PAID — previous $' + prev; // add revert control if unlocked
                                                    const unlocked = sessionStorage.getItem('skillRatesUnlocked') === '1'; if(unlocked){ const revBtn = document.createElement('button'); revBtn.textContent='Revert'; revBtn.style.marginLeft='8px'; revBtn.onclick = ()=>{ revertPaidEvent(p.id, e); }; liE.appendChild(revBtn); }
                                                }
                                                else { const amt = (e.rate!==undefined) ? e.rate : (e.amount||0); liE.textContent = display + ' — Skill: ' + (e.skill||'') + ' — $' + amt; }
                                                ulYear.appendChild(liE); }
                                              evDiv.appendChild(ulYear);
                                            }
                                          }
                                          // show more/less control
                                          if(!showAll && allEvents.length>5){ const moreBtn = document.createElement('button'); moreBtn.textContent='Show more'; moreBtn.style.marginTop='6px'; moreBtn.onclick = ()=>{ showAllEvents.add(p.id); render(players); }; evDiv.appendChild(moreBtn); }
                                          else if(showAll && allEvents.length>5){ const lessBtn = document.createElement('button'); lessBtn.textContent='Show less'; lessBtn.style.marginTop='6px'; lessBtn.onclick = ()=>{ showAllEvents.delete(p.id); render(players); }; evDiv.appendChild(lessBtn); }
                                          infoDiv.appendChild(evDiv); }
        }
        li.appendChild(infoDiv);
        const controls=document.createElement('div'); controls.className='controls';
        const inc=document.createElement('button'); inc.type='button'; inc.textContent='+'; inc.onclick=()=>incPlayer(p.id);
                const ed=document.createElement('button'); ed.type='button'; ed.textContent='✎'; ed.className='edit'; ed.onclick=()=>editPlayer(p.id);
                const rm=document.createElement('button'); rm.type='button'; rm.textContent='✕'; rm.className='rm'; rm.onclick=()=>removePlayer(p.id);
                        const eraseBtn=document.createElement('button'); eraseBtn.type='button'; eraseBtn.textContent='Mark paid'; eraseBtn.className='erase'; eraseBtn.style.marginLeft='8px'; eraseBtn.onclick=()=>erasePlayerRecords(p.id);
                        controls.appendChild(inc); controls.appendChild(ed); controls.appendChild(rm); controls.appendChild(eraseBtn);
                li.appendChild(controls);
        ul.appendChild(li);
      }) }

  let players = loadLocal(); render(players); setStatus('ready (local)');

  document.getElementById('addBtn').addEventListener('click', ()=>{ const input=document.getElementById('nameInput'); const name=input.value.trim(); if(!name) return; input.value=''; addPlayer(name); });
  const resetBtnEl = document.getElementById('resetBtn'); if(resetBtnEl){ resetBtnEl.addEventListener('click', resetAll); /* removed from UI */ }
  document.getElementById('nameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') { const name=e.target.value.trim(); if(name){ e.target.value=''; addPlayer(name); } } });

  function addPlayer(name){ name = (name||'').trim(); if(!name) return; const skillInput = document.getElementById('skillInput'); let skill = 1; if(skillInput){ skill = parseInt(skillInput.value) || 1; skill = Math.max(1, Math.min(9, skill)); skillInput.value = ''; }
      // auto-suffix duplicate names: perform case-insensitive check against existing player names
      const existing = players.map(p=> (p.name||'').trim().toLowerCase()); let base = name; let candidate = base; let idx = 1; while(existing.includes(candidate.toLowerCase())){ idx++; candidate = base + ' (' + idx + ')'; }
      const finalName = candidate;
      const p={ id: makeId(), name: finalName, skill, misses:0, createdAt: Date.now() };
      players.push(p); saveLocal(players); render(players);
      createServerPlayer(p).then(newId=>{ if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); } }).catch(e=>console.error('create failed',e)); }

  function editPlayer(id){ editingId = id; render(players); }

    async function saveEdit(id,newName,newSkill,newMisses){ const p = players.find(x=> x.id===id); if(!p) return; const old = { name: p.name, skill: p.skill, misses: p.misses };
      p.name = (newName||'').trim(); p.skill = Math.max(1, Math.min(9, Number(newSkill) || 1)); p.misses = Math.max(0, Number(newMisses) || 0); editingId = null; saveLocal(players); render(players); updateTotalAndChart(); if(String(p.id).startsWith('local-')){ setStatus('saved (local)'); return true; }
      try{ setStatus('saving...'); const ok = await updateServerPlayer(p.id,{ name: p.name, skill: p.skill, misses: p.misses }); if(ok){ try{ await createChangeEntry(p.id, 'update', JSON.stringify({ name: p.name, skill: p.skill, misses: p.misses }), JSON.stringify(p)); }catch(e){ console.error('failed to create change entry', e); }
          setStatus('saved'); return true; } else { throw new Error('server returned failure'); } }catch(e){ console.error('edit failed', e); // revert
        p.name = old.name; p.skill = old.skill; p.misses = old.misses; saveLocal(players); render(players); updateTotalAndChart(); setStatus('save failed'); return false; } }

  function incPlayer(id){ // create a per-miss event and update player totals
      const player = players.find(p=>p.id===id); if(!player) return;
      // increment misses immediately for UI responsiveness
      player.misses = (player.misses||0) + 1;
      const rate = skillRate(player.skill);
      // If this is a local-only record, apply amount immediately and return
      if(String(id).startsWith('local-')){
        player.amountOwed = (player.amountOwed||0) + rate;
        saveLocal(players); render(players); updateTotalAndChart(); setStatus('miss logged (local)'); return;
      }
      // For server-backed players, persist misses first, then compute final rate from server and add once
      saveLocal(players); render(players); updateTotalAndChart();
      (async ()=>{ try{
        const serverRate = await getServerSkillRate(player.skill);
        const finalRate = (serverRate!==null) ? serverRate : rate;
        player.amountOwed = (player.amountOwed||0) + finalRate;
        saveLocal(players); render(players); updateTotalAndChart();
        const got = await createMissEvent(id, player.skill, finalRate);
        if(got){ const pnow = players.find(p=>p.id===id); await updateServerPlayer(id,{ misses: pnow.misses, amountOwed: pnow.amountOwed }); // append event locally so history updates immediately
                  const newEvent = { ts: Date.now(), tsIso: new Date().toISOString(), skill: player.skill, rate: finalRate, amount: finalRate };
                  pnow._events = pnow._events ? [newEvent].concat(pnow._events) : [newEvent]; saveLocal(players); render(players);
                  try{ await createChangeEntry(id,'miss', JSON.stringify({ skill: player.skill, rate: finalRate }), JSON.stringify(pnow)); }catch(e){ console.error('failed creating miss change entry', e); } }
      }catch(e){ console.error('createMissEvent failed', e); } })(); }
  function decPlayer(id){ players = players.map(p=> p.id===id? {...p, misses:Math.max(0,(p.misses||0)-1)}: p); saveLocal(players); render(players); const newVal = players.find(p=>p.id===id).misses; if(!String(id).startsWith('local-')){ updateServerPlayer(id,{ misses: newVal }).then(ok=>{ if(ok){ const pnow = players.find(p=>p.id===id); createChangeEntry(id,'update', JSON.stringify({ misses: pnow.misses }), JSON.stringify(pnow)); } }).catch(e=>console.error(e)); } }
  function removePlayer(id){ const p = players.find(p=>p.id===id); if(!p) return; if(!confirm('Delete player "' + (p.name||'Unnamed') + '"? This will permanently remove the player and their events. Continue?')) return; players = players.filter(p2=> p2.id!==id); saveLocal(players); render(players); if(!String(id).startsWith('local-')){ // record delete in changes before deleting
      createChangeEntry(id,'delete','', JSON.stringify(p)).then(()=>{ deleteServerPlayer(id).catch(e=>console.error(e)); }).catch(e=>{ console.error('failed to write delete change entry',e); deleteServerPlayer(id).catch(e2=>console.error(e2)); }); } }

    // erase player records (reset misses and amountOwed to zero) with confirmation and audit entry
    async function erasePlayerRecords(id){
      try{
        const p = players.find(p=>p.id===id);
        if(!p) return;
        const name = p.name || 'Unnamed';
        if(!confirm('Mark paid for "' + name + '"? This will set misses and amount owed to 0 but keep historical events. Continue?')) return;
        const beforeSnapshot = JSON.stringify(p);
        p.misses = 0;
        p.amountOwed = 0;
        saveLocal(players); render(players); updateTotalAndChart();
        if(String(id).startsWith('local-')){ setStatus('records marked paid (local)'); return true; }

        setStatus('marking paid...');
        const ok = await updateServerPlayer(id, { misses: 0, amountOwed: 0 });
        if(!ok){ setStatus('mark paid failed'); return false; }

        // write change entry (audit)
        try{ await createChangeEntry(id, 'paid', JSON.stringify({ before: beforeSnapshot }), JSON.stringify(p)); }catch(e){ console.error('failed creating paid change entry', e); }

        // append a paid event locally so history shows immediately
        try{
          const beforeObj = JSON.parse(beforeSnapshot);
          const prevAmt = Number(beforeObj.amountOwed||0);
          const newEvent = { ts: Date.now(), tsIso: new Date().toISOString(), action: 'paid', beforeAmount: prevAmt, amount: 0 };
          p._events = p._events ? [newEvent].concat(p._events) : [newEvent];
          saveLocal(players); render(players);
          // create a server-side paid event so other clients can see it under misses
          try{ await createPaidEvent(id, prevAmt); }catch(e){ console.error('failed creating server paid event', e); }
        }catch(e){ console.error('failed appending paid event', e); }

        setStatus('records marked paid');
        return true;
      }catch(e){ console.error('erasePlayerRecords error', e); setStatus('mark paid failed'); return false; }
    }

  async function revertPaidEvent(playerId, event){
    try{
      if(!confirm('Revert paid action? This will restore the previous balance for the player. Continue?')) return false;
      const p = players.find(x=> x.id===playerId);
      if(!p) return false;
      const beforeAmt = (event && event.beforeAmount!==undefined) ? Number(event.beforeAmount) : 0;
      p.amountOwed = beforeAmt;
      saveLocal(players); render(players); updateTotalAndChart();
      if(String(playerId).startsWith('local-')){ setStatus('paid reverted (local)'); return true; }

      setStatus('reverting paid...');
      const ok = await updateServerPlayer(playerId, { amountOwed: beforeAmt });
      if(!ok){ setStatus('revert failed'); return false; }

      try{
        await createChangeEntry(playerId, 'paid-revert', JSON.stringify({ eventTs: event.ts, before: beforeAmt }), JSON.stringify(p));
      }catch(e){ console.error('failed creating paid-revert change entry', e); }

      // append local event noting revert
      const revEvent = { ts: Date.now(), tsIso: new Date().toISOString(), action: 'paid-revert', beforeAmount: beforeAmt, amount: beforeAmt };
      p._events = p._events ? [revEvent].concat(p._events) : [revEvent];
      saveLocal(players); render(players);

      setStatus('paid reverted');
      return true;
    }catch(e){ console.error('revert failed', e); setStatus('revert failed'); return false; }
  }

function resetAll(){ if(!confirm('Reset all scores to 0?')) return; players = players.map(p=> ({...p, misses:0})); saveLocal(players); render(players); players.forEach(p=>{ if(!String(p.id).startsWith('local-')) updateServerPlayer(p.id,{ misses:0 }).catch(e=>console.error(e)); }); }

  // REST helpers
  function docIdFromName(name){ const parts=name.split('/'); return parts[parts.length-1]; }
  function parseDoc(doc){ const data=doc.fields||{}; return { id: docIdFromName(doc.name), name: (data.name && data.name.stringValue) ? data.name.stringValue : undefined, skill: (data.skill && parseInt(data.skill.integerValue||'1'))||1, misses: (data.misses && parseInt(data.misses.integerValue||'0'))||0, amountOwed: (data.amountOwed && parseInt(data.amountOwed.integerValue||'0'))||0, createdAt: (data.createdAt && parseInt(data.createdAt.integerValue||String(Date.now())))||Date.now() }; }

  async function listServerPlayers(){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '?key=' + API_KEY; const res=await fetch(url); const debug = { url, status: res.status }; if(!res.ok){ const txt=await res.text(); setDebugInfo({project:PROJECT,db:DB_ID,status:res.status,body:txt}); throw new Error('list failed: '+res.status+' '+txt); } const json=await res.json(); setDebugInfo({project:PROJECT,db:DB_ID,status:res.status,docs: (json.documents||[]).length}); if(!json.documents) return []; return json.documents.map(parseDoc); }catch(e){ console.error('listServerPlayers error', e); setDebugInfo({project:PROJECT,db:DB_ID,error:String(e)}); return null; } }
  async function createServerPlayer(p){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/'+COLLECTION+'?key='+API_KEY; const editor = currentEditor(); const now = String(Date.now()); const body={ fields: { name:{ stringValue: String((p.name && String(p.name).trim())? p.name : 'Unnamed') }, skill:{ integerValue: String(Math.max(1, Math.min(9, p.skill||1))) }, misses:{ integerValue: String(p.misses||0) }, amountOwed:{ integerValue: String(p.amountOwed||0) }, createdAt:{ integerValue: String(p.createdAt||Date.now()) }, lastEditorId: { stringValue: String(editor.id) }, lastEditorName: { stringValue: String(editor.name) }, lastModifiedAt: { integerValue: now } } }; const res=await fetch(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const txt=await res.text(); if(!res.ok) throw new Error('create failed: '+res.status+' '+txt); const json=JSON.parse(txt); const newId = docIdFromName(json.name); // create initial change entry
      try{ await createChangeEntry(newId, 'create', JSON.stringify({ name: p.name, skill: p.skill, misses: p.misses }), JSON.stringify({ name: p.name, skill: p.skill, misses: p.misses, createdAt: p.createdAt, lastEditorId: editor.id, lastEditorName: editor.name, lastModifiedAt: now })); }catch(e){ console.error('create change entry failed', e); }
      return newId; }catch(e){ console.error('createServerPlayer error', e); return null; } }
  async function updateServerPlayer(id,patch){ try{ const base = 'https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/'+COLLECTION+'/'+id; const mask = []; const bodyFields = {}; const local = players.find(p=> p.id===id); const missesVal = (patch.misses!==undefined) ? patch.misses : (local? (local.misses||0) : 0); if(patch.misses!==undefined || local){ bodyFields.misses = { integerValue: String(missesVal) }; mask.push('misses'); } if(patch.name!==undefined && String(patch.name).trim() !== ''){ bodyFields.name={ stringValue: String(patch.name) }; mask.push('name'); }   if(patch.skill!==undefined && Number(patch.skill)>=1 && Number(patch.skill)<=9){ bodyFields.skill={ integerValue: String(patch.skill) }; mask.push('skill'); } if(patch.amountOwed!==undefined){ bodyFields.amountOwed = { integerValue: String(patch.amountOwed) }; mask.push('amountOwed'); }
        // include editor info
        const editor = currentEditor(); if(editor && editor.id){ bodyFields.lastEditorId = { stringValue: String(editor.id) }; if(!mask.includes('lastEditorId')) mask.push('lastEditorId'); } if(editor && editor.name){ bodyFields.lastEditorName = { stringValue: String(editor.name) }; if(!mask.includes('lastEditorName')) mask.push('lastEditorName'); } bodyFields.lastModifiedAt = { integerValue: String(Date.now()) }; if(!mask.includes('lastModifiedAt')) mask.push('lastModifiedAt');
        if(local && local.createdAt){ bodyFields.createdAt = { integerValue: String(local.createdAt) }; if(!mask.includes('createdAt')) mask.push('createdAt'); } if(mask.length===0){ bodyFields.misses = { integerValue: String(missesVal) }; mask.push('misses'); } const url = base + '?key=' + API_KEY + mask.map(m=>'&updateMask.fieldPaths='+encodeURIComponent(m)).join(''); const res=await fetch(url,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) }); if(!res.ok){ const txt=await res.text(); throw new Error('update failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('updateServerPlayer error', e); return false; } }
  async function deleteServerPlayer(id){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/'+COLLECTION+'/'+id+'?key='+API_KEY; const res=await fetch(url,{ method:'DELETE' }); if(!res.ok){ const txt=await res.text(); throw new Error('delete failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('deleteServerPlayer error', e); return false; } }

  // create an audit/change entry under players/{id}/changes
  async function createChangeEntry(playerId, action, patchJson, snapshotJson){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '/' + encodeURIComponent(playerId) + '/changes?key=' + API_KEY; const editor = currentEditor(); const body = { fields: { editorId: { stringValue: String(editor.id) }, editorName: { stringValue: String(editor.name) }, ts: { integerValue: String(Date.now()) }, tsIso: { stringValue: new Date().toISOString() }, action: { stringValue: String(action) }, patch: { stringValue: String(patchJson || '') }, snapshot: { stringValue: String(snapshotJson || '') } } }; const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(!res.ok){ const txt = await res.text(); throw new Error('change entry create failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('createChangeEntry error', e); return false; } }

  // create miss event under players/{id}/misses and return true if ok
  async function createMissEvent(playerId, skill, rate){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '/' + encodeURIComponent(playerId) + '/misses?key=' + API_KEY; const now = String(Date.now()); const body = { fields: { ts: { integerValue: now }, tsIso: { stringValue: new Date().toISOString() }, skill: { integerValue: String(skill) }, rate: { integerValue: String(rate) }, amount: { integerValue: String(rate) } } }; const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(!res.ok){ const txt = await res.text(); throw new Error('createMissEvent failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('createMissEvent error', e); return false; } }

  // utility: total and charts (misses and amount)
  async function createPaidEvent(playerId, beforeAmt){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/' + COLLECTION + '/' + encodeURIComponent(playerId) + '/misses?key=' + API_KEY; const now = String(Date.now()); const body = { fields: { ts: { integerValue: now }, tsIso: { stringValue: new Date().toISOString() }, action: { stringValue: 'paid' }, beforeAmount: { integerValue: String(beforeAmt||0) }, amount: { integerValue: String(0) } } }; const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(!res.ok){ const txt = await res.text(); throw new Error('createPaidEvent failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('createPaidEvent error', e); return false; } }

function updateTotalAndChart(){ const totalMisses = players.reduce((s,p)=> s + (p.misses||0), 0); const totalAmount = players.reduce((s,p)=> s + ( (p.amountOwed!==undefined && p.amountOwed!==null) ? (Number(p.amountOwed)||0) : ((p.misses||0) * skillRate(p.skill)) ), 0); const totalMissesEl = document.getElementById('totalMisses'); const totalAmountEl = document.getElementById('totalAmount'); if(totalMissesEl) totalMissesEl.textContent = 'Total missed shots: ' + totalMisses; if(totalAmountEl) totalAmountEl.textContent = 'Total amount: $' + totalAmount; // charts
      try{
        const barLabelPlugin = { id: 'barValue', afterDatasetsDraw: function(chart){ const ctx = chart.ctx; const canvasWidth = chart.width; const isAmountChart = chart && chart.canvas && chart.canvas.id === 'chartAmount'; chart.data.datasets.forEach(function(dataset, i){ const meta = chart.getDatasetMeta(i); meta.data.forEach(function(bar, idx){ const val = dataset.data[idx]; if(val===undefined || val===null) return; const x = bar.x; const y = bar.y; ctx.save(); ctx.font = 'bold 12px Arial'; ctx.textBaseline = 'middle'; const displayVal = isAmountChart ? ('$' + String(val)) : String(val);
                    // use consistent black text for labels (user requested default black)
                    const textColor = '#111';
                    const textWidth = ctx.measureText(displayVal).width;
                    if(x + 20 + textWidth < canvasWidth){ ctx.fillStyle = textColor; ctx.textAlign = 'left'; ctx.fillText(displayVal, x + 10, y); }
                    else { ctx.fillStyle = textColor; ctx.textAlign = 'right'; ctx.fillText(displayVal, x - 8, y); }
                    ctx.restore(); }); }); } };

        // unified soft palette: determine base order from list ordering so colors match across charts
        const compareOrder = (a,b)=>{ const ma=a.misses||0, mb=b.misses||0; if(mb - ma !== 0) return mb - ma; const ama = (a.amountOwed!==undefined ? (Number(a.amountOwed)||0) : ((a.misses||0)*skillRate(a.skill))), amb = (b.amountOwed!==undefined ? (Number(b.amountOwed)||0) : ((b.misses||0)*skillRate(b.skill))); if(amb - ama !== 0) return amb - ama; return (b.createdAt||0) - (a.createdAt||0); };
        const baseOrder = (players||[]).slice().sort(compareOrder);
        // generate soft pastel palette mapped by player id
        const paletteMap = {};
        if(baseOrder.length>0){ baseOrder.forEach((p,i)=>{ const hue = Math.round(i * 360 / baseOrder.length); paletteMap[p.id] = 'hsl(' + hue + ',55%,65%)'; }); }

        // Misses chart: use base order and show top 5
                const missesSorted = baseOrder.slice(0,5);
        const labelsMisses = missesSorted.map(p=> p.name || 'Unnamed');
        const missesData = missesSorted.map(p=> p.misses||0);
        const paletteMisses = missesSorted.map(p=> paletteMap[p.id] || '#d1d5db');

        if(window.playerChartMisses){ window.playerChartMisses.data.labels = labelsMisses; window.playerChartMisses.data.datasets[0].data = missesData; window.playerChartMisses.data.datasets[0].backgroundColor = paletteMisses; window.playerChartMisses.update(); }
        else { const ctx = document.getElementById('chartMisses'); if(ctx && window.Chart){ window.playerChartMisses = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: labelsMisses, datasets:[{ data: missesData, backgroundColor: paletteMisses }] }, options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false, scales:{ x:{ beginAtZero:true } }, plugins:{ legend:{ display:false } } }, plugins: [barLabelPlugin] }); } }

        // Amount chart: rank by total $ and show top 4, reuse paletteMap so colors match same players
        const amountSorted = (players||[]).slice().sort((a,b)=> (Number(b.amountOwed)||0) - (Number(a.amountOwed)||0) );
        const topAmount = amountSorted.slice(0,5);
        const labelsAmount = topAmount.map(p=> p.name || 'Unnamed');
        const amountData = topAmount.map(p=> Number(p.amountOwed)||((p.misses||0) * skillRate(p.skill)));
        const paletteAmount = topAmount.map(p=> paletteMap[p.id] || '#d1d5db');

        if(window.playerChartAmount){ window.playerChartAmount.data.labels = labelsAmount; window.playerChartAmount.data.datasets[0].data = amountData; window.playerChartAmount.data.datasets[0].backgroundColor = paletteAmount; window.playerChartAmount.update(); }
        else { const ctx2 = document.getElementById('chartAmount'); if(ctx2 && window.Chart){ window.playerChartAmount = new Chart(ctx2.getContext('2d'), { type: 'bar', data: { labels: labelsAmount, datasets:[{ data: amountData, backgroundColor: paletteAmount }] }, options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false, scales:{ x:{ beginAtZero:true, ticks: { callback: function(value){ return '$' + value; } } } }, plugins:{ legend:{ display:false } } }, plugins: [barLabelPlugin] }); } }

    }catch(e){ console.error('chart update failed', e); }
  }

  // initial sync and poll (offline toggle removed)
  (async function init(){ sessionStorage.removeItem('skillRatesUnlocked');
    // wire skill scale button
    try{ const btn = document.getElementById('showScaleBtn'); const panel = document.getElementById('skillScalePanel');     if(btn && panel){ btn.addEventListener('click', ()=>{ if(panel.style.display==='block'){ panel.style.display='none'; } else { panel.style.display='block'; // build visible skill rates view
          panel.innerHTML = ''; const title = document.createElement('div'); title.innerHTML = '<strong>Skill rate per miss</strong>'; panel.appendChild(title);
          const container = document.createElement('div'); container.style.marginTop='8px';

          function renderReadOnlyTable(){
            container.innerHTML = '';
            const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse';
            const tbody = document.createElement('tbody');
            const addRow = (label, value)=>{
              const tr = document.createElement('tr');
              const td1 = document.createElement('td'); td1.textContent = label; td1.style.padding = '4px 8px';
              const td2 = document.createElement('td'); td2.textContent = '$' + Number(value||0); td2.style.padding = '4px 8px'; td2.style.textAlign = 'right';
              tr.appendChild(td1); tr.appendChild(td2); tbody.appendChild(tr);
            };
            addRow('Skill 1-2', skillRates['1-2']);
            for(let s=3;s<=9;s++){ addRow('Skill '+s, skillRates[String(s)]); }
            table.appendChild(tbody); container.appendChild(table);
          }

          function buildEditableForm(){
            container.innerHTML = '';
            const form = document.createElement('div');
            form.style.marginTop = '4px';
            const inputs = {};
            const row12 = document.createElement('div'); row12.style.marginBottom = '6px';
            row12.innerHTML = 'Skill 1-2: $';
            const input12 = document.createElement('input'); input12.type='number'; input12.value = skillRates['1-2']; input12.style.width='80px'; input12.style.marginLeft='8px';
            row12.appendChild(input12); form.appendChild(row12); inputs['1-2'] = input12;
            for(let s=3;s<=9;s++){ const row = document.createElement('div'); row.style.marginBottom='6px'; row.innerHTML = 'Skill '+s+': $'; const inp = document.createElement('input'); inp.type='number'; inp.value = skillRates[String(s)]; inp.style.width='80px'; inp.style.marginLeft='8px'; row.appendChild(inp); form.appendChild(row); inputs[String(s)] = inp; }
            const btnRow = document.createElement('div'); btnRow.style.marginTop='8px';
            const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.style.marginRight='8px';
            saveBtn.onclick = async ()=>{ const newRates = {}; newRates['1-2'] = Number(inputs['1-2'].value)||0; for(let s=3;s<=9;s++){ newRates[String(s)] = Number(inputs[String(s)].value)||0; } skillRates = newRates; saveSkillRates(skillRates);
              try{ await saveServerSkillRates(skillRates); setStatus('skill rates saved'); }catch(e){ console.error('failed saving server skill rates', e); setStatus('skill rates saved locally'); }
                        // after finishing editing, return to locked state for security
                        sessionStorage.removeItem('skillRatesUnlocked');
                        updateTotalAndChart(); render(players); panel.style.display='none'; };
                      const resetBtn = document.createElement('button'); resetBtn.textContent='Reset'; resetBtn.onclick = ()=>{ skillRates = Object.assign({}, defaultSkillRates); saveSkillRates(skillRates); // try to persist reset to server
                                              (async ()=>{ try{ await saveServerSkillRates(skillRates); setStatus('skill rates reset and saved'); }catch(e){ console.error('failed saving server skill rates on reset', e); setStatus('skill rates reset locally'); } })();
                                              // lock again after reset
                                              sessionStorage.removeItem('skillRatesUnlocked');
                                              updateTotalAndChart(); render(players); renderReadOnlyTable(); };
                      btnRow.appendChild(saveBtn); btnRow.appendChild(resetBtn); form.appendChild(btnRow); container.appendChild(form);
                    }

          renderReadOnlyTable();
          const controlRow = document.createElement('div'); controlRow.style.marginTop = '8px';
          const unlocked = sessionStorage.getItem('skillRatesUnlocked') === '1';
          if(unlocked){
            const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.onclick = ()=>{ buildEditableForm(); };
            controlRow.appendChild(editBtn);
            const lockBtn = document.createElement('button'); lockBtn.textContent = 'Lock'; lockBtn.style.marginLeft='8px'; lockBtn.onclick = ()=>{ sessionStorage.removeItem('skillRatesUnlocked'); renderReadOnlyTable(); };
            controlRow.appendChild(lockBtn);
          } else {
            const unlockArea = document.createElement('span');
            const unlockBtn = document.createElement('button'); unlockBtn.textContent = 'Unlock to edit'; unlockBtn.style.marginRight='8px';
            const pwInput = document.createElement('input'); pwInput.type='password'; pwInput.placeholder='PIN'; pwInput.style.marginLeft='8px';
            const msgSpan = document.createElement('span'); msgSpan.style.color='red'; msgSpan.style.marginLeft='8px';
            unlockBtn.onclick = ()=>{ if(pwInput.value === '0715'){ sessionStorage.setItem('skillRatesUnlocked','1'); msgSpan.textContent=''; panel.querySelectorAll('*').forEach(n=>n.remove && n.remove()); // rebuild
                panel.innerHTML = ''; panel.appendChild(title); panel.appendChild(container); panel.appendChild(controlRow); buildEditableForm(); } else { msgSpan.textContent = ' Incorrect password'; } };
            unlockArea.appendChild(pwInput); unlockArea.appendChild(unlockBtn); unlockArea.appendChild(msgSpan);
            controlRow.appendChild(unlockArea);
          }
          panel.appendChild(container); panel.appendChild(controlRow);
        } }); } }catch(e){}
    const server = await listServerPlayers();
    if(server===null){ setStatus('Firestore REST unreachable'); updateTotalAndChart(); } else {
      setStatus('connected to Firestore (REST)');
      const localOnly = players.filter(p=> String(p.id).startsWith('local-'));
      // merge server and local by id: prefer non-empty server.name, but keep local name if server name missing
      const byId = {};
      for(const l of players){ byId[l.id]=Object.assign({},l); }
      for(const s of server){ const existing = byId[s.id]; if(existing){ const serverMisses = (s.misses!==undefined) ? s.misses : (existing.misses||0); const mergedMisses = Math.max(existing.misses||0, serverMisses); const serverAmount = (s.amountOwed!==undefined) ? Number(s.amountOwed) : (Number(existing.amountOwed)||0); const mergedAmount = Math.max(Number(existing.amountOwed)||0, serverAmount); byId[s.id] = Object.assign({}, existing, { id: s.id, name: (s.name && String(s.name).trim()) ? s.name : (existing.name || s.name), skill: (s.skill!==undefined) ? s.skill : (existing.skill||1), misses: mergedMisses, amountOwed: mergedAmount, createdAt: s.createdAt||existing.createdAt }); } else { byId[s.id] = Object.assign({}, s); } }
      players = Object.values(byId);
      // ensure local-only entries are preserved
      players = players.concat(localOnly.filter(p=> !players.find(x=>x.id===p.id)));
      saveLocal(players); render(players); updateTotalAndChart();
      // fetch server skill rates and use them
      try{ const srvRates = await fetchServerSkillRates(); if(srvRates){ skillRates = Object.assign({}, defaultSkillRates, srvRates); saveSkillRates(skillRates); } }catch(e){ console.warn('could not load server skill rates', e); }
      for(const p of localOnly){ const newId = await createServerPlayer(p); if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); updateTotalAndChart(); } }
      if(typeof window !== 'undefined'){ setInterval(async ()=>{ // avoid clobbering inline edits while user is editing
                  if(typeof editingId !== 'undefined' && editingId !== null) { /* skip server merge while editing to preserve input state */ return; }
                  const s = await listServerPlayers(); if(s && Array.isArray(s)){ const localOnly2 = players.filter(p=> String(p.id).startsWith('local-'));
                  // merge same as above
                  const byId2 = {};
                  for(const l of players){ byId2[l.id]=Object.assign({},l); }
                  for(const ss of s){ const existing = byId2[ss.id]; if(existing){ const serverMisses = (ss.misses!==undefined) ? ss.misses : (existing.misses||0); const mergedMisses = Math.max(existing.misses||0, serverMisses); const serverAmount = (ss.amountOwed!==undefined) ? Number(ss.amountOwed) : (Number(existing.amountOwed)||0); const mergedAmount = Math.max(Number(existing.amountOwed)||0, serverAmount); byId2[ss.id] = Object.assign({}, existing, { id: ss.id, name: (ss.name && String(ss.name).trim()) ? ss.name : (existing.name || ss.name), skill: (ss.skill!==undefined) ? ss.skill : (existing.skill||1), misses: mergedMisses, amountOwed: mergedAmount, createdAt: ss.createdAt||existing.createdAt }); } else { byId2[ss.id] = Object.assign({}, ss); } }
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