// ══════════════════════════════════════════
// BIOIMPEDÂNCIA — registo de indicadores partilhado
// (usado pela aba Bioimpedância e pela página de detalhe)
// ══════════════════════════════════════════
const METRICS = {
  peso: {
    key: 'peso', label: 'Peso', unit: 'kg',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: null, rangeLabel: 'Sem faixa fixa — depende da altura (ver IMC)',
    explain: 'O peso corporal total inclui água, gordura, músculo e osso. Sozinho não diz se a composição corporal é saudável — deve ser sempre lido junto com o IMC e a percentagem de gordura corporal.',
    related: ['imc', 'gc', 'musc']
  },
  imc: {
    label: 'IMC', unit: '',
    derive: h => {
      const p = parseFloat(String(h.peso).replace(',', '.'));
      const aM = (h.altura || 184) / 100;
      if (isNaN(p) || !aM) return null;
      return +(p / (aM * aM)).toFixed(1);
    },
    range: [18.5, 25], rangeLabel: 'Peso normal: 18,5–25',
    explain: 'Índice de Massa Corporal = peso ÷ altura². É um rastreio populacional simples e rápido, mas não diferencia massa muscular de gordura — por isso nunca deve ser lido isoladamente, sobretudo em pessoas com bastante massa muscular.',
    related: ['peso', 'gc']
  },
  gc: {
    key: 'gc', label: 'Gordura corporal', unit: '%',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: [18, 22], rangeLabel: 'Meta: 18–22%',
    explain: 'Percentagem do peso total que é tecido adiposo. Valores elevados aumentam o risco cardiometabólico; valores muito baixos também têm riscos (hormonal, imunológico).',
    related: ['gv', 'musc', 'imc']
  },
  musc: {
    key: 'musc', label: 'Músculo total', unit: 'kg',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: null, rangeLabel: 'Quanto maior (dentro do razoável), geralmente melhor',
    explain: 'Massa muscular total no corpo. Mais massa muscular está associada a um metabolismo basal mais alto e a melhor força funcional ao longo da vida.',
    related: ['met', 'me', 'gc']
  },
  gv: {
    key: 'gv', label: 'Gordura visceral', unit: '',
    parse: v => parseFloat(v),
    range: [0, 9], rangeLabel: 'Meta: <9',
    explain: 'Gordura acumulada à volta dos órgãos internos. É o indicador de bioimpedância mais associado a risco cardiovascular e resistência à insulina — clinicamente mais relevante do que o peso ou a gordura subcutânea.',
    related: ['gc', 'met', 'peso']
  },
  me: {
    key: 'me', label: 'Músculo esquelético', unit: 'kg',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: null, rangeLabel: 'Quanto maior (dentro do razoável), geralmente melhor',
    explain: 'Subconjunto do músculo total ligado diretamente ao esqueleto — o principal motor do metabolismo em repouso.',
    related: ['musc', 'met']
  },
  prot: {
    key: 'prot', label: 'Proteína corporal', unit: '%',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: [16, 18], rangeLabel: 'Meta: 16–18%',
    explain: 'Percentagem de proteína no corpo (parte do tecido magro). Níveis baixos podem indicar perda muscular ou ingestão proteica insuficiente.',
    related: ['musc', 'agua']
  },
  agua: {
    key: 'agua', label: 'Água corporal', unit: '%',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: [45, 60], rangeLabel: 'Referência típica: 45–60%',
    explain: 'Percentagem de água no corpo. A hidratação afeta diretamente a precisão de TODAS as outras leituras de bioimpedância elétrica, porque a corrente usada para medir depende da água nos tecidos — medir sempre nas mesmas condições (ex: em jejum, de manhã) ajuda a comparar valores ao longo do tempo.',
    related: ['prot', 'peso']
  },
  met: {
    key: 'met', label: 'Metabolismo basal', unit: 'kcal/dia',
    parse: v => parseFloat(String(v).replace(/\./g, '').replace(',', '.')),
    range: null, rangeLabel: 'Depende da massa muscular e da idade',
    explain: 'Energia mínima que o corpo gasta em repouso para se manter vivo. Sobe com mais massa muscular e desce com a idade — é a base usada para calcular as necessidades calóricas diárias.',
    related: ['musc', 'me', 'idade']
  },
  idade: {
    key: 'idade', label: 'Idade corporal', unit: 'anos',
    parse: v => parseFloat(v),
    range: null, rangeLabel: 'Comparar com a idade real',
    explain: 'Estimativa de "idade metabólica" a partir da composição corporal, comparada à média de pessoas com essa idade cronológica. Ficar abaixo da idade real é um bom sinal.',
    related: ['musc', 'gc', 'met']
  },
  ossea: {
    key: 'ossea', label: 'Massa óssea', unit: 'kg',
    parse: v => parseFloat(String(v).replace(',', '.')),
    range: [2.5, 4.5], rangeLabel: 'Referência típica: 2,5–4,5 kg',
    explain: 'Peso estimado dos minerais ósseos. Costuma manter-se estável — grandes variações súbitas normalmente indicam erro de medição da balança, não uma mudança real.',
    related: ['peso']
  },
  fc: {
    key: 'fc', label: 'Frequência cardíaca', unit: 'bpm',
    parse: v => parseFloat(v),
    range: [60, 100], rangeLabel: 'Repouso saudável: 60–100 bpm (atletas: 40–60)',
    explain: 'Batimentos por minuto em repouso. Valores mais baixos dentro do normal costumam indicar melhor condicionamento cardiovascular.',
    related: ['passos', 'met']
  },
  passos: {
    key: 'passos', label: 'Passos', unit: '',
    parse: v => parseFloat(v),
    range: [8000, Infinity], rangeLabel: 'Meta: 8.000+/dia',
    explain: 'Número de passos dados no dia. Mais passos aumentam o gasto calórico diário fora do treino (NEAT) e ajudam a criar défice calórico sem depender só das sessões de treino.',
    related: ['fc', 'gc', 'gv']
  }
};

function metricValue(id, h) {
  const m = METRICS[id];
  if (!m || !h) return null;
  if (m.derive) return m.derive(h);
  const raw = h[m.key];
  if (raw === undefined || raw === null || raw === '') return null;
  const v = m.parse(raw);
  return isNaN(v) ? null : v;
}

function historyEntries() {
  return Object.entries(state.healthHistory || {})
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, h]) => ({ date, h }));
}

function metricSeries(id) {
  return historyEntries()
    .map(e => ({ date: e.date, value: metricValue(id, e.h) }))
    .filter(p => p.value !== null && !isNaN(p.value));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

function classifyR(r) {
  const a = Math.abs(r);
  const dir = r >= 0 ? 'positiva' : 'negativa';
  let strength;
  if (a < 0.3) strength = 'fraca';
  else if (a < 0.6) strength = 'moderada';
  else if (a < 0.8) strength = 'forte';
  else strength = 'muito forte';
  return `${strength} ${dir}`;
}

function correlateMetric(id, minPoints) {
  minPoints = minPoints || 5;
  const base = metricSeries(id);
  const baseByDate = new Map(base.map(p => [p.date, p.value]));
  const out = [];
  Object.keys(METRICS).forEach(otherId => {
    if (otherId === id) return;
    const other = metricSeries(otherId);
    const xs = [], ys = [];
    other.forEach(p => {
      if (baseByDate.has(p.date)) { xs.push(baseByDate.get(p.date)); ys.push(p.value); }
    });
    if (xs.length >= minPoints) {
      const r = pearson(xs, ys);
      if (r !== null) out.push({ id: otherId, label: METRICS[otherId].label, r, n: xs.length });
    }
  });
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

function snapshotHealthHistory(dateKey) {
  if (!state.healthHistory) state.healthHistory = {};
  state.healthHistory[dateKey] = { ...state.health };
}
