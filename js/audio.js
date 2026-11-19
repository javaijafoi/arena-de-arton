/* Arena de Arton — sons sintetizados (WebAudio), sem arquivos. Só tocam depois do primeiro clique. */
(function (root) {
  'use strict';
  let ctx = null, master = null, musGain = null, musTimer = null;
  const S = { som: true, musica: false };
  function init() {
    if (ctx) return ctx;
    try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = 0.0; musGain.connect(master);
    return ctx;
  }
  function tom(f, dur, tipo, vol, quando, slide, dest) {
    if (!ctx || !S.som && dest !== musGain) return;
    const t = ctx.currentTime + (quando || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function ruido(dur, vol, quando, filtro, freq) {
    if (!ctx || !S.som) return;
    const t = ctx.currentTime + (quando || 0); const n = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); g.gain.value = vol || 0.2;
    const f = ctx.createBiquadFilter(); f.type = filtro || 'lowpass'; f.frequency.value = freq || 1200;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const SFX = {
    passo: () => { tom(180 + Math.random() * 40, 0.05, 'triangle', 0.06); },
    clique: () => tom(660, 0.05, 'square', 0.04),
    dado: () => { for (let i = 0; i < 4; i++) tom(900 + Math.random() * 600, 0.03, 'square', 0.03, i * 0.04); },
    swing: () => ruido(0.18, 0.18, 0, 'bandpass', 1800),
    acerto: () => { ruido(0.12, 0.35, 0, 'lowpass', 900); tom(140, 0.15, 'sine', 0.35, 0, 60); },
    erro: () => { ruido(0.25, 0.12, 0, 'highpass', 2500); tom(500, 0.12, 'sine', 0.05, 0.05, 380); },
    critico: () => { ruido(0.3, 0.45, 0, 'lowpass', 700); tom(90, 0.35, 'sine', 0.5, 0, 40); tom(880, 0.2, 'square', 0.08, 0.05); tom(1320, 0.25, 'square', 0.06, 0.12); },
    flecha: () => { tom(1200, 0.18, 'sine', 0.08, 0, 500); ruido(0.1, 0.08, 0, 'highpass', 3000); },
    magia: () => { tom(400, 0.5, 'sine', 0.12, 0, 1200); tom(600, 0.5, 'triangle', 0.06, 0.05, 1500); },
    fogo: () => { ruido(0.7, 0.4, 0, 'lowpass', 600); tom(80, 0.6, 'sawtooth', 0.12, 0, 40); },
    raio: () => { for (let i = 0; i < 6; i++) tom(200 + Math.random() * 1600, 0.05, 'sawtooth', 0.08, i * 0.03); ruido(0.3, 0.2, 0, 'highpass', 2000); },
    gelo: () => { for (let i = 0; i < 5; i++) tom(1500 + i * 300, 0.25, 'sine', 0.05, i * 0.04); },
    cura: () => { [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.35, 'sine', 0.09, i * 0.07)); },
    buff: () => { [392, 494, 587].forEach((f, i) => tom(f, 0.4, 'triangle', 0.08, i * 0.06)); },
    sombra: () => { tom(220, 0.6, 'sawtooth', 0.08, 0, 70); tom(233, 0.6, 'sawtooth', 0.06, 0, 75); },
    morte: () => { tom(300, 0.6, 'triangle', 0.15, 0, 60); ruido(0.4, 0.15, 0.1, 'lowpass', 400); },
    queda: () => { tom(250, 0.5, 'sine', 0.15, 0, 90); },
    turno: () => tom(740, 0.08, 'sine', 0.06),
    rodada: () => { tom(392, 0.15, 'triangle', 0.08); tom(523, 0.2, 'triangle', 0.08, 0.1); },
    furia: () => { ruido(0.4, 0.3, 0, 'lowpass', 500); tom(110, 0.5, 'sawtooth', 0.15, 0, 70); },
    vitoria: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tom(f, i === 5 ? 0.8 : 0.2, 'square', 0.07, i * 0.13)); },
    derrota: () => { [392, 370, 349, 262].forEach((f, i) => tom(f, 0.5, 'triangle', 0.1, i * 0.3)); },
    sopro: () => { ruido(1.0, 0.35, 0, 'bandpass', 700); tom(160, 0.9, 'sawtooth', 0.1, 0, 60); },
  };
  // música bem simples: arpejo pentatônico suave em loop
  const SEQ = [[220, 330, 440, 494], [196, 294, 392, 440], [174.6, 261.6, 349.2, 392], [196, 294, 392, 494]];
  let passo = 0;
  function tickMusica() {
    if (!ctx || !S.musica) return;
    const acorde = SEQ[Math.floor(passo / 8) % SEQ.length]; const n = acorde[[0, 2, 1, 3, 2, 1, 3, 2][passo % 8]];
    tom(n, 0.5, 'triangle', 0.05, 0, null, musGain);
    if (passo % 8 === 0) tom(acorde[0] / 2, 1.6, 'sine', 0.07, 0, null, musGain);
    passo++;
  }
  const API = {
    init, S,
    tocar(nome) { if (!S.som) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume(); const f = SFX[nome]; if (f) try { f(); } catch (e) { /* sem som */ } },
    musica(on) {
      S.musica = on; init(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume();
      musGain.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.4);
      if (on && !musTimer) musTimer = setInterval(tickMusica, 260);
      if (!on && musTimer) { clearInterval(musTimer); musTimer = null; }
    },
  };
  root.SOM = API;
})(this);
