"""Live viewer shell — ported verbatim from the monolith's
``src/api/routes/whiteboard.py`` (``_VIEWER_SHELL``), with paths rewritten
from ``/api/whiteboards/*`` + ``/ws/whiteboard`` (monolith) to
``/api/apps/whiteboard/*`` + ``/api/apps/whiteboard/ws`` (this app's own
mounted sub-app — every app's routes, including its WS route, live under
its own ``/api/apps/<id>/`` prefix per the framework's ``routes:register``
contribution point).
"""

VIEWER_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Whiteboard</title>
<style>
  html,body{margin:0;min-height:100%;background:#0a0a0f}
  body{-webkit-overflow-scrolling:touch}
  #frame{display:block;width:100%;min-height:100vh;border:0;background:#fff}
  #dot{position:fixed;top:8px;right:10px;width:9px;height:9px;border-radius:50%;
    background:#e0245e;box-shadow:0 0 6px #e0245e;z-index:9;transition:background .3s,box-shadow .3s}
  #dot.live{background:#17bf63;box-shadow:0 0 6px #17bf63}
</style>
</head>
<body>
<span id="dot" title="disconnected"></span>
<iframe id="frame" title="Whiteboard"></iframe>
<script>
(function(){
  var BOARD = "__BOARD_ID__";
  var frame = document.getElementById('frame');
  var dot = document.getElementById('dot');
  var htmlUrl = '/api/apps/whiteboard/boards/' + encodeURIComponent(BOARD) + '/html';

  function sizeFrame(){
    try {
      var d = frame.contentDocument;
      if (d && d.documentElement) {
        var h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
        frame.style.height = Math.max(h, window.innerHeight) + 'px';
      }
    } catch(e){}
  }
  function reload(){
    frame.src = htmlUrl + '?t=' + Date.now();
  }
  function findTarget(sel, text){
    var d; try { d = frame.contentDocument; } catch(e){ return null; }
    if(!d) return null;
    if(sel){ try { var e = d.querySelector(sel); if(e) return e; } catch(_){} }
    if(text){
      var rx = null; try { rx = new RegExp(text, 'i'); } catch(_){}
      var nodes = d.querySelectorAll('h1,h2,h3,h4,h5,section,[id],p,li,td,th,figure,img,div');
      for(var i=0;i<nodes.length;i++){
        var t = (nodes[i].textContent || '') + ' ' + (nodes[i].id || '') + ' ' + (nodes[i].getAttribute && (nodes[i].getAttribute('alt')||'') );
        if(rx ? rx.test(t) : t.toLowerCase().indexOf(text.toLowerCase()) >= 0) return nodes[i];
      }
    }
    return null;
  }
  function hexToRgb(h){
    try {
      h = (h || '').toString().trim();
      if(h.charAt(0) === '#') h = h.slice(1);
      if(h.length === 3) h = h.split('').map(function(x){ return x + x; }).join('');
      var n = parseInt(h, 16);
      if(h.length >= 6 && !isNaN(n)) return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    } catch(_){}
    return { r:239, g:68, b:68 };
  }
  function pointTo(msg){
    try {
      var el = findTarget(msg.selector, msg.text);
      if(!el) return;
      var dur = Math.max(400, msg.duration || 2000);
      if(msg.scroll !== false){
        var top = 0;
        try { top = frame.offsetTop + el.getBoundingClientRect().top - 40; } catch(_){}
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      if(msg.highlight !== false){
        var col = hexToRgb(msg.color || '#ef4444');
        var c = col.r + ',' + col.g + ',' + col.b;
        var cleanup = function(){ try { el.style.outline=''; el.style.outlineOffset=''; el.style.boxShadow=''; } catch(_){} };
        try {
          el.style.outlineStyle = 'solid';
          el.style.outlineWidth = '3px';
          el.style.outlineOffset = '3px';
          if(!el.style.borderRadius) el.style.borderRadius = '6px';
          var anim = el.animate([
            { outlineColor:'rgba('+c+',0)',    boxShadow:'0 0 0 0 rgba('+c+',0)' },
            { outlineColor:'rgba('+c+',0.98)', boxShadow:'0 0 34px 11px rgba('+c+',0.60)', offset:0.10 },
            { outlineColor:'rgba('+c+',0.98)', boxShadow:'0 0 34px 11px rgba('+c+',0.50)', offset:0.55 },
            { outlineColor:'rgba('+c+',0)',    boxShadow:'0 0 0 0 rgba('+c+',0)' }
          ], { duration: dur, easing:'ease-out' });
          if(anim && anim.finished && anim.finished.then) anim.finished.then(cleanup, cleanup);
          else setTimeout(cleanup, dur + 150);
        } catch(e){
          el.style.outline = '3px solid rgba('+c+',.95)';
          setTimeout(cleanup, dur);
        }
      }
    } catch(e){ console.error('whiteboard point failed', e); }
    scheduleReport();
  }
  function runJs(js){
    try {
      var w = frame.contentWindow;
      if (w) (new w.Function(js))();
    } catch(e){ console.error('whiteboard exec_js failed', e); }
    setTimeout(sizeFrame, 60);
    scheduleReport();
  }
  function currentTop(){
    try {
      var d = frame.contentDocument; if(!d) return null;
      var sY = window.scrollY || 0;
      var base = frame.offsetTop || 0;
      var heads = d.querySelectorAll('h1,h2,h3,h4');
      var cur = null, topVisible = null;
      for(var i=0;i<heads.length;i++){
        var top = base + heads[i].getBoundingClientRect().top;
        if(top <= sY + 12) cur = heads[i];
        if(topVisible === null && top >= sY - 4) topVisible = heads[i];
      }
      var docH = document.documentElement.scrollHeight;
      var total = Math.max(1, docH - window.innerHeight);
      return {
        section: cur ? (cur.textContent||'').trim().slice(0,160) : null,
        topVisible: topVisible ? (topVisible.textContent||'').trim().slice(0,160) : null,
        scrollPct: Math.round(Math.min(1, Math.max(0, sY/total))*100),
        atTop: sY <= 4,
        atBottom: (sY + window.innerHeight) >= (docH - 4)
      };
    } catch(e){ return null; }
  }
  var reportTimer;
  function report(){
    try { if(ws && ws.readyState === 1) ws.send(JSON.stringify({type:'whiteboard_viewport', id:BOARD, view:currentTop()})); } catch(e){}
  }
  function scheduleReport(){ clearTimeout(reportTimer); reportTimer = setTimeout(report, 220); }
  window.addEventListener('scroll', scheduleReport, {passive:true});
  frame.addEventListener('load', function(){ sizeFrame(); setTimeout(sizeFrame, 350); setTimeout(report, 420); });
  window.addEventListener('resize', function(){ sizeFrame(); scheduleReport(); });

  reload();

  var proto = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws;
  var initedOnce = false;
  function connect(){
    ws = new WebSocket(proto + '://' + location.host + '/api/apps/whiteboard/ws');
    ws.onopen = function(){ dot.className = 'live'; dot.title = 'live'; setTimeout(report, 300); };
    ws.onclose = function(){ dot.className = ''; dot.title = 'reconnecting'; setTimeout(connect, 1500); };
    ws.onerror = function(){ try { ws.close(); } catch(e){} };
    ws.onmessage = function(ev){
      var msg; try { msg = JSON.parse(ev.data); } catch(e){ return; }
      if (msg.type === 'whiteboard_init') {
        if (initedOnce) reload();
        initedOnce = true;
      } else if (msg.type === 'whiteboard_update' && msg.action === 'set') {
        if (!msg.board || msg.board.id === BOARD) reload();
      } else if (msg.type === 'whiteboard_exec' && msg.id === BOARD) {
        runJs(msg.js);
      } else if (msg.type === 'whiteboard_point' && msg.id === BOARD) {
        pointTo(msg);
      } else if (msg.type === 'whiteboard_update' && msg.action === 'delete' && msg.id === BOARD) {
        reload();
      }
    };
  }
  connect();
  setInterval(function(){ if (ws && ws.readyState === 1) ws.send('ping'); }, 20000);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible' && (!ws || ws.readyState > 1)) connect();
  });
})();
</script>
</body>
</html>"""
