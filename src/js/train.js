// ══════════════════════════════════════════
// TRAINING — PLAN BUILDER
// ══════════════════════════════════════════
let newPlanExercises = [];
let newPlanFreq = [];
let editingPlanId = null;

function openPlanModal(id) {
  editingPlanId = id || null;
  const plan = id ? state.workoutPlans.find(p => p.id === id) : null;
  document.getElementById('plan-modal-title').innerHTML =
    (plan ? `✏️ Editar treino #${plan.id}` : '🏋️ Novo treino') +
    ` <button class="modal-close" onclick="closeModal('plan-modal')">×</button>`;
  document.getElementById('p-name').value = plan ? plan.name : '';
  newPlanFreq = plan ? [...(plan.frequency || [])] : [];
  newPlanExercises = plan ? plan.exercises.map(e => ({...e})) : [];
  renderFreqDays();
  renderExerciseRows();
  document.getElementById('plan-modal').classList.add('open');
}

function renderFreqDays() {
  const dn = ['D','S','T','Q','Q','S','S'];
  document.getElementById('freq-days').innerHTML = dn.map((d, i) =>
    `<button type="button" class="day-toggle ${newPlanFreq.includes(i) ? 'selected' : ''}" onclick="toggleFreqDay(${i})">${d}</button>`
  ).join('');
}
function toggleFreqDay(i) {
  const idx = newPlanFreq.indexOf(i);
  if (idx === -1) newPlanFreq.push(i); else newPlanFreq.splice(idx, 1);
  renderFreqDays();
}

function renderExerciseRows() {
  const c = document.getElementById('plan-exercises-build');
  if (!newPlanExercises.length) {
    c.innerHTML = '<p style="color:var(--txt3);font-size:13px">Ainda sem exercícios.</p>';
    return;
  }
  c.innerHTML = newPlanExercises.map((e, i) => `
    <div class="ex-build-row">
      <input class="form-input" placeholder="Nome exercício" value="${esc(e.name||'')}" oninput="updateExerciseField(${i},'name',this.value)"/>
      <div class="form-row" style="margin-top:6px">
        <input type="number" class="form-input" placeholder="Séries" value="${e.series||''}" oninput="updateExerciseField(${i},'series',this.value)"/>
        <input class="form-input" placeholder="Reps (ex: 10–12)" value="${esc(e.reps||'')}" oninput="updateExerciseField(${i},'reps',this.value)"/>
      </div>
      <div class="form-row" style="margin-top:6px">
        <input class="form-input" placeholder="Carga (ex: 2x25kg)" value="${esc(e.carga||'')}" oninput="updateExerciseField(${i},'carga',this.value)"/>
        <input type="number" class="form-input" placeholder="Descanso (seg)" value="${e.descanso||''}" oninput="updateExerciseField(${i},'descanso',this.value)"/>
      </div>
      <button type="button" class="btn-secondary" style="margin-top:6px;padding:8px" onclick="removeExerciseRow(${i})">🗑 Remover exercício</button>
    </div>
  `).join('');
}
function updateExerciseField(i, field, val) {
  newPlanExercises[i][field] = (field === 'series' || field === 'descanso') ? (+val || 0) : val;
}
function addExerciseRow() {
  newPlanExercises.push({ name:'', series:3, reps:'10-12', carga:'', descanso:60 });
  renderExerciseRows();
}
function removeExerciseRow(i) {
  newPlanExercises.splice(i, 1);
  renderExerciseRows();
}

async function savePlan() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { showToast('⚠️ Indica o nome do treino'); return; }
  const exercises = newPlanExercises.filter(e => e.name && e.name.trim());
  if (editingPlanId) {
    const plan = state.workoutPlans.find(p => p.id === editingPlanId);
    plan.name = name; plan.frequency = [...newPlanFreq]; plan.exercises = exercises;
  } else {
    state.workoutPlans.push({ id: nextPlanId(), name, frequency: [...newPlanFreq], exercises });
  }
  closeModal('plan-modal');
  renderPlans(); renderCalendar(); updateDash();
  await pushToGitHub();
  showToast('✅ Treino guardado!');
}

async function deletePlan(id) {
  if (!confirm('Remover este treino?')) return;
  state.workoutPlans = state.workoutPlans.filter(p => p.id !== id);
  renderPlans(); renderCalendar(); updateDash();
  await pushToGitHub();
}

function renderPlans() {
  const list = document.getElementById('plans-list');
  const empty = document.getElementById('plans-empty');
  if (!state.workoutPlans.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const dayAbbr = ['D','S','T','Q','Q','S','S'];
  list.innerHTML = state.workoutPlans.map(p => `
    <div class="workout-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="workout-title">#${p.id} ${esc(p.name)}</div>
          <div class="workout-sub">${(p.frequency||[]).sort().map(d => dayAbbr[d]).join(' ') || 'Sem frequência definida'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="mg-icon-btn" style="width:28px;height:28px" onclick="openPlanModal(${p.id})">✏️</button>
          <button class="mg-icon-btn" style="width:28px;height:28px" onclick="deletePlan(${p.id})">🗑</button>
        </div>
      </div>
      ${(p.exercises||[]).length ? p.exercises.map(e => `
        <div class="exercise-row">
          <div class="ex-name">${esc(e.name)}</div>
          <div class="ex-chips">
            <span class="chip">${e.series}×${esc(e.reps)}</span>
            ${e.carga ? `<span class="chip chip-blue">${esc(e.carga)}</span>` : ''}
            ${e.descanso ? `<span class="chip chip-warn">⏱ ${e.descanso}s</span>` : ''}
          </div>
        </div>
      `).join('') : `<p style="color:var(--txt3);font-size:13px;margin-top:8px">Sem exercícios ainda.</p>`}
    </div>
  `).join('');
}

// ══════════════════════════════════════════
// TRAINING — CALENDAR
// ══════════════════════════════════════════
let calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);

function calShift(delta) {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendar() {
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth();
  document.getElementById('cal-month-lbl').textContent = `${monthsFull[m]} ${y}`;
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(y, m, 1 - startOffset);
  let html = ['D','S','T','Q','Q','S','S'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    const dk = fmtDate(d);
    const wd = d.getDay();
    const hasPlan = state.workoutPlans.some(p => (p.frequency||[]).includes(wd));
    const done = state.workoutLogs[dk] && state.workoutLogs[dk].length > 0;
    const isToday = dk === TODAY;
    const otherMonth = d.getMonth() !== m;
    html += `<div class="cal-cell ${hasPlan?'has-plan':''} ${done?'done':''} ${isToday?'today':''} ${otherMonth?'other-month':''}" onclick="openDayModal('${dk}')">${d.getDate()}</div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;
}

let dayModalDate = TODAY;
function openDayModal(dk) {
  dayModalDate = dk;
  const d = parseLocalDate(dk);
  const wd = d.getDay();
  const scheduled = state.workoutPlans.filter(p => (p.frequency||[]).includes(wd));
  const logs = state.workoutLogs[dk] || [];
  document.getElementById('day-modal-title').innerHTML =
    `📅 ${d.getDate()} ${monthsFull[d.getMonth()]} <button class="modal-close" onclick="closeModal('day-modal')">×</button>`;
  document.getElementById('day-modal-body').innerHTML = `
    <div style="margin-bottom:14px">
      <div class="form-label">Treino planeado</div>
      ${scheduled.length ? scheduled.map(p => `<span class="chip" style="margin-right:6px">${esc(p.name)}</span>`).join('') : '<span style="color:var(--txt3);font-size:13px">Nenhum treino agendado</span>'}
    </div>
    <div>
      <div class="form-label">Sessões registadas</div>
      ${logs.length ? logs.map((l, i) => `
        <div class="meal-entry" onclick="deleteTrainingAt('${dk}',${i})">
          <div class="meal-emoji">🏋️</div>
          <div class="meal-info"><div class="meal-name">${esc(l.planName)}</div><div class="meal-detail">${l.dur?l.dur+' min · ':''}${esc(l.intensity)}${l.notes?' · '+esc(l.notes.slice(0,40)):''}</div></div>
        </div>
      `).join('') : '<span style="color:var(--txt3);font-size:13px">Sem sessões registadas</span>'}
    </div>`;
  document.getElementById('day-modal').classList.add('open');
}

// ══════════════════════════════════════════
// TRAINING — LOG SESSIONS
// ══════════════════════════════════════════
let trainModalDate = TODAY;
let trainViewDate = TODAY;

function trainShiftDay(delta) {
  const next = shiftDate(trainViewDate, delta);
  if (next > TODAY) return;
  trainViewDate = next;
  renderTraining();
}

function openTrainModal(dateKey) {
  trainModalDate = dateKey || TODAY;
  const sel = document.getElementById('t-type');
  const planOpts = state.workoutPlans.map(p => `<option value="plan:${p.id}">${esc(p.name)}</option>`).join('');
  sel.innerHTML = planOpts + `<option>Cardio — Caminhada</option><option>Cardio — HIIT</option><option>Descanso ativo</option><option>Outro</option>`;
  document.getElementById('train-modal').classList.add('open');
}

async function addTraining() {
  const val = document.getElementById('t-type').value;
  let planId = null, planName = val;
  if (val.startsWith('plan:')) {
    planId = +val.slice(5);
    const p = state.workoutPlans.find(pp => pp.id === planId);
    planName = p ? p.name : val;
  }
  if (!state.workoutLogs[trainModalDate]) state.workoutLogs[trainModalDate] = [];
  state.workoutLogs[trainModalDate].push({
    planId, planName,
    dur: +document.getElementById('t-dur').value || 0,
    intensity: document.getElementById('t-int').value,
    notes: document.getElementById('t-notes').value.trim(),
    ts: Date.now()
  });
  closeModal('train-modal');
  document.getElementById('t-dur').value = '';
  document.getElementById('t-notes').value = '';
  renderTraining(); renderCalendar(); updateDash();
  await pushToGitHub();
  showToast('✅ Treino guardado!');
}

function renderTraining() {
  document.getElementById('train-date-label').textContent = dateNavLabel(trainViewDate);
  document.getElementById('train-next-btn').disabled = trainViewDate >= TODAY;

  const logs = state.workoutLogs[trainViewDate] || [];
  const le = document.getElementById('train-empty');
  const ll = document.getElementById('train-log-list');
  if (!logs.length) { le.style.display = 'block'; ll.innerHTML = ''; return; }
  le.style.display = 'none';
  ll.innerHTML = logs.map((l, i) => `
    <div class="meal-entry" onclick="deleteTrainingAt('${trainViewDate}',${i})">
      <div class="meal-emoji">🏋️</div>
      <div class="meal-info">
        <div class="meal-name">${esc(l.planName)}</div>
        <div class="meal-detail">${l.dur?l.dur+' min · ':''} ${esc(l.intensity)}${l.notes?' · '+esc(l.notes.slice(0,40)):''}</div>
      </div>
      <span class="chip chip-warn" style="flex-shrink:0">${esc(l.intensity)}</span>
    </div>
  `).join('');
}

async function deleteTrainingAt(dk, idx) {
  if (!confirm('Remover esta sessão?')) return;
  state.workoutLogs[dk].splice(idx, 1);
  if (!state.workoutLogs[dk].length) delete state.workoutLogs[dk];
  renderCalendar();
  renderTraining();
  updateDash();
  if (document.getElementById('day-modal').classList.contains('open')) openDayModal(dk);
  await pushToGitHub();
}
