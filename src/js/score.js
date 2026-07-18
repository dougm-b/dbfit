// ══════════════════════════════════════════
// NOTA DE DESEMPENHO DIÁRIO — cruza bioimpedância, alimentação, treino e
// evolução face aos dias anteriores num único valor 0–100. Usado pela
// barra de progresso do Dashboard e pela cor do ícone de chama no topo.
//
// Pesos (ajustáveis): bioimpedância 30%, alimentação 25%, treino 25%,
// evolução 20%. Uma componente sem dados disponíveis é ignorada e o peso
// das restantes é redistribuído (não penaliza por falta de registo).
// ══════════════════════════════════════════
const SCORE_TIERS = [
  { min: 90, tier: 'blue',   color: 'var(--blue)',   label: 'Excecional' },
  { min: 75, tier: 'green',  color: 'var(--good)',   label: 'Muito bom' },
  { min: 55, tier: 'yellow', color: 'var(--caution)',label: 'Ok' },
  { min: 35, tier: 'orange', color: 'var(--warn)',   label: 'Precisa de atenção' },
  { min: 0,  tier: 'red',    color: 'var(--red)',    label: 'Fraco' }
];

function scoreTierFor(score) {
  return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

function avgOf(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function computeDailyScore() {
  const parts = [];

  // 1. Bioimpedância: média dos níveis de intensidade dos indicadores com faixa definida
  const bioIds = ['gc', 'gv', 'prot', 'agua', 'fc', 'passos'];
  const bioTierScore = { 'badge-ok': 100, 'badge-caution': 70, 'badge-warn': 40, 'badge-red': 10 };
  const bioScores = bioIds
    .map(id => classifyMetricValue(id, metricValue(id, state.health)))
    .filter(Boolean)
    .map(s => bioTierScore[s.cls]);
  if (bioScores.length) parts.push({ score: avgOf(bioScores), weight: 30 });

  // 2. Alimentação: proximidade às metas de calorias e proteína de hoje
  const totals = dayTotals(TODAY);
  const g = state.settings;
  if (totals.kcal > 0) {
    const kcalDevPct = Math.abs(totals.kcal - g.metaKcal) / g.metaKcal;
    const kcalScore = Math.max(0, 100 - kcalDevPct * 150);
    const protScore = Math.min(100, (totals.prot / g.metaProt) * 100);
    parts.push({ score: (kcalScore + protScore) / 2, weight: 25 });
  }

  // 3. Treino: sessão registada hoje (bónus se treinou num dia sem plano agendado)
  const scheduled = state.workoutPlans.some(p => (p.frequency || []).includes(now.getDay()));
  const done = (state.workoutLogs[TODAY] || []).length > 0;
  parts.push({ score: done ? 100 : (scheduled ? 20 : 65), weight: 25 });

  // 4. Evolução: gordura corporal vs. ~7 dias atrás (a descer = bom, para este objetivo)
  const gcSeries = metricSeries('gc');
  if (gcSeries.length >= 2) {
    const last = gcSeries[gcSeries.length - 1];
    const weekAgoDate = shiftDate(last.date, -7);
    const ref = [...gcSeries].reverse().find(p => p.date <= weekAgoDate) || gcSeries[0];
    const delta = last.value - ref.value; // negativo = melhorou
    const trendScore = Math.max(0, Math.min(100, 50 - delta * 40));
    parts.push({ score: trendScore, weight: 20 });
  }

  if (!parts.length) return { score: null, tier: 'green', color: 'var(--good)', label: 'Sem dados', breakdown: [] };

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);
  const t = scoreTierFor(score);
  return { score, tier: t.tier, color: t.color, label: t.label, breakdown: parts };
}
