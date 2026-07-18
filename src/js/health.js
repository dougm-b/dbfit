// ══════════════════════════════════════════
// BIOIMPEDÂNCIA
// ══════════════════════════════════════════
function renderHealth() {
  const h = state.health;
  document.getElementById('h-peso').textContent  = h.peso;
  document.getElementById('h-gc').textContent    = h.gc;
  document.getElementById('h-musc').textContent  = h.musc;
  document.getElementById('h-gv').textContent    = h.gv;
  document.getElementById('h-me').textContent    = h.me;
  document.getElementById('h-prot').textContent  = h.prot;
  document.getElementById('h-agua').textContent  = h.agua;
  document.getElementById('h-met').textContent   = h.met;
  document.getElementById('h-idade').textContent = h.idade || '21 anos';
  document.getElementById('h-ossea').textContent = h.ossea || '4,0 kg';
  document.getElementById('h-fc').textContent    = h.fc ? h.fc + ' bpm' : '— bpm';
  document.getElementById('h-passos').textContent = (h.passos || 0).toLocaleString('pt-PT');

  // Cor de cada indicador de acordo com a intensidade do desvio face à faixa saudável
  applyMetricStatus('gc', 'h-gc', 'h-gc-status');
  applyMetricStatus('gv', 'h-gv', 'h-gv-status');
  applyMetricStatus('prot', 'h-prot', 'h-prot-status');
  applyMetricStatus('agua', 'h-agua', 'h-agua-status');
  applyMetricStatus('ossea', 'h-ossea', 'h-ossea-status');
  applyMetricStatus('fc', 'h-fc', 'h-fc-status');
  applyMetricStatus('passos', 'h-passos', 'h-passos-status');

  const pesoNum = parseFloat(String(h.peso).replace(',', '.'));
  const alturaM = (h.altura || 184) / 100;
  if (!isNaN(pesoNum)) {
    const imc = (pesoNum / (alturaM * alturaM)).toFixed(1);
    const cls = classifyIMC(+imc);
    const st = document.getElementById('h-peso-status');
    st.textContent = `IMC ${imc} · ${cls.label}`;
    st.style.color = cls.color;
  }
  if (apiKey) document.getElementById('api-key-input').value = apiKey.slice(0,8) + '...';
}

async function saveHealth() {
  const fields = {
    peso: document.getElementById('h-peso-i').value,
    gc:   document.getElementById('h-gc-i').value,
    musc: document.getElementById('h-musc-i').value,
    gv:   document.getElementById('h-gv-i').value,
    me:   document.getElementById('h-me-i').value,
    prot: document.getElementById('h-prot-i').value,
    agua: document.getElementById('h-agua-i').value,
    met:  document.getElementById('h-met-i').value,
    fc:   document.getElementById('h-fc-i').value,
    passos: document.getElementById('h-passos-i').value,
  };
  if (fields.peso) state.health.peso = fields.peso + ' kg';
  if (fields.gc)   state.health.gc   = fields.gc + '%';
  if (fields.musc) state.health.musc = fields.musc + ' kg';
  if (fields.gv)   state.health.gv   = fields.gv;
  if (fields.me)   state.health.me   = fields.me + ' kg';
  if (fields.prot) state.health.prot = fields.prot + '%';
  if (fields.agua) state.health.agua = fields.agua + '%';
  if (fields.met)  state.health.met  = fields.met;
  if (fields.fc)      state.health.fc = +fields.fc;
  if (fields.passos)  state.health.passos = +fields.passos;
  snapshotHealthHistory(TODAY);
  closeModal('health-modal');
  renderHealth(); updateDash();
  await pushToGitHub();
  showToast('✅ Dados de bioimpedância atualizados!');
}

function goToMetric(id) {
  location.href = 'detail.html?metric=' + encodeURIComponent(id);
}
