// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
let dashViewDate = TODAY;

function dashShiftDay(delta) {
  const next = shiftDate(dashViewDate, delta);
  if (next > TODAY) return; // não navega para o futuro
  dashViewDate = next;
  updateDash();
}

function updateFlameIcon(perf) {
  const flame = document.getElementById('flame-icon');
  if (!flame) return;
  flame.classList.remove('flame-pulse', 'flame-gold');
  if (perf.score === null) { flame.style.color = 'var(--good)'; return; }
  flame.style.color = perf.score >= 100 ? 'var(--gold)' : perf.color;
  if (perf.score >= 100) flame.classList.add('flame-gold');
  if (perf.score >= 80) flame.classList.add('flame-pulse');
}

function dashGoToDate(dk) {
  if (dk > TODAY) return;
  dashViewDate = dk;
  updateDash();
}

function renderWeekStrip() {
  const strip = document.getElementById('week-strip');
  if (!strip) return;
  const items = [];
  for (let i = 6; i >= 0; i--) {
    const dk = shiftDate(TODAY, -i);
    const d = parseLocalDate(dk);
    const perf = computeDailyScore(dk);
    const color = perf.score === null ? 'var(--g4)' : (perf.score >= 100 ? 'var(--gold)' : perf.color);
    const filled = perf.score !== null;
    const viewing = dk === dashViewDate;
    items.push(`
      <div class="week-day${viewing ? ' viewing' : ''}" onclick="dashGoToDate('${dk}')">
        <div class="week-day-dot${filled ? ' filled' : ''}" style="background:${color}${filled ? `;box-shadow:0 0 8px ${color}55` : ''}"></div>
        <div class="week-day-lbl${dk === TODAY ? ' today' : ''}">${days[d.getDay()]}</div>
      </div>
    `);
  }
  strip.innerHTML = items.join('');
}

function openScoreBreakdown() {
  const perf = computeDailyScore(dashViewDate);
  document.getElementById('score-breakdown-date').textContent = dateNavLabel(dashViewDate);
  const list = document.getElementById('score-breakdown-list');
  const empty = document.getElementById('score-breakdown-empty');
  if (!perf.breakdown.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    const ALL_LABELS = ['Bioimpedância', 'Alimentação', 'Treino', 'Sono (noite anterior)', 'Evolução'];
    const present = perf.breakdown.map(p => p.label);
    const missing = ALL_LABELS.filter(l => !present.includes(l));
    list.innerHTML = perf.breakdown.map(part => {
      const score = Math.round(part.score);
      const tier = scoreTierFor(score);
      return `
        <div class="breakdown-row">
          <div class="breakdown-hdr">
            <span class="b-label">${esc(part.label)} <span style="color:var(--txt3);font-weight:400">(peso ${part.effWeight}%)</span></span>
            <span class="b-score" style="color:${tier.color}">${score}</span>
          </div>
          <div class="progress-bar breakdown-bar"><div class="progress-fill" style="width:${score}%;background:${tier.color}"></div></div>
        </div>
      `;
    }).join('') + (missing.length ? `
      <p style="font-size:11px;color:var(--txt3);margin-top:4px">Sem dados de ${missing.map(l => l.toLowerCase()).join(', ')} neste dia — o peso foi redistribuído pelos restantes indicadores (soma sempre 100%).</p>` : '');
  }
  document.getElementById('score-breakdown-modal').classList.add('open');
}

function updateDash() {
  document.getElementById('dash-date-label').textContent = dateNavLabel(dashViewDate);
  document.getElementById('dash-next-btn').disabled = dashViewDate >= TODAY;

  const totals = dayTotals(dashViewDate);
  const g = state.settings;
  const h = healthObjForDate(dashViewDate);

  const perf = computeDailyScore(dashViewDate);
  const scoreNum = document.getElementById('score-num');
  const scoreLabel = document.getElementById('score-label');
  const scoreBar = document.getElementById('score-bar');
  if (scoreNum) {
    scoreNum.textContent = perf.score === null ? '—' : perf.score;
    scoreNum.style.color = perf.color;
    scoreLabel.textContent = perf.label;
    scoreLabel.style.color = perf.color;
    scoreBar.style.width = (perf.score || 0) + '%';
    scoreBar.style.background = perf.color;
  }
  // O ícone de chama no topo reflete sempre o dia real de hoje, independente
  // da data que está a ser navegada no dashboard.
  updateFlameIcon(dashViewDate === TODAY ? perf : computeDailyScore(TODAY));
  renderWeekStrip();

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

  const pesoNum = parseFloat(String(h.peso).replace(',', '.'));
  if (!isNaN(pesoNum)) {
    const alturaM = (h.altura || state.health.altura || 184) / 100;
    const imc = (pesoNum / (alturaM * alturaM)).toFixed(1);
    document.getElementById('dash-peso').innerHTML = Math.floor(pesoNum) + `<span style="font-size:16px">.${String(pesoNum.toFixed(1)).split('.')[1]}</span>`;
    const cls = classifyIMC(+imc);
    const badge = document.getElementById('dash-imc');
    badge.className = 'stat-badge ' + cls.cls;
    badge.textContent = 'IMC ' + imc;
  } else {
    document.getElementById('dash-peso').textContent = '—';
    document.getElementById('dash-imc').textContent = 'Sem dados';
    document.getElementById('dash-imc').className = 'stat-badge';
  }
  const gcNum = parseFloat(String(h.gc).replace(',', '.'));
  const gcBadge = document.getElementById('dash-gc-badge');
  if (!isNaN(gcNum)) {
    document.getElementById('dash-gc').innerHTML = Math.floor(gcNum) + `<span style="font-size:16px">%</span>`;
    const gcStatus = classifyMetricValue('gc', gcNum);
    if (gcStatus && gcBadge) {
      gcBadge.className = 'stat-badge ' + gcStatus.cls;
      gcBadge.textContent = `${gcStatus.emoji} Meta: 18–22%`;
    }
  } else {
    document.getElementById('dash-gc').textContent = '—';
    if (gcBadge) { gcBadge.className = 'stat-badge'; gcBadge.textContent = 'Sem dados'; }
  }
  const muscNum = parseFloat(String(h.musc).replace(',', '.'));
  document.getElementById('ring-musc').textContent = !isNaN(muscNum) ? h.musc : '—';
  document.getElementById('ring-musc-txt').textContent = !isNaN(muscNum) ? Math.round(muscNum) : '—';
  const gvNum = parseFloat(h.gv);
  document.getElementById('ring-gv').textContent = !isNaN(gvNum) ? 'Nível ' + h.gv : '—';
  document.getElementById('ring-gv-txt').textContent = !isNaN(gvNum) ? h.gv : '—';

  const weekday = parseLocalDate(dashViewDate).getDay();
  const scheduled = state.workoutPlans.filter(p => (p.frequency||[]).includes(weekday));
  const planNames = scheduled.length ? scheduled.map(p => esc(p.name)).join(', ') : 'Sem treino agendado';
  const done = state.workoutLogs[dashViewDate] && state.workoutLogs[dashViewDate].length > 0;
  document.getElementById('today-workout-info').innerHTML =
    `<span style="color:var(--acc2);font-weight:600">${planNames}</span><br>
     <span style="color:${done?'var(--good)':'var(--txt3)'}">
       ${done ? '✅ Treino registado!' : '⏳ Por registar'}
     </span>`;

  const passos = h.passos || 0;
  document.getElementById('dash-passos').textContent = passos.toLocaleString('pt-PT');
  const passosStatus = classifyMetricValue('passos', passos);
  const passosBadge = document.getElementById('dash-passos-badge');
  if (passosStatus && passosBadge) {
    passosBadge.className = 'stat-badge ' + passosStatus.cls;
    passosBadge.textContent = `${passosStatus.emoji} Meta: 8.000+`;
  }

  document.getElementById('goal-agua-txt').textContent = `${g.metaAgua}+ litros/dia`;
  document.getElementById('goal-prot-txt').textContent = `${Math.round(g.metaProt*0.95)}–${g.metaProt} g`;
  document.getElementById('goal-kcal-txt').textContent = `${Math.round(g.metaKcal*0.95)}–${Math.round(g.metaKcal*1.05)} kcal`;
  const totalDays = new Set(state.workoutPlans.flatMap(p => p.frequency || [])).size;
  document.getElementById('goal-cardio-txt').textContent = `${totalDays}x/semana`;
}
