// ══════════════════════════════════════════
// BIOIMPEDÂNCIA
// ══════════════════════════════════════════
let healthViewDate = TODAY;

function healthShiftDay(delta) {
  const next = shiftDate(healthViewDate, delta);
  if (next > TODAY) return; // não navega para o futuro
  healthViewDate = next;
  renderHealth();
}

function setHealthField(valueId, statusId, h, key, format, defaultColor) {
  const valueEl = document.getElementById(valueId);
  const statusEl = statusId && document.getElementById(statusId);
  const raw = h[key];
  if (raw === undefined || raw === null || raw === '') {
    valueEl.textContent = '—';
    valueEl.style.color = 'var(--txt3)';
    if (statusEl) { statusEl.textContent = 'Sem dados neste dia'; statusEl.style.color = 'var(--txt3)'; }
    return false;
  }
  valueEl.textContent = format ? format(raw) : raw;
  valueEl.style.color = defaultColor || '';
  return true;
}

function renderHealth() {
  document.getElementById('health-date-label').textContent = dateNavLabel(healthViewDate);
  document.getElementById('health-next-btn').disabled = healthViewDate >= TODAY;

  const h = healthObjForDate(healthViewDate);

  setHealthField('h-peso', null, h, 'peso');
  if (setHealthField('h-gc', 'h-gc-status', h, 'gc')) applyMetricStatus('gc', 'h-gc', 'h-gc-status', h);
  setHealthField('h-musc', null, h, 'musc', null, 'var(--good)');
  if (setHealthField('h-gv', 'h-gv-status', h, 'gv')) applyMetricStatus('gv', 'h-gv', 'h-gv-status', h);
  setHealthField('h-me', null, h, 'me', null, 'var(--good)');
  if (setHealthField('h-prot', 'h-prot-status', h, 'prot')) applyMetricStatus('prot', 'h-prot', 'h-prot-status', h);
  if (setHealthField('h-agua', 'h-agua-status', h, 'agua')) applyMetricStatus('agua', 'h-agua', 'h-agua-status', h);
  setHealthField('h-met', null, h, 'met', null, 'var(--txt)');
  setHealthField('h-idade', null, h, 'idade', null, 'var(--good)');
  if (setHealthField('h-ossea', 'h-ossea-status', h, 'ossea')) applyMetricStatus('ossea', 'h-ossea', 'h-ossea-status', h);
  if (setHealthField('h-fc', 'h-fc-status', h, 'fc', v => v + ' bpm')) applyMetricStatus('fc', 'h-fc', 'h-fc-status', h);
  if (setHealthField('h-passos', 'h-passos-status', h, 'passos', v => (v || 0).toLocaleString('pt-PT'))) {
    applyMetricStatus('passos', 'h-passos', 'h-passos-status', h);
  }

  const pesoNum = parseFloat(String(h.peso).replace(',', '.'));
  const alturaM = (h.altura || state.health.altura || 184) / 100;
  const pesoSt = document.getElementById('h-peso-status');
  if (!isNaN(pesoNum)) {
    const imc = (pesoNum / (alturaM * alturaM)).toFixed(1);
    const cls = classifyIMC(+imc);
    pesoSt.textContent = `IMC ${imc} · ${cls.label}`;
    pesoSt.style.color = cls.color;
  } else {
    pesoSt.textContent = 'Sem dados neste dia';
    pesoSt.style.color = 'var(--txt3)';
  }

  if (apiKey) document.getElementById('api-key-input').value = apiKey.slice(0,8) + '...';
  renderMeasurements();
}

function openHealthModal() {
  const h = healthObjForDate(healthViewDate);
  const fields = { peso:'h-peso-i', gc:'h-gc-i', musc:'h-musc-i', gv:'h-gv-i', me:'h-me-i', prot:'h-prot-i', agua:'h-agua-i', met:'h-met-i', fc:'h-fc-i', passos:'h-passos-i' };
  Object.entries(fields).forEach(([key, id]) => {
    const raw = h[key];
    const input = document.getElementById(id);
    if (raw === undefined || raw === null || raw === '') { input.value = ''; return; }
    input.value = parseFloat(String(raw).replace(',', '.'));
  });
  document.getElementById('health-modal').classList.add('open');
}

async function saveHealth() {
  const fields = {
    peso: document.getElementById('h-peso-i').value,
    gc:   document.getElementById('h-gc-i').value,
    musc: document.getElementById('h-musc-i').value,
    gv:   document.getElementById('h-gv-i').value,
    me:   document.getElementById('h-me-i').value,
    prot: document.getElementById('h-prot-i').value,
    agua: document.getElementById('h-agua-i').value,
    met:  document.getElementById('h-met-i').value,
    fc:   document.getElementById('h-fc-i').value,
    passos: document.getElementById('h-passos-i').value,
  };
  const isToday = healthViewDate === TODAY;
  if (!isToday && !state.healthHistory[healthViewDate]) state.healthHistory[healthViewDate] = {};
  const target = isToday ? state.health : state.healthHistory[healthViewDate];

  if (fields.peso) target.peso = fields.peso + ' kg';
  if (fields.gc)   target.gc   = fields.gc + '%';
  if (fields.musc) target.musc = fields.musc + ' kg';
  if (fields.gv)   target.gv   = fields.gv;
  if (fields.me)   target.me   = fields.me + ' kg';
  if (fields.prot) target.prot = fields.prot + '%';
  if (fields.agua) target.agua = fields.agua + '%';
  if (fields.met)  target.met  = fields.met;
  if (fields.fc)      target.fc = +fields.fc;
  if (fields.passos)  target.passos = +fields.passos;
  if (isToday) snapshotHealthHistory(TODAY);

  closeModal('health-modal');
  renderHealth(); updateDash();
  await pushToGitHub();
  showToast('✅ Dados de bioimpedância atualizados!');
}

function goToMetric(id) {
  location.href = 'detail.html?metric=' + encodeURIComponent(id);
}
