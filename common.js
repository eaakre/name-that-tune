// Shared helpers for player and host pages.
const SB_URL = 'https://rhjkseexnaiyqwgidkyv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoamtzZWV4bmFpeXF3Z2lka3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MjI3ODYsImV4cCI6MjEwMzA5ODc4Nn0._v4fGVuU0mnUrhas6svqHJYoS69XhKqjp_7xpnWardU';
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong');
  return data;
}

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.remove('hide');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hide'), 3200);
}

// Live game + players. Realtime pushes, plus a slow poll as a safety net.
function watchGame(gameId, onGame, onPlayers) {
  let stopped = false;
  const loadGame = async () => {
    const { data } = await sb.from('buzz_games').select('*').eq('id', gameId).maybeSingle();
    if (!stopped) onGame(data);
  };
  const loadPlayers = async () => {
    const { data } = await sb.from('buzz_players').select('id,name,score,joined_at').eq('game_id', gameId).order('joined_at');
    if (!stopped && data) onPlayers(data);
  };
  const ch = sb.channel('g-' + gameId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'buzz_games', filter: 'id=eq.' + gameId },
      p => { if (p.eventType === 'DELETE') onGame(null); else onGame(p.new); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'buzz_players', filter: 'game_id=eq.' + gameId }, () => loadPlayers())
    .subscribe(status => { if (status === 'SUBSCRIBED') { loadGame(); loadPlayers(); } });
  loadGame(); loadPlayers();
  const iv = setInterval(() => { if (!document.hidden) { loadGame(); loadPlayers(); } }, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadGame(); loadPlayers(); } });
  return () => { stopped = true; clearInterval(iv); sb.removeChannel(ch); };
}
