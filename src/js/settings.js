// ══════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════
function renderSettings() {
  document.getElementById('s-meta-kcal').value = state.settings.metaKcal;
  document.getElementById('s-meta-prot').value = state.settings.metaProt;
  document.getElementById('s-meta-carb').value = state.settings.metaCarb;
  document.getElementById('s-meta-fat').value  = state.settings.metaFat;
  document.getElementById('s-meta-agua').value = state.settings.metaAgua;
  document.getElementById('s-altura').value    = state.health.altura;
  if (apiKey) document.getElementById('api-key-input').value = apiKey.slice(0,8) + '...';
  document.getElementById('token-status').textContent = ghToken ? '✅ Configurado' : '❌ Não configurado';
}

async function saveGoals() {
  const g = state.settings;
  g.metaKcal = +document.getElementById('s-meta-kcal').value || g.metaKcal;
  g.metaProt = +document.getElementById('s-meta-prot').value || g.metaProt;
  g.metaCarb = +document.getElementById('s-meta-carb').value || g.metaCarb;
  g.metaFat  = +document.getElementById('s-meta-fat').value  || g.metaFat;
  g.metaAgua = +document.getElementById('s-meta-agua').value || g.metaAgua;
  updateDash();
  await pushToGitHub();
  showToast('✅ Metas guardadas!');
}

async function saveAltura() {
  const v = +document.getElementById('s-altura').value;
  if (v) state.health.altura = v;
  renderHealth(); updateDash();
  await pushToGitHub();
  showToast('✅ Altura guardada!');
}

function saveApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val.startsWith('sk-')) {
    document.getElementById('api-key-status').textContent = '❌ Chave inválida — deve começar com sk-';
    return;
  }
  apiKey = val;
  localStorage.setItem('dbfit_apikey', apiKey);
  document.getElementById('api-key-status').textContent = '✅ Chave guardada!';
  document.getElementById('api-key-input').value = apiKey.slice(0,8) + '...';
}
