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

// ── Hipnograma: linha do tempo da noite, com um nível por fase ──
const SLEEP_STAGE_LEVELS = { a: 0, r: 1, l: 2, d: 3 }; // acordado no topo, profundo em baixo
const SLEEP_STAGE_COLORS = { a: 'var(--warn)', r: '#c084fc', l: 'var(--blue)', d: 'var(--acc)' };

function sleepHypnogramSvg(stages) {
  const W = 600, H = 130, PAD_TOP = 8, ROW = 28, BAR = 20;
  const totalMin = stages.reduce((a, s) => Math.max(a, s[0] + s[1]), 0);
  if (!totalMin) return '';
  const x = min => (min / totalMin) * W;
  let out = '';
  // linhas de grelha a cada hora
  for (let m = 60; m < totalMin; m += 60) {
    out += `<line x1="${x(m).toFixed(1)}" y1="0" x2="${x(m).toFixed(1)}" y2="${H}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>`;
  }
  stages.forEach(([off, dur, code]) => {
    const lvl = SLEEP_STAGE_LEVELS[code];
    if (lvl === undefined) return;
    const y = PAD_TOP + lvl * ROW;
    out += `<rect x="${x(off).toFixed(1)}" y="${y}" width="${Math.max(1.5, x(dur)).toFixed(1)}" height="${BAR}" rx="2" fill="${SLEEP_STAGE_COLORS[code]}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${out}</svg>`;
}

// ── Leitura descritiva da noite: impacto no dia seguinte + possíveis motivos ──
function sleepInsights(rec, date) {
  const impact = [], causes = [];
  const dur = rec.duration;
  const totalMin = dur * 60;
  const hasStages = (rec.deep || 0) + (rec.rem || 0) + (rec.light || 0) > 0;
  const deepPct = hasStages ? (rec.deep || 0) / totalMin : null;
  const remPct = hasStages ? (rec.rem || 0) / totalMin : null;
  const awakeMin = rec.awake || 0;

  // Duração
  if (dur < 6) {
    impact.push('⚠️ Dormiste menos de 6 horas — espera mais fome e apetite por doces (a grelina sobe e a leptina desce), menos força e foco no treino, e pior sensibilidade à insulina ao longo do dia.');
  } else if (dur < 7) {
    impact.push('🟡 Ficaste ligeiramente abaixo das 7 horas recomendadas — pode haver alguma quebra de energia e de foco à tarde; se puderes, evita decisões alimentares por impulso.');
  } else if (dur <= 9) {
    impact.push('✅ Duração dentro da faixa recomendada (7–9h) — boas condições para recuperação muscular, controlo do apetite e energia estável durante o dia.');
  } else {
    impact.push('🟡 Mais de 9 horas de sono — dormir demais de forma recorrente pode ser sinal de sono pouco reparador ou de fadiga acumulada, e costuma deixar uma sensação de lentidão ao acordar.');
  }

  // Fases
  if (deepPct !== null) {
    if (deepPct < 0.10) {
      impact.push('💪 Pouco sono profundo (' + fmtMin(rec.deep) + ') — é nesta fase que há maior libertação de hormona de crescimento e recuperação física; os músculos podem sentir-se mais pesados e a recuperação do treino fica mais lenta.');
    } else if (deepPct >= 0.15) {
      impact.push('💪 Boa dose de sono profundo (' + fmtMin(rec.deep) + ') — recuperação física favorecida; bom dia para treinar com intensidade.');
    }
    if (remPct !== null && remPct < 0.15) {
      impact.push('🧠 Pouco sono REM (' + fmtMin(rec.rem) + ') — esta fase consolida memória e humor; podes notar menos paciência e mais dificuldade de concentração.');
    } else if (remPct !== null && remPct >= 0.20) {
      impact.push('🧠 Sono REM em boa quantidade (' + fmtMin(rec.rem) + ') — memória e humor bem servidos.');
    }
  }
  if (awakeMin > 30) {
    impact.push('⏰ Estiveste acordado ' + fmtMin(awakeMin) + ' durante a noite — sono fragmentado reduz a qualidade mesmo com duração razoável; pode haver sonolência diurna.');
  }

  // Possíveis motivos
  const startedLate = rec.start && rec.start >= '00:00' && rec.start < '05:00';
  if (dur < 7 && startedLate) {
    causes.push('🌙 Foste dormir tarde (' + rec.start + ') — o motivo mais provável para a noite curta é simplesmente a hora de deitar, não a qualidade do sono em si.');
  } else if (dur < 7) {
    causes.push('⏱️ Noite curta — se o despertar foi por alarme, tentar antecipar a hora de deitar é a alavanca mais eficaz.');
  }
  if (deepPct !== null && deepPct < 0.10) {
    causes.push('🍷 Sono profundo reduzido costuma estar associado a: álcool ou cafeína ao fim do dia, refeição pesada perto de deitar, quarto quente, ou stress elevado.');
  }
  if (awakeMin > 30) {
    causes.push('💡 Despertares frequentes podem vir de ruído ou luz no quarto, líquidos em excesso antes de deitar, ou temperatura desconfortável. Se for um padrão recorrente (com ressonar ou cansaço constante), vale a pena falar com um médico sobre apneia do sono.');
  }
  if (date && state.workoutLogs[date] && state.workoutLogs[date].length && deepPct !== null && deepPct >= 0.15) {
    causes.push('🏋️ Treinaste neste dia — exercício regular é dos fatores que mais aumenta o sono profundo, e parece ter ajudado.');
  }
  if (!causes.length) {
    causes.push('✅ Nada fora do padrão a apontar — manter um horário de deitar consistente é o que mais protege noites como esta.');
  }
  return { impact, causes };
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
  // Cada registo é a noite que TERMINOU na manhã desta data (começou na
  // véspera, salvo se só adormeceste depois da meia-noite) — e é essa noite
  // que conta para o desempenho deste dia.
  const nightFrom = (!rec.start || rec.start >= '12:00') ? dateNavLabel(shiftDate(sleepViewDate, -1)) : dateNavLabel(sleepViewDate);
  document.getElementById('sleep-night-lbl').textContent =
    `Noite de ${nightFrom.toLowerCase()} → acordar ${dateNavLabel(sleepViewDate).toLowerCase()} · conta para o desempenho deste dia`;
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

  // Hipnograma — só quando há a linha do tempo detalhada (dados importados)
  const chartCard = document.getElementById('sleep-chart-card');
  if (rec.stages && rec.stages.length) {
    chartCard.style.display = 'block';
    document.getElementById('sleep-hypnogram').innerHTML = sleepHypnogramSvg(rec.stages);
    document.getElementById('sleep-start-lbl').textContent = rec.start ? '🛏️ ' + rec.start : '';
    document.getElementById('sleep-end-lbl').textContent = rec.end ? '⏰ ' + rec.end : '';
  } else {
    chartCard.style.display = 'none';
  }

  // Leitura descritiva da noite
  const insights = sleepInsights(rec, sleepViewDate);
  document.getElementById('sleep-impact').innerHTML = insights.impact.map(t => `<p style="margin-bottom:8px">${t}</p>`).join('');
  document.getElementById('sleep-causes').innerHTML = insights.causes.map(t => `<p style="margin-bottom:8px">${t}</p>`).join('');
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
  // Mantém start/end/stages importados, se existirem — só atualiza os totais
  state.sleepHistory[sleepViewDate] = Object.assign({}, state.sleepHistory[sleepViewDate] || {}, {
    duration,
    light: +document.getElementById('s-light-i').value || 0,
    deep:  +document.getElementById('s-deep-i').value  || 0,
    rem:   +document.getElementById('s-rem-i').value   || 0,
    awake: +document.getElementById('s-awake-i').value || 0,
  });
  closeModal('sleep-modal');
  renderSleep();
  updateDash();
  await pushToGitHub();
  showToast('✅ Sono registado!');
}
