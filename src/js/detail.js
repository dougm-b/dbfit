// ══════════════════════════════════════════
// DETAIL PAGE — histórico, faixa saudável, indicadores relacionados,
// correlação estatística real (calculada a partir do healthHistory)
// ══════════════════════════════════════════
function getQueryMetric() {
  const params = new URLSearchParams(location.search);
  const id = params.get('metric');
  return (id && METRICS[id]) ? id : 'peso';
}

function fmtNum(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (Math.round(v * 10) / 10).toLocaleString('pt-PT');
}

function corrColor(r) {
  const a = Math.abs(r);
  if (a < 0.3) return 'var(--txt3)';
  return r > 0 ? 'var(--acc)' : 'var(--red)';
}

function rangeBarHtml(current, range, label) {
  if (current === null) return `<p style="font-size:12px;color:var(--txt3)">${esc(label || '')}</p>`;
  const [lo, hi] = range;
  const finiteHi = isFinite(hi) ? hi : lo + Math.max(lo, current, 1) * 0.6;
  const span = finiteHi - lo || 1;
  const margin = span * 0.4;
  const min = lo - margin, max = finiteHi + margin;
  const clampPct = v => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const pct = clampPct(current);
  const loPct = clampPct(lo);
  const hiPct = isFinite(hi) ? clampPct(hi) : 100;
  const inRange = current >= lo && (!isFinite(hi) || current <= hi);
  return `
    <div class="range-bar-wrap">
      <div class="range-bar">
        <div class="range-bar-zone" style="left:${loPct}%;width:${Math.max(0, hiPct - loPct)}%"></div>
        <div class="range-bar-marker" style="left:${pct}%;background:${inRange ? 'var(--acc)' : 'var(--red)'}"></div>
      </div>
      <div style="font-size:11px;color:var(--txt3);margin-top:6px">${esc(label)} · ${inRange ? '✅ dentro da faixa saudável' : '⚠️ fora da faixa saudável'}</div>
    </div>`;
}

function svgLineChart(series) {
  const W = 320, H = 140, padL = 30, padR = 10, padT = 14, padB = 22;
  const values = series.map(p => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const rangeSpan = max - min;
  min -= rangeSpan * 0.1; max += rangeSpan * 0.1;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const pts = series.map((p, i) => {
    const x = padL + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = padT + innerH - ((p.value - min) / (max - min)) * innerH;
    return [x, y];
  });
  const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaD = pathD + ` L${pts[pts.length - 1][0].toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#4ade80"/>`).join('');
  const firstLabel = series[0].date.slice(5);
  const lastLabel = series[series.length - 1].date.slice(5);
  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="rgba(255,255,255,.08)"/>
      <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="rgba(255,255,255,.08)"/>
      <text x="2" y="${padT + 4}" font-size="9" fill="#6b8f6b">${fmtNum(max)}</text>
      <text x="2" y="${padT + innerH}" font-size="9" fill="#6b8f6b">${fmtNum(min)}</text>
      <path d="${areaD}" fill="rgba(74,222,128,.12)" stroke="none"/>
      <path d="${pathD}" fill="none" stroke="#4ade80" stroke-width="2"/>
      ${dots}
      <text x="${padL}" y="${H - 4}" font-size="9" fill="#6b8f6b">${firstLabel}</text>
      <text x="${W - padR}" y="${H - 4}" font-size="9" fill="#6b8f6b" text-anchor="end">${lastLabel}</text>
    </svg>`;
}

function renderDetail() {
  const id = getQueryMetric();
  const m = METRICS[id];
  const container = document.getElementById('detail-content');

  document.getElementById('detail-title').textContent = m.label;
  document.title = m.label + ' — DB Fit';

  const series = metricSeries(id);
  const current = series.length ? series[series.length - 1].value : metricValue(id, state.health);
  const unit = m.unit ? ' ' + m.unit : '';

  const rangeHtml = m.range
    ? rangeBarHtml(current, m.range, m.rangeLabel)
    : `<p style="font-size:12px;color:var(--txt3)">${esc(m.rangeLabel || '')}</p>`;

  const chartHtml = series.length >= 2
    ? svgLineChart(series)
    : `<div class="empty-state" style="padding:24px 10px">
         <div class="icon">📈</div>
         <p>Ainda não há histórico suficiente.<br>Cada vez que atualizares a bioimpedância (ou importares dados) fica um novo ponto aqui.</p>
       </div>`;

  const values = series.map(p => p.value);
  const statsHtml = values.length ? `
    <div class="detail-stats-row">
      <div class="detail-stat"><div class="detail-stat-val">${fmtNum(values[values.length - 1])}</div><div class="detail-stat-lbl">Atual</div></div>
      <div class="detail-stat"><div class="detail-stat-val">${fmtNum(Math.min(...values))}</div><div class="detail-stat-lbl">Mínimo</div></div>
      <div class="detail-stat"><div class="detail-stat-val">${fmtNum(Math.max(...values))}</div><div class="detail-stat-lbl">Máximo</div></div>
      <div class="detail-stat"><div class="detail-stat-val">${fmtNum(values.reduce((a, b) => a + b, 0) / values.length)}</div><div class="detail-stat-lbl">Média</div></div>
    </div>` : '';

  const relatedHtml = (m.related || []).map(rid => {
    const rm = METRICS[rid];
    if (!rm) return '';
    const rv = metricValue(rid, state.health);
    return `<div class="related-item" onclick="location.href='detail.html?metric=${rid}'">
      <div class="related-name">${esc(rm.label)}</div>
      <div class="related-val">${rv === null ? '—' : fmtNum(rv)}${rm.unit ? ' ' + rm.unit : ''}</div>
    </div>`;
  }).join('');

  const correlations = correlateMetric(id, 5);
  const corrHtml = correlations.length
    ? correlations.map(c => `
        <div class="corr-row">
          <span class="corr-name">${esc(c.label)}</span>
          <span class="corr-val" style="color:${corrColor(c.r)}">r = ${c.r.toFixed(2)} <span class="corr-tag">(${classifyR(c.r)}, n=${c.n})</span></span>
        </div>`).join('')
    : `<p style="font-size:12px;color:var(--txt3)">Ainda sem dados suficientes para calcular uma correlação estatística real (é preciso um mínimo de 5 registos na mesma data para cada par de indicadores). Continua a atualizar a bioimpedância regularmente — ou importa histórico do Google Fit / Zepp em Configurações.</p>`;

  container.innerHTML = `
    <div class="card">
      <div class="card-title">${esc(m.label)}</div>
      <div class="detail-current">${current === null ? '—' : fmtNum(current)}<span class="detail-unit">${unit}</span></div>
      ${rangeHtml}
    </div>
    <div class="card">
      <div class="card-title">📈 Histórico</div>
      ${chartHtml}
      ${statsHtml}
    </div>
    <div class="card">
      <div class="card-title">ℹ️ O que é</div>
      <p style="font-size:13px;color:var(--txt2);line-height:1.6">${esc(m.explain)}</p>
    </div>
    ${relatedHtml ? `<div class="card"><div class="card-title">🔗 Indicadores relacionados</div>${relatedHtml}</div>` : ''}
    <div class="card">
      <div class="card-title">📊 Correlação com outros indicadores</div>
      <p style="font-size:11px;color:var(--txt3);margin-bottom:10px">Calculada a partir do teu histórico real (coeficiente de correlação de Pearson), não é uma opinião — só aparece um indicador aqui quando há registos suficientes na mesma data para comparar.</p>
      ${corrHtml}
    </div>
  `;
}
