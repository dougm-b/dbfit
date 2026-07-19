// ══════════════════════════════════════════
// SONO
// ══════════════════════════════════════════
let sleepViewDate = TODAY;

function sleepShiftDay(delta) {
  const next = shiftDate(sleepViewDate, delta);
  if (next > TODAY) return; // não navega para o futuro
  sleepViewDate = next;
  renderSleep();
}

function fmtMin(min) {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}

function renderSleep() {
  document.getElementById('sleep-date-label').textContent = dateNavLabel(sleepViewDate);
  document.getElementById('sleep-next-btn').disabled = sleepViewDate >= TODAY;

  const rec = state.sleepHistory[sleepViewDate];
  const content = document.getElementById('sleep-content');
  const empty = document.getElementById('sleep-empty');
  if (!rec || !rec.duration) {
    content.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  content.style.display = 'block';
  empty.style.display = 'none';

  const h = Math.floor(rec.duration), m = Math.round((rec.duration - h) * 60);
  document.getElementById('sleep-duration').textContent = `${h}h${String(m).padStart(2,'0')}`;
  const status = classifyByRange(rec.duration, SLEEP_RANGE);
  const badge = document.getElementById('sleep-duration-badge');
  if (status) {
    badge.className = 'stat-badge ' + status.cls;
    badge.textContent = `${status.emoji} Meta: 7–9h`;
  }

  const stages = [
    { key: 'light', txt: 'sleep-light-txt', bar: 'sleep-light-bar' },
    { key: 'deep',  txt: 'sleep-deep-txt',  bar: 'sleep-deep-bar' },
    { key: 'rem',   txt: 'sleep-rem-txt',   bar: 'sleep-rem-bar' },
    { key: 'awake', txt: 'sleep-awake-txt', bar: 'sleep-awake-bar' },
  ];
  const totalMin = rec.duration * 60;
  stages.forEach(s => {
    const val = rec[s.key];
    document.getElementById(s.txt).textContent = fmtMin(val);
    const pct = val && totalMin ? Math.min(100, Math.round(val / totalMin * 100)) : 0;
    document.getElementById(s.bar).style.width = pct + '%';
  });
}

function openSleepModal() {
  const rec = state.sleepHistory[sleepViewDate] || {};
  document.getElementById('s-duration-i').value = rec.duration || '';
  document.getElementById('s-light-i').value = rec.light || '';
  document.getElementById('s-deep-i').value = rec.deep || '';
  document.getElementById('s-rem-i').value = rec.rem || '';
  document.getElementById('s-awake-i').value = rec.awake || '';
  document.getElementById('sleep-modal').classList.add('open');
}

async function saveSleep() {
  const duration = parseFloat(document.getElementById('s-duration-i').value);
  if (!duration) { showToast('⚠️ Indica as horas dormidas'); return; }
  if (!state.sleepHistory) state.sleepHistory = {};
  state.sleepHistory[sleepViewDate] = {
    duration,
    light: +document.getElementById('s-light-i').value || 0,
    deep:  +document.getElementById('s-deep-i').value  || 0,
    rem:   +document.getElementById('s-rem-i').value   || 0,
    awake: +document.getElementById('s-awake-i').value || 0,
  };
  closeModal('sleep-modal');
  renderSleep();
  updateDash();
  await pushToGitHub();
  showToast('✅ Sono registado!');
}
