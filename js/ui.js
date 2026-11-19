/* Arena de Arton — interface: mapa, tokens, animações, menus. Toda regra vem de rules.js. */
(function () {
  'use strict';
  const D = window.T20DATA, R = window.T20, IA = window.T20IA, SOM = window.SOM;
  const S = 52, COLS = 16, ROWS = 12, W = COLS * S, H = ROWS * S;
  const $ = id => document.getElementById(id);
  const TOK = window.ARENA_TOK;
  const ICON_COND = { atordoado: '💫', ofuscado: '🌟', abalado: '😨', apavorado: '😱', fatigado: '😓', exausto: '🥵', vulneravel: '🎯', fraco: '🥀', enredado: '🕸', imovel: '⛓', lento: '🐌', caido: '⤵', inconsciente: '💤', emChamas: '🔥', acido: '🧪', paralisado: '🧊', sangrando: '🩸', fintado: '🃏', desafiado: '⚔', cego: '🕶', agarrado: '🤼' };
  const ICON_BUFF = { furia: '😡', bencao: '✨', oracao: '🙏', inspiracao: '🎵', defMagia: '🛡', escudoFe: '🛡', armaEspiritual: '🗡', velocidade: '⚡', marca: '🎯', perdicao: '☠', baluarte: '🛡', desafio: '⚔', agarrando: '🤼' };
  const NOME_BUFF = { furia: 'Fúria', bencao: 'Bênção', oracao: 'Oração', inspiracao: 'Inspirado', defMagia: 'Armadura Arcana', escudoFe: 'Escudo da Fé', armaEspiritual: 'Arma Espiritual', velocidade: 'Velocidade', marca: 'Marca da Presa', perdicao: 'Perdição', baluarte: 'Baluarte', desafio: 'Desafiando', agarrando: 'Agarrando' };
  const BOAS = new Set(['fintado']);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } } };

  const G = {
    st: null, modo: null, passo: 0, grupo: store.get('arena.grupo', ['mari', 'hana', 'zaldrin', 'aria']),
    camp: store.get('arena.camp', { passo: 0 }), op: store.get('arena.op', false), ia: { m: store.get('arena.iaM', true), h: false }, vel: 1,
    busy: false, sel: null, mods: {}, hover: null, inspect: null, logN: 0, scale: 1, nivel: 1, encontro: null, toks: {}
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms / G.vel));

  /* =============== MENU =============== */
  function montarMenu() {
    const picks = $('picks'); picks.innerHTML = '';
    for (const h of D.HEROIS) {
      const c = D.CLASSES[h.classe]; const b = document.createElement('button'); b.className = 'pick' + (G.grupo.includes(h.id) ? ' sel' : '');
      b.innerHTML = `<span class="n">${G.grupo.indexOf(h.id) + 1}</span><div class="face" style="background-image:${TOK.px(h.token)}"></div><b>${h.nome}</b><small><span style="color:var(--gold);font-weight:800">${c.nome}</span><br>${c.descricao}</small>`;
      b.onclick = () => { SOM.tocar('clique'); const i = G.grupo.indexOf(h.id); if (i >= 0) G.grupo.splice(i, 1); else if (G.grupo.length < 4) G.grupo.push(h.id); else { G.grupo.shift(); G.grupo.push(h.id); } store.set('arena.grupo', G.grupo); montarMenu(); };
      picks.appendChild(b);
    }
    $('nSel').textContent = `(${G.grupo.length}/4)`;
    const lad = $('ladder'); lad.innerHTML = '';
    D.ENCONTROS.forEach((E, i) => {
      const st = i < G.camp.passo ? 'done' : i === G.camp.passo ? 'now' : 'lock';
      const b = document.createElement('button'); b.className = 'step ' + st; b.disabled = st === 'lock';
      b.innerHTML = `<div class="lv"><small>NÍVEL</small>${E.nivel}</div><div><b>${st === 'done' ? '✓ ' : ''}${E.nome}</b><span>${E.texto}</span></div>`;
      b.onclick = () => iniciar('campanha', i);
      lad.appendChild(b);
    });
    const sel = $('selEnc'); if (!sel.options.length) D.ENCONTROS.forEach((E, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${E.nome} (nível ${E.nivel})`; sel.appendChild(o); });
  }
  $('bCamp').onclick = () => iniciar('campanha', Math.min(G.camp.passo, D.ENCONTROS.length - 1));
  $('bReset').onclick = () => { G.camp = { passo: 0 }; store.set('arena.camp', G.camp); montarMenu(); };
  $('selLvl').oninput = e => { $('lvlV').textContent = e.target.value; };
  $('selEnc').onchange = e => { $('selLvl').value = D.ENCONTROS[+e.target.value].nivel; $('lvlV').textContent = $('selLvl').value; };
  $('bLivre').onclick = () => iniciar('livre', +$('selEnc').value, +$('selLvl').value);
  $('tMenu').onclick = () => voltarMenu();

  function togs() {
    $('tIA').textContent = G.ia.m ? '🤖 Inimigos: IA' : '🎮 Inimigos: você'; $('tIA').classList.toggle('on', G.ia.m);
    $('tIAH').textContent = G.ia.h ? '🤖 Heróis: IA' : '🎮 Heróis: você'; $('tIAH').classList.toggle('on', G.ia.h);
    $('tOp').textContent = G.op ? '⚡ Oportunidade: sim' : '⚡ Oportunidade: não'; $('tOp').classList.toggle('on', !!G.op);
    $('tVel').textContent = '⏩ ' + G.vel + '×'; $('tVel').classList.toggle('on', G.vel > 1);
    $('tSom').textContent = SOM.S.som ? '🔊 Som' : '🔇 Som'; $('tSom').classList.toggle('on', SOM.S.som);
    $('tMus').classList.toggle('on', SOM.S.musica);
  }
  $('tIA').onclick = () => { G.ia.m = !G.ia.m; store.set('arena.iaM', G.ia.m); togs(); atualizar(); seguir(); };
  $('tIAH').onclick = () => { G.ia.h = !G.ia.h; togs(); atualizar(); seguir(); };
  $('tOp').onclick = () => { G.op = !G.op; store.set('arena.op', G.op); if (G.st) G.st.cfg.oportunidade = G.op; togs(); };
  $('tVel').onclick = () => { G.vel = G.vel === 1 ? 2 : G.vel === 2 ? 4 : 1; togs(); };
  $('tSom').onclick = () => { SOM.S.som = !SOM.S.som; togs(); SOM.tocar('clique'); };
  $('tMus').onclick = () => { SOM.S.som = true; SOM.musica(!SOM.S.musica); togs(); };

  function voltarMenu() { if (G.modo === 'run' && window.RUNUI) { G.st = null; $('game').classList.add('hidden'); $('tMenu').classList.add('hidden'); $('over').classList.add('hidden'); return window.RUNUI.voltarDaBatalha(); } G.st = null; $('game').classList.add('hidden'); $('menu').classList.remove('hidden'); $('tMenu').classList.add('hidden'); $('over').classList.add('hidden'); $('topSub').textContent = 'Simulador tático de Tormenta 20'; montarMenu(); if (window.RUNUI) window.RUNUI.vestirTreino(); }

  /* =============== INÍCIO DE BATALHA =============== */
  function iniciar(modo, idx, nivel) {
    if (!G.grupo.length) { G.grupo = ['mari', 'hana', 'zaldrin', 'aria']; }
    SOM.init(); SOM.tocar('clique');
    const E = D.ENCONTROS[idx]; G.modo = modo; G.passo = idx; G.encontro = E; G.nivel = nivel || E.nivel;
    G.st = R.novaBatalha({ herois: G.grupo.slice(0, 4), nivel: G.nivel, inimigos: E.inimigos, mapa: E.mapa, seed: (Math.random() * 1e9) | 0, oportunidade: !!G.op });
    G.sel = null; G.mods = {}; G.logN = 0; G.undo = null; G.stats = {}; G.inspect = null; $('logIn').innerHTML = '';
    $('menu').classList.add('hidden'); $('game').classList.remove('hidden'); $('tMenu').classList.remove('hidden'); $('over').classList.add('hidden'); document.body.classList.remove('em-run', 'px-treino');
    $('topSub').textContent = `${E.nome} · nível ${G.nivel}${modo === 'livre' ? ' · batalha livre' : ''}`;
    desenharMapa(G.st.mapa); criarTokens(); ajustar();
    atualizar();
    G.prep = G.ia.h ? null : { sel: null };
    if (!G.prep) R.comecar(G.st);
    (async () => { G.busy = true; await banner(E.nome); if (G.prep) { G.busy = false; atualizar(); flutuarTopo('Posicione seus heróis'); return; } await tocar(G.st.eventosIniciais || []); G.busy = false; atualizar(); seguir(); })();
  }
  // batalha iniciada pelo modo roguelike (run-ui.js): heróis e inimigos vêm da run
  function iniciarRun(o) {
    SOM.init(); G.modo = 'run'; G.runCtx = o; G.encontro = { nome: o.nome }; G.nivel = o.cfg.nivel; G.grupo = o.cfg.herois.slice();
    G.st = R.novaBatalha(o.cfg); if (o.ajustar) o.ajustar(G.st);
    G.sel = null; G.mods = {}; G.logN = 0; G.undo = null; G.stats = {}; G.inspect = null; $('logIn').innerHTML = '';
    $('menu').classList.add('hidden'); $('game').classList.remove('hidden'); $('tMenu').classList.remove('hidden'); $('over').classList.add('hidden'); document.body.classList.remove('em-run', 'px-treino');
    $('topSub').textContent = `${o.nome} · nível ${G.nivel} · run`;
    desenharMapa(G.st.mapa); criarTokens(); ajustar(); atualizar();
    G.prep = G.ia.h ? null : { sel: null }; if (!G.prep) R.comecar(G.st);
    (async () => { G.busy = true; await banner(o.nome); if (G.prep) { G.busy = false; atualizar(); flutuarTopo('Posicione seus heróis'); return; } await tocar(G.st.eventosIniciais || []); G.busy = false; atualizar(); seguir(); })();
  }
  function flutuarTopo(txt) { const h = R.unidadeEm(G.st, R.zonaHerois(G.st)[0].x, R.zonaHerois(G.st)[0].y) || G.st.unidades.find(u => u.lado === 'h'); if (h) flutuar(h, txt, 'txt'); }
  async function comecarBatalha() {
    if (!G.prep || G.busy) return; SOM.tocar('rodada'); R.comecar(G.st); G.prep = null; G.sel = null; G.inspect = null; desenharDestaques();
    G.busy = true; atualizar(); await banner('Lutem!', 600); await tocar(G.st.eventosIniciais || []); G.busy = false; G.ops = null; atualizar(); seguir();
  }
  function painelPreparo() {
    const st = G.st, el = $('acts'); const sel = G.prep.sel && R.porId(st, G.prep.sel);
    let h = `<h3>Posicionamento</h3><div class="desc">Antes da luta, arrume o grupo na <b style="color:#ffd65a">zona dourada</b> do seu canto: clique num herói e depois numa casa da zona. Clicar em outro herói troca os dois de lugar.</div>`;
    h += `<button class="btn gold" id="bComecar" style="width:100%;margin:4px 0">⚔ Começar batalha</button>`;
    for (const u of st.unidades.filter(o => o.lado === 'h')) h += `<button class="abtn${sel === u ? ' on' : ''}" data-pp="${u.id}"><span class="ic"><span class="mini" style="background-image:${TOK(u.token)}"></span></span>${u.nome.split(' ')[0]}<span class="c">${D.CLASSES[u.classe] ? D.CLASSES[u.classe].nome || u.classe : u.classe}</span></button>`;
    h += `<div class="hint">${sel ? '👉 Agora clique numa casa dourada para ' + sel.nome.split(' ')[0] + '.' : 'Dica: guerreiros na frente, magos e arqueiros atrás.'}</div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-pp]').forEach(x => x.onclick = () => { SOM.tocar('clique'); G.prep.sel = G.prep.sel === x.dataset.pp ? null : x.dataset.pp; if (G.prep.sel) { G.inspect = G.prep.sel; atualizarCartao(); } painelPreparo(); desenharDestaques(); });
    $('bComecar').onclick = () => comecarBatalha();
  }
  function cliquePreparo(c) {
    const st = G.st; const o = R.unidadeEm(st, c.x, c.y); const sel = G.prep.sel;
    if (!sel) { if (o && o.lado === 'h') { G.prep.sel = o.id; G.inspect = o.id; atualizarCartao(); SOM.tocar('clique'); } else if (o) { G.inspect = o.id; atualizarCartao(); } painelPreparo(); desenharDestaques(); return; }
    if (o && o.id === sel) { G.prep.sel = null; painelPreparo(); desenharDestaques(); return; }
    const err = R.reposicionar(st, sel, c.x, c.y);
    if (err) { if (o && o.lado === 'h') { G.prep.sel = o.id; SOM.tocar('clique'); painelPreparo(); desenharDestaques(); return; } flutuar(R.porId(st, sel), err, 'txt'); SOM.tocar('erro'); return; }
    SOM.tocar('passo'); for (const u of st.unidades.filter(q => q.lado === 'h')) { const d = G.toks[u.id]; d.style.transition = 'left .2s, top .2s'; d.style.left = u.x * S + 'px'; d.style.top = u.y * S + 'px'; setTimeout(() => { d.style.transition = ''; }, 220); }
    G.prep.sel = null; painelPreparo(); desenharDestaques(); atualizarCartao();
  }

  /* =============== MAPA =============== */
  function desenharMapa(mapa) {
    const c = $('map'), x = c.getContext('2d'); let sd = 7 + mapa.nome.length * 13;
    const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const at = (i, j) => (mapa.linhas[j] || '')[i];
    x.clearRect(0, 0, W, H);
    const cripta = mapa.tema === 'cripta';
    if (cripta) {
      x.fillStyle = '#4b4f5e'; x.fillRect(0, 0, W, H);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const X = i * S, Y = j * S; const g = 70 + (r() * 22 | 0);
        x.fillStyle = `rgb(${g},${g + 4},${g + 18})`; x.fillRect(X + 1, Y + 1, S - 2, S - 2);
        x.fillStyle = '#ffffff10'; x.fillRect(X + 1, Y + 1, S - 2, 4);
        if (r() < .35) { x.strokeStyle = '#2b2e3a'; x.lineWidth = 1.2; x.beginPath(); let a = X + r() * S, b = Y + r() * S; x.moveTo(a, b); for (let q = 0; q < 3; q++) { a += (r() - .5) * 18; b += (r() - .5) * 18; x.lineTo(a, b); } x.stroke(); }
        if (r() < .12) { x.fillStyle = '#5c8a4a66'; x.beginPath(); x.ellipse(X + r() * S, Y + r() * S, 6 + r() * 8, 3 + r() * 5, r() * 3, 0, 7); x.fill(); }
      }
    } else {
      x.fillStyle = '#5fae4a'; x.fillRect(0, 0, W, H);
      for (let k = 0; k < 420; k++) { x.fillStyle = ['#6bbd54', '#55a042', '#73c45c', '#4f9a3e'][k % 4]; x.globalAlpha = .55; x.beginPath(); x.ellipse(r() * W, r() * H, 8 + r() * 22, 5 + r() * 12, r() * 3, 0, 7); x.fill(); }
      x.globalAlpha = 1;
      for (let k = 0; k < 600; k++) { x.strokeStyle = r() > .5 ? '#8fd96d' : '#3f8a32'; x.lineWidth = 1.5; const a = r() * W, b = r() * H; x.beginPath(); x.moveTo(a, b); x.lineTo(a + (r() - .5) * 4, b - 4 - r() * 4); x.stroke(); }
      for (let k = 0; k < 40; k++) { const a = r() * W, b = r() * H; if ('.'.indexOf(at(a / S | 0, b / S | 0)) < 0) continue; x.fillStyle = ['#fff6a8', '#ffb3d1', '#ffffff', '#b8d4ff'][k % 4]; for (let q = 0; q < 5; q++) { x.beginPath(); x.arc(a + Math.cos(q * 1.26) * 3, b + Math.sin(q * 1.26) * 3, 1.8, 0, 7); x.fill(); } x.fillStyle = '#f5c542'; x.beginPath(); x.arc(a, b, 1.5, 0, 7); x.fill(); }
    }
    // trilha
    x.fillStyle = '#d9b77a'; for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 'p') { x.beginPath(); x.roundRect(i * S - 4 + r() * 4, j * S - 3, S + 6, S + 6, 14); x.fill(); }
    x.fillStyle = '#c49f62'; for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 'p') for (let q = 0; q < 3; q++) { x.beginPath(); x.arc(i * S + r() * S, j * S + r() * S, 1.5 + r() * 2, 0, 7); x.fill(); }
    // água
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const ch = at(i, j); if (ch !== '~' && ch !== '=') continue; x.fillStyle = '#2f78d6'; x.beginPath(); x.roundRect(i * S - 3, j * S - 3, S + 6, S + 6, 12); x.fill(); }
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const ch = at(i, j); if (ch !== '~' && ch !== '=') continue; x.fillStyle = '#4a92ea'; x.beginPath(); x.roundRect(i * S + 3, j * S + 3, S - 6, S - 6, 10); x.fill(); x.strokeStyle = '#bfe0ff'; x.lineWidth = 2; x.globalAlpha = .7; for (let q = 0; q < 2; q++) { const a = i * S + 6 + r() * 24, b = j * S + 10 + r() * 28; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + 5, b - 4, a + 10, b); x.quadraticCurveTo(a + 15, b + 4, a + 20, b); x.stroke(); } x.globalAlpha = 1; }
    // ponte
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === '=') { const X = i * S, Y = j * S; x.fillStyle = '#000a'; x.fillRect(X, Y + 4, S, S); x.fillStyle = '#b07a3e'; x.fillRect(X, Y, S, S); x.fillStyle = '#8a5a28'; for (let q = 0; q < S; q += 8) x.fillRect(X, Y + q, S, 2); x.fillStyle = '#6b4219'; if (at(i - 1, j) !== '=') x.fillRect(X, Y, 4, S); if (at(i + 1, j) !== '=') x.fillRect(X + S - 4, Y, 4, S); }
    // pedras
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 'R') { const cx = i * S + 26, cy = j * S + 28; x.fillStyle = '#0004'; x.beginPath(); x.ellipse(cx + 3, cy + 12, 20, 8, 0, 0, 7); x.fill(); x.fillStyle = '#7d8290'; x.beginPath(); x.moveTo(cx - 18, cy + 10); x.lineTo(cx - 14, cy - 8); x.lineTo(cx - 2, cy - 16); x.lineTo(cx + 14, cy - 10); x.lineTo(cx + 19, cy + 8); x.closePath(); x.fill(); x.fillStyle = '#a9aebb'; x.beginPath(); x.moveTo(cx - 12, cy - 6); x.lineTo(cx - 2, cy - 14); x.lineTo(cx + 10, cy - 9); x.lineTo(cx, cy - 1); x.closePath(); x.fill(); }
    // muros
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 'W') {
      const X = i * S, Y = j * S;
      if (cripta) { x.fillStyle = '#1d1f29'; x.fillRect(X, Y, S, S); x.fillStyle = '#2d3040'; x.fillRect(X + 2, Y + 2, S - 4, S - 12); x.strokeStyle = '#3d4155'; x.lineWidth = 2; for (let q = 12; q < S - 10; q += 12) { x.beginPath(); x.moveTo(X + 2, Y + q); x.lineTo(X + S - 2, Y + q); x.stroke(); } x.fillStyle = '#4a4f66'; x.fillRect(X + 2, Y + 2, S - 4, 5); }
      else { x.fillStyle = '#0005'; x.fillRect(X + 2, Y + 8, S, S); x.fillStyle = '#9b8a74'; x.fillRect(X, Y, S, S - 6); x.fillStyle = '#bba98f'; x.fillRect(X, Y, S, 10); x.strokeStyle = '#6f604e'; x.lineWidth = 2; for (let q = 10; q < S - 6; q += 11) { x.beginPath(); x.moveTo(X, Y + q); x.lineTo(X + S, Y + q); x.stroke(); const o = (q / 11) % 2 ? 12 : 30; x.beginPath(); x.moveTo(X + o, Y + q); x.lineTo(X + o, Y + q + 11); x.stroke(); } x.fillStyle = '#4f9a3e'; x.beginPath(); x.arc(X + 8, Y + 4, 5, 0, 7); x.fill(); }
    }
    // túmulos
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 't') { const X = i * S, Y = j * S; x.fillStyle = '#0006'; x.fillRect(X + 9, Y + 9, 38, 42); x.fillStyle = '#8d8a98'; x.beginPath(); x.roundRect(X + 7, Y + 5, 38, 42, 6); x.fill(); x.fillStyle = '#aaa7b6'; x.beginPath(); x.roundRect(X + 10, Y + 8, 32, 36, 4); x.fill(); x.fillStyle = '#6c6978'; x.fillRect(X + 24, Y + 13, 4, 24); x.fillRect(X + 17, Y + 20, 18, 4); }
    // tochas da cripta
    if (cripta) for (const [i, j] of [[1, 1], [14, 1], [1, 10], [14, 10], [7, 5], [8, 6]]) { const g = x.createRadialGradient(i * S + 26, j * S + 26, 2, i * S + 26, j * S + 26, 110); g.addColorStop(0, '#ffb24a55'); g.addColorStop(1, '#ffb24a00'); x.fillStyle = g; x.fillRect(i * S - 90, j * S - 90, 230, 230); }
    // árvores
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (at(i, j) === 'T') { const cx = i * S + 26 + (r() - .5) * 4, cy = j * S + 24 + (r() - .5) * 4; x.fillStyle = '#0003'; x.beginPath(); x.ellipse(cx + 5, cy + 16, 20, 8, 0, 0, 7); x.fill(); x.fillStyle = '#6b4423'; x.fillRect(cx - 3, cy + 6, 6, 12); x.fillStyle = '#226b2c'; x.beginPath(); x.arc(cx, cy, 19, 0, 7); x.fill(); x.fillStyle = '#2f8a37'; x.beginPath(); x.arc(cx - 3, cy - 4, 15, 0, 7); x.fill(); x.fillStyle = '#45a84a'; x.beginPath(); x.arc(cx - 7, cy - 8, 8, 0, 7); x.fill(); x.fillStyle = '#7fd06d'; x.beginPath(); x.arc(cx - 9, cy - 10, 3, 0, 7); x.fill(); }
    // grade
    x.strokeStyle = cripta ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.13)'; x.lineWidth = 1;
    for (let i = 1; i < COLS; i++) { x.beginPath(); x.moveTo(i * S + .5, 0); x.lineTo(i * S + .5, H); x.stroke(); }
    for (let j = 1; j < ROWS; j++) { x.beginPath(); x.moveTo(0, j * S + .5); x.lineTo(W, j * S + .5); x.stroke(); }
  }

  /* =============== TOKENS =============== */
  function criarTokens() {
    const box = $('toks'); box.innerHTML = ''; G.toks = {};
    for (const u of G.st.unidades) {
      const d = document.createElement('div'); d.className = 'tok ' + u.lado + (u.grande ? ' big' : '') + (u.voo ? ' voa' : '');
      d.innerHTML = `<div class="in"><div class="sel"></div><div class="face" style="background-image:${TOK(u.token)}"></div><div class="hp"><i class="lag"></i><i class="cur"></i></div><div class="ci"></div></div>`;
      d.style.left = u.x * S + 'px'; d.style.top = u.y * S + 'px'; box.appendChild(d); G.toks[u.id] = d;
    }
  }
  function atualizarToken(u) {
    const d = G.toks[u.id]; if (!d) return;
    const p = Math.max(0, u.pv) / u.pvMax * 100;
    const cur = d.querySelector('.cur'); cur.style.width = p + '%'; d.querySelector('.lag').style.width = p + '%';
    cur.classList.toggle('mid', p < 50 && p >= 25); cur.classList.toggle('low', p < 25);
    d.classList.toggle('ko', u.vivo && u.pv <= 0 || R.tem(u, 'inconsciente'));
    if (!u.vivo) d.classList.add('dead');
    const ic = []; for (const k in u.cond) if (ICON_COND[k] && k !== 'caido' || (k === 'caido' && !R.tem(u, 'inconsciente'))) ic.push(`<span title="${R.NOME_COND[k] || k}">${ICON_COND[k] || '•'}</span>`);
    for (const k of ['furia', 'velocidade', 'marca', 'baluarte']) if (u.buff[k]) ic.push(`<span>${ICON_BUFF[k]}</span>`);
    d.querySelector('.ci').innerHTML = ic.slice(0, 4).join('');
    const ae = u.vivo && u.buff.armaEspiritual; let ar = d.querySelector('.arma');
    if (ae && !ar) { ar = document.createElement('div'); ar.className = 'arma'; ar.innerHTML = ESPADA + (ae.duas ? ESPADA : ''); d.appendChild(ar); }
    if (!ae && ar) ar.remove();
    if (ar) ar.classList.toggle('usada', ae.bloq || (ae.r === G.st.rodada && ae.n >= (ae.duas ? 2 : 1)));
  }
  const ESPADA = '<svg viewBox="0 0 20 44" width="18" height="40"><defs><linearGradient id="ae-g" x1="0" x2="1"><stop offset="0" stop-color="#fff8d0"/><stop offset=".5" stop-color="#ffe27a"/><stop offset="1" stop-color="#d9a520"/></linearGradient></defs><path d="M10 1 L13.5 7 L13.5 29 L6.5 29 L6.5 7 Z" fill="url(#ae-g)" stroke="#8a5a00" stroke-width=".8"/><path d="M10 3 L10 28" stroke="#fffbe8" stroke-width=".9"/><rect x="2" y="29" width="16" height="3.2" rx="1.4" fill="#f5c542" stroke="#8a5a00" stroke-width=".8"/><rect x="8.3" y="32" width="3.4" height="7.5" fill="#b07a3e" stroke="#5a3a10" stroke-width=".6"/><circle cx="10" cy="41" r="2.4" fill="#f5c542" stroke="#8a5a00" stroke-width=".7"/></svg>';
  const centro = u => ({ x: u.x * S + 26, y: u.y * S + 26 });

  /* =============== EFEITOS (partículas) =============== */
  const FX = { parts: [], raf: 0 };
  const fxc = $('fx').getContext('2d');
  function loopFX() {
    fxc.clearRect(0, 0, W, H); const ps = FX.parts; const dt = G.vel;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.t += dt;
      if (p.t >= p.vida) { ps.splice(i, 1); if (p.fim) p.fim(); continue; }
      const k = p.t / p.vida;
      if (p.tipo === 'proj') {
        const e = k < 1 ? k : 1; const x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e - Math.sin(e * Math.PI) * (p.arco || 0);
        fxc.globalAlpha = 1; fxc.fillStyle = p.cor; fxc.shadowColor = p.cor; fxc.shadowBlur = 16; fxc.beginPath(); fxc.arc(x, y, p.r || 6, 0, 7); fxc.fill(); fxc.shadowBlur = 0;
        if (p.flecha) { const a = Math.atan2(p.y1 - p.y0, p.x1 - p.x0); fxc.strokeStyle = '#f4e3c0'; fxc.lineWidth = 3; fxc.beginPath(); fxc.moveTo(x, y); fxc.lineTo(x - Math.cos(a) * 18, y - Math.sin(a) * 18); fxc.stroke(); }
        for (let q = 0; q < 2; q++) ps.push({ tipo: 'dot', x, y, vx: (Math.random() - .5) * 1.2, vy: (Math.random() - .5) * 1.2, t: 0, vida: 14 + Math.random() * 10, cor: p.cor, r: 2 + Math.random() * 2.5 });
        continue;
      }
      if (p.tipo === 'dot') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; fxc.globalAlpha = 1 - k; fxc.fillStyle = p.cor; fxc.beginPath(); fxc.arc(p.x, p.y, (p.r || 3) * (1 - k * .5), 0, 7); fxc.fill(); }
      else if (p.tipo === 'anel') { fxc.globalAlpha = (1 - k) * (p.a || 1); fxc.strokeStyle = p.cor; fxc.lineWidth = (p.lw || 5) * (1 - k) + 1; fxc.beginPath(); fxc.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * Math.sqrt(k), 0, 7); fxc.stroke(); }
      else if (p.tipo === 'disco') { fxc.globalAlpha = (1 - k) * (p.a || .6); const g = fxc.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (0.4 + k * .6)); g.addColorStop(0, '#fff'); g.addColorStop(.3, p.cor); g.addColorStop(1, p.cor + '00'); fxc.fillStyle = g; fxc.beginPath(); fxc.arc(p.x, p.y, p.r * (0.4 + k * .6), 0, 7); fxc.fill(); }
      else if (p.tipo === 'feixe') { fxc.globalAlpha = 1 - k; fxc.strokeStyle = p.cor; fxc.shadowColor = p.cor; fxc.shadowBlur = 20; fxc.lineCap = 'round'; fxc.lineWidth = (p.lw || 10) * (1 - k * .6); fxc.beginPath(); fxc.moveTo(p.x0, p.y0); if (p.zig) { const n = 8; for (let q = 1; q <= n; q++) { const e = q / n; fxc.lineTo(p.x0 + (p.x1 - p.x0) * e + (q < n ? (Math.random() - .5) * 22 : 0), p.y0 + (p.y1 - p.y0) * e + (q < n ? (Math.random() - .5) * 22 : 0)); } } else fxc.lineTo(p.x1, p.y1); fxc.stroke(); fxc.strokeStyle = '#fff'; fxc.lineWidth = (p.lw || 10) * .3 * (1 - k); fxc.stroke(); fxc.shadowBlur = 0; }
      else if (p.tipo === 'cel') { fxc.globalAlpha = Math.sin(k * Math.PI) * (p.a || .55); fxc.fillStyle = p.cor; fxc.fillRect(p.x * S + 2, p.y * S + 2, S - 4, S - 4); }
      else if (p.tipo === 'nota') { p.y -= .6 * dt; p.x += Math.sin(p.t / 6) * .6; fxc.globalAlpha = 1 - k; fxc.fillStyle = p.cor; fxc.font = '900 18px Nunito'; fxc.fillText(p.txt, p.x, p.y); }
    }
    fxc.globalAlpha = 1;
    FX.raf = ps.length ? requestAnimationFrame(loopFX) : 0;
  }
  function addFX(p) { p.t = 0; FX.parts.push(p); if (!FX.raf) FX.raf = requestAnimationFrame(loopFX); }
  function explosao(x, y, cor, n, forca, g) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * (forca || 3); addFX({ tipo: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (g ? 1.5 : 0), g: g || 0, vida: 22 + Math.random() * 22, cor, r: 2 + Math.random() * 3 }); } }
  function brilhoSubindo(x, y, cor, n) { for (let i = 0; i < n; i++) addFX({ tipo: 'dot', x: x + (Math.random() - .5) * 40, y: y + 10 + Math.random() * 10, vx: (Math.random() - .5) * .3, vy: -.6 - Math.random() * 1.2, vida: 40 + Math.random() * 25, cor, r: 2 + Math.random() * 2 }); }
  function projetil(a, b, cor, ms, extra) { return new Promise(res => addFX(Object.assign({ tipo: 'proj', x0: a.x, y0: a.y, x1: b.x, y1: b.y, cor, vida: Math.max(8, (ms || 300) / 16.7), fim: res }, extra || {}))); }

  /* =============== TEXTOS FLUTUANTES =============== */
  const pilha = {};
  function flutuar(u, txt, cls) {
    const c = centro(u); const k = (pilha[u.id] = (pilha[u.id] || 0) + 1); setTimeout(() => { pilha[u.id]--; }, 500 / G.vel);
    const d = document.createElement('div'); d.className = 'float ' + (cls || ''); d.textContent = txt;
    d.style.left = c.x + 'px'; d.style.top = (c.y - 36 - (k - 1) * 20) + 'px'; d.style.animationDuration = (1.1 / Math.sqrt(G.vel)) + 's';
    $('board').appendChild(d); setTimeout(() => d.remove(), 1300 / Math.sqrt(G.vel));
  }
  function dado(u, ev) {
    const c = centro(u); const d = document.createElement('div');
    d.className = 'die ' + (ev.r === 20 ? 'n20 ' : ev.r === 1 ? 'n1 ' : '') + (ev.acerto ? 'ok' : 'no');
    d.innerHTML = `<span class="d">${ev.r}</span>${ev.bonus >= 0 ? '+' : ''}${ev.bonus} = <b>${ev.total}</b> <span style="opacity:.8">vs Def ${ev.def}</span>`;
    d.style.left = c.x + 'px'; d.style.top = (c.y - 34) + 'px'; $('board').appendChild(d);
    setTimeout(() => d.remove(), 1000 / G.vel);
  }
  function fita(u) {
    const f = document.createElement('div'); f.className = 'fita ' + u.lado;
    f.innerHTML = `<i style="background-image:${TOK(u.token)}"></i><span>${ehIA(u) ? '' : 'Sua vez: '}<b>${u.nome}</b></span>`;
    f.style.animationDuration = (1.5 / G.vel) + 's'; $('board').appendChild(f); setTimeout(() => f.remove(), 1600 / G.vel);
  }
  async function banner(txt, ms) { const b = $('banner'); b.textContent = txt; b.classList.remove('go'); void b.offsetWidth; b.style.animationDuration = (1.2 / G.vel) + 's'; b.classList.add('go'); await sleep(ms || 700); }
  function tremer() { const w = $('wrap'); w.classList.remove('shk'); void w.offsetWidth; w.classList.add('shk'); }

  /* =============== EVENTOS -> ANIMAÇÃO =============== */
  const SOM_FX = { seta: 'magia', fogo: 'fogo', explosao: 'fogo', lava: 'fogo', raio: 'raio', gelo: 'gelo', cura: 'cura', bencao: 'buff', escudo: 'buff', velocidade: 'buff', armaEspiritual: 'buff', perdicao: 'sombra', trevas: 'sombra', raioRoxo: 'sombra', raioVerde: 'raio', medo: 'sombra', sono: 'magia', teia: 'magia', leque: 'magia', som: 'raio', luz: 'gelo', acido: 'sopro' };
  async function tocar(evs, ator) {
    const stt = id => (G.stats[id] = G.stats[id] || { dano: 0, cura: 0, abates: 0 });
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i]; const u = e.id ? R.porId(G.st, e.id) : null;
      if (e.t === 'turno') ator = null;
      const A = ator && R.porId(G.st, ator);
      if (A && u && e.t === 'dano' && u.lado !== A.lado) stt(ator).dano += e.v;
      if (A && u && e.t === 'cura' && u.lado === A.lado) stt(ator).cura += e.v;
      if (A && u && e.t === 'morte' && u.lado !== A.lado) stt(ator).abates++;
      switch (e.t) {
        case 'turno': {
          for (const id in G.toks) G.toks[id].classList.toggle('act', id === e.id);
          atualizarOrdem(); atualizarCartao(); if (u && u.vivo) SOM.tocar('turno');
          if (u && u.vivo && !R.incapaz(u)) fita(u);
          await sleep(120); break;
        }
        case 'rodada': SOM.tocar('rodada'); await banner('Rodada ' + e.rodada, 500); break;
        case 'mover': await animarMovimento(u, e.caminho, e.investida, e.empurrao); break;
        case 'manobra': await animarManobra(e); break;
        case 'ataque': if (e.oportunidade) { const A = R.porId(G.st, e.de); flutuar(A, '⚡ oportunidade!', 'crit'); SOM.tocar('critico'); await sleep(350); } await animarAtaque(e, evs, i); break;
        case 'dano': {
          const tk = G.toks[e.id]; atualizarToken(u);
          const crit = evs[i - 1] && evs[i - 1].t === 'ataque' && evs[i - 1].critico;
          flutuar(u, e.v > 0 ? String(e.v) : '0', crit ? 'crit' : 'dmg');
          if (e.v > 0) { tk.classList.remove('hit', 'shake'); void tk.offsetWidth; tk.classList.add('hit', 'shake'); explosao(centro(u).x, centro(u).y, e.tipo === 'fogo' ? '#ff8a2a' : e.tipo === 'ácido' ? '#9dff3a' : e.tipo === 'eletricidade' ? '#bfe9ff' : e.tipo === 'frio' ? '#dff8ff' : e.tipo === 'luz' ? '#fff6b8' : '#ff4a4a', Math.min(26, 6 + e.v), 3.5); }
          if (!evs[i - 1] || evs[i - 1].t !== 'ataque') SOM.tocar('acerto');
          await sleep(e.v > 0 ? 260 : 120); break;
        }
        case 'cura': atualizarToken(u); flutuar(u, '+' + e.v, 'heal'); brilhoSubindo(centro(u).x, centro(u).y, '#8dffa4', 16); SOM.tocar('cura'); await sleep(300); break;
        case 'cond': atualizarToken(u); flutuar(u, (ICON_COND[e.cond] || '') + ' ' + (R.NOME_COND[e.cond] || e.cond), 'txt'); if (e.cond === 'inconsciente') { SOM.tocar('queda'); } await sleep(240); break;
        case 'fimCond': atualizarToken(u); break;
        case 'morte': { atualizarToken(u); const c = centro(u); explosao(c.x, c.y, '#e9e4ff', 30, 2.5, .05); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 10, r1: 46, vida: 30, cor: '#ffffff' }); SOM.tocar('morte'); flutuar(u, '☠', 'crit'); await sleep(450); break; }
        case 'texto': flutuar(u, e.txt, 'txt'); await sleep(200); break;
        case 'pm': if (e.v) flutuar(u, e.v + ' PM', 'pm'); break;
        case 'resist': flutuar(u, `${{ fort: 'Fort', ref: 'Ref', von: 'Von' }[e.teste]} ${e.total} ${e.ok ? '✓' : '✗'}`, 'txt'); await sleep(140); break;
        case 'magia': await animarMagia(e); break;
        case 'fx': await animarFx(e); break;
        case 'teia': desenharDestaques(); break;
      }
    }
    for (const u of G.st.unidades) atualizarToken(u);
  }
  async function animarMovimento(u, cam, investida, empurrao) {
    const d = G.toks[u.id]; const passo = investida ? 70 : empurrao ? 60 : 110; if (empurrao) { SOM.tocar('acerto'); tremer(); }
    d.style.transition = `left ${passo / G.vel}ms linear, top ${passo / G.vel}ms linear`;
    for (let k = 1; k < cam.length; k++) { d.style.left = cam[k][0] * S + 'px'; d.style.top = cam[k][1] * S + 'px'; SOM.tocar('passo'); if (investida) addFX({ tipo: 'dot', x: cam[k][0] * S + 26, y: cam[k][1] * S + 46, vx: 0, vy: -.3, vida: 20, cor: '#e8d3a0', r: 5 }); await sleep(passo); }
    const f = cam[cam.length - 1]; d.style.transition = ''; d.style.left = f[0] * S + 'px'; d.style.top = f[1] * S + 'px';
  }
  async function animarAtaque(e) {
    const a = R.porId(G.st, e.de), b = R.porId(G.st, e.para); const ta = G.toks[e.de];
    const ca = centro(a), cb = centro(b);
    SOM.tocar('dado'); dado(a, e); await sleep(380);
    if (e.distancia) {
      SOM.tocar('flecha');
      await projetil(ca, cb, a.lado === 'h' ? '#ffe9a8' : '#ffb3b3', 260 + R.distEuc(a, b) * 18, { flecha: true, arco: 12, r: 3 });
    } else {
      const dx = (cb.x - ca.x) * .35, dy = (cb.y - ca.y) * .35;
      SOM.tocar('swing');
      await ta.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 260 / G.vel, easing: 'ease-out' }).finished.catch(() => { });
    }
    if (!e.acerto) { flutuar(b, 'errou', 'miss'); SOM.tocar('erro'); await sleep(220); return; }
    if (e.critico) { SOM.tocar('critico'); tremer(); flutuar(a, 'CRÍTICO!', 'crit'); addFX({ tipo: 'anel', x: cb.x, y: cb.y, r0: 8, r1: 60, vida: 26, cor: '#ffd23f', lw: 8 }); }
    else SOM.tocar('acerto');
  }
  async function animarManobra(e) {
    const a = R.porId(G.st, e.de), b = R.porId(G.st, e.para); const ca = centro(a), cb = centro(b);
    const d = document.createElement('div'); d.className = 'die ' + (e.ok ? 'ok' : 'no');
    d.innerHTML = `🤼 ${{ agarrar: 'Agarrar', empurrar: 'Empurrar', derrubar: 'Derrubar', escapar: 'Escapar' }[e.manobra]} <b>${e.a}</b> vs ${e.b}`;
    d.style.left = ca.x + 'px'; d.style.top = (ca.y - 34) + 'px'; $('board').appendChild(d); setTimeout(() => d.remove(), 1000 / G.vel);
    SOM.tocar('dado'); await sleep(350); SOM.tocar('swing');
    await G.toks[e.de].animate([{ transform: 'translate(0,0)' }, { transform: `translate(${(cb.x - ca.x) * .4}px,${(cb.y - ca.y) * .4}px)` }, { transform: 'translate(0,0)' }], { duration: 300 / G.vel }).finished.catch(() => { });
    flutuar(b, e.ok ? { agarrar: 'agarrado!', empurrar: 'empurrado!', derrubar: 'derrubado!', escapar: 'livre!' }[e.manobra] : 'resistiu', e.ok ? 'txt' : 'miss');
    if (e.ok) { SOM.tocar(e.manobra === 'derrubar' ? 'queda' : 'acerto'); explosao(cb.x, cb.y, '#e8d3a0', 14, 2.5); } else SOM.tocar('erro');
    await sleep(250);
  }
  async function animarMagia(e) {
    const u = R.porId(G.st, e.id); const c = centro(u); const cor = e.cor || '#b98cff';
    SOM.tocar(SOM_FX[e.fx] || 'magia');
    addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 34, r1: 6, vida: 20, cor, lw: 4 }); brilhoSubindo(c.x, c.y, cor, 10); await sleep(220);
    const M = D.MAGIAS[e.magia] || { forma: 'linha' };
    if (e.celulas && e.celulas.length) {
      if (M.forma === 'linha' || e.magia === 'sopro' && !D.MAGIAS[e.magia]) {
        const f = e.celulas[e.celulas.length - 1]; addFX({ tipo: 'feixe', x0: c.x, y0: c.y, x1: f.x * S + 26, y1: f.y * S + 26, vida: 34, cor, lw: e.fx === 'raio' ? 8 : 16, zig: e.fx === 'raio' });
      } else if (M.forma === 'esfera' && e.ponto) {
        const p = { x: e.ponto.x * S + 26, y: e.ponto.y * S + 26 }; await projetil(c, p, cor, 380, { r: 9, arco: 30 });
        addFX({ tipo: 'disco', x: p.x, y: p.y, r: (M.tamanho + .5) * S, vida: 36, cor }); explosao(p.x, p.y, cor, 70, 7); explosao(p.x, p.y, '#ffe27a', 30, 4); tremer();
      }
      for (const cel of e.celulas) addFX({ tipo: 'cel', x: cel.x, y: cel.y, vida: 34, cor, a: .55 });
      if (M.forma === 'cone' || M.forma === 'cubo' || M.forma.startsWith('aura')) for (const cel of e.celulas) if (Math.random() < (M.forma.startsWith('aura') ? .15 : .6)) explosao(cel.x * S + 26, cel.y * S + 26, cor, 3, 1.5);
      await sleep(300);
    } else if (e.alvos && e.alvos.length) {
      for (const id of e.alvos) {
        const o = R.porId(G.st, id); const co = centro(o);
        if (o === u || M.forma === 'si' || M.alcance === 'toque' && o.lado === u.lado) { addFX({ tipo: 'anel', x: co.x, y: co.y, r0: 6, r1: 40, vida: 30, cor, lw: 6 }); brilhoSubindo(co.x, co.y, cor, 18); continue; }
        if (e.fx === 'seta') continue; // as setas saem como fx próprios
        if (['raio', 'gelo', 'raioRoxo', 'luz', 'raioVerde'].includes(e.fx)) addFX({ tipo: 'feixe', x0: c.x, y0: c.y, x1: co.x, y1: co.y, vida: 26, cor, lw: e.fx === 'gelo' ? 14 : 8, zig: e.fx === 'raio' });
        else await projetil(c, co, cor, 320, { r: e.fx === 'lava' ? 9 : 6 });
        explosao(co.x, co.y, cor, 24, 3.5);
        if (e.fx === 'lava') { addFX({ tipo: 'disco', x: co.x, y: co.y, r: 80, vida: 26, cor }); tremer(); }
        if (e.fx === 'gelo') addFX({ tipo: 'anel', x: co.x, y: co.y, r0: 40, r1: 8, vida: 30, cor: '#ffffff', lw: 6 });
      }
      await sleep(160);
    }
  }
  async function animarFx(e) {
    const a = e.de ? R.porId(G.st, e.de) : null, b = e.para ? R.porId(G.st, e.para) : null;
    if (e.fx === 'seta') { await projetil(centro(a), centro(b), e.cor || '#b98cff', 240, { r: 5, arco: (Math.random() - .5) * 60 }); explosao(centro(b).x, centro(b).y, e.cor || '#b98cff', 10, 2.5); return; }
    if (e.fx === 'armaEspiritual') {
      const ar = G.toks[a.id] && G.toks[a.id].querySelector('.arma'); if (ar) ar.style.opacity = 0;
      SOM.tocar('swing'); const c0 = centro(a); c0.x += 26; c0.y -= 10;
      await projetil(c0, centro(b), '#ffe27a', 230, { r: 6, arco: -40 });
      const c = centro(b); SOM.tocar('acerto'); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 8, r1: 34, vida: 18, cor: '#ffe27a', lw: 5 }); explosao(c.x, c.y, '#fff3b0', 16, 3.5); tremer();
      if (ar) setTimeout(() => { ar.style.opacity = ''; }, 250); await sleep(120); return;
    }
    if (e.fx === 'furia') { SOM.tocar('furia'); const c = centro(a); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 6, r1: 56, vida: 30, cor: '#ff3b2f', lw: 8 }); explosao(c.x, c.y, '#ff6a2f', 40, 4, -.02); tremer(); await sleep(300); return; }
    if (e.fx === 'baluarte') { SOM.tocar('buff'); const c = centro(a); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 44, r1: 30, vida: 34, cor: '#9fd0ff', lw: 9 }); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 20, r1: 40, vida: 30, cor: '#ffffff', lw: 3 }); await sleep(250); return; }
    if (e.fx === 'cura') { const c = centro(b); brilhoSubindo(c.x, c.y, '#fff3a0', 14); return; }
    if (e.fx === 'marca') { SOM.tocar('buff'); const c = centro(b); addFX({ tipo: 'anel', x: c.x, y: c.y, r0: 50, r1: 14, vida: 28, cor: '#ff5f66', lw: 4 }); await sleep(250); return; }
    if (e.fx === 'finta') { SOM.tocar('swing'); const c = centro(b); for (let i = 0; i < 6; i++) addFX({ tipo: 'nota', x: c.x - 20 + i * 8, y: c.y - 10, txt: ['?', '!', '♠', '♦'][i % 4], vida: 40, cor: '#ffe27a' }); await sleep(250); return; }
    if (e.fx === 'inspiracao') { SOM.tocar('buff'); for (const o of R.aliadosDe(G.st, a)) { const c = centro(o); for (let i = 0; i < 3; i++) addFX({ tipo: 'nota', x: c.x - 14 + i * 12, y: c.y - 6 - i * 6, txt: i % 2 ? '♪' : '♫', vida: 55, cor: '#ffe27a' }); } await sleep(350); return; }
  }

  /* =============== PAINÉIS =============== */
  function atualizar() {
    if (!G.st) return;
    for (const u of G.st.unidades) atualizarToken(u);
    const cur = R.atual(G.st); for (const id in G.toks) G.toks[id].classList.toggle('act', !!cur && id === cur.id && !G.st.fim);
    atualizarOrdem(); atualizarCartao(); atualizarAcoes(); atualizarLog(); desenharDestaques(); previsao();
  }
  const ehIA = u => u && (u.lado === 'm' ? G.ia.m : G.ia.h);
  function atualizarOrdem() {
    const st = G.st; const o = $('order'); const n = st.ordem.length; let html = `<div class="rd">RODADA<b>${st.rodada}</b></div>`;
    for (let k = 0; k < n; k++) {
      const id = st.ordem[(st.vez + k) % n]; const u = R.porId(st, id); if (!u.vivo) continue;
      html += `<div class="op ${u.lado}${k === 0 ? ' now' : ''}${R.incapaz(u) ? ' ko' : ''}" data-id="${u.id}"><div style="background-image:${TOK(u.token)}"><i>${st.iniciativa[u.id]}</i></div><span>${u.nome.split(' ')[0]}</span></div>`;
    }
    o.innerHTML = html;
    o.querySelectorAll('.op').forEach(el => { el.onclick = () => { G.inspect = el.dataset.id; atualizarCartao(); }; });
  }
  function atualizarCartao() {
    const st = G.st; const u = R.porId(st, G.inspect) || R.atual(st); if (!u) return;
    const pv = Math.max(0, u.pv) / u.pvMax * 100, pm = u.pmMax ? u.pm / u.pmMax * 100 : 0;
    const conds = Object.keys(u.cond).map(k => `<span class="cond ${BOAS.has(k) ? '' : 'bad'}">${ICON_COND[k] || ''} ${R.NOME_COND[k] || k}</span>`)
      .concat(Object.keys(u.buff).filter(k => NOME_BUFF[k] && u.buff[k]).map(k => `<span class="cond">${ICON_BUFF[k]} ${NOME_BUFF[k]}${typeof u.buff[k] === 'number' && u.buff[k] > 0 && k !== 'armaEspiritual' ? ' +' + u.buff[k] : ''}</span>`));
    const def = R.defesa(st, u, null, 'cac').valor;
    let linhas = '';
    if (u.lado === 'h') {
      const a = u.arma; linhas = `${a.nome}: ${a.distancia ? 'Pontaria' : 'Luta'} +${(a.distancia ? u.per.pont : u.per.luta) + a.bonusItem}, ${a.dano[0]}d${a.dano[1]}${R.perfisDeAtaque(u, !!a.distancia)[0].dano[2] ? '+' + R.perfisDeAtaque(u, !!a.distancia)[0].dano[2] : ''}, crítico ${a.margem}/×${a.mult}.`;
      const habs = (u.habilidades || []).map(h => D.HABILIDADES[h].nome); if (habs.length) linhas += `<br><b>Poderes:</b> ${habs.join(', ')}.`;
      if (u.magias.length) linhas += `<br><b>Magias (${u.circulo}º círculo, CD ${u.cd}):</b> ${u.magias.map(m => D.MAGIAS[m].nome).join(', ')}.`;
    } else {
      linhas = u.ataques.map(a => `${a.nome} +${a.bonus} (${a.dano[0]}d${a.dano[1]}+${a.dano[2]})`).join(', ') + (u.ataques.length > 1 ? ' — todos na mesma ação.' : '.');
      if (u.distancia) linhas += `<br>${u.distancia.nome} +${u.distancia.bonus} (${u.distancia.dano[0]}d${u.distancia.dano[1]}+${u.distancia.dano[2]}).`;
      if (u.magias.length) linhas += `<br><b>Magias:</b> ${u.magias.map(m => D.MAGIAS[m].nome).join(', ')} (CD ${u.cd}).`;
      if (u.rd) linhas += `<br>Redução de dano ${u.rd}.`; if (u.furtivo) linhas += `<br>Ataque furtivo +${u.furtivo[0]}d6.`; if (u.sopro) linhas += `<br>${u.sopro.nome}: ${u.sopro.dano[0]}d${u.sopro.dano[1]} em linha (Ref CD ${u.sopro.cd})${u.sopro.pronto ? ', recarrega em ' + u.sopro.pronto : ', pronto!'}.`;
      if (u.aprox) linhas += `<br><i style="opacity:.7">Ficha aproximada.</i>`;
    }
    $('card').innerHTML = `
      <div class="big" style="background-image:${TOK(u.token)}"><span class="side ${u.lado}">${u.lado === 'h' ? 'HERÓI' : 'INIMIGO'}${ehIA(u) ? ' · IA' : ''}</span><b>${u.nome}</b><small>${u.lado === 'h' ? `${u.classeNome} ${u.nivel}` : `ND ${u.ndTxt}`}</small></div>
      <div class="bar"><div class="t"><span>PV</span><span>${u.pv} / ${u.pvMax}</span></div><div class="b"><i class="lag" style="width:${pv}%"></i><i style="width:${pv}%"></i></div></div>
      ${u.pmMax ? `<div class="bar pm"><div class="t"><span>PM</span><span>${u.pm} / ${u.pmMax}</span></div><div class="b"><i style="width:${pm}%"></i></div></div>` : ''}
      <div class="stats"><div><small>DEFESA</small><b>${def}</b></div><div><small>DESLOC.</small><b>${R.deslocAtual(u) * 1.5}m</b></div><div><small>INICIAT.</small><b>${u.per.inic >= 0 ? '+' : ''}${u.per.inic}</b></div>
      <div><small>FORT</small><b>+${u.per.fort}</b></div><div><small>REF</small><b>+${u.per.ref}</b></div><div><small>VON</small><b>+${u.per.von}</b></div></div>
      ${conds.length ? `<div class="conds">${conds.join('')}</div>` : ''}
      <div class="extra">${linhas}</div>`;
  }
  function atualizarLog() {
    const L = G.st.log; const box = $('logIn');
    for (; G.logN < L.length; G.logN++) { const p = document.createElement('p'); const t = L[G.logN]; p.textContent = t; p.className = 'new' + (t.startsWith('—') || t.startsWith('⚔') ? ' r' : ''); box.appendChild(p); }
    while (box.children.length > 120) box.firstChild.remove();
    const lg = $('log'); lg.scrollTop = lg.scrollHeight;
  }

  /* ---------- ações do jogador ---------- */
  function stepper(rot, val, min, max, on) {
    const id = 's' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => { const el = document.getElementById(id); if (!el) return; el.querySelector('.m').onclick = () => { if (val > min) { on(val - 1); SOM.tocar('clique'); } }; el.querySelector('.p').onclick = () => { if (val < max) { on(val + 1); SOM.tocar('clique'); } }; });
    return `<div class="stepper" id="${id}"><span>${rot}</span><button class="m">–</button><b>${val}</b><button class="p">+</button></div>`;
  }
  function atualizarAcoes() {
    const st = G.st, el = $('acts'); if (G.prep) return painelPreparo(); const u = R.atual(st);
    if (!u || st.fim) { el.innerHTML = '<h3>Batalha encerrada</h3>'; return; }
    const ac = u.acoes;
    const pips = `<span class="pips"><span class="pip ${ac.padrao ? 'ok' : ''}">PADRÃO</span><span class="pip ${ac.movimento ? 'ok' : ''}">MOV.</span>${u.buff.velocidade ? `<span class="pip ${ac.extra ? 'ok' : ''}">EXTRA</span>` : ''}</span>`;
    if (ehIA(u)) { el.innerHTML = `<h3>${u.nome.split(' ')[0]} ${pips}</h3><div class="hint">🤖 A IA está jogando este turno…</div>`; return; }
    const ops = R.opcoes(st); G.ops = ops; const sel = G.sel || {};
    let h = `<h3>Turno de ${u.nome.split(' ')[0]} ${pips}</h3>`;
    const b = (id, ic, txt, pode, extra, on) => `<button class="abtn${on ? ' on' : ''}" data-a="${id}" ${pode ? '' : 'disabled'}><span class="ic">${ic}</span>${txt}${extra ? `<span class="c">${extra}</span>` : ''}</button>`;
    const temCac = !!R.perfisDeAtaque(u, false), temDist = !!R.perfisDeAtaque(u, true);
    if (temCac) h += b('atacar', '⚔', 'Atacar', ops.atacar.length > 0, ops.atacar.length ? ops.atacar.length + ' alvo' + (ops.atacar.length > 1 ? 's' : '') : 'ninguém adjacente', sel.modo === 'atacar');
    if (temDist) h += b('distancia', '🏹', 'Atirar', ops.distancia.length > 0, '', sel.modo === 'distancia');
    if (temCac) h += b('investida', '🐂', 'Investida', ops.investida.length > 0, 'ação completa', sel.modo === 'investida');
    // modificadores de ataque
    if (u.lado === 'h' && (u.habilidades.includes('ataqueEspecial') || u.habilidades.includes('golpeDivino') || u.habilidades.includes('ataqueExtra')) && (ac.padrao || ac.extra)) {
      const m = G.mods; const k = 1 + Math.floor(u.nivel / 4); let sub = '';
      if (u.habilidades.includes('ataqueEspecial')) { sub += stepper('Ataque Especial: +4 no ataque (1 PM cada)', m.aeAtaque || 0, 0, k - (m.aeDano || 0), v => { G.mods.aeAtaque = v; atualizarAcoes(); previsao(); }); sub += stepper('Ataque Especial: +4 no dano (1 PM cada)', m.aeDano || 0, 0, k - (m.aeAtaque || 0), v => { G.mods.aeDano = v; atualizarAcoes(); previsao(); }); }
      if (u.habilidades.includes('golpeDivino')) sub += stepper('Golpe Divino: +Car e +Xd8 de luz (2 PM, +1 por dado)', m.golpeDivino || 0, 0, k, v => { G.mods.golpeDivino = v; atualizarAcoes(); previsao(); });
      if (u.habilidades.includes('ataqueExtra')) sub += stepper('Ataque Extra: um golpe a mais (2 PM)', m.ataqueExtra ? 1 : 0, 0, 1, v => { G.mods.ataqueExtra = !!v; atualizarAcoes(); previsao(); });
      const custo = (m.aeAtaque || 0) + (m.aeDano || 0) + (m.golpeDivino ? 2 + m.golpeDivino - 1 : 0) + (m.ataqueExtra ? 2 : 0);
      sub += `<div class="desc">Custo do ataque: <b style="color:${custo > Math.min(u.pm, u.nivel) ? 'var(--red)' : 'var(--pm)'}">${custo} PM</b> (limite ${u.nivel} por ação, você tem ${u.pm}).</div>`;
      h += `<div class="sub">${sub}</div>`;
    }
    // magias
    if (u.magias.length) {
      h += b('magias', '✨', 'Magias', ac.padrao && !u.buff.furia, u.buff.furia ? 'em fúria' : u.magias.length, sel.modo === 'magiasLista' || sel.modo === 'magia');
      if (sel.modo === 'magiasLista' || sel.modo === 'magia') {
        let sub = '';
        for (const mid of u.magias) {
          const M = D.MAGIAS[mid]; const c = M.custoFixo || D.CUSTO_CIRCULO[M.circulo];
          sub += `<button class="abtn${sel.magia === mid ? ' on' : ''}" data-m="${mid}" title="${M.desc.replace(/"/g, '')}" ${u.pm >= c && ac.padrao ? '' : 'disabled'}><span class="ic">${M.circulo}º</span>${M.nome}<span class="c">${c} PM</span></button>`;
          if (sel.magia === mid) sub += painelMagia(u, mid);
        }
        h += `<div class="sub">${sub}</div>`;
      }
    }
    // habilidades
    const habs = ops.habilidades;
    for (const hb of habs) {
      const nome = hb.id === 'sopro' ? u.sopro.nome : D.HABILIDADES[hb.id].nome;
      const ic = { furia: '😡', curaMaos: '✋', marcaPresa: '🎯', fintar: '🃏', inspiracao: '🎵', sopro: '🐉', baluarte: '🛡', desafio: '⚔' }[hb.id];
      const custo = { furia: '2 PM · livre', curaMaos: '1 PM · mov.', marcaPresa: '1 PM · mov.', fintar: 'padrão', inspiracao: '2 PM · padrão', sopro: 'padrão', baluarte: '1 PM · livre', desafio: '1 PM · mov.' }[hb.id];
      h += b('h:' + hb.id, ic, nome, hb.pode, custo, sel.modo === 'hab' && sel.hab === hb.id);
      if (sel.modo === 'hab' && sel.hab === hb.id) h += painelHab(u, hb.id);
    }
    if ((ops.manobras || []).length || sel.modo === 'manobra') {
      h += b('manobras', '🤼', 'Manobra', ops.manobras.length > 0, 'padrão', sel.modo === 'manobraLista' || sel.modo === 'manobra');
      if (sel.modo === 'manobraLista' || sel.modo === 'manobra') {
        h += `<div class="sub"><div class="desc">Teste de Luta contra Luta do alvo (criatura grande +5). Clique na manobra e depois no inimigo adjacente.</div>`;
        for (const [id, ic, nome, desc] of [['agarrar', '🤼', 'Agarrar', 'imóvel, desprevenido e –2 nos ataques'], ['empurrar', '💥', 'Empurrar', '1,5 m (+1,5 m a cada 5 pontos de vantagem)'], ['derrubar', '⤵', 'Derrubar', 'fica caído']])
          h += `<button class="abtn${sel.manobra === id ? ' on' : ''}" data-mb="${id}" title="${desc}"><span class="ic">${ic}</span>${nome}<span class="c">${desc}</span></button>`;
        h += '</div>';
      }
    }
    if (u.buff.armaEspiritual && u.buff.armaEspiritual.ataque) h += b('arma', '🗡', 'Arma Espiritual golpeia', ops.armaEspiritual.length > 0, ops.armaEspiritual.length ? 'livre · 2d6 automático' : 'já agiu nesta rodada', sel.modo === 'arma');
    if (ops.escapar) h += b('escapar', '🔓', 'Escapar do agarrão', true, 'padrão');
    if (ops.soltar) h += b('soltar', '✋', 'Soltar quem está agarrando', true, 'livre');
    for (const it of ops.itens || []) {
      const ic = { pocao: '🧪', pocaoMaior: '🧪', oleo: '🫙', protecao: '✨', velocidade: '⚡', granada: '💣' }[it.id] || '🎒';
      h += b('i:' + it.k, ic, it.nome, it.pode, (it.acao === 'padrao' ? 'padrão' : 'mov.') + ' · cinto', sel.modo === 'item' && sel.slot === it.k);
    }
    if (ops.levantar) h += b('levantar', '⬆', 'Levantar-se', true, 'mov.');
    if (ops.apagar) h += b('apagar', '🧯', 'Apagar as chamas', true, 'padrão');
    if (G.undo && G.undo.turnoId === st.turnoId) h += b('desfazer', '↩', 'Desfazer movimento', true, 'Z');
    h += b('fim', '⏭', 'Encerrar turno', true, 'E');
    h += `<div class="hint" id="dica">${dica(u, ops)}</div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-a]').forEach(x => x.onclick = () => clicarAcao(x.dataset.a));
    el.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { SOM.tocar('clique'); G.sel = { modo: 'magia', magia: x.dataset.m, aprim: {} }; atualizarAcoes(); desenharDestaques(); });
    el.querySelectorAll('[data-cast]').forEach(x => x.onclick = () => lancarSemAlvo());
    el.querySelectorAll('[data-mb]').forEach(x => x.onclick = () => { SOM.tocar('clique'); G.sel = { modo: 'manobra', manobra: x.dataset.mb }; atualizarAcoes(); desenharDestaques(); });
    el.querySelectorAll('[data-hgo]').forEach(x => x.onclick = () => usarHabSemAlvo());
  }
  function dica(u, ops) {
    const s = G.sel || {};
    if (s.modo === 'magia') { const M = D.MAGIAS[s.magia]; if (M.forma === 'alvo' && !(s.magia === 'toqueChocante' && s.aprim.area)) return '👉 Clique num alvo destacado.'; if (['esfera', 'cubo'].includes(M.forma)) return '👉 Escolha o ponto central da área no mapa.'; if (['cone', 'linha'].includes(M.forma)) return '👉 Aponte a direção no mapa e clique.'; return ''; }
    if (s.modo === 'item') { const it = (ops.itens || []).find(x => x.k === s.slot); return it && it.id === 'granada' ? '👉 Clique num inimigo a até 30 m: explode nele e em quem estiver ao lado (inclusive aliados).' : '👉 Clique em você ou num aliado adjacente (funciona em desmaiados).'; }
    if (s.modo === 'manobra') return '👉 Clique num inimigo adjacente.';
    if (s.modo === 'arma') return '👉 Clique num inimigo a até 9 m: a arma acerta sozinha (2d6). Depois ela não contra-ataca até seu próximo turno.';
    if (s.modo === 'manobraLista') return 'Escolha a manobra.';
    if (s.modo === 'investida') return '👉 Clique no inimigo para a investida (+2 no ataque, –2 na Defesa até seu próximo turno).';
    if (s.modo === 'hab') { if (s.hab === 'curaMaos') return '👉 Clique em você ou num aliado adjacente.'; if (['marcaPresa', 'fintar', 'desafio'].includes(s.hab)) return '👉 Clique num inimigo.'; if (s.hab === 'sopro') return '👉 Aponte a direção do sopro.'; return ''; }
    const p = [];
    if (ops.mover) p.push('azul = mover'); if (ops.atacar.length || ops.distancia.length) p.push('vermelho = atacar');
    return p.length ? 'Clique no mapa: ' + p.join(', ') + '. Esc cancela.' : 'Sem ações úteis: encerre o turno.';
  }
  function painelMagia(u, mid) {
    const M = D.MAGIAS[mid]; const s = G.sel; let h = `<div class="sub" style="background:#0e1838"><div class="desc">${M.desc}</div>${legendaMagia(M, mid, s.aprim)}`;
    for (const a of M.aprim || []) {
      if (a.circulo && a.circulo > u.circulo) { h += `<div class="desc" style="opacity:.55">🔒 ${a.nome} (${a.circulo}º círculo)</div>`; continue; }
      const max = a.repetivel ? 9 : 1;
      h += stepper(`+${a.custo} PM: ${a.nome}`, s.aprim[a.id] || 0, 0, max, v => { s.aprim[a.id] = v; atualizarAcoes(); desenharDestaques(); });
    }
    const cm = R.custoMagia(u, mid, s.aprim);
    h += `<div class="desc">Custo: <b style="color:${cm.erros.length ? 'var(--red)' : 'var(--pm)'}">${cm.custo} PM</b>${M.resist ? ` · ${{ fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' }[M.resist.teste]} CD ${u.cd}` : ''}${cm.erros.length ? '<br><span style="color:#ff9aa0">' + cm.erros[0] + '</span>' : ''}</div>`;
    if (mid === 'setaInfalivel') { const qt = s.aprim.cinco ? 5 : s.aprim.tres ? 3 : 2; h += `<div class="hint">Clique nos alvos, um por seta: ${(s.alvos || []).length}/${qt} escolhidas. Pode repetir o mesmo alvo.</div>`; }
    const semAlvo = M.forma === 'si' || M.forma.startsWith('aura') || (mid === 'toqueChocante' && s.aprim.area);
    if (semAlvo) h += `<button class="btn gold" data-cast ${cm.erros.length ? 'disabled' : ''}>Lançar ${M.nome}</button>`;
    return h + '</div>';
  }
  function painelHab(u, hab) {
    const s = G.sel; let h = `<div class="sub" style="background:#0e1838"><div class="desc">${hab === 'sopro' ? `Linha de 15 m: ${u.sopro.dano[0]}d${u.sopro.dano[1]} de ácido (Reflexos CD ${u.sopro.cd} reduz à metade).` : D.HABILIDADES[hab].desc}</div>`;
    if (hab === 'furia') { h += stepper('Fúria maior (+1 PM cada)', s.extra || 0, 0, Math.floor(u.nivel / 5), v => { s.extra = v; atualizarAcoes(); }); h += `<button class="btn gold" data-hgo>Entrar em fúria (${2 + (s.extra || 0)} PM)</button>`; }
    if (hab === 'inspiracao') { h += stepper('Inspiração maior (+2 PM cada)', s.extra || 0, 0, Math.floor(u.nivel / 4), v => { s.extra = v; atualizarAcoes(); }); h += `<button class="btn gold" data-hgo>Inspirar (${2 + 2 * (s.extra || 0)} PM)</button>`; }
    if (hab === 'baluarte') { h += stepper('Baluarte maior (+1 PM, +2 Def)', s.extra || 0, 0, Math.floor(u.nivel / 4), v => { s.extra = v; atualizarAcoes(); }); h += `<button class="btn gold" data-hgo>Erguer o Baluarte (${1 + (s.extra || 0)} PM)</button>`; }
    if (hab === 'curaMaos') h += stepper('Cura maior (+1 PM, +1d8+1)', s.extra || 0, 0, Math.floor((u.nivel - 1) / 4), v => { s.extra = v; atualizarAcoes(); });
    return h + '</div>';
  }
  function clicarAcao(a) {
    SOM.tocar('clique'); const u = R.atual(G.st);
    if (a === 'fim') return agir({ tipo: 'fim' });
    if (a === 'desfazer') return desfazer();
    if (a === 'escapar') return agir({ tipo: 'manobra', manobra: 'escapar' });
    if (a === 'soltar') return agir({ tipo: 'soltar' });
    if (a === 'manobras') { G.sel = G.sel && (G.sel.modo === 'manobraLista' || G.sel.modo === 'manobra') ? null : { modo: 'manobraLista' }; atualizarAcoes(); desenharDestaques(); return; }
    if (a === 'levantar') return agir({ tipo: 'levantar' });
    if (a === 'apagar') return agir({ tipo: 'apagar' });
    if (a.startsWith('i:')) { const k = +a.slice(2); const it = (G.ops.itens || []).find(x => x.k === k); if (it && it.proprio) return agir({ tipo: 'item', slot: k, alvo: u.id }); G.sel = (G.sel && G.sel.modo === 'item' && G.sel.slot === k) ? null : { modo: 'item', slot: k }; atualizarAcoes(); desenharDestaques(); previsao(); return; }
    if (a === 'magias') { G.sel = (G.sel && (G.sel.modo === 'magiasLista' || G.sel.modo === 'magia')) ? null : { modo: 'magiasLista' }; }
    else if (a.startsWith('h:')) { const hab = a.slice(2); G.sel = (G.sel && G.sel.hab === hab) ? null : { modo: 'hab', hab, extra: 0 }; }
    else { G.sel = (G.sel && G.sel.modo === a) ? null : { modo: a }; }
    void u; atualizarAcoes(); desenharDestaques(); previsao();
  }
  function lancarSemAlvo() { const s = G.sel; agir({ tipo: 'magia', magia: s.magia, aprim: limpa(s.aprim) }); }
  function usarHabSemAlvo() { const s = G.sel; agir({ tipo: 'habilidade', hab: s.hab, extra: s.extra || 0 }); }
  const limpa = a => Object.fromEntries(Object.entries(a || {}).filter(([, v]) => v));

  /* ---------- destaques no mapa ---------- */
  const hlc = $('hl').getContext('2d');
  function celula(x, y, f, s, r) { hlc.fillStyle = f; hlc.beginPath(); hlc.roundRect(x * S + 2, y * S + 2, S - 4, S - 4, r === undefined ? 6 : r); hlc.fill(); if (s) { hlc.strokeStyle = s; hlc.lineWidth = 2; hlc.stroke(); } }
  function colchete(x, y, cor) { hlc.strokeStyle = cor || '#fff'; hlc.lineWidth = 4; const bx = x * S, by = y * S; [[0, 0, 1, 1], [S, 0, -1, 1], [0, S, 1, -1], [S, S, -1, -1]].forEach(([a, b, s, t]) => { hlc.beginPath(); hlc.moveTo(bx + a, by + b + t * 12); hlc.lineTo(bx + a, by + b); hlc.lineTo(bx + a + s * 12, by + b); hlc.stroke(); }); }
  function desenharDestaques() {
    hlc.clearRect(0, 0, W, H); const st = G.st; if (!st) return;
    // teia
    for (const c of st.teia) { hlc.strokeStyle = '#f4f1eacc'; hlc.lineWidth = 1.2; const X = c.x * S + 26, Y = c.y * S + 26; for (let k = 0; k < 6; k++) { hlc.beginPath(); hlc.moveTo(X, Y); hlc.lineTo(X + Math.cos(k * 1.047) * 25, Y + Math.sin(k * 1.047) * 25); hlc.stroke(); } for (const r of [8, 15, 22]) { hlc.beginPath(); for (let k = 0; k <= 6; k++) { const px = X + Math.cos(k * 1.047) * r, py = Y + Math.sin(k * 1.047) * r; k ? hlc.lineTo(px, py) : hlc.moveTo(px, py); } hlc.stroke(); } }
    for (const id in G.toks) G.toks[id].classList.remove('tgt');
    if (G.prep) {
      const zona = R.zonaHerois(st); const sel = G.prep.sel && R.porId(st, G.prep.sel);
      for (const c of zona) celula(c.x, c.y, sel ? 'rgba(255,214,90,.42)' : 'rgba(255,214,90,.26)', 'rgba(255,230,150,.85)');
      contorno(zona, '#ffd65a', []);
      if (sel) { G.toks[sel.id].classList.add('tgt'); }
      if (G.hover && sel && zona.some(c => c.x === G.hover.x && c.y === G.hover.y)) colchete(G.hover.x, G.hover.y, '#ffe27a');
      return;
    }
    const u = R.atual(st); if (!u || st.fim || ehIA(u) || G.busy) return;
    const ops = G.ops || R.opcoes(st); const s = G.sel || {}; const hv = G.hover;
    const marcar = ids => ids.forEach(id => { const o = R.porId(st, id); celula(o.x, o.y, o.lado === u.lado ? 'rgba(90,255,150,.38)' : 'rgba(255,80,85,.42)', o.lado === u.lado ? 'rgba(200,255,220,.9)' : 'rgba(255,190,190,.9)'); G.toks[id].classList.add('tgt'); });
    if (!s.modo || s.modo === 'atacar' || s.modo === 'distancia') {
      if (!s.modo && ops.mover) for (const c of ops.mover) celula(c.x, c.y, 'rgba(70,125,255,.40)', 'rgba(200,220,255,.75)');
      const alvos = s.modo === 'atacar' ? ops.atacar : s.modo === 'distancia' ? ops.distancia : [...new Set([...ops.atacar, ...ops.distancia])];
      marcar(alvos);
      if (!s.modo && hv && ops.mover && ops.mover.some(c => c.x === hv.x && c.y === hv.y)) setaCaminho(R.alcancaveis(st, u, R.deslocAtual(u)).caminho(hv.x, hv.y));
    } else if (s.modo === 'item') { const it = (ops.itens || []).find(x => x.k === s.slot); if (it) marcar(it.alvos);
    } else if (s.modo === 'manobra') { marcar(ops.manobras || []);
    } else if (s.modo === 'arma') { const cel = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (R.dist(u, { x, y }) <= 6 && R.visao(st, u, { x, y }).ve) cel.push({ x, y }); for (const c of cel) celula(c.x, c.y, 'rgba(255,255,255,.07)'); contorno(cel, 'rgba(255,255,255,.85)', [7, 5]); marcar(ops.armaEspiritual || []);
    } else if (s.modo === 'investida') {
      marcar(ops.investida);
      if (hv) { const o = R.unidadeEm(st, hv.x, hv.y); if (o && ops.investida.includes(o.id)) { const alc = R.alcancaveis(st, u, R.deslocAtual(u) * 2); const dest = alc.celulas.filter(c => R.adjacente(c, o)).sort((a, b) => a.custo - b.custo)[0]; if (dest) setaCaminho(alc.caminho(dest.x, dest.y)); } }
    } else if (s.modo === 'magia') {
      const M = D.MAGIAS[s.magia];
      // 1) ALCANCE: até onde você pode mirar (contorno tracejado branco)
      const alc = celulasAlcance(st, u, s.magia, s.aprim);
      if (alc) { for (const c of alc) celula(c.x, c.y, 'rgba(255,255,255,.07)'); contorno(alc, 'rgba(255,255,255,.9)', [7, 5]); }
      // 2) ÁREA: quem é atingido (preenchido na cor da magia)
      if (M.forma === 'alvo' && !(s.magia === 'toqueChocante' && s.aprim.area)) marcar(R.alvosValidosMagia(st, u, s.magia, s.aprim) || []);
      else if (M.forma === 'si') marcar([u.id]);
      else {
        let cel = null, fora = false;
        if (M.forma.startsWith('aura') || s.magia === 'toqueChocante') cel = R.areaMagia(st, u, s.magia, u, s.aprim);
        else if (['esfera', 'cubo'].includes(M.forma)) {
          if (hv) { cel = R.areaMagia(st, u, s.magia, hv, s.aprim); fora = !(R.dist(u, hv) <= R.alcanceMagia(M) && R.visao(st, u, hv).ve); }
        } else if (hv && !(hv.x === u.x && hv.y === u.y)) cel = R.areaMagia(st, u, s.magia, hv, s.aprim);
        if (cel && fora) { for (const c of cel) celula(c.x, c.y, 'rgba(120,120,130,.30)'); contorno(cel, 'rgba(200,200,210,.6)', [3, 4]); }
        else if (cel) { for (const c of cel) { const o = R.unidadeEm(st, c.x, c.y); celula(c.x, c.y, o ? (o.lado === u.lado && !M.aliadosApenas && M.forma !== 'auraAliados' ? 'rgba(255,220,60,.55)' : 'rgba(255,90,40,.55)') : hexA(M.cor, .32)); } contorno(cel, hexA(M.cor, 1), []); }
        if (hv && ['esfera', 'cubo'].includes(M.forma)) { hlc.fillStyle = fora ? '#bbb' : M.cor; hlc.beginPath(); hlc.arc(hv.x * S + 26, hv.y * S + 26, 6, 0, 7); hlc.fill(); }
      }
    } else if (s.modo === 'hab') {
      if (s.hab === 'curaMaos') marcar(R.aliadosDe(st, u).filter(a => a === u || R.adjacente(u, a)).map(a => a.id));
      if (s.hab === 'marcaPresa') marcar(R.inimigosDe(st, u).map(a => a.id));
      if (s.hab === 'desafio') marcar(R.inimigosDe(st, u).filter(o => R.dist(u, o) <= 6).map(a => a.id));
      if (s.hab === 'fintar') marcar(R.inimigosDe(st, u).filter(o => R.dist(u, o) <= 6).map(a => a.id));
      if (s.hab === 'sopro' && hv) { for (const c of linhaSopro(u, hv)) celula(c.x, c.y, 'rgba(157,255,58,.45)', 'rgba(220,255,180,.9)'); }
    }
    if (hv && hv.x >= 0) colchete(hv.x, hv.y, '#ffffffcc');
  }
  // contorno de uma região de casas (só as bordas externas)
  function contorno(cel, cor, dash) {
    const k = new Set(cel.map(c => c.x + ',' + c.y)); const tem = (x, y) => k.has(x + ',' + y);
    hlc.save(); hlc.strokeStyle = cor; hlc.lineWidth = 2.5; hlc.setLineDash(dash || []); hlc.beginPath();
    for (const c of cel) { const X = c.x * S, Y = c.y * S;
      if (!tem(c.x, c.y - 1)) { hlc.moveTo(X, Y + 1); hlc.lineTo(X + S, Y + 1); }
      if (!tem(c.x, c.y + 1)) { hlc.moveTo(X, Y + S - 1); hlc.lineTo(X + S, Y + S - 1); }
      if (!tem(c.x - 1, c.y)) { hlc.moveTo(X + 1, Y); hlc.lineTo(X + 1, Y + S); }
      if (!tem(c.x + 1, c.y)) { hlc.moveTo(X + S - 1, Y); hlc.lineTo(X + S - 1, Y + S); } }
    hlc.stroke(); hlc.restore();
  }
  // casas que a magia alcança (onde se pode mirar). null = não se aplica (pessoal, aura)
  function celulasAlcance(st, u, mid, aprim) {
    const M = D.MAGIAS[mid]; if (M.forma === 'si' || M.forma.startsWith('aura') || (mid === 'toqueChocante' && aprim.area)) return null;
    let r = R.alcanceMagia(M); if (mid === 'curarFerimentos' && aprim.curto) r = 6;
    const cel = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (x === u.x && y === u.y && M.forma !== 'alvo') continue;
      if (['cone', 'linha'].includes(M.forma)) { if (R.distEuc(u, { x, y }) <= M.tamanho + 0.5 && R.terreno(st, x, y) !== 'W' && R.visao(st, u, { x, y }).ve) cel.push({ x, y }); continue; }
      if (R.dist(u, { x, y }) > r) continue; if (r > 1 && !R.visao(st, u, { x, y }).ve) continue; if (R.terreno(st, x, y) === 'W') continue;
      cel.push({ x, y });
    }
    return cel;
  }
  // texto: alcance x área
  function legendaMagia(M, mid, aprim) {
    const m = q => (q * 1.5).toString().replace('.', ',') + ' m';
    const nomeAlc = { 0: 'pessoal', 1: 'toque', 6: 'curto', 20: 'médio', 40: 'longo' };
    let r = R.alcanceMagia(M); if (mid === 'curarFerimentos' && aprim.curto) r = 6;
    let alc, area;
    if (M.forma === 'si') { alc = 'pessoal'; area = 'só você'; }
    else if (M.forma.startsWith('aura')) { alc = 'pessoal'; area = `todos a até ${m(6)} de você` + (M.forma === 'auraAliados' ? ' (aliados)' : M.forma === 'auraInimigos' ? ' (inimigos)' : ''); }
    else if (M.forma === 'alvo') { alc = `${nomeAlc[r] || ''} (${r <= 1 ? 'adjacente' : m(r)})`; area = mid === 'setaInfalivel' ? `${aprim.cinco ? 5 : aprim.tres ? 3 : 2} setas, divida entre os alvos` : mid === 'toqueChocante' && aprim.area ? `todos a até ${m(4)} de você` : '1 alvo'; }
    else if (M.forma === 'esfera') { alc = `${nomeAlc[r] || ''} (${m(r)}) até o centro`; area = `esfera de ${m(M.tamanho)} de raio`; }
    else if (M.forma === 'cubo') { alc = `${nomeAlc[r] || ''} (${m(r)}) até o centro`; area = `cubo de ${m(M.tamanho)} de lado`; }
    else if (M.forma === 'cone') { alc = 'sai de você'; area = `cone de ${m(M.tamanho)}`; }
    else if (M.forma === 'linha') { alc = 'sai de você'; area = `linha de ${m(M.tamanho)}`; }
    return `<div class="leg"><span><i class="lg-alc"></i><b>Alcance</b> ${alc}</span><span><i class="lg-area" style="background:${hexA(M.cor, .5)};border-color:${M.cor}"></i><b>Área</b> ${area}</span></div>`;
  }
  function linhaSopro(u, p) { const dx = p.x - u.x, dy = p.y - u.y, L = Math.hypot(dx, dy) || 1; const out = []; for (const c of R.linhaCelulas(u.x, u.y, Math.round(u.x + dx / L * 10), Math.round(u.y + dy / L * 10)).slice(1)) { const t = R.terreno(G.st, c.x, c.y); if (t === null || t === 'W') break; out.push(c); } return out; }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function setaCaminho(P) {
    if (!P || P.length < 2) return;
    hlc.strokeStyle = '#0e1838'; hlc.lineWidth = 12; hlc.lineJoin = 'round'; hlc.lineCap = 'round';
    const draw = () => { hlc.beginPath(); P.forEach(([i, j], n) => { const a = i * S + 26, b = j * S + 26; n ? hlc.lineTo(a, b) : hlc.moveTo(a, b); }); hlc.stroke(); };
    draw(); hlc.strokeStyle = '#f5c542'; hlc.lineWidth = 7; draw();
    const [ex, ey] = P[P.length - 1], [px, py] = P[P.length - 2]; const ang = Math.atan2(ey - py, ex - px); const cx = ex * S + 26, cy = ey * S + 26;
    hlc.fillStyle = '#f5c542'; hlc.strokeStyle = '#0e1838'; hlc.lineWidth = 3; hlc.beginPath(); hlc.moveTo(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14); hlc.lineTo(cx + Math.cos(ang + 2.3) * 13, cy + Math.sin(ang + 2.3) * 13); hlc.lineTo(cx + Math.cos(ang - 2.3) * 13, cy + Math.sin(ang - 2.3) * 13); hlc.closePath(); hlc.stroke(); hlc.fill();
  }

  /* ---------- previsão (estilo FE) ---------- */
  function previsao() {
    const st = G.st, el = $('fore'); if (!st) return; const u = R.atual(st);
    const hv = G.hover; const o = hv ? R.unidadeEm(st, hv.x, hv.y) : null; const s = G.sel || {};
    if (!u || st.fim || ehIA(u) || !o || o.lado === u.lado && s.modo !== 'magia') {
      el.innerHTML = `<h3>Previsão</h3><div class="desc">Passe o mouse sobre um alvo para ver a chance de acerto e o dano.<br><br><b style="color:var(--ink)">Atalhos:</b> E encerra o turno, Esc cancela.<br>Flanco +2 · investida +2 · cobertura +5 na Defesa · alvo em combate –5 para tiros.</div>`;
      return;
    }
    let corpo = '';
    if (s.modo === 'magia') {
      const M = D.MAGIAS[s.magia];
      corpo = `<div class="fl"><span>Magia</span><b>${M.nome}</b><span>Custo</span><b>${R.custoMagia(u, s.magia, s.aprim).custo} PM</b>`;
      if (M.resist) { const bon = o.per[M.resist.teste]; const chance = Math.max(5, Math.min(95, (21 - (u.cd - bon)) * 5)); corpo += `<span>${{ fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' }[M.resist.teste]} do alvo</span><b>+${bon} vs CD ${u.cd}</b><span>Chance de resistir</span><b class="${chance > 50 ? 'lo' : 'hi'}">${chance}%</b>`; }
      corpo += '</div>';
    } else {
      const isDist = s.modo === 'distancia' || (!s.modo && !G.ops.atacar.includes(o.id) && G.ops.distancia.includes(o.id));
      const pv = R.previsaoAtaque(st, u, o, Object.assign({ distancia: isDist, investida: s.modo === 'investida' }, u.lado === 'h' ? G.mods : {}));
      if (!pv) { el.innerHTML = '<h3>Previsão</h3><div class="desc">Sem ataque possível.</div>'; return; }
      const totMin = pv.reduce((a, p) => a + p.min, 0), totMax = pv.reduce((a, p) => a + p.max, 0);
      corpo = `<div class="fl">${pv.map(p => `<span>${p.nome} (+${p.bonus} vs ${p.def})</span><b class="${p.chance >= 60 ? 'hi' : p.chance < 40 ? 'lo' : ''}">${p.chance}%</b>`).join('')}
        <span>Dano se acertar tudo</span><b>${totMin}–${totMax}</b><span>Crítico</span><b>${pv[0].margem}+ (×${pv[0].mult})</b><span>PV do alvo</span><b>${Math.max(0, o.pv)} / ${o.pvMax}</b></div>
        ${pv[0].mods.length ? `<div class="mods">${[...new Set(pv.flatMap(p => p.mods))].join(' · ')}${pv[0].furtivo ? ' · ataque furtivo!' : ''}</div>` : ''}`;
    }
    el.innerHTML = `<h3>Previsão</h3><div class="fc"><div><div class="p ${u.lado}" style="background-image:${TOK(u.token)}"></div><b style="font-size:12px">${u.nome.split(' ')[0]}</b></div><div class="vs">VS</div><div><div class="p ${o.lado}" style="background-image:${TOK(o.token)}"></div><b style="font-size:12px">${o.nome.split(' ')[0]}</b></div></div>${corpo}`;
  }

  /* ---------- cliques no mapa ---------- */
  function celulaDoEvento(e) { const r = $('board').getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / G.scale / S), y = Math.floor((e.clientY - r.top) / G.scale / S); return (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? null : { x, y }; }
  $('board').addEventListener('mousemove', e => {
    if (!G.st) return; const c = celulaDoEvento(e); const ant = G.hover;
    if (c && ant && c.x === ant.x && c.y === ant.y) return; G.hover = c; desenharDestaques(); previsao();
    const o = c && R.unidadeEm(G.st, c.x, c.y); const tip = $('tip');
    if (o) { tip.innerHTML = `<b>${o.nome}</b><br>PV ${Math.max(0, o.pv)}/${o.pvMax}${o.pmMax ? ' · PM ' + o.pm + '/' + o.pmMax : ''} · Def ${R.defesa(G.st, o, null, 'cac').valor}`; tip.classList.remove('hidden'); tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
    else tip.classList.add('hidden');
  });
  $('board').addEventListener('mouseleave', () => { G.hover = null; $('tip').classList.add('hidden'); desenharDestaques(); previsao(); });
  $('board').addEventListener('contextmenu', e => { e.preventDefault(); cancelar(); });
  $('board').addEventListener('click', e => {
    SOM.init(); if (!G.st || G.busy || G.st.fim) return; const c = celulaDoEvento(e); if (!c) return;
    if (G.prep) return cliquePreparo(c);
    const st = G.st, u = R.atual(st); const o = R.unidadeEm(st, c.x, c.y);
    if (ehIA(u)) { if (o) { G.inspect = o.id; atualizarCartao(); } return; }
    const novoHover = !G.hover || G.hover.x !== c.x || G.hover.y !== c.y; if (novoHover) G.hover = c;
    const ops = G.ops; const s = G.sel || {};
    // toque (celular): o 1º toque numa área só mostra a prévia; o 2º confirma
    if (novoHover && ((s.modo === 'magia' && ['esfera', 'cubo', 'cone', 'linha'].includes(D.MAGIAS[s.magia].forma)) || (s.modo === 'hab' && s.hab === 'sopro'))) { desenharDestaques(); previsao(); return; }
    if (!s.modo || s.modo === 'atacar' || s.modo === 'distancia') {
      if (o && o.lado !== u.lado && (s.modo !== 'distancia') && ops.atacar.includes(o.id)) return agir({ tipo: 'atacar', alvo: o.id, mods: u.lado === 'h' ? { ...G.mods } : {} });
      if (o && o.lado !== u.lado && ops.distancia.includes(o.id)) return agir({ tipo: 'distancia', alvo: o.id, mods: u.lado === 'h' ? { ...G.mods } : {} });
      if (!s.modo && !o && ops.mover && ops.mover.some(m => m.x === c.x && m.y === c.y)) return agir({ tipo: 'mover', x: c.x, y: c.y });
      if (o) { G.inspect = o.id; atualizarCartao(); }
      return;
    }
    if (s.modo === 'item') { const it = (ops.itens || []).find(x => x.k === s.slot); if (o && it && it.alvos.includes(o.id)) return agir({ tipo: 'item', slot: s.slot, alvo: o.id }); return; }
    if (s.modo === 'arma') { if (o && (ops.armaEspiritual || []).includes(o.id)) return agir({ tipo: 'armaEspiritual', alvo: o.id }); return; }
    if (s.modo === 'manobra') { if (o && (ops.manobras || []).includes(o.id)) return agir({ tipo: 'manobra', manobra: s.manobra, alvo: o.id }); return; }
    if (s.modo === 'investida') { if (o && ops.investida.includes(o.id)) return agir({ tipo: 'investida', alvo: o.id }); return; }
    if (s.modo === 'magia') {
      const M = D.MAGIAS[s.magia]; const ap = limpa(s.aprim);
      if (s.magia === 'setaInfalivel') {
        if (!o || !(R.alvosValidosMagia(st, u, s.magia, ap) || []).includes(o.id)) return;
        const qt = ap.cinco ? 5 : ap.tres ? 3 : 2; s.alvos = (s.alvos || []).concat(o.id); flutuar(o, '🎯 ' + s.alvos.filter(x => x === o.id).length, 'txt'); SOM.tocar('clique');
        if (s.alvos.length >= qt) return agir({ tipo: 'magia', magia: s.magia, aprim: ap, alvos: s.alvos });
        atualizarAcoes(); return;
      }
      if (M.forma === 'alvo' && !(s.magia === 'toqueChocante' && ap.area)) { if (o) return agir({ tipo: 'magia', magia: s.magia, aprim: ap, alvo: o.id }); return; }
      if (M.forma === 'si' || M.forma.startsWith('aura') || s.magia === 'toqueChocante') return agir({ tipo: 'magia', magia: s.magia, aprim: ap });
      if (c.x === u.x && c.y === u.y && ['cone', 'linha'].includes(M.forma)) return;
      return agir({ tipo: 'magia', magia: s.magia, aprim: ap, ponto: c });
    }
    if (s.modo === 'hab') {
      if (['curaMaos', 'marcaPresa', 'fintar', 'desafio'].includes(s.hab) && o) return agir({ tipo: 'habilidade', hab: s.hab, alvo: o.id, extra: s.extra || 0 });
      if (s.hab === 'sopro' && !(c.x === u.x && c.y === u.y)) return agir({ tipo: 'habilidade', hab: 'sopro', ponto: c });
      if (['furia', 'inspiracao', 'baluarte'].includes(s.hab)) return usarHabSemAlvo();
    }
  });
  function cancelar() { if (G.sel) { G.sel = null; atualizarAcoes(); desenharDestaques(); previsao(); } }
  document.addEventListener('keydown', e => {
    if (!G.st || $('game').classList.contains('hidden')) return;
    if (e.key === 'Escape') cancelar();
    if ((e.key === 'z' || e.key === 'Z') && !G.busy) desfazer();
    if ((e.key === 'e' || e.key === 'E') && !G.busy && !G.prep && !ehIA(R.atual(G.st))) agir({ tipo: 'fim' });
  });

  /* ---------- execução e fluxo ---------- */
  async function agir(acao) {
    if (G.busy || !G.st || G.st.fim || G.prep) return;
    const st = G.st; const u = R.atual(st);
    const antes = acao.tipo === 'mover' ? JSON.parse(JSON.stringify(st)) : null;
    const r = R.executar(st, acao);
    if (!r.ok) { flutuar(u, r.erro, 'txt'); SOM.tocar('erro'); return; }
    G.undo = antes && st.turnoId === antes.turnoId ? antes : null;
    G.busy = true; G.sel = null; G.mods = acao.tipo === 'mover' ? G.mods : {}; G.inspect = null; desenharDestaques();
    $('acts').querySelectorAll('button').forEach(b => b.disabled = true);
    await tocar(r.ev, u.id); atualizarLog();
    G.busy = false; G.ops = null; atualizar(); fimOuSeguir();
  }
  function desfazer() {
    const st = G.st; if (!G.undo || G.busy || G.undo.turnoId !== st.turnoId) return;
    G.st = G.undo; G.undo = null; G.sel = null; G.ops = null; G.logN = Math.min(G.logN, G.st.log.length);
    for (const u of G.st.unidades) { const d = G.toks[u.id]; if (d) { d.style.transition = 'left .18s, top .18s'; d.style.left = u.x * S + 'px'; d.style.top = u.y * S + 'px'; setTimeout(() => { d.style.transition = ''; }, 200); } }
    SOM.tocar('clique'); atualizar();
  }
  let seguindo = false;
  async function seguir() {
    if (seguindo || !G.st || G.prep) return; seguindo = true;
    try {
      let guard = 0;
      while (G.st && !G.st.fim && ehIA(R.atual(G.st)) && guard < 400) {
        guard++; const st = G.st; G.busy = true; atualizarAcoes();
        await sleep(260);
        const turno = st.turnoId; let passos = 0;
        while (G.st === st && !st.fim && st.turnoId === turno && passos < 10) {
          const atorId = R.atual(st).id; let a = IA.proximaAcao(st); let r = R.executar(st, a);
          if (!r.ok) r = R.executar(st, { tipo: 'fim' });
          await tocar(r.ev, atorId); atualizarLog(); passos++;
          if (st.turnoId === turno && !st.fim) await sleep(160);
        }
        if (G.st === st && !st.fim && st.turnoId === turno) await tocar(R.executar(st, { tipo: 'fim' }).ev);
        G.busy = false; G.ops = null; atualizar();
      }
    } finally { seguindo = false; G.busy = false; }
    if (G.st) { G.ops = null; atualizar(); fimOuSeguir(true); }
  }
  function fimOuSeguir(semSeguir) {
    const st = G.st; if (!st) return;
    if (st.fim) return setTimeout(() => fimDeBatalha(), 600 / G.vel);
    if (!semSeguir && ehIA(R.atual(st))) seguir();
  }

  /* ---------- fim de batalha ---------- */
  function novidades(nivelDe, nivelPara) {
    const out = [];
    for (const hid of G.grupo) {
      const a = R.criarHeroi(hid, nivelDe, 0), b = R.criarHeroi(hid, nivelPara, 0);
      const mag = b.magias.filter(m => !a.magias.includes(m)).map(m => D.MAGIAS[m].nome);
      const hab = b.habilidades.filter(m => !a.habilidades.includes(m)).map(m => D.HABILIDADES[m].nome);
      const itens = [`PV ${a.pvMax}→${b.pvMax}`]; if (b.pmMax) itens.push(`PM ${a.pmMax}→${b.pmMax}`);
      if (b.circulo > a.circulo) itens.push(`<b>magias de ${b.circulo}º círculo</b>`);
      if (mag.length) itens.push('novas magias: ' + mag.join(', ')); if (hab.length) itens.push('novo poder: ' + hab.join(', '));
      if (b.furtivo && a.furtivo && b.furtivo[0] > a.furtivo[0]) itens.push(`furtivo ${b.furtivo[0]}d6`);
      if (b.rd > (a.rd || 0)) itens.push(`RD ${b.rd}`);
      out.push(`<b>${b.nome}</b>: ${itens.join(' · ')}`);
    }
    return out.join('<br>');
  }
  function fimDeBatalha() {
    const st = G.st; const venceu = st.fim === 'herois'; SOM.tocar(venceu ? 'vitoria' : 'derrota');
    if (G.modo === 'run' && G.runCtx) { const ctx = G.runCtx; G.runCtx = null; if (venceu) { const c = { x: W / 2, y: H / 2 }; for (let k = 0; k < 3; k++) setTimeout(() => explosao(c.x + (Math.random() - .5) * 500, c.y + (Math.random() - .5) * 300, ['#f5c542', '#5b9bff', '#8dffa4'][k], 50, 6, .08), k * 250); } return ctx.aoFim(st, G.stats); }
    const herois = st.unidades.filter(u => u.lado === 'h');
    const faces = herois.map((u, i) => `<div class="${u.vivo ? '' : 'x'}" style="background-image:${TOK(u.token)};animation-delay:${i * .1}s" title="${u.nome}"></div>`).join('');
    let html = `<h2>${venceu ? 'Vitória!' : 'Derrota…'}</h2><div class="faces">${faces}</div>`;
    const caidos = herois.filter(u => !u.vivo).map(u => u.nome);
    const linhas = herois.map(u => ({ u, s: G.stats[u.id] || { dano: 0, cura: 0, abates: 0 } }));
    const maxD = Math.max(1, ...linhas.map(l => l.s.dano)); const mvp = linhas.slice().sort((a, b) => (b.s.dano + b.s.cura) - (a.s.dano + a.s.cura))[0];
    const tabela = `<div class="news">${linhas.map(l => `<div class="st"><b>${l.u.nome.split(' ')[0]}${l === mvp && venceu ? ' ⭐' : ''}</b><span class="bb"><i style="width:${l.s.dano / maxD * 100}%"></i></span><span>${l.s.dano} dano${l.s.cura ? ' · ' + l.s.cura + ' cura' : ''}${l.s.abates ? ' · ' + l.s.abates + '☠' : ''}</span></div>`).join('')}</div>`;
    html += `<p>${venceu ? `${G.encontro.nome} vencida em ${st.rodada} rodadas.` : 'O grupo caiu. Tente outra tática: flanqueie, use cobertura e guarde PM para curar.'}${caidos.length ? `<br>Mortos em combate: ${caidos.join(', ')} (voltam na próxima luta).` : ''}</p>${tabela}`;
    const prox = G.modo === 'campanha' && venceu && G.passo + 1 < D.ENCONTROS.length ? D.ENCONTROS[G.passo + 1] : null;
    if (G.modo === 'campanha' && venceu) { G.camp.passo = Math.max(G.camp.passo, G.passo + 1); store.set('arena.camp', G.camp); }
    if (prox) html += `<div class="news">⬆ <b>O grupo sobe para o nível ${prox.nivel}!</b><br>${novidades(G.nivel, prox.nivel)}</div>`;
    if (G.modo === 'campanha' && venceu && !prox) html += `<div class="news">🏆 <b>Campanha completa!</b> A Serpe Anciã caiu. Tente outro grupo ou a batalha livre no nível 15.</div>`;
    html += '<div class="row" style="justify-content:center;margin-top:10px">';
    if (prox) html += `<button class="btn gold" id="oNext">Próxima: ${prox.nome}</button>`;
    html += `<button class="btn${prox ? '' : ' gold'}" id="oAgain">${venceu ? 'Jogar de novo' : 'Tentar de novo'}</button><button class="btn" id="oMenu">Menu</button></div>`;
    $('overIn').className = 'win' + (venceu ? '' : ' red'); $('overIn').innerHTML = html; $('over').classList.remove('hidden');
    if (prox) $('oNext').onclick = () => iniciar('campanha', G.passo + 1);
    $('oAgain').onclick = () => iniciar(G.modo, G.passo, G.modo === 'livre' ? G.nivel : undefined);
    $('oMenu').onclick = () => voltarMenu();
    if (venceu) { const c = { x: W / 2, y: H / 2 }; for (let k = 0; k < 4; k++) setTimeout(() => explosao(c.x + (Math.random() - .5) * 500, c.y + (Math.random() - .5) * 300, ['#f5c542', '#5b9bff', '#ff5f66', '#8dffa4'][k], 50, 6, .08), k * 250); }
  }

  /* ---------- escala do tabuleiro ---------- */
  function ajustar() {
    const cw = $('center').clientWidth || W; const s = Math.min(1.25, cw / W); G.scale = s;
    $('board').style.transform = `scale(${s})`; $('wrap').style.width = W * s + 'px'; $('wrap').style.height = H * s + 'px';
  }
  window.addEventListener('resize', () => { if (G.st) ajustar(); });

  togs(); montarMenu();
  window.ARENA = { G, iniciar, iniciarRun, agir, R, IA, atualizar, seguir, voltarMenu, togs };
  if (window.claude && window.claude.hot) try { window.claude.hot.snapshot = () => ({ passo: G.camp.passo }); } catch (e) { /* ok */ }
})();
