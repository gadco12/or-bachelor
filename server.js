/**
 * Or Bachelor — backend
 * Serves the invite (index.html), records every RSVP to Postgres,
 * and exposes a live host dashboard at /host (with a key login screen)
 */
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const HOST_KEY = process.env.HOST_KEY || 'changeme';
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function init() {
  if (!pool) { console.warn('No DATABASE_URL set — RSVPs will not be stored.'); return; }
  await pool.query(
    'CREATE TABLE IF NOT EXISTS rsvps (id SERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT NOW(), name TEXT, choice TEXT)'
  );
  console.log('Database ready.');
}
init().catch(console.error);

// --- the invite ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/song.mp3', (req, res) => res.sendFile(path.join(__dirname, 'song.mp3')));

// --- record an RSVP ---
app.post('/rsvp', async (req, res) => {
  try {
    const name = String(req.body.name || '').slice(0, 120);
    const choice = String(req.body.choice || '').slice(0, 60);
    if (pool) await pool.query('INSERT INTO rsvps(name, choice) VALUES ($1, $2)', [name, choice]);
    res.json({ ok: true, stored: !!pool });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// --- raw data (host only) ---
app.get('/api/rsvps', async (req, res) => {
  if (req.query.key !== HOST_KEY) return res.status(401).json({ error: 'unauthorized' });
  if (!pool) return res.json({ rows: [], noDb: true });
  try {
    const r = await pool.query('SELECT ts, name, choice FROM rsvps ORDER BY ts DESC');
    res.json({ rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

// --- host dashboard (with key login screen) ---
app.get('/host', (req, res) => res.type('html').send(hostHtml()));

function hostHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Host &middot; Champagne Ori RSVPs</title>
<style>
  :root{ --blue:#0038A8; --navy:#002766; --gold:#F2B705; --ink:#12233b; --line:#d7e0ec; --bg:#e9f1fa; }
  *{ box-sizing:border-box; } body{ margin:0; font-family:system-ui,Arial,sans-serif; background:var(--bg); color:var(--ink); padding:24px 16px 64px; }
  .wrap{ max-width:820px; margin:0 auto; }
  h1{ font-size:26px; margin:0 0 4px; } .muted{ color:#6b7f97; font-size:14px; margin:0 0 20px; }
  .cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:22px; }
  .card{ background:#fff; border-radius:14px; padding:16px; box-shadow:0 12px 30px -18px rgba(6,28,64,.4); }
  .card .n{ font-size:36px; font-weight:900; line-height:1; } .card .l{ font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:#6b7f97; margin-top:6px; }
  .card.coming .n{ color:#0a7d3c; } .card.no .n{ color:#c0392b; } .card.king .n{ color:var(--gold); }
  table{ width:100%; border-collapse:collapse; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 12px 30px -18px rgba(6,28,64,.4); }
  th,td{ text-align:left; padding:11px 14px; border-bottom:1px solid var(--line); font-size:14px; }
  th{ background:var(--blue); color:#fff; font-size:12px; letter-spacing:.06em; text-transform:uppercase; }
  tr:last-child td{ border-bottom:none; }
  .pill{ display:inline-block; padding:3px 9px; border-radius:999px; font-size:12px; font-weight:700; }
  .pill.coming{ background:#e9f7ee; color:#0a7d3c; } .pill.no{ background:#fdecea; color:#c0392b; } .pill.king{ background:#fef6e0; color:#a9791a; }
  .bar{ display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:10px; }
  button{ font:inherit; font-weight:700; background:var(--blue); color:#fff; border:none; border-radius:10px; padding:11px 18px; cursor:pointer; }
  .warn{ background:#fff6e0; color:#8a6d1a; border:1px solid #f0dca0; padding:12px 14px; border-radius:12px; font-size:13px; font-weight:600; margin-bottom:16px; }
  .gate{ min-height:74vh; display:flex; align-items:center; justify-content:center; }
  .gate-card{ background:#fff; border-radius:18px; padding:32px 26px; box-shadow:0 20px 50px -20px rgba(6,28,64,.45); width:100%; max-width:360px; text-align:center; }
  .gate-card h1{ font-size:24px; margin:0 0 6px; }
  .gate-card input{ width:100%; padding:15px 14px; font-size:16px; border:2px solid var(--line); border-radius:12px; margin:16px 0 12px; }
  .gate-card button{ width:100%; padding:15px; font-size:16px; }
  .gate-err{ color:#c0392b; font-size:13px; font-weight:700; min-height:18px; margin:12px 0 0; }
</style></head><body><div class="wrap">
  <div id="gate" class="gate">
    <div class="gate-card">
      <h1>Host access &#128081;</h1>
      <p class="muted">Enter the host key to see everyone's RSVPs.</p>
      <input id="keyInput" type="password" placeholder="Host key" autocomplete="current-password">
      <button id="enterBtn" type="button">Enter</button>
      <p class="gate-err" id="gateErr"></p>
    </div>
  </div>
  <div id="dash" style="display:none">
    <div class="bar"><div><h1>Champagne Ori &mdash; RSVPs</h1><p class="muted" id="sub">Live &middot; latest answer per person</p></div><button onclick="load()">Refresh</button></div>
    <div id="content"></div>
  </div>
</div>
<script>
  var KEY = '';
  var order = { "Coming":0, "Not coming":1, "Or is king (gag)":2 };
  var timer = null;
  function esc(s){ return String(s).replace(/[&<>]/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]; }); }
  function showDash(){ document.getElementById('gate').style.display='none'; document.getElementById('dash').style.display='block'; if(!timer) timer=setInterval(load,15000); }
  function render(data){
    var rows = data.rows || [];
    var latest = {};
    for(var i=0;i<rows.length;i++){ if(!(rows[i].name in latest)) latest[rows[i].name]=rows[i]; }
    var people = Object.keys(latest).map(function(n){ return latest[n]; });
    function count(v){ return people.filter(function(p){ return p.choice===v; }).length; }
    var coming=count('Coming'), no=count('Not coming'), king=count('Or is king (gag)');
    function cls(ch){ return ch==='Coming'?'coming':ch==='Not coming'?'no':'king'; }
    people.sort(function(a,b){ var oa=(order[a.choice]==null?9:order[a.choice]), ob=(order[b.choice]==null?9:order[b.choice]); return oa-ob || a.name.localeCompare(b.name); });
    var html = '';
    if(data.noDb){ html += '<div class="warn">No database connected yet, so RSVPs are not being stored. Add a Postgres database and set DATABASE_URL on the Render service.</div>'; }
    html += '<div class="cards">'
      +'<div class="card coming"><div class="n">'+coming+'</div><div class="l">Coming</div></div>'
      +'<div class="card no"><div class="n">'+no+'</div><div class="l">Not coming</div></div>'
      +'<div class="card king"><div class="n">'+king+'</div><div class="l">Or is king (gag)</div></div>'
      +'</div>';
    html += '<table><thead><tr><th>Name</th><th>Choice</th><th>When</th></tr></thead><tbody>';
    for(var j=0;j<people.length;j++){ var p=people[j]; var when=new Date(p.ts).toLocaleString(); html += '<tr><td>'+esc(p.name)+'</td><td><span class="pill '+cls(p.choice)+'">'+esc(p.choice)+'</span></td><td>'+esc(when)+'</td></tr>'; }
    html += '</tbody></table>';
    if(!people.length && !data.noDb) html = '<p class="muted">No RSVPs yet. Send the invite and watch them roll in.</p>';
    document.getElementById('content').innerHTML = html;
    var sub=document.getElementById('sub'); if(sub) sub.textContent = people.length + ' responded  &middot; updates every 15s';
  }
  async function fetchRows(key){
    var r = await fetch('/api/rsvps?key=' + encodeURIComponent(key));
    if(r.status === 401) return { auth:false };
    var d = await r.json(); d.auth = true; return d;
  }
  async function load(){ if(!KEY) return; try{ var d = await fetchRows(KEY); if(d.auth) render(d); }catch(e){} }
  async function doEnter(){
    var v = document.getElementById('keyInput').value.trim();
    if(!v) return;
    document.getElementById('gateErr').textContent = 'Checking...';
    try{
      var d = await fetchRows(v);
      if(d.auth){ KEY = v; document.getElementById('gateErr').textContent=''; render(d); showDash(); try{ history.replaceState(null,'','/host?key='+encodeURIComponent(v)); }catch(e){} }
      else { document.getElementById('gateErr').textContent = 'Wrong host key. Try again.'; }
    }catch(e){ document.getElementById('gateErr').textContent = 'Network error. Try again.'; }
  }
  document.getElementById('enterBtn').addEventListener('click', doEnter);
  document.getElementById('keyInput').addEventListener('keydown', function(e){ if(e.key==='Enter') doEnter(); });
  // auto-login if a key is already in the URL
  (function(){
    var m = location.search.match(/[?&]key=([^&]+)/);
    if(m){ document.getElementById('keyInput').value = decodeURIComponent(m[1]); doEnter(); }
    else { document.getElementById('keyInput').focus(); }
  })();
</script></body></html>`;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on ' + port));
