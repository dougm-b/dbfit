// ══════════════════════════════════════════
// DETAIL PAGE — boot (does not use core.js's checkToken()/initApp(), since
// this page only ever renders the single detail view, not the full app)
// ══════════════════════════════════════════
async function detailSilentSync() {
  if (!ghToken || document.visibilityState === 'hidden') return;
  const ok = await loadFromGitHub({ silent: true, skipIfBusy: true });
  if (ok) renderDetail();
}

async function bootDetail() {
  if (!ghToken) {
    document.getElementById('detail-content').innerHTML = `
      <div class="empty-state">
        <div class="icon">🔒</div>
        <p>Abre primeiro a app principal (index.html) e configura o teu token GitHub — este ecrã usa os mesmos dados sincronizados.</p>
      </div>`;
    return;
  }
  await loadFromGitHub();
  renderDetail();
  setInterval(detailSilentSync, 45000);
  document.addEventListener('visibilitychange', detailSilentSync);
}
bootDetail();
