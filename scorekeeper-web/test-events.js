const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

(async ()=>{
  try{
    const appJsPath = path.resolve(__dirname, 'dist', 'app-v4.js');
    if(!fs.existsSync(appJsPath)){
      console.error('app-v4.js not found at', appJsPath); process.exit(1);
    }
    const appJs = fs.readFileSync(appJsPath, 'utf8');
    const players = [
      { id:'p1', name:'Carter', skill:5, misses:9, amountOwed:54, createdAt: Date.now() - 100000 },
      { id:'p2', name:'Kevin C', skill:5, misses:12, amountOwed:72, createdAt: Date.now() - 200000 },
      { id:'p3', name:'Michael', skill:7, misses:6, amountOwed:60, createdAt: Date.now() - 300000 }
    ];

    const indexHtmlPath = path.resolve(__dirname, 'index.html');
    let indexHtml = '<!doctype html><html><head><meta charset="utf-8"></head><body>';
    if(fs.existsSync(indexHtmlPath)){
      indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    } else {
      // fallback minimal structure
      indexHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="app"><main><ul id="list" class="list"></ul><div id="status"></div></main></div></body></html>`;
    }
    // remove external Chart.js script tag if present
    indexHtml = indexHtml.replace(/<script[^>]*cdn\.jsdelivr\.net[^>]*><\/script>/i, '');
    // insert localStorage prefill and inline app script
    const preScript = `<script>window.localStorage.setItem('scorekeeper.players', ${JSON.stringify(JSON.stringify(players))}); window.FORCE_PROD = true;</script>`;
    const appInline = `<script>try {\n${appJs.replace(/<\/script>/g,'<\\/script>')}\n} catch(e){ console.error('APP ERROR', e && e.stack ? e.stack : e); }</script>`;
    // place preScript before closing </body> and replace any existing app-v4.js script tag
    if(indexHtml.indexOf('app-v4.js') !== -1){ indexHtml = indexHtml.replace(/<script[^>]*app-v4\.js[^>]*>.*?<\/script>/is, appInline); indexHtml = indexHtml.replace(/<body[^>]*>/i, match => match + '\n' + preScript + '\n'); }
    else { indexHtml = indexHtml.replace(/<\/body>/i, preScript + '\n' + appInline + '\n</body>'); }

    console.log('html contains addBtn', indexHtml.indexOf('id="addBtn"') !== -1); console.log('bundle has simulate helper', appJs.indexOf('_simulateEventsOffline') !== -1);
    const html = indexHtml + "\n<script>\n(async ()=>{\n  const waitFor = (name, timeout=15000)=> new Promise((res,rej)=>{ const t0=Date.now(); (function check(){ try{ if(window[name]) return res(true);}catch(e){} if(Date.now()-t0>timeout) return rej(new Error('timeout '+name)); setTimeout(check,100); })(); });\n  try{\n    await waitFor('_simulateEventsOffline',15000);\n    console.log('simulate available');\n    await window._simulateEventsOffline('p1');\n    await window._simulateEventsOffline('p2');\n    console.log('simulate done');\n    const ev1 = await window._testListPlayerEvents('p1');\n    const ev2 = await window._testListPlayerEvents('p2');\n    console.log('EV1', JSON.stringify(ev1));\n    console.log('EV2', JSON.stringify(ev2));\n    // auto-expand each player to force events to render\n    const nameEls = Array.from(document.querySelectorAll('#list .item .name')) || [];\n    console.log('nameEls', nameEls.length);\n    for(const el of nameEls){ try{ el.click(); }catch(e){ console.error('click failed', e); } }\n    // wait for async fetch/render to complete\n    await new Promise(r=> setTimeout(r, 800));\n    const items = Array.from(document.querySelectorAll('#list .item'));
    console.log('DOM items', items.length);\n    items.forEach(li=>{ const id = li.dataset.playerId || 'noid'; const evs = li.querySelectorAll('.events li'); console.log('player', id, 'events count', evs.length); });\n  }catch(e){ console.error('test harness error', e); }\n})();\n</script>";n    console.log('DOM items', items.length);\n    items.forEach(li=>{ const id = li.dataset.playerId || 'noid'; const evs = li.querySelectorAll('.events li'); console.log('player', id, 'events count', evs.length); });\n  }catch(e){ console.error('test harness error', e); }\n})();\n</script>";

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('log', (...args)=> console.log(...args));
    virtualConsole.on('error', (...args)=> console.error(...args));
    virtualConsole.on('info', (...args)=> console.info(...args));
    virtualConsole.on('warn', (...args)=> console.warn(...args));
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost:8000', virtualConsole });
    // ensure bundle executes in the window context (some JSDOM setups may not auto-run heavy scripts)
    try{
      const s = dom.window.document.createElement('script');
      s.textContent = appJs;
      dom.window.document.body.appendChild(s);
    }catch(e){ console.error('failed to inject appJs into window', e); }

    // wait for the test script to complete
    await new Promise(r=> setTimeout(r, 12000));
    console.log('test finished');
    process.exit(0);
  }catch(e){ console.error('fatal', e); process.exit(2); }
})();
