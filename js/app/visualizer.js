//! Roc Waves — visualizer: Visualizadores de espectro (player, mini-player, modo TV).
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// Audio Visualizers
const miniCanvas = document.getElementById('mini-visualizer');
const miniCtx = miniCanvas.getContext('2d');
const tvCanvas = document.getElementById('tv-visualizer');
const tvCtx = tvCanvas.getContext('2d');
const tvModal = document.getElementById('tv-ambient-modal');

function resizeCanvas() {
  miniCanvas.width = miniCanvas.parentElement.clientWidth * window.devicePixelRatio;
  miniCanvas.height = miniCanvas.parentElement.clientHeight * window.devicePixelRatio;
}
// ResizeObserver mede depois do layout (sem forçar um layout síncrono no
// arranque) e acompanha o canvas a aparecer/esconder (ex.: telemóvel ↔ desktop).
if (window.ResizeObserver) {
  new ResizeObserver(resizeCanvas).observe(miniCanvas.parentElement);
}
function resizeTVCanvas() {
  if (tvCanvas.parentElement) {
    tvCanvas.width = tvCanvas.parentElement.clientWidth * window.devicePixelRatio;
    tvCanvas.height = tvCanvas.parentElement.clientHeight * window.devicePixelRatio;
  }
}
window.addEventListener('resize', () => {
  if (!window.ResizeObserver) resizeCanvas();
  resizeTVCanvas();
});
if (!window.ResizeObserver) resizeCanvas();

let visualizerStep = 0;
const freqData = new Uint8Array(64);

function drawSpectrum() {
  // Nada visível (mini-visualizador escondido no telemóvel, modo TV fechado):
  // não gastar CPU/bateria a desenhar.
  const tvVisible = !tvModal.classList.contains('hidden'); // sem forçar layout
  if (miniCanvas.width === 0 && !tvVisible) {
    visualizerStep++;
    requestAnimationFrame(drawSpectrum);
    return;
  }
  miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
  tvCtx.clearRect(0, 0, tvCanvas.width, tvCanvas.height);

  let hasRealData = false;
  if (isAudioContextReady && analyserNode && isPlaying) {
    try {
      analyserNode.getByteFrequencyData(freqData);
      for (let val of freqData) {
        if (val > 0) { hasRealData = true; break; }
      }
    } catch (e) {}
  }

  const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim() || '#06b6d4';
  const bars = 24;
  const w = miniCanvas.width / bars;

  for (let i = 0; i < bars; i++) {
    let h = 2;
    if (isPlaying) {
      if (hasRealData) {
        const raw = freqData[i % freqData.length] / 255;
        h = Math.max(2, raw * miniCanvas.height * 0.95);
      } else {
        const wave = (Math.sin(visualizerStep * 0.15 + i * 0.45) * 0.5 + 0.5);
        h = Math.max(2, wave * miniCanvas.height * 0.85);
      }
    }
    miniCtx.fillStyle = brandColor;
    miniCtx.fillRect(i * w + 1, miniCanvas.height - h, w - 2, h);
  }

  if (visualizerStyle === 'bars') {
    const tvW = tvCanvas.width / bars;
    for (let i = 0; i < bars; i++) {
      let tvH = 4;
      if (isPlaying) {
        if (hasRealData) {
          const raw = freqData[i % freqData.length] / 255;
          tvH = Math.max(4, raw * tvCanvas.height * 0.95);
        } else {
          const wave = (Math.sin(visualizerStep * 0.15 + i * 0.45) * 0.5 + 0.5);
          tvH = Math.max(4, wave * tvCanvas.height * 0.85);
        }
      }
      tvCtx.fillStyle = brandColor;
      tvCtx.fillRect(i * tvW + 2, tvCanvas.height - tvH, tvW - 4, tvH);
    }
  } else {
    const centerX = tvCanvas.width / 2;
    const centerY = tvCanvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.6;
    const points = 36;
    
    tvCtx.beginPath();
    tvCtx.strokeStyle = brandColor;
    tvCtx.lineWidth = 3;
    tvCtx.shadowBlur = 15;
    tvCtx.shadowColor = brandColor;

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      let amp = 0;
      if (isPlaying) {
        amp = hasRealData ? (freqData[i % freqData.length] / 255) * 25 : Math.sin(visualizerStep * 0.2 + i * 0.8) * 12;
      }
      const r = radius + amp;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (i === 0) tvCtx.moveTo(x, y);
      else tvCtx.lineTo(x, y);
    }
    tvCtx.closePath();
    tvCtx.stroke();
    tvCtx.shadowBlur = 0;
  }

  visualizerStep++;
  requestAnimationFrame(drawSpectrum);
}
drawSpectrum();
