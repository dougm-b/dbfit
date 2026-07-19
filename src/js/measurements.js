// ══════════════════════════════════════════
// MEDIDAS CORPORAIS — cards totalmente livres definidos pelo utilizador
// (cintura, peito, braço, etc.), cada um com o seu próprio histórico e
// gráfico na página de detalhe (?measurement=<id>)
// ══════════════════════════════════════════
function nextMeasurementId() {
  const ids = state.measurements.defs.map(d => d.id);
  let n = 1;
  while (ids.includes('m' + n)) n++;
  return 'm' + n;
}

function measurementLatestValue(id) {
  const dates = Object.keys(state.measurements.history)
    .filter(d => state.measurements.history[d][id] !== undefined)
    .sort();
  if (!dates.length) return null;
  return state.measurements.history[dates[dates.length - 1]][id];
}

function measurementSeries(id) {
  return Object.entries(state.measurements.history)
    .filter(([, day]) => day[id] !== undefined)
    .map(([date, day]) => ({ date, value: day[id] }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function renderMeasurements() {
  const defs = state.measurements.defs;
  const list = document.getElementById('measurements-list');
  const empty = document.getElementById('measurements-empty');
  if (!list || !empty) return; // página sem a secção de medidas (ex: detail.html)
  if (!defs.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = defs.map(d => {
    const v = measurementLatestValue(d.id);
    return `
    <div class="health-box" onclick="goToMeasurement('${d.id}')">
      <div class="health-lbl">${esc(d.name)}</div>
      <div class="health-val">${v === null || v === undefined ? '—' : fmtMeasureVal(v)}<span style="font-size:13px;color:var(--txt3)"> ${esc(d.unit || '')}</span></div>
      <div class="health-status" style="color:var(--txt3)">toca para ver histórico</div>
    </div>`;
  }).join('');
}

function fmtMeasureVal(v) {
  return (Math.round(v * 10) / 10).toLocaleString('pt-PT');
}

function openMeasurementModal() {
  const sel = document.getElementById('ms-type');
  sel.innerHTML = state.measurements.defs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')
    + `<option value="__new__">+ Nova medida…</option>`;
  sel.value = state.measurements.defs.length ? state.measurements.defs[0].id : '__new__';
  document.getElementById('ms-value').value = '';
  document.getElementById('ms-new-name').value = '';
  document.getElementById('ms-new-unit').value = '';
  toggleMeasurementNewFields();
  document.getElementById('measurement-modal').classList.add('open');
}

function toggleMeasurementNewFields() {
  const isNew = document.getElementById('ms-type').value === '__new__';
  document.getElementById('ms-new-fields').style.display = isNew ? 'block' : 'none';
}

async function saveMeasurement() {
  const sel = document.getElementById('ms-type');
  const value = +document.getElementById('ms-value').value;
  if (!value && value !== 0) { showToast('⚠️ Indica um valor'); return; }

  let id = sel.value;
  if (id === '__new__') {
    const name = document.getElementById('ms-new-name').value.trim();
    if (!name) { showToast('⚠️ Indica o nome da medida'); return; }
    const unit = document.getElementById('ms-new-unit').value.trim();
    id = nextMeasurementId();
    state.measurements.defs.push({ id, name, unit });
  }

  if (!state.measurements.history[TODAY]) state.measurements.history[TODAY] = {};
  state.measurements.history[TODAY][id] = value;

  closeModal('measurement-modal');
  renderMeasurements();
  await pushToGitHub();
  showToast('✅ Medida guardada!');
}

async function deleteMeasurementDef(id) {
  if (!confirm('Remover esta medida e todo o seu histórico?')) return false;
  state.measurements.defs = state.measurements.defs.filter(d => d.id !== id);
  Object.values(state.measurements.history).forEach(day => { delete day[id]; });
  renderMeasurements();
  await pushToGitHub();
  return true;
}

function goToMeasurement(id) {
  rememberReturnScreen();
  location.href = 'detail.html?measurement=' + encodeURIComponent(id);
}
