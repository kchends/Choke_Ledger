// REST-only Scorekeeper app bundle v4
(function(){
  const API_KEY = 'REDACTED_API_KEY';
  const PROJECT = 'the-choke-ledger';
  const DB_ID = 'choke';
  const LOCAL_KEY = 'scorekeeper.players';

  function setStatus(s){ const el=document.getElementById('status'); if(el) el.textContent='Status: '+s; }
  function loadLocal(){ try{ const raw=localStorage.getItem(LOCAL_KEY); return raw?JSON.parse(raw):[] }catch(e){console.error(e);return[]} }
  function saveLocal(p){ try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(p)) }catch(e){console.error(e)} }
  function makeId(){ return 'local-'+(Date.now().toString(36)+Math.floor(Math.random()*1000).toString(36)) }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // skill rates: editable, persisted locally and saved to Firestore
  const RATE_KEY = 'scorekeeper.rates';
  const defaultRates = {1:0,2:0,3:2,4:4,5:6,6:8,7:10,8:12,9:14};
  let ratesMap = null;
  function loadRatesLocal(){ try{ const raw = localStorage.getItem(RATE_KEY); if(raw){ ratesMap = JSON.parse(raw); } else { ratesMap = Object.assign({}, defaultRates); } }catch(e){ ratesMap = Object.assign({}, defaultRates); } }
  loadRatesLocal();

  async function fetchRatesFromServer(){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/settings/skillRates?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ return; } const json = await res.json(); const f = json.fields || {}; const map = {}; for(let i=1;i<=9;i++){ const key = 's'+i; if(f[key] && f[key].integerValue) map[i] = parseInt(f[key].integerValue,10); else map[i] = (defaultRates[i] || 0); } ratesMap = map; try{ localStorage.setItem(RATE_KEY, JSON.stringify(ratesMap)); }catch(e){} }catch(e){ console.error('fetchRatesFromServer error', e); } }

  async function saveRatesToServer(map){ try{ const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/settings?documentId=skillRates&key=' + API_KEY; const bodyFields = {}; for(const k in map){ bodyFields['s'+k] = { integerValue: String(map[k]) }; }
      let res = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) });
      if(res.ok) return true; const txt = await res.text(); if(String(res.status) === '409'){ // already exists - PATCH
        const patchUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/settings/skillRates?key=' + API_KEY;
        const res2 = await fetch(patchUrl, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) }); if(!res2.ok){ const t2 = await res2.text(); throw new Error('patch failed '+t2); } return true; }
      throw new Error('saveRatesToServer failed: '+res.status+' '+txt);
    }catch(e){ console.error('saveRatesToServer error', e); return false; } }

  // prompt for password and show editable rates UI
  async function showPasswordPrompt(msg){ return new Promise(res=>{ try{ const existing = document.getElementById('password-modal'); if(existing) existing.remove(); const modal = document.createElement('div'); modal.id='password-modal'; modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.background='rgba(0,0,0,0.4)'; const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='16px'; box.style.borderRadius='8px'; box.style.maxWidth='90%'; box.style.boxSizing='border-box'; const pmsg = document.createElement('div'); pmsg.textContent = msg; pmsg.style.marginBottom='8px'; const input = document.createElement('input'); input.type='password'; input.placeholder='Password'; input.style.marginBottom='8px'; input.style.display='block'; const ok = document.createElement('button'); ok.textContent='OK'; ok.style.marginRight='8px'; const cancel = document.createElement('button'); cancel.textContent='Cancel'; box.appendChild(pmsg); box.appendChild(input); box.appendChild(ok); box.appendChild(cancel); modal.appendChild(box); document.body.appendChild(modal); function cleanup(val){ try{ modal.remove(); }catch(e){} res(val); }
      ok.addEventListener('click', ()=>{ const v = input.value || ''; if(String(v).trim() === '0715') cleanup(true); else cleanup(false); }); cancel.addEventListener('click', ()=> cleanup(false)); }catch(e){ console.error('showPasswordPrompt failed', e); res(false); } }); }

  async function openSkillRates(){ try{ const ok = await showPasswordPrompt('Enter password to edit skill rates'); if(!ok){ setStatus('rates locked'); return; } // build modal
    const existing = document.getElementById('rates-modal'); if(existing) existing.remove(); const modal = document.createElement('div'); modal.id='rates-modal'; modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.background='rgba(0,0,0,0.4)'; const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='12px'; box.style.borderRadius='8px'; box.style.maxWidth='95%'; box.style.boxSizing='border-box'; const title = document.createElement('div'); title.textContent='Edit Skill Rates (per miss)'; title.style.fontWeight='700'; title.style.marginBottom='8px'; box.appendChild(title);
    const table = document.createElement('div'); table.style.display='grid'; table.style.gridTemplateColumns='1fr 1fr'; table.style.gap='8px'; for(let i=1;i<=9;i++){ const lbl = document.createElement('div'); lbl.textContent = 'Skill ' + i; const inp = document.createElement('input'); inp.type='number'; inp.min='0'; inp.value = (ratesMap && ratesMap[i]!==undefined) ? ratesMap[i] : (defaultRates[i]||0); inp.dataset.skill = String(i); table.appendChild(lbl); table.appendChild(inp); }
    box.appendChild(table);
    const save = document.createElement('button'); save.textContent='Save'; save.style.marginTop='8px'; const cancel = document.createElement('button'); cancel.textContent='Cancel'; cancel.style.marginLeft='8px'; box.appendChild(save); box.appendChild(cancel); modal.appendChild(box); document.body.appendChild(modal);
    save.addEventListener('click', async ()=>{ try{ const inputs = modal.querySelectorAll('input'); const newMap = {}; inputs.forEach(inp=>{ const k = Number(inp.dataset.skill || 0); newMap[k] = Number(inp.value) || 0; }); ratesMap = newMap; try{ localStorage.setItem(RATE_KEY, JSON.stringify(ratesMap)); }catch(e){} setStatus('saving rates...'); await saveRatesToServer(ratesMap); setStatus('rates saved'); render(players); updateTotalAndChart(); modal.remove(); }catch(e){ console.error('save rates failed', e); setStatus('rates save failed'); } });
    cancel.addEventListener('click', ()=>{ try{ modal.remove(); }catch(e){} setStatus('rates cancelled'); });
  }catch(e){ console.error('openSkillRates failed', e); setStatus('rates failed'); } }

  function skillRate(skill){ const s = Number(skill) || 1; if(!ratesMap) loadRatesLocal(); return ratesMap && ratesMap[s] !== undefined ? Number(ratesMap[s]) : (defaultRates[s] || 0); }

  let editingId = null;
  const expandedPlayers = new Set();
  const showAllEvents = new Set();

  function parseMissDoc(doc){ try{ const d = doc.fields || {}; return { id: docIdFromName(doc.name), ts: d.ts ? parseInt(d.ts.integerValue||'0') : 0, tsIso: d.tsIso ? (d.tsIso.stringValue||'') : '', skill: d.skill ? parseInt(d.skill.integerValue||'1') : 1, rate: d.rate ? parseInt(d.rate.integerValue||'0') : 0, amount: d.amount ? parseInt(d.amount.integerValue||'0') : 0, action: 'miss' }; }catch(e){ return null; } }

  function parseChangeDoc(doc){ try{ const d = doc.fields || {}; const action = d.action ? (d.action.stringValue||'') : ''; const ts = d.ts ? parseInt(d.ts.integerValue||'0') : 0; const tsIso = d.tsIso ? (d.tsIso.stringValue||'') : ''; const patch = d.patch ? (d.patch.stringValue||'') : ''; const snapshot = d.snapshot ? (d.snapshot.stringValue||'') : ''; return { id: docIdFromName(doc.name), ts, tsIso, action, patch, snapshot }; }catch(e){ return null; } }

  async function listMissEvents(playerId){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + encodeURIComponent(playerId) + '/misses?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ const txt = await res.text(); throw new Error('list misses failed: '+res.status+' '+txt); } const json = await res.json(); if(!json.documents) return []; return (json.documents||[]).map(parseMissDoc).filter(x=>x); }catch(e){ console.error('listMissEvents error', e); return []; } }

  async function listChangeEntries(playerId){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + encodeURIComponent(playerId) + '/changes?key=' + API_KEY; const res = await fetch(url); if(!res.ok){ const txt = await res.text(); throw new Error('list changes failed: '+res.status+' '+txt); } const json = await res.json(); if(!json.documents) return []; return (json.documents||[]).map(parseChangeDoc).filter(x=>x); }catch(e){ console.error('listChangeEntries error', e); return []; } }

  const _eventsCache = new Map(); // playerId -> { ts, events }
  const _eventsBackoff = new Map(); // playerId -> backoffUntil(ms)

  async function listPlayerEvents(playerId){
    try{
      const now = Date.now();
      // respect per-player backoff if server returned 429 recently
      const bo = _eventsBackoff.get(playerId);
      if(bo && now < bo){ console.warn('events backoff active for', playerId); const p = players.find(x=>x.id===playerId); return p && p._events ? p._events : []; }
      // return cached events for short TTL to avoid quota overuse
      const cached = _eventsCache.get(playerId);
      if(cached && (now - cached.ts) < 30000){ return cached.events; }

      const [misses, changes] = await Promise.all([ listMissEvents(playerId), listChangeEntries(playerId) ]);
      const mappedChanges = (changes||[]).map(c=>{ let rate = undefined; let amount = undefined; try{ if(c.patch){ const p = JSON.parse(c.patch); if(p.rate!==undefined) rate = Number(p.rate); if(p.amount!==undefined) amount = Number(p.amount); } if(amount===undefined && c.snapshot){ const s = JSON.parse(c.snapshot); if(s.amount!==undefined) amount = Number(s.amount); if(s.rate!==undefined) rate = Number(s.rate); } }catch(e){} return { ts: c.ts||0, tsIso: c.tsIso||'', action: c.action, rate, amount, patch: c.patch, snapshot: c.snapshot }; });
      const all = (misses||[]).concat(mappedChanges||[]);
      const sorted = all.sort((a,b)=> (Number(b.ts||0) - Number(a.ts||0)));
      try{ _eventsCache.set(playerId, { ts: now, events: sorted }); }catch(e){}
      return sorted;
    }catch(e){
      console.error('listPlayerEvents error', e);
      try{
        // if server responded with 429, back off for a short period
        if(e && e.message && String(e.message).indexOf('429') !== -1){ _eventsBackoff.set(playerId, Date.now() + 60000); }
      }catch(ex){}
      const p = players.find(x=>x.id===playerId);
      return p && p._events ? p._events : [];
    }
  }

  // modal confirm helper: returns Promise<boolean>
  let _confirmInFlight = null;
  function showConfirm(msg){ if(_confirmInFlight) return _confirmInFlight; _confirmInFlight = new Promise(res=>{ try{ const existing = document.getElementById('confirm-modal'); if(existing) existing.remove(); const modal = document.createElement('div'); modal.id='confirm-modal'; modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.background='rgba(0,0,0,0.4)'; const box = document.createElement('div'); box.style.background='#fff'; box.style.padding='16px'; box.style.borderRadius='8px'; box.style.maxWidth='90%'; box.style.boxSizing='border-box'; const pmsg = document.createElement('div'); pmsg.textContent = msg; pmsg.style.marginBottom='12px'; const ok = document.createElement('button'); ok.textContent='OK'; ok.style.marginRight='8px'; const cancel = document.createElement('button'); cancel.textContent='Cancel'; box.appendChild(pmsg); box.appendChild(ok); box.appendChild(cancel); modal.appendChild(box); document.body.appendChild(modal); function cleanup(val){ try{ modal.remove(); }catch(e){} const r = _confirmInFlight; _confirmInFlight = null; res(val); }
      ok.addEventListener('click', ()=> cleanup(true)); cancel.addEventListener('click', ()=> cleanup(false)); }catch(e){ console.error('showConfirm failed', e); _confirmInFlight = null; res(false); } }); return _confirmInFlight; }

  function lockLi(id, locked){ try{ const sel = 'li[data-player-id="'+String(id)+'"]'; const li = document.querySelector(sel); if(!li) return; li.dataset.locked = locked ? '1' : ''; const btns = li.querySelectorAll('button'); btns.forEach(b=> b.disabled = !!locked); }catch(e){ console.error('lockLi error', e); } }

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
      if(sorted.length>0){ const bestMiss = sorted[0].misses||0; const bestAmount = (sorted[0].misses||0) * (sorted[0].skill||1);
        for(const sp of sorted){ if((sp.misses||0) === bestMiss && ((sp.misses||0)*(sp.skill||1)) === bestAmount){ topPlayers.push(sp.id); } else break; }
      }
      sorted.forEach(p=>{
        const li=document.createElement('li'); li.className='item'; li.dataset.playerId = p.id;
        if(topPlayers.includes(p.id)) li.classList.add('mvp');
        const amount = (p.misses||0) * skillRate(p.skill);
        const safeName = escapeHtml(p.name || 'Unnamed');
        const badge = (topPlayers.includes(p.id)) ? '<span class="mvp-badge">👑 Supreme Choke</span>' : '';
        const infoDiv = document.createElement('div'); infoDiv.style.flex = '1';
        if(p.id === editingId){
          const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = p.name || '';
          nameInput.style.padding = '8px'; nameInput.style.borderRadius = '6px'; nameInput.style.marginRight = '8px';
          const skillInput = document.createElement('input'); skillInput.type = 'number'; skillInput.min = '1'; skillInput.max = '9'; skillInput.value = p.skill || 1;
          skillInput.style.width = '80px'; skillInput.style.marginRight = '8px';
          const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.onclick = ()=> saveEdit(p.id, nameInput.value, skillInput.value);
          const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; cancelBtn.onclick = ()=> { editingId = null; render(players); };
          infoDiv.appendChild(nameInput); infoDiv.appendChild(skillInput); infoDiv.appendChild(saveBtn); infoDiv.appendChild(cancelBtn);
        } else {
          const nameDiv = document.createElement('div'); nameDiv.className='name'; nameDiv.style.cursor='pointer'; nameDiv.innerHTML = safeName + badge;
          const subDiv = document.createElement('div'); subDiv.className='sub'; subDiv.textContent = 'Skill: ' + (p.skill||1) + ' — ' + (p.misses||0) + ' misses — $' + amount;
          // expand/collapse player events on tap (mobile-friendly)
          nameDiv.addEventListener('click', async (ev)=>{
            try{
              if(expandedPlayers.has(p.id)){ expandedPlayers.delete(p.id); render(players); return; }
              // optimistic expand to show loading placeholder
              expandedPlayers.add(p.id);
              if(!p._events) p._events = [];
              render(players);
              setStatus('loading events...');
              const events = await listPlayerEvents(p.id);
              const pp = players.find(x=>x.id===p.id);
              if(pp) pp._events = events;
              setStatus('ready');
              render(players);
            }catch(e){ console.error('expand failed', e); setStatus('ready'); }
          }, { passive: true });

          infoDiv.appendChild(nameDiv); infoDiv.appendChild(subDiv);
          // show events when expanded (mobile-first: concise list)
          if(expandedPlayers.has(p.id)){
            const evDiv = document.createElement('div'); evDiv.className='events'; evDiv.style.marginTop='8px';
            const allEvents = (p._events || []).slice();
          const showAll = showAllEvents.has(p.id);
          const events = showAll ? allEvents : allEvents.slice(0,5);
          if(events.length===0){ const ulEv=document.createElement('ul'); ulEv.style.margin='6px 0'; ulEv.style.paddingLeft='18px'; const liE=document.createElement('li'); liE.textContent='No events found.'; ulEv.appendChild(liE); evDiv.appendChild(ulEv); }
          else{
            const groups = {};
            for(const e of events){ const d = new Date(Number(e.ts||0)); const year = d.getFullYear(); if(!groups[year]) groups[year]=[]; groups[year].push(e); }
            const years = Object.keys(groups).map(Number).sort((a,b)=> b-a);
            for(const y of years){ const yearHdr = document.createElement('div'); yearHdr.style.fontWeight='700'; yearHdr.style.marginTop='6px'; yearHdr.textContent=String(y); evDiv.appendChild(yearHdr);
              const ulYear = document.createElement('ul'); ulYear.style.margin='6px 0'; ulYear.style.paddingLeft='18px';
              for(const e of groups[y]){ const d=new Date(Number(e.ts||0)); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const display = mm+'-'+dd; const liE=document.createElement('li');
                  if(e.action==='paid'){
                    const prev=(e.beforeAmount!==undefined)?Number(e.beforeAmount):(e.amount||0);
                    liE.textContent = display + ' - PAID - previous $' + prev;
                    ulYear.appendChild(liE);
                  }
                  else if(e.action==='reset'){
                    const prevMiss = (e.beforeMisses!==undefined)?Number(e.beforeMisses):(e.beforeAmount&&0);
                    const prevAmt = (e.beforeAmount!==undefined)?Number(e.beforeAmount):0;
                    liE.textContent = display + ' - RESET - previous ' + prevMiss + ' misses - $' + prevAmt;
                    ulYear.appendChild(liE);
                  }
                  else if(e.action==='miss' || e.rate!==undefined || e.amount!==undefined){ const amt = (e.rate!==undefined)?e.rate:(e.amount||0); const skillLabel = (e.skill!==undefined) ? ('SL ' + e.skill) : ('SL ' + (p.skill||'')); liE.textContent = display + ' - ' + skillLabel + ' - $' + amt; ulYear.appendChild(liE); }
                  else { liE.textContent = display + ' - ' + (e.action||'event'); ulYear.appendChild(liE); }
              }
              evDiv.appendChild(ulYear);
            }
          }
          // show more / show less
          if(!showAll && allEvents.length>5){ const moreBtn=document.createElement('button'); moreBtn.textContent='Show more'; moreBtn.style.marginTop='6px'; moreBtn.addEventListener('click', ()=>{ showAllEvents.add(p.id); render(players); }); evDiv.appendChild(moreBtn); }
          else if(showAll && allEvents.length>5){ const lessBtn=document.createElement('button'); lessBtn.textContent='Show less'; lessBtn.style.marginTop='6px'; lessBtn.addEventListener('click', ()=>{ showAllEvents.delete(p.id); render(players); }); evDiv.appendChild(lessBtn); }
          infoDiv.appendChild(evDiv);
          }

        }
        li.appendChild(infoDiv);
        const controls=document.createElement('div'); controls.className='controls';
        const inc=document.createElement('button'); inc.type='button'; inc.textContent='+'; inc.onclick=()=>incPlayer(p.id);
        const ed=document.createElement('button'); ed.type='button'; ed.textContent='✎'; ed.className='edit'; ed.onclick=()=>editPlayer(p.id);
        const resetBtn = document.createElement('button'); resetBtn.type='button'; resetBtn.textContent='Reset'; resetBtn.className='reset'; resetBtn.onclick=()=>resetPlayerTotals(p.id);
        const rm=document.createElement('button'); rm.type='button'; rm.textContent='✕'; rm.className='rm'; rm.onclick=()=>removePlayer(p.id);
        controls.appendChild(inc); controls.appendChild(ed); controls.appendChild(resetBtn); controls.appendChild(rm);
        li.appendChild(controls);
        ul.appendChild(li);
      }) }

  let players = loadLocal(); render(players); setStatus('ready (local)');
  // add Skill Rates button to top center
  try{
    const top = document.getElementById('topCenter');
    if(top){ const srBtn = document.createElement('button'); srBtn.id='skillRatesBtn'; srBtn.textContent='Skill Rates'; srBtn.style.marginTop='6px'; srBtn.style.marginLeft='8px'; srBtn.addEventListener('click', openSkillRates); top.appendChild(srBtn); }
  }catch(e){ console.error('adding Skill Rates button failed', e); }

  document.getElementById('addBtn').addEventListener('click', ()=>{ const input=document.getElementById('nameInput'); const name=input.value.trim(); if(!name) return; input.value=''; addPlayer(name); });
  const resetBtnEl = document.getElementById('resetBtn'); if(resetBtnEl){ resetBtnEl.addEventListener('click', resetAll); /* removed from UI */ }
  document.getElementById('nameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') { const name=e.target.value.trim(); if(name){ e.target.value=''; addPlayer(name); } } });

  function addPlayer(name){ const skillInput = document.getElementById('skillInput'); let skill = 1; if(skillInput){ skill = parseInt(skillInput.value) || 1; skill = Math.max(1, Math.min(9, skill)); skillInput.value = ''; }
    const p={ id: makeId(), name, skill, misses:0, createdAt: Date.now() };
    players.push(p); saveLocal(players); render(players);
    createServerPlayer(p).then(newId=>{ if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); } }).catch(e=>console.error('create failed',e)); }

  function editPlayer(id){ editingId = id; render(players); }

    async function saveEdit(id,newName,newSkill){ const p = players.find(x=> x.id===id); if(!p) return; const old = { name: p.name, skill: p.skill };
      p.name = (newName||'').trim(); p.skill = Math.max(1, Math.min(9, Number(newSkill) || 1)); editingId = null; saveLocal(players); render(players); updateTotalAndChart(); if(String(p.id).startsWith('local-')){ setStatus('saved (local)'); return true; }
      try{ setStatus('saving...'); const ok = await updateServerPlayer(p.id,{ name: p.name, skill: p.skill }); if(ok){ setStatus('saved'); return true; } else { throw new Error('server returned failure'); } }catch(e){ console.error('edit failed', e); // revert
        p.name = old.name; p.skill = old.skill; saveLocal(players); render(players); updateTotalAndChart(); setStatus('save failed'); return false; } }

  async function incPlayer(id){ try{
      const player = players.find(p=>p.id===id);
      if(!player) return;
      // increment locally
      player.misses = (player.misses||0) + 1;
      const rate = skillRate(player.skill);
      player.amountOwed = (player.amountOwed||0) + rate;
      // optimistic update
      saveLocal(players); render(players); updateTotalAndChart();
      // append local event immediately
      const newEvent = { ts: Date.now(), tsIso: new Date().toISOString(), action: 'miss', skill: player.skill, rate: rate, amount: rate };
      player._events = player._events ? [newEvent].concat(player._events) : [newEvent];
      // persist miss event and update player on server when not local-only
      if(String(id).startsWith('local-')){ setStatus('miss logged (local)'); return true; }
      try{
        const created = await createMissEvent(id, player.skill, rate);
        if(created){ await updateServerPlayer(id, { misses: player.misses, amountOwed: player.amountOwed }); try{ await createChangeEntry(id, 'miss', JSON.stringify({ skill: player.skill, rate: rate }), JSON.stringify(player)); }catch(e){ console.error('createChangeEntry for miss failed', e); } }
      }catch(e){ console.error('incPlayer server flow failed', e); }
    }catch(e){ console.error('incPlayer error', e); } }
  async function removePlayer(id){ try{ const p = players.find(x=>x.id===id); if(!p) return; const ok = await showConfirm('Delete "' + (p.name||'Unnamed') + '"? This cannot be undone. Continue?'); if(!ok) return; lockLi(id, true); players = players.filter(p=> p.id!==id); saveLocal(players); render(players); if(!String(id).startsWith('local-')){ await deleteServerPlayer(id).catch(e=>console.error(e)); } }catch(e){ console.error('removePlayer error', e);} }

  async function resetPlayerTotals(id){ try{ const p = players.find(x=>x.id===id); if(!p) return false; const name = p.name || 'Unnamed'; const ok = await showConfirm('Reset running totals for "' + name + '"? This will set misses and amount owed to 0 but keep historical events. Continue?'); if(!ok) return false; lockLi(id, true); const beforeSnapshot = JSON.stringify(p); const prevMiss = Number(p.misses||0); const prevAmt = Number(p.amountOwed||0); p.misses = 0; p.amountOwed = 0; saveLocal(players); render(players); updateTotalAndChart(); if(String(id).startsWith('local-')){ // append local reset event
          const newEvent = { ts: Date.now(), tsIso: new Date().toISOString(), action: 'reset', beforeMisses: prevMiss, beforeAmount: prevAmt }; p._events = p._events ? [newEvent].concat(p._events) : [newEvent]; saveLocal(players); render(players); setStatus('reset (local)'); lockLi(id, false); return true; }
        setStatus('resetting...'); const ok2 = await updateServerPlayer(id, { misses: 0, amountOwed: 0 }); if(!ok2){ setStatus('reset failed'); lockLi(id, false); return false; }
      try{ await createChangeEntry(id, 'reset', JSON.stringify({ before: beforeSnapshot }), JSON.stringify(p)); }catch(e){ console.error('failed creating reset change entry', e); }
      try{ const newEvent = { ts: Date.now(), tsIso: new Date().toISOString(), action: 'reset', beforeMisses: prevMiss, beforeAmount: prevAmt }; p._events = p._events ? [newEvent].concat(p._events) : [newEvent]; saveLocal(players); render(players); }catch(e){ console.error('failed appending reset event', e); }
        setStatus('reset complete'); return true; }catch(e){ console.error('resetPlayerTotals error', e); setStatus('reset failed'); return false; } finally{ lockLi(id, false); } }
  function resetAll(){ if(!confirm('Reset all scores to 0?')) return; players = players.map(p=> ({...p, misses:0})); saveLocal(players); render(players); players.forEach(p=>{ if(!String(p.id).startsWith('local-')) updateServerPlayer(p.id,{ misses:0 }).catch(e=>console.error(e)); }); }

  // REST helpers
  function docIdFromName(name){ const parts=name.split('/'); return parts[parts.length-1]; }
  function parseDoc(doc){ const data=doc.fields||{}; return { id: docIdFromName(doc.name), name: (data.name && data.name.stringValue) ? data.name.stringValue : undefined, skill: (data.skill && parseInt(data.skill.integerValue||'1'))||1, misses: (data.misses && parseInt(data.misses.integerValue||'0'))||0, createdAt: (data.createdAt && parseInt(data.createdAt.integerValue||String(Date.now())))||Date.now() }; }

  async function listServerPlayers(){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players?key=' + API_KEY; const res=await fetch(url); if(!res.ok){ const txt=await res.text(); throw new Error('list failed: '+res.status+' '+txt); } const json=await res.json(); if(!json.documents) return []; return json.documents.map(parseDoc); }catch(e){ console.error('listServerPlayers error', e); return null; } }
  async function createServerPlayer(p){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players?key='+API_KEY; const body={ fields: { name:{ stringValue: String((p.name && String(p.name).trim())? p.name : 'Unnamed') }, skill:{ integerValue: String(Math.max(1, Math.min(9, p.skill||1))) }, misses:{ integerValue: String(p.misses||0) }, createdAt:{ integerValue: String(p.createdAt||Date.now()) } } }; const res=await fetch(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const txt=await res.text(); if(!res.ok) throw new Error('create failed: '+res.status+' '+txt); const json=JSON.parse(txt); return docIdFromName(json.name); }catch(e){ console.error('createServerPlayer error', e); return null; } }
  async function updateServerPlayer(id,patch){ try{ const base = 'https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players/'+id; const mask = []; const bodyFields = {}; const local = players.find(p=> p.id===id); const missesVal = (patch.misses!==undefined) ? patch.misses : (local? (local.misses||0) : 0); if(patch.misses!==undefined || local){ bodyFields.misses = { integerValue: String(missesVal) }; mask.push('misses'); } if(patch.name!==undefined && String(patch.name).trim() !== ''){ bodyFields.name={ stringValue: String(patch.name) }; mask.push('name'); } if(patch.skill!==undefined && Number(patch.skill)>=1 && Number(patch.skill)<=9){ bodyFields.skill={ integerValue: String(patch.skill) }; mask.push('skill'); } if(local && local.createdAt){ bodyFields.createdAt = { integerValue: String(local.createdAt) }; if(!mask.includes('createdAt')) mask.push('createdAt'); } if(patch.amountOwed!==undefined){ bodyFields.amountOwed = { integerValue: String(patch.amountOwed) }; if(!mask.includes('amountOwed')) mask.push('amountOwed'); }
    if(mask.length===0){ bodyFields.misses = { integerValue: String(missesVal) }; mask.push('misses'); }
    const url = base + '?key=' + API_KEY + mask.map(m=>'&updateMask.fieldPaths='+encodeURIComponent(m)).join(''); const res=await fetch(url,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) }); if(!res.ok){ const txt=await res.text(); throw new Error('update failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('updateServerPlayer error', e); return false; } }

  async function createMissEvent(id, skill, rate){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + encodeURIComponent(id) + '/misses?key=' + API_KEY; const now = Date.now(); const body = { fields: { ts: { integerValue: String(now) }, tsIso: { stringValue: new Date(now).toISOString() }, skill: { integerValue: String(skill) }, rate: { integerValue: String(rate) }, amount: { integerValue: String(rate) } } }; const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(!res.ok){ const txt = await res.text(); throw new Error('createMissEvent failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('createMissEvent error', e); return false; } }

  async function createChangeEntry(id, action, patchStr, snapshotStr){ try{ const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/' + DB_ID + '/documents/players/' + encodeURIComponent(id) + '/changes?key=' + API_KEY; const now = Date.now(); const bodyFields = { action: { stringValue: String(action) }, ts: { integerValue: String(now) }, tsIso: { stringValue: new Date(now).toISOString() } }; if(patchStr) bodyFields.patch = { stringValue: String(patchStr) }; if(snapshotStr) bodyFields.snapshot = { stringValue: String(snapshotStr) }; const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fields: bodyFields }) }); if(!res.ok){ const txt = await res.text(); throw new Error('createChangeEntry failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('createChangeEntry error', e); return false; } }
  async function deleteServerPlayer(id){ try{ const url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DB_ID+'/documents/players/'+id+'?key='+API_KEY; const res=await fetch(url,{ method:'DELETE' }); if(!res.ok){ const txt=await res.text(); throw new Error('delete failed: '+res.status+' '+txt); } return true; }catch(e){ console.error('deleteServerPlayer error', e); return false; } }

  // utility: total and charts (misses and amount)
  function updateTotalAndChart(){ const totalMisses = players.reduce((s,p)=> s + (p.misses||0), 0); const totalAmount = players.reduce((s,p)=> s + ((p.misses||0) * (p.skill||1)), 0); const totalMissesEl = document.getElementById('totalMisses'); const totalAmountEl = document.getElementById('totalAmount'); if(totalMissesEl) totalMissesEl.textContent = 'Total missed shots: ' + totalMisses; if(totalAmountEl) totalAmountEl.textContent = 'Total amount: $' + totalAmount; // charts
      try{
        const barLabelPlugin = { id: 'barValue', afterDatasetsDraw: function(chart){ const ctx = chart.ctx; const canvasWidth = chart.width; const isAmountChart = chart && chart.canvas && chart.canvas.id === 'chartAmount'; chart.data.datasets.forEach(function(dataset, i){ const meta = chart.getDatasetMeta(i); meta.data.forEach(function(bar, idx){ const val = dataset.data[idx]; if(val===undefined || val===null) return; const x = bar.x; const y = bar.y; ctx.save(); ctx.font = 'bold 12px Arial'; const displayVal = isAmountChart ? ('$' + String(val)) : String(val);
            // force label font color to black for legibility
            let textColor = '#000';
            const textWidth = ctx.measureText(displayVal).width;
            if(x + 20 + textWidth < canvasWidth){ ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.fillText(displayVal, x + 10, y); } else { ctx.fillStyle = '#000'; ctx.textAlign = 'right'; ctx.fillText(displayVal, x - 8, y); }
            ctx.restore(); }); }); } };

        // unified soft palette: determine base order from list ordering so colors match across charts
        const compareOrder = (a,b)=>{ const ma=a.misses||0, mb=b.misses||0; if(mb - ma !== 0) return mb - ma; const ama=(a.misses||0)*(a.skill||1), amb=(b.misses||0)*(b.skill||1); if(amb - ama !== 0) return amb - ama; return (b.createdAt||0) - (a.createdAt||0); };
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
        const amountSorted = (players||[]).slice().sort((a,b)=> ((b.misses||0)*skillRate(b.skill)) - ((a.misses||0)*skillRate(a.skill)));
        const topAmount = amountSorted.slice(0,5);
        const labelsAmount = topAmount.map(p=> p.name || 'Unnamed');
        const amountData = topAmount.map(p=> (p.misses||0) * skillRate(p.skill));
        const paletteAmount = topAmount.map(p=> paletteMap[p.id] || '#d1d5db');

        if(window.playerChartAmount){ window.playerChartAmount.data.labels = labelsAmount; window.playerChartAmount.data.datasets[0].data = amountData; window.playerChartAmount.data.datasets[0].backgroundColor = paletteAmount; window.playerChartAmount.update(); }
        else { const ctx2 = document.getElementById('chartAmount'); if(ctx2 && window.Chart){ window.playerChartAmount = new Chart(ctx2.getContext('2d'), { type: 'bar', data: { labels: labelsAmount, datasets:[{ data: amountData, backgroundColor: paletteAmount }] }, options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false, scales:{ x:{ beginAtZero:true, ticks: { callback: function(value){ return '$' + value; } } } }, plugins:{ legend:{ display:false } } }, plugins: [barLabelPlugin] }); } }

    }catch(e){ console.error('chart update failed', e); }
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
      for(const s of server){ const existing = byId[s.id]; if(existing){ const mergedObj = { id: s.id, name: (s.name && String(s.name).trim()) ? s.name : (existing.name || s.name), skill: (s.skill!==undefined) ? s.skill : (existing.skill||1), misses: (s.misses!==undefined)? s.misses : (existing.misses||0), createdAt: s.createdAt||existing.createdAt }; if(existing._events) mergedObj._events = existing._events; byId[s.id] = mergedObj; } else { byId[s.id] = Object.assign({}, s); } }
      players = Object.values(byId);
      // ensure local-only entries are preserved
      players = players.concat(localOnly.filter(p=> !players.find(x=>x.id===p.id)));
      saveLocal(players); render(players); updateTotalAndChart();
      for(const p of localOnly){ const newId = await createServerPlayer(p); if(newId){ players = players.map(x=> x.id===p.id? {...x, id:newId}: x); saveLocal(players); render(players); updateTotalAndChart(); } }
      if(typeof window !== 'undefined'){ setInterval(async ()=>{ // avoid clobbering inline edits while user is editing
                  if(typeof editingId !== 'undefined' && editingId !== null) { /* skip server merge while editing to preserve input state */ return; }
                  const s = await listServerPlayers(); if(s && Array.isArray(s)){ const localOnly2 = players.filter(p=> String(p.id).startsWith('local-'));
                  // merge same as above
                  const byId2 = {};
                  for(const l of players){ byId2[l.id]=Object.assign({},l); }
                  for(const ss of s){ const existing = byId2[ss.id]; if(existing){ const mergedObj = { id: ss.id, name: (ss.name && String(ss.name).trim()) ? ss.name : (existing.name || ss.name), skill: (ss.skill!==undefined) ? ss.skill : (existing.skill||1), misses: (ss.misses!==undefined)? ss.misses : (existing.misses||0), createdAt: ss.createdAt||existing.createdAt }; if(existing._events) mergedObj._events = existing._events; byId2[ss.id] = mergedObj; } else { byId2[ss.id] = Object.assign({}, ss); } }
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

  // Debug / testing helpers: simulate offline events and test event retrieval without hitting Firestore quota
  window._simulateEventsOffline = async function(playerId){ try{
      const sampleMisses = [
        { ts: Date.now() - 1000*60*60, tsIso: new Date(Date.now() - 1000*60*60).toISOString(), action: 'miss', skill: 5, rate: 6, amount: 6 },
        { ts: Date.now() - 1000*60*30, tsIso: new Date(Date.now() - 1000*60*30).toISOString(), action: 'miss', skill: 5, rate: 6, amount: 6 }
      ];
      const sampleChanges = [
        { ts: Date.now() - 1000*60*10, tsIso: new Date(Date.now() - 1000*60*10).toISOString(), action: 'paid', patch: '', snapshot: '' }
      ];
      const mappedChanges = sampleChanges.map(c=> ({ ts: c.ts, tsIso: c.tsIso, action: c.action, rate: undefined, amount: undefined, patch: c.patch, snapshot: c.snapshot }));
      const all = sampleMisses.concat(mappedChanges).sort((a,b)=> (b.ts||0) - (a.ts||0));
      try{ _eventsCache.set(playerId, { ts: Date.now(), events: all }); }catch(e){}
      const p = players.find(x=> x.id===playerId);
      if(p){ p._events = all; saveLocal(players); render(players); }
      console.log('Simulated events for', playerId, all);
      return all;
    }catch(e){ console.error('simulateEventsOffline failed', e); return []; } };

  window._testListPlayerEvents = async function(playerId){ try{ const ev = await listPlayerEvents(playerId); console.log('listPlayerEvents ->', playerId, ev); return ev; }catch(e){ console.error('testListPlayerEvents failed', e); return null; } };
  function updateFirestore(id, patch){ return updateServerPlayer(id, patch); }
  function deleteFirestore(id){ return deleteServerPlayer(id); }

  // no-op for tryInit

})();