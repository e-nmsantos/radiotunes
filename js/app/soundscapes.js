//! Roc Waves — soundscapes: Sons ambiente sintetizados (chuva, mar, lareira, ruído) e PWA.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// Soundscapes Nodes
const soundscapeNodes = {
  rain: { gain: null, node: null, vol: 0 },
  ocean: { gain: null, node: null, vol: 0 },
  fire: { gain: null, node: null, vol: 0 },
  noise: { gain: null, node: null, vol: 0 }
};

// PWA Service Worker Registration & Cache Auto-Update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
    }).catch(err => {
      console.warn('SW register fail:', err);
    });
  });
  // Recarregar só quando uma versão NOVA substitui outra (não na 1.ª instalação,
  // em que o SW apenas passa a controlar a página) e nunca a meio da música.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadingForUpdate) return;
    if (audio && !audio.paused) {
      showToast(t('updateReady'), '✨', 'info');
      return;
    }
    reloadingForUpdate = true;
    window.location.reload();
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  document.getElementById('pwa-install-banner').classList.remove('hidden');
});

function installPWA() {
  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        document.getElementById('pwa-install-banner').classList.add('hidden');
      }
      deferredPWAInstallPrompt = null;
    });
  }
}

function initAudioContext() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 128;

    // 10-Band Graphic Equalizer Filter Nodes
    const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const keys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

    freqs.forEach((f, idx) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = idx === 0 ? 'lowshelf' : (idx === freqs.length - 1 ? 'highshelf' : 'peaking');
      filter.frequency.value = f;
      filter.Q.value = 1.4;
      filter.gain.value = eq10Bands[keys[idx]] || 0;
      filters10[keys[idx]] = filter;
    });

    // Stereo Panner (Spatial Audio)
    if (audioCtx.createStereoPanner) {
      pannerNode = audioCtx.createStereoPanner();
      pannerNode.pan.value = spatialValue / 100;
    }

    // Reverb Convolver
    convolverNode = audioCtx.createConvolver();
    createSyntheticImpulseResponse();
    
    reverbGain = audioCtx.createGain();
    dryGain = audioCtx.createGain();
    reverbGain.gain.value = reverbValue / 100;
    dryGain.gain.value = 1.0;

    // Fiação da cadeia DSP: source -> EQ 10 bandas -> panner -> dry/wet -> analyser -> destination
    const eqKeys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
    for (let i = 0; i < eqKeys.length - 1; i++) {
      filters10[eqKeys[i]].connect(filters10[eqKeys[i + 1]]);
    }
    let chainTail = filters10[eqKeys[eqKeys.length - 1]];
    if (pannerNode) {
      chainTail.connect(pannerNode);
      chainTail = pannerNode;
    }
    chainTail.connect(dryGain);
    if (convolverNode) {
      chainTail.connect(convolverNode);
      convolverNode.connect(reverbGain);
      reverbGain.connect(analyserNode);
    }
    dryGain.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);

    isAudioContextReady = true;
  } catch (err) {
    console.warn("Web Audio API inicializada em modo fallback:", err);
  }
}

function createSyntheticImpulseResponse() {
  if (!audioCtx || !convolverNode) return;
  const rate = audioCtx.sampleRate;
  const length = rate * 2.0;
  const decay = 2.0;
  const impulse = audioCtx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i;
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
  }
  convolverNode.buffer = impulse;
}

// Soundscapes Synthesizer Engine
function initSoundscapeNode(type) {
  if (!audioCtx) initAudioContext();
  if (soundscapeNodes[type].node) return;

  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'rain') {
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  } else if (type === 'ocean') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / 10000);
    }
  } else if (type === 'fire') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.985 ? (Math.random() * 2 - 1) : (Math.random() * 0.05 - 0.025);
    }
  } else {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = buffer;
  noiseSrc.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = type === 'rain' ? 'lowpass' : (type === 'ocean' ? 'bandpass' : 'highpass');
  filter.frequency.value = type === 'rain' ? 800 : (type === 'ocean' ? 400 : 1200);

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  noiseSrc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noiseSrc.start();

  soundscapeNodes[type].node = noiseSrc;
  soundscapeNodes[type].gain = gain;
}

function updateSoundscape(type, val) {
  initAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  initSoundscapeNode(type);

  const num = parseInt(val, 10);
  soundscapeNodes[type].vol = num;
  if (soundscapeNodes[type].gain) {
    soundscapeNodes[type].gain.gain.value = (num / 100) * 0.4;
  }
  document.getElementById(`val-${type}`).textContent = `${num}%`;

  const activeCount = Object.values(soundscapeNodes).filter(s => s.vol > 0).length;
  document.getElementById('side-soundscapes-badge').textContent = activeCount > 0 ? `${activeCount} On` : 'Off';
}

function stopAllSoundscapes() {
  ['rain', 'ocean', 'fire', 'noise'].forEach(t => {
    document.getElementById(`sound-${t}`).value = 0;
    updateSoundscape(t, 0);
  });
}
