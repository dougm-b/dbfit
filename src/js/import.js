// ══════════════════════════════════════════
// IMPORTAR HISTÓRICO (Google Fit / Zepp) — melhor esforço
// Não há API pública para puxar dados diretamente destas apps a partir do
// browser, por isso o utilizador exporta um ficheiro (Google Takeout para
// o Google Fit; "Exportar dados" na Zepp) e esta função tenta reconhecer
// peso, gordura corporal, frequência cardíaca e passos a partir dele.
// ══════════════════════════════════════════
function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const IMPORT_COLUMN_ALIASES = {
  date:   ['date','data','day','timestamp','time','datetime','starttime','dateofmeasurement'].map(normKey),
  peso:   ['weight','peso','bodyweight','weightkg','massa','mass'].map(normKey),
  gc:     ['bodyfat','bodyfatpercentage','gordura','gorduracorporal','fatpercentage','percentgordura','fat'].map(normKey),
  fc:     ['heartrate','heartrateavg','avgheartrate','restingheartrate','bpm','frequenciacardiaca','pulso'].map(normKey),
  passos: ['steps','stepcount','passos','totalsteps'].map(normKey)
};

function normalizeDateString(raw) {
  if (!raw) return null;
  raw = String(raw).trim();
  if (/^\d{13}$/.test(raw)) return fmtDate(new Date(+raw));
  if (/^\d{10}$/.test(raw)) return fmtDate(new Date(+raw * 1000));
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    let a = +m[1], b = +m[2], y = m[3];
    let day, month;
    if (a > 12) { day = a; month = b; } else if (b > 12) { day = b; month = a; } else { day = a; month = b; }
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return fmtDate(d);
  return null;
}

function parseImportCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => normKey(h.replace(/^"|"$/g, '')));
  const colIndex = {};
  Object.entries(IMPORT_COLUMN_ALIASES).forEach(([field, aliases]) => {
    const idx = headers.findIndex(h => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  });
  if (colIndex.date === undefined) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.replace(/^"|"$/g, '').trim());
    const dk = normalizeDateString(cells[colIndex.date]);
    if (!dk) continue;
    const row = { date: dk };
    ['peso', 'gc', 'fc', 'passos'].forEach(field => {
      const idx = colIndex[field];
      if (idx !== undefined && cells[idx]) {
        const v = parseFloat(String(cells[idx]).replace(',', '.'));
        if (!isNaN(v)) row[field] = v;
      }
    });
    if (Object.keys(row).length > 1) rows.push(row);
  }
  return rows;
}

function scanJsonForHealthRecords(obj, out, depth) {
  depth = depth || 0;
  if (depth > 12 || out.records.length > 20000) return;
  if (Array.isArray(obj)) { obj.forEach(it => scanJsonForHealthRecords(it, out, depth + 1)); return; }
  if (!obj || typeof obj !== 'object') return;

  // Google Fit Takeout "Data Point" shape: { dataTypeName, startTimeNanos, value:[{fpVal|intVal}] }
  if (obj.dataTypeName && Array.isArray(obj.value) && (obj.startTimeNanos || obj.startTime)) {
    const ms = obj.startTimeNanos ? Math.floor(Number(obj.startTimeNanos) / 1e6)
      : (obj.startTime ? Date.parse(obj.startTime) : null);
    const dk = ms ? fmtDate(new Date(ms)) : null;
    const first = obj.value[0] || {};
    const val = (typeof first.fpVal === 'number') ? first.fpVal : (typeof first.intVal === 'number' ? first.intVal : null);
    if (dk && val !== null) {
      const type = String(obj.dataTypeName).toLowerCase();
      const rec = { date: dk };
      if (type.includes('weight')) rec.peso = val;
      else if (type.includes('fat')) rec.gc = val;
      else if (type.includes('heart_rate') || type.includes('heart_minutes')) rec.fc = val;
      else if (type.includes('step_count')) rec.passos = val;
      if (Object.keys(rec).length > 1) out.records.push(rec);
    }
  }

  // Generic flat record: any object with a recognizable date field and numeric metric fields
  const keyMap = {};
  Object.keys(obj).forEach(k => { keyMap[normKey(k)] = k; });
  const dateAlias = IMPORT_COLUMN_ALIASES.date.find(a => keyMap[a] !== undefined);
  if (dateAlias) {
    const dk = normalizeDateString(obj[keyMap[dateAlias]]);
    if (dk) {
      const rec = { date: dk };
      Object.keys(obj).forEach(k => {
        const nk = normKey(k);
        const v = obj[k];
        if (typeof v !== 'number') return;
        if (IMPORT_COLUMN_ALIASES.peso.includes(nk)) rec.peso = v;
        if (IMPORT_COLUMN_ALIASES.gc.includes(nk)) rec.gc = v;
        if (IMPORT_COLUMN_ALIASES.fc.includes(nk)) rec.fc = v;
        if (IMPORT_COLUMN_ALIASES.passos.includes(nk)) rec.passos = v;
      });
      if (Object.keys(rec).length > 1) out.records.push(rec);
    }
  }

  Object.values(obj).forEach(v => scanJsonForHealthRecords(v, out, depth + 1));
}

function mergeImportedRecords(records) {
  if (!state.healthHistory) state.healthHistory = {};
  const counts = { peso: 0, gc: 0, fc: 0, passos: 0 };
  let minDate = null, maxDate = null;
  records.forEach(r => {
    if (!r.date) return;
    if (!state.healthHistory[r.date]) state.healthHistory[r.date] = { altura: state.health.altura };
    const entry = state.healthHistory[r.date];
    if (typeof r.peso === 'number' && !isNaN(r.peso))   { entry.peso = r.peso.toFixed(1).replace('.', ',') + ' kg'; counts.peso++; }
    if (typeof r.gc === 'number' && !isNaN(r.gc))       { entry.gc = r.gc.toFixed(1).replace('.', ',') + '%'; counts.gc++; }
    if (typeof r.fc === 'number' && !isNaN(r.fc))       { entry.fc = Math.round(r.fc); counts.fc++; }
    if (typeof r.passos === 'number' && !isNaN(r.passos)) { entry.passos = Math.round(r.passos); counts.passos++; }
    if (!minDate || r.date < minDate) minDate = r.date;
    if (!maxDate || r.date > maxDate) maxDate = r.date;
  });
  const dates = Object.keys(state.healthHistory).sort();
  const latest = dates[dates.length - 1];
  if (latest) state.health = { ...state.health, ...state.healthHistory[latest] };
  return { counts, minDate, maxDate, total: records.length };
}

async function importHealthFile() {
  const input = document.getElementById('import-file');
  const status = document.getElementById('import-status');
  if (!input.files.length) { status.textContent = '⚠️ Escolhe um ficheiro primeiro.'; return; }
  const file = input.files[0];
  status.style.color = 'var(--txt3)';
  status.textContent = 'A ler ficheiro...';
  try {
    const text = await file.text();
    let records = [];
    let parsedAs = 'CSV';
    try {
      const json = JSON.parse(text);
      parsedAs = 'JSON';
      const out = { records: [] };
      scanJsonForHealthRecords(json, out, 0);
      records = out.records;
    } catch (e) {
      records = parseImportCSV(text);
    }
    if (!records.length) {
      status.style.color = 'var(--warn)';
      status.textContent = `⚠️ Não reconheci colunas/campos de data+peso/gordura/FC/passos neste ficheiro (lido como ${parsedAs}). Formatos variam muito entre exportações — se isto acontecer, diz-me o que continha o ficheiro para eu ajustar o importador.`;
      return;
    }
    const result = mergeImportedRecords(records);
    renderHealth(); updateDash(); renderSettings();
    await pushToGitHub();
    status.style.color = 'var(--acc)';
    status.textContent = `✅ Importados ${result.total} registos (${parsedAs}) entre ${result.minDate} e ${result.maxDate}. Peso: ${result.counts.peso} · Gordura: ${result.counts.gc} · FC: ${result.counts.fc} · Passos: ${result.counts.passos}. Confere nos gráficos de Bioimpedância se os valores fazem sentido.`;
    input.value = '';
  } catch (e) {
    status.style.color = 'var(--red)';
    status.textContent = '❌ Erro ao processar o ficheiro: ' + e.message;
  }
}
