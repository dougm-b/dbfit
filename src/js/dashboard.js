// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function updateDash() {
  const totals = dayTotals(TODAY);
  const g = state.settings;
  document.getElementById('m-kcal').textContent = totals.kcal;
  document.getElementById('m-prot').textContent = totals.prot + 'g';
  document.getElementById('m-carb').textContent = totals.carb + 'g';
  document.getElementById('m-fat').textContent  = totals.fat  + 'g';
  document.getElementById('m-kcal-lbl').textContent = `kcal / ${g.metaKcal}`;
  document.getElementById('m-prot-lbl').textContent = `prot / ${g.metaProt}g`;
  document.getElementById('m-carb-lbl').textContent = `carb / ${g.metaCarb}g`;
  document.getElementById('m-fat-lbl').textContent  = `gord / ${g.metaFat}g`;

  const protPct = g.metaProt ? Math.min(100, Math.round(totals.prot / g.metaProt * 100)) : 0;
  const kcalPct = g.metaKcal ? Math.min(100, Math.round(totals.kcal / g.metaKcal * 100)) : 0;
  document.getElementById('prot-bar').style.width  = protPct + '%';
  document.getElementById('kcal-bar').style.width  = kcalPct + '%';
  document.getElementById('prot-pct').textContent  = protPct + '%';
  document.getElementById('kcal-pct').textContent  = kcalPct + '%';

  const h = state.health;
  const pesoNum = parseFloat(String(h.peso).replace(',', '.'));
  if (!isNaN(pesoNum)) {
    const alturaM = (h.altura || 184) / 100;
    const imc = (pesoNum / (alturaM * alturaM)).toFixed(1);
    document.getElementById('dash-peso').innerHTML = Math.floor(pesoNum) + `<span style="font-size:16px">.${String(pesoNum.toFixed(1)).split('.')[1]}</span>`;
    const cls = classifyIMC(+imc);
    const badge = document.getElementById('dash-imc');
    badge.className = 'stat-badge ' + cls.cls;
    badge.textContent = 'IMC ' + imc;
  }
  const gcNum = parseFloat(String(h.gc).replace(',', '.'));
  if (!isNaN(gcNum)) {
    document.getElementById('dash-gc').innerHTML = Math.floor(gcNum) + `<span style="font-size:16px">%</span>`;
  }
  const muscNum = parseFloat(String(h.musc).replace(',', '.'));
  if (!isNaN(muscNum)) {
    document.getElementById('ring-musc').textContent = h.musc;
    document.getElementById('ring-musc-txt').textContent = Math.round(muscNum);
  }
  const gvNum = parseFloat(h.gv);
  if (!isNaN(gvNum)) {
    document.getElementById('ring-gv').textContent = 'Nível ' + h.gv;
    document.getElementById('ring-gv-txt').textContent = h.gv;
  }

  const scheduled = state.workoutPlans.filter(p => (p.frequency||[]).includes(now.getDay()));
  const planNames = scheduled.length ? scheduled.map(p => esc(p.name)).join(', ') : 'Sem treino agendado';
  const done = state.workoutLogs[TODAY] && state.workoutLogs[TODAY].length > 0;
  document.getElementById('today-workout-info').innerHTML =
    `<span style="color:var(--acc2);font-weight:600">${planNames}</span><br>
     <span style="color:${done?'var(--acc)':'var(--txt3)'}">
       ${done ? '✅ Treino registado!' : '⏳ Por registar'}
     </span>`;

  document.getElementById('goal-agua-txt').textContent = `${g.metaAgua}+ litros/dia`;
  document.getElementById('goal-prot-txt').textContent = `${Math.round(g.metaProt*0.95)}–${g.metaProt} g`;
  document.getElementById('goal-kcal-txt').textContent = `${Math.round(g.metaKcal*0.95)}–${Math.round(g.metaKcal*1.05)} kcal`;
  const totalDays = new Set(state.workoutPlans.flatMap(p => p.frequency || [])).size;
  document.getElementById('goal-cardio-txt').textContent = `${totalDays}x/semana`;
}
