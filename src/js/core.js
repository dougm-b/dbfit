// ══════════════════════════════════════════
// GITHUB API CONFIG
// ══════════════════════════════════════════
const GH_OWNER = 'dougm-b';
const GH_REPO  = 'dbfit';
const GH_FILE  = 'data/db.json';
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

let ghToken = localStorage.getItem('dbfit_ghtoken') || '';
let apiKey  = localStorage.getItem('dbfit_apikey')  || '';

// ── DATE HELPERS ──
function fmtDate(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseLocalDate(dk){
  const [y,m,d] = dk.split('-').map(Number);
  return new Date(y, m-1, d);
}
const now   = new Date();
const TODAY = fmtDate(now);

function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════
// DEFAULT WORKOUT PLANS
// ══════════════════════════════════════════
const FBA_DEFAULT = [
  {name:'Press banco plano c/ halteres', series:4, reps:'10–12', carga:'2x 25–32 kg', descanso:90},
  {name:'Press banco inclinado', series:3, reps:'10–12', carga:'2x 20–25 kg', descanso:90},
  {name:'Remada curvada c/ halteres', series:4, reps:'10–12', carga:'2x 25–32 kg', descanso:90},
  {name:'Press ombros sentado', series:3, reps:'10–12', carga:'2x 16,5 kg', descanso:75},
  {name:'Rosca direta', series:4, reps:'10–12', carga:'2x 16,5 kg', descanso:60},
  {name:'Extensão tríceps atrás cabeça', series:3, reps:'12', carga:'1x 14,5 kg', descanso:60},
  {name:'Goblet squat', series:3, reps:'15', carga:'1x 32,5 kg', descanso:90},
  {name:'Lunge estático', series:3, reps:'10 cada', carga:'2x 14,5 kg', descanso:75},
];
const FBB_DEFAULT = [
  {name:'Remada unilateral no banco', series:4, reps:'10–12 cada', carga:'1x 32,5 kg', descanso:90},
  {name:'Pullover c/ halter', series:3, reps:'12–15', carga:'1x 25–30 kg', descanso:75},
  {name:'Crucifixo banco plano', series:3, reps:'12–15', carga:'2x 14–18 kg', descanso:75},
  {name:'Press ombros sentado', series:3, reps:'10–12', carga:'2x 16,5 kg', descanso:75},
  {name:'Rosca martelo', series:3, reps:'12', carga:'2x 16,5 kg', descanso:60},
  {name:'Extensão tríceps (testa)', series:4, reps:'12', carga:'2x 14,5 kg', descanso:60},
  {name:'Stiff c/ halteres', series:3, reps:'12', carga:'2x 25–30 kg', descanso:90},
  {name:'Elevação pélvica no banco', series:3, reps:'15', carga:'1x 25–30 kg', descanso:75},
];

function defaultState(){
  return {
    workoutPlans: [
      { id:1, name:'Full Body A — Ênfase Peito + Bíceps', frequency:[1,5], exercises: FBA_DEFAULT.map(e=>({...e})) },
      { id:2, name:'Full Body B — Ênfase Costas + Tríceps', frequency:[3,6], exercises: FBB_DEFAULT.map(e=>({...e})) }
    ],
    workoutLogs: {},
    meals: {},
    health: {
      altura:184, peso:'122,5 kg', gc:'37,0%', musc:'73,3 kg', gv:'15',
      me:'43,0 kg', prot:'11,4%', agua:'44,9%', met:'2.309',
      idade:'21 anos', ossea:'4,0 kg', fc:72, passos:0
    },
    healthHistory: {},
    settings: { metaKcal:2600, metaProt:195, metaCarb:290, metaFat:75, metaAgua:3 },
    chatHistory: []
  };
}

let state = defaultState();
let dbSha = null; // GitHub file SHA needed for updates

function migrateState(loaded){
  const base = defaultState();
  if (!loaded) return base;
  const s = Object.assign({}, base, loaded);
  s.health   = Object.assign({}, base.health, loaded.health || {});
  s.settings = Object.assign({}, base.settings, loaded.settings || {});
  s.workoutPlans = (loaded.workoutPlans && loaded.workoutPlans.length) ? loaded.workoutPlans : base.workoutPlans;
  s.workoutLogs  = loaded.workoutLogs || {};
  s.meals        = loaded.meals || {};
  s.healthHistory = loaded.healthHistory || {};
  s.chatHistory  = loaded.chatHistory || [];

  // migrate old flat foods -> meals
  if (loaded.foods && !loaded.meals) {
    s.meals = {};
    Object.entries(loaded.foods).forEach(([dk, items]) => {
      items.forEach(it => {
        if (!s.meals[dk]) s.meals[dk] = [];
        let meal = s.meals[dk].find(m => m.name === it.meal);
        if (!meal) { meal = { name: it.meal, foods: [] }; s.meals[dk].push(meal); }
        meal.foods.push({ name: it.food, qty: it.qty||0, kcal: it.kcal||0, prot: it.prot||0, carb: it.carb||0, fat: it.fat||0, ts: it.ts||Date.now() });
      });
    });
  }
  // migrate old training -> workoutLogs
  if (loaded.training && !loaded.workoutLogs) {
    s.workoutLogs = {};
    Object.entries(loaded.training).forEach(([dk, items]) => {
      s.workoutLogs[dk] = items.map(it => ({
        planId: null, planName: it.type, dur: it.dur||0,
        intensity: it.intensity||'Moderada', notes: it.notes||'', ts: it.ts||Date.now()
      }));
    });
  }
  return s;
}

function classifyIMC(imc){
  if (imc < 18.5) return { label:'Abaixo do peso', cls:'badge-caution', color:'var(--caution)' };
  if (imc < 25)   return { label:'Peso normal', cls:'badge-ok', color:'var(--good)' };
  if (imc < 30)   return { label:'Sobrepeso', cls:'badge-warn', color:'var(--warn)' };
  return { label:'Obesidade', cls:'badge-red', color:'var(--red)' };
}

function nextPlanId(){
  return state.workoutPlans.length ? Math.max(...state.workoutPlans.map(p => p.id)) + 1 : 1;
}

function dayTotals(dk){
  const meals = state.meals[dk] || [];
  return meals.reduce((a, meal) => {
    (meal.foods || []).forEach(f => { a.kcal += f.kcal||0; a.prot += f.prot||0; a.carb += f.carb||0; a.fat += f.fat||0; });
    return a;
  }, { kcal:0, prot:0, carb:0, fat:0 });
}

function addFoodToMeal(dateKey, mealName, food){
  if (!state.meals[dateKey]) state.meals[dateKey] = [];
  let meal = state.meals[dateKey].find(m => m.name === mealName);
  if (!meal) { meal = { name: mealName, foods: [] }; state.meals[dateKey].push(meal); }
  meal.foods.push({ ...food, ts: Date.now() });
  return meal;
}

// ══════════════════════════════════════════
// TOKEN SETUP
// ══════════════════════════════════════════
function checkToken() {
  if (ghToken) {
    document.getElementById('token-setup').style.display = 'none';
    initApp();
  }
}

async function saveToken() {
  const val = document.getElementById('token-input').value.trim();
  const err = document.getElementById('setup-error');
  if (!val.startsWith('github_pat_') && !val.startsWith('ghp_')) {
    err.textContent = '❌ Token inválido. Deve começar com github_pat_ ou ghp_';
    return;
  }
  err.textContent = 'A verificar token...';
  try {
    const res = await fetch(GH_API, {
      headers: { Authorization: `token ${val}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) {
      err.textContent = '⚠️ Token válido mas ficheiro data/db.json não encontrado. Criando...';
      ghToken = val;
      localStorage.setItem('dbfit_ghtoken', ghToken);
      state = defaultState();
      await pushToGitHub();
      document.getElementById('token-setup').style.display = 'none';
      initApp();
      return;
    }
    if (!res.ok) {
      err.textContent = '❌ Token inválido ou sem permissões. Verifica e tenta novamente.';
      return;
    }
    ghToken = val;
    localStorage.setItem('dbfit_ghtoken', ghToken);
    err.style.color = 'var(--acc)';
    err.textContent = '✅ Token válido! A carregar dados...';
    setTimeout(() => {
      document.getElementById('token-setup').style.display = 'none';
      initApp();
    }, 800);
  } catch(e) {
    err.textContent = '❌ Erro de rede. Verifica a ligação.';
  }
}

function resetToken() {
  localStorage.removeItem('dbfit_ghtoken');
  ghToken = '';
  document.getElementById('token-setup').style.display = 'flex';
  document.getElementById('token-input').value = '';
  document.getElementById('setup-error').textContent = '';
}

// ══════════════════════════════════════════
// GITHUB SYNC
// ══════════════════════════════════════════
function setSyncStatus(status, label) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  if (!dot || !lbl) return; // page has no sync-bar (e.g. detail.html without it)
  dot.className = 'sync-dot ' + status;
  lbl.className = 'sync-label ' + status;
  lbl.textContent = label;
}

let syncBusy = false;

async function loadFromGitHub(opts) {
  opts = opts || {};
  if (opts.skipIfBusy && syncBusy) return false;
  syncBusy = true;
  if (!opts.silent) setSyncStatus('syncing', 'a carregar...');
  try {
    const res = await fetch(GH_API + '?t=' + Date.now(), {
      headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    dbSha = data.sha;
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    state = migrateState(content);
    setSyncStatus('ok', 'sincronizado');
    return true;
  } catch(e) {
    setSyncStatus(opts.silent ? 'ok' : 'error', opts.silent ? 'sincronizado' : 'erro ao carregar');
    // On a silent background refresh, never discard local state on failure —
    // only the very first explicit load may fall back to defaults.
    if (!opts.silent) {
      showToast('⚠️ Erro ao carregar dados do GitHub');
      state = migrateState(null);
    }
    return false;
  } finally {
    syncBusy = false;
  }
}

// ══════════════════════════════════════════
// AUTO-SYNC (multi-device) — poll GitHub in the background so changes made
// on another device/browser show up here without a manual reload.
// ══════════════════════════════════════════
async function silentSync() {
  if (!ghToken || document.visibilityState === 'hidden') return;
  const ok = await loadFromGitHub({ silent: true, skipIfBusy: true });
  if (!ok) return;
  const activeScreen = document.querySelector('.screen.active');
  const activeId = activeScreen ? activeScreen.id.replace('-screen', '') : 'dash';
  updateDash();
  if (activeId === 'diet')     renderDiet();
  if (activeId === 'train')  { renderPlans(); renderCalendar(); renderTraining(); }
  if (activeId === 'health')   renderHealth();
  if (activeId === 'settings') renderSettings();
}

let autoSyncTimer = null;
function startAutoSync() {
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(silentSync, 45000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') silentSync();
  });
}

async function pushToGitHub() {
  setSyncStatus('syncing', 'a guardar...');
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
    const body = {
      message: `dbfit: update ${new Date().toISOString()}`,
      content,
      ...(dbSha ? { sha: dbSha } : {})
    };
    const res = await fetch(GH_API, {
      method: 'PUT',
      headers: {
        Authorization: `token ${ghToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      if (res.status === 409 || res.status === 422) {
        await loadFromGitHub();
        return await pushToGitHub();
      }
      throw new Error(err.message);
    }
    const data = await res.json();
    dbSha = data.content.sha;
    setSyncStatus('ok', 'guardado ✓');
    setTimeout(() => setSyncStatus('ok', 'sincronizado'), 2000);
    return true;
  } catch(e) {
    setSyncStatus('error', 'erro ao guardar');
    showToast('❌ Erro ao guardar: ' + e.message);
    return false;
  }
}

// ══════════════════════════════════════════
// APP INIT
// ══════════════════════════════════════════
async function initApp() {
  await loadFromGitHub();
  updateDash();
  renderHealth();
  renderSettings();
  renderPlans();
  renderCalendar();
  setupDate();
  startAutoSync();
}

// ══════════════════════════════════════════
// DATE / TOPBAR
// ══════════════════════════════════════════
const days   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const monthsFull = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function setupDate() {
  document.getElementById('date-chip').textContent =
    `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sc = document.getElementById(id + '-screen');
  if (sc) sc.classList.add('active');
  const nb = document.getElementById('nav-' + id);
  if (nb) nb.classList.add('active');
  if (id === 'diet')     renderDiet();
  if (id === 'train')  { renderPlans(); renderCalendar(); renderTraining(); }
  if (id === 'health')   renderHealth();
  if (id === 'dash')     updateDash();
  if (id === 'settings') renderSettings();
  document.getElementById('content').scrollTop = 0;
  silentSync(); // pull latest data from other devices in the background
}

// ══════════════════════════════════════════
// MODALS (generic open/close)
// ══════════════════════════════════════════
function openFoodModal(prefillMeal) {
  if (prefillMeal) document.getElementById('f-meal').value = prefillMeal;
  document.getElementById('food-modal').classList.add('open');
}
function openFoodModalForMeal(mi) {
  openFoodModal(state.meals[TODAY][mi].name);
}
function openHealthModal() { document.getElementById('health-modal').classList.add('open'); }
function closeModal(id)    { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
