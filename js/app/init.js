//! Roc Waves — init: arranque da app. Carregado por último: chama tudo o que
//  precisa de todos os módulos já carregados (os outros declaram funções e estado
//  e só ligam listeners).
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// Arranques que dependem de todos os módulos já carregados
restoreFromAutoBackup();
attachAudioEvents(audio);
initAlarmChecker();
initDVRChecker();

// Check Deep Link Query Param on Load (?station=...)
const urlParams = new URLSearchParams(window.location.search);
const stationParam = urlParams.get('station');
if (stationParam) {
  currentStationId = stationParam;
}

// Acessibilidade: botões só com ícone ganham nome acessível a partir do title
// (também nos cartões e listas gerados dinamicamente).
function labelIconButtons(root) {
  root.querySelectorAll('button[title]:not([aria-label])').forEach(b => b.setAttribute('aria-label', b.getAttribute('title')));
}
labelIconButtons(document);
new MutationObserver(muts => {
  for (const m of muts) {
    for (const n of m.addedNodes) if (n.nodeType === 1) labelIconButtons(n.matches('button') ? n.parentNode || n : n);
    if (m.type === 'attributes' && m.target.matches('button')) m.target.setAttribute('aria-label', m.target.getAttribute('title') || '');
  }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });

// Initial load
changeLanguage(currentLang);
updateCounts();
sync10BandSliders();
selectStation(currentStationId, false);

// Auditoria de saúde em background: arranca imediatamente com a app,
// em fundo e com cadência suave — nunca bloqueia a UI.
runBackgroundHealthAudit().catch(() => {});
