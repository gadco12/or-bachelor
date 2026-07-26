/**
 * Or Bachelor — backend
 * Serves the invite (index.html), records every RSVP to Postgres,
 * and exposes a live host dashboard at /host?key=YOUR_HOST_KEY
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
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// --- raw data (host only) ---
app.get('/api/rsvps', async (req, res) => {
  if (req.query.key !== HOST_KEY) return res.status(401).json({ error: 'unauthorized' });
  if (!pool) return res.json({ rows: [] });
  try {
    const r = await pool.query('SELECT ts, name, choice FROM rsvps ORDER BY ts DESC');
    res.json({ rows: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

// --- host dashboard ---
app.get('/host', (req, res) => res.type('html').send(hostHtml(String(req.query.key || ''))));

function hostHtml(key) {
  const k = key.replace(/[&<>"']/g, '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Host — Or Bachelor RSVPs</title>
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
  .bar{ display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  button{ font:inherit; font-weight:700; background:var(--blue); color:#fff; border:none; border-radius:10px; padding:9px 16px; cursor:pointer; }
  .err{ background:#fdecea; color:#c0392b; padding:14px; border-radius:12px; }
</style></head><body><div class="wrap">
  <div class="bar"><div><h1>Or's Bachelor — RSVPs</h1><p class="muted" id="sub">Live · latest answer per person</p></div><button onclick="load()">Refresh</button></div>
  <div id="content"><p class="muted">Loading…</p></div>
</div>
<script>
  const KEY = ${JSON.stringify(k)};
  const order = { "Coming":0, "Not coming":1, "Or is king (gag)":2 };
  async function load(){
    const c = document.getElementById('content');
    try{
      const r = await fetch('/api/rsvps?key=' + encodeURIComponent(KEY));
      if(r.status === 401){ c.innerHTML = '<div class="err">Wrong or missing host key. Open this page as <b>/host?key=YOUR_KEY</b>.</div>'; return; }
      const data = await r.json();
      const rows = data.rows || [];
      // latest answer per name
      const latest = {};
      for(const row of rows){ if(!(row.name in latest)) latest[row.name] = row; } // rows are newest-first
      const people = Object.values(latest);
      const count = v => people.filter(p => p.choice === v).length;
      const coming = count('Coming'), no = count('Not coming'), king = count('Or is king (gag)');
      const cls = ch => ch==='Coming'?'coming':ch==='Not coming'?'no':'king';
      people.sort((a,b)=> (order[a.choice]??9)-(order[b.choice]??9) || a.name.localeCompare(b.name));
      let html = '<div class="cards">'
        + '<div class="card coming"><div class="n">'+coming+'</div><div class="l">Coming</div></div>'
        + '<div class="card no"><div class="n">'+no+'</div><div class="l">Not coming</div></div>'
        + '<div class="card king"><div class="n">'+king+'</div><div class="l">Or is king (gag)</div></div>'
        + '</div>';
      html += '<table><thead><tr><th>Name</th><th>Choice</th><th>When</th></tr></thead><tbody>';
      for(const p of people){
        const when = new Date(p.ts).toLocaleString();
        html += '<tr><td>'+esc(p.name)+'</td><td><span class="pill '+cls(p.choice)+'">'+esc(p.choice)+'</span></td><td>'+esc(when)+'</td></tr>';
      }
      html += '</tbody></table>';
      if(!people.length) html = '<p class="muted">No RSVPs yet.</p>';
      c.innerHTML = html;
      document.getElementById('sub').textContent = people.length + ' responded · updates every 15s';
    }catch(e){ c.innerHTML = '<div class="err">Could not load. Try Refresh.</div>'; }
  }
  function esc(s){ return String(s).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
  load(); setInterval(load, 15000);
</script></body></html>`;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on ' + port));
