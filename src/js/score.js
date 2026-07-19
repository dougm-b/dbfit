// ══════════════════════════════════════════
// NOTA DE DESEMPENHO DIÁRIO — cruza bioimpedância, alimentação, treino,
// sono e evolução face aos dias anteriores num único valor 0–100. Usado
// pela barra de progresso do Dashboard, pelo detalhe por categoria, e pela
// cor/animação do ícone de chama no topo.
//
// Pesos (ajustáveis): bioimpedância 25%, alimentação 20%, treino 20%,
// sono 15%, evolução 20%. Uma componente sem dados disponíveis é ignorada
// e o peso das restantes é redistribuído (não penaliza por falta de registo).
// ══════════════════════════════════════════
const SCORE_TIERS = [
  { min: 90, tier: 'blue',   color: 'var(--blue)',   label: 'Excecional' },
  { min: 75, tier: 'green',  color: 'var(--good)',   label: 'Muito bom' },
  { min: 55, tier: 'yellow', color: 'var(--caution)',label: 'Ok' },
  { min: 35, tier: 'orange', color: 'var(--warn)',   label: 'Precisa de atenção' },
  { min: 0,  tier: 'red',    color: 'var(--red)',    label: 'Fraco' }
];
const SLEEP_RANGE = [7, 9]; // horas

function scoreTierFor(score) {
  if (score >= 100) return { min: 100, tier: 'gold', color: 'var(--gold)', label: 'Perfeito' };
  return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

function avgOf(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

const BIO_TIER_SCORE = { 'badge-ok': 100, 'badge-caution': 70, 'badge-warn': 40, 'badge-red': 10 };

function computeDailyScore(date) {
  date = date || TODAY;
  const parts = [];
  const h = healthObjForDate(date);

  // 1. Bioimpedância: média dos níveis de intensidade dos indicadores com faixa definida
  const bioIds = ['gc', 'gv', 'prot', 'agua', 'fc', 'passos'];
  const bioScores = bioIds
    .map(id => classifyMetricValue(id, metricValue(id, h)))
    .filter(Boolean)
    .map(s => BIO_TIER_SCORE[s.cls]);
  if (bioScores.length) parts.push({ score: avgOf(bioScores), weight: 25, label: 'Bioimpedância' });

  // 2. Alimentação: proximidade às metas de calorias e proteína do dia
  const totals = dayTotals(date);
  const g = state.settings;
  if (totals.kcal > 0) {
    const kcalDevPct = Math.abs(totals.kcal - g.metaKcal) / g.metaKcal;
    const kcalScore = Math.max(0, 100 - kcalDevPct * 150);
    const protScore = Math.min(100, (totals.prot / g.metaProt) * 100);
    parts.push({ score: (kcalScore + protScore) / 2, weight: 20, label: 'Alimentação' });
  }

  // 3. Treino: sessão registada nesse dia (bónus se treinou num dia sem plano agendado)
  const weekday = parseLocalDate(date).getDay();
  const scheduled = state.workoutPlans.some(p => (p.frequency || []).includes(weekday));
  const done = (state.workoutLogs[date] || []).length > 0;
  parts.push({ score: done ? 100 : (scheduled ? 20 : 65), weight: 20, label: 'Treino' });

  // 4. Sono: horas dormidas face à faixa recomendada (7–9h). O registo de
  // cada data é a noite que TERMINOU nessa manhã (começou na véspera) — é
  // esse sono que impacta o desempenho deste dia.
  const sleepRec = state.sleepHistory[date];
  if (sleepRec && sleepRec.duration) {
    const sleepStatus = classifyByRange(sleepRec.duration, SLEEP_RANGE);
    if (sleepStatus) parts.push({ score: BIO_TIER_SCORE[sleepStatus.cls], weight: 15, label: 'Sono (noite anterior)' });
  }

  // 5. Evolução: gordura corporal vs. ~7 dias antes desta data (a descer = bom)
  const gcSeries = metricSeries('gc').filter(p => p.date <= date);
  if (gcSeries.length >= 2) {
    const last = gcSeries[gcSeries.length - 1];
    const weekAgoDate = shiftDate(last.date, -7);
    const ref = [...gcSeries].reverse().find(p => p.date <= weekAgoDate) || gcSeries[0];
    const delta = last.value - ref.value; // negativo = melhorou
    const trendScore = Math.max(0, Math.min(100, 50 - delta * 40));
    parts.push({ score: trendScore, weight: 20, label: 'Evolução' });
  }

  if (!parts.length) return { score: null, tier: 'green', color: 'var(--good)', label: 'Sem dados', breakdown: [] };

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  // Peso efetivo de cada componente neste dia: quando falta um indicador
  // (ex: sem dados de sono), o peso dos restantes é redistribuído para que a
  // soma mostrada seja sempre 100%.
  parts.forEach(p => { p.effWeight = Math.round(p.weight / totalWeight * 100); });
  const residual = 100 - parts.reduce((a, p) => a + p.effWeight, 0);
  if (residual) parts.reduce((a, b) => (b.effWeight > a.effWeight ? b : a)).effWeight += residual;

  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);
  const t = scoreTierFor(score);
  return { score, tier: t.tier, color: t.color, label: t.label, breakdown: parts };
}
