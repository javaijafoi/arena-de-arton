/* Arena de Arton — telas do modo roguelike: menu da run, pré-run, mapa do andar, loja,
   descanso, eventos, resultado de batalha, fim de run e guilda. Regras em run.js. */
(function () {
  'use strict';
  const D = window.T20DATA, R = window.T20, RUN = window.T20RUN, SOM = window.SOM, A = () => window.ARENA;
  const $ = id => document.getElementById(id);
  const TOK = window.ARENA_TOK;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ok */ } } };
  const S = { run: store.get('arena.run', null), meta: Object.assign(RUN.novoMeta(), store.get('arena.meta', {})), sel: null, inv: null, pre: null, res: null };
  if (S.run && S.run.v !== 1) S.run = null;
  const salvar = () => { if (S.run) store.set('arena.run', S.run); else store.del('arena.run'); store.set('arena.meta', S.meta); if (window.NUVEM) window.NUVEM.agendar(S.meta, S.run); };
  function aplicarNuvem(d) { if (!d) return; S.meta = Object.assign(RUN.novoMeta(), d.meta || {}); S.run = d.run && d.run.v === 1 ? d.run : null; if (S.run) store.set('arena.run', S.run); else store.del('arena.run'); store.set('arena.meta', S.meta); }
  const H = hid => D.HEROIS.find(h => h.id === hid);
  const I = id => RUN.ITENS[id];
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clique = () => { try { SOM.init(); SOM.tocar('clique'); } catch (e) { /* ok */ } };
  const ICON = { inicio: '🏁', batalha: '⚔', elite: '💀', loja: '🛒', descanso: '🔥', evento: '?', taverna: '🍺', chefe: '👑' };
  const NOME_TIPO = { inicio: 'Partida', batalha: 'Batalha', elite: 'Elite', loja: 'Loja', descanso: 'Fogueira', evento: 'Evento', taverna: 'Taverna', chefe: 'Chefe do andar' };

  /* ---------- casca: uma seção #run com uma tela por vez ---------- */
  const root = document.createElement('section'); root.id = 'run'; root.className = 'hidden'; document.body.insertBefore(root, $('tip'));
  function mostrar(html, cls) {
    $('menu').classList.add('hidden'); $('game').classList.add('hidden'); $('over').classList.add('hidden');
    root.className = 'rv ' + (cls || ''); root.innerHTML = html; window.scrollTo(0, 0);
    $('topSub').textContent = S.run ? `Roguelike · andar ${S.run.andar} · nível ${S.run.nivel}` : 'Roguelike';
    $('tMenu').classList.remove('hidden');
  }
  function ligar(sel, fn) { root.querySelectorAll(sel).forEach(el => el.onclick = e => { clique(); fn(el.dataset, el, e); }); }
  function fecharRun() { root.className = 'hidden'; root.innerHTML = ''; }

  /* ---------- painel no menu principal ---------- */
  function montarBlocoMenu() {
    let box = $('runBox');
    if (!box) { box = document.createElement('div'); box.id = 'runBox'; box.className = 'win box runbox'; $('menu').insertBefore(box, $('menu').children[1] || null); }
    const m = S.meta; const prox = RUN.MARCOS.find(x => m.pontos < x.pts);
    box.innerHTML = `<div class="rb-l"><h3>Modo Roguelike · Andar 1: Estrada e Ruínas</h3>
      <p>Monte um grupo, atravesse o mapa do andar escolhendo o caminho e derrote o chefe. Ferimentos, poções e ouro passam de uma batalha para a outra. Se todos caírem, a run acaba, mas a pontuação fica e libera coisas novas.</p>
      <div class="rb-stats"><span>🏅 <b>${m.pontos.toLocaleString('pt-BR')}</b> pontos</span><span>${nuvemTxt()}</span><span>🎲 ${m.runs} runs · ${m.vitorias} vitórias</span>${prox ? `<span>Próximo marco: <b>${prox.nome}</b> em ${prox.pts.toLocaleString('pt-BR')}</span>` : ''}</div></div>
      <div class="rb-b">${S.run && !S.run.fim ? `<button class="btn gold" id="rbCont">▶ Continuar run (nível ${S.run.nivel})</button><button class="btn" id="rbNova">Nova run</button>` : `<button class="btn gold" id="rbNova">⚔ Nova run</button>`}
      ${RUN.liberado(m, 'guilda') ? '<button class="btn" id="rbGuilda">🏛 Guilda</button>' : `<button class="btn" disabled title="Libera com ${RUN.MARCOS[0].pts} pontos">🔒 Guilda (${RUN.MARCOS[0].pts.toLocaleString('pt-BR')} pts)</button>`}</div>`;
    if ($('rbNuvem')) $('rbNuvem').onclick = () => { clique(); telaNuvem(); };
    if ($('rbCont')) $('rbCont').onclick = () => { clique(); continuar(); };
    $('rbNova').onclick = () => { clique(); telaPre(); };
    if ($('rbGuilda')) $('rbGuilda').onclick = () => { clique(); telaGuilda(); };
    // a escada antiga vira "treino"
    const lad = $('ladder'); if (lad && lad.parentElement && !lad.parentElement.dataset.treino) { lad.parentElement.dataset.treino = 1; const h = lad.parentElement.querySelector('h3'); if (h) h.textContent = 'Treino: escada de batalhas (modo antigo)'; }
    const bc = $('bCamp'); if (bc) bc.textContent = '⚔ Treino: escada antiga';
  }
  function nuvemTxt() {
    const N = window.NUVEM; if (!N) return '';
    const t = { local: '💾 salvo neste aparelho', salvando: '☁ salvando…', nuvem: '☁ salvo na nuvem', erro: '⚠ sem conexão com a nuvem (salvo neste aparelho)' }[N.estado] || '';
    return `<button class="lnk" id="rbNuvem">${t} · outro aparelho</button>`;
  }
  function telaNuvem(msg) {
    const N = window.NUVEM;
    let h = `<div class="rv-head"><h2>Seu progresso em outro aparelho</h2><div class="sp"></div><button class="btn" id="nVoltar">✕ Voltar</button></div>
      <div class="rv-grid2"><div class="win box"><h3>Código deste aparelho</h3><p class="mut">O progresso (pontos, guilda e run em andamento) é salvo neste navegador e na nuvem. Para continuar em outro aparelho, copie este código e cole lá. Não compartilhe: quem tiver o código mexe no seu save.</p>
      <div class="codigo" id="nCod">${esc(N.codigo())}</div><button class="btn gold" id="nCopiar">📋 Copiar código</button></div>
      <div class="win box"><h3>Usar um código</h3><p class="mut">Cole o código do outro aparelho. O progresso daqui será trocado pelo de lá.</p>
      <input id="nIn" class="inp" placeholder="cole o código aqui" autocomplete="off"><button class="btn gold" id="nUsar">Carregar progresso</button>${msg ? `<p class="${msg.ok ? 'okt' : 'redt'}">${esc(msg.txt)}</p>` : ''}</div></div>`;
    mostrar(h, 'nuvem');
    $('nVoltar').onclick = () => { clique(); voltarAoMenu(); };
    $('nCopiar').onclick = () => { clique(); try { navigator.clipboard.writeText(N.codigo()); $('nCopiar').textContent = '✓ Copiado'; } catch (e) { const r = document.createRange(); r.selectNodeContents($('nCod')); getSelection().removeAllRanges(); getSelection().addRange(r); } };
    $('nUsar').onclick = async () => { clique(); try { const d = await N.usarCodigo($('nIn').value); aplicarNuvem(d); telaNuvem({ ok: true, txt: `Progresso carregado: ${(S.meta.pontos || 0).toLocaleString('pt-BR')} pontos.` }); } catch (e) { telaNuvem({ ok: false, txt: e.message }); } };
  }
  function voltarAoMenu() { fecharRun(); A().G.modo = null; A().voltarMenu(); montarBlocoMenu(); }

  /* ---------- pré-run ---------- */
  function telaPre() {
    const m = S.meta; const ouro = 150 + (RUN.liberado(m, 'bolsaRica') ? 100 : 0);
    S.pre = S.pre || { grupo: store.get('arena.grupo', ['mari', 'hana', 'zaldrin', 'aria']).slice(0, 4), compras: { racao: 0, pocao: 0, barraca: 0, oleo: 0 }, bau: [] };
    const P = S.pre; const PRECOS = { racao: 1, pocao: 30, barraca: 10, oleo: 30 };
    const gasto = Object.entries(P.compras).reduce((a, [k, v]) => a + v * PRECOS[k], 0); const resta = ouro - gasto;
    let h = `<div class="rv-head"><h2>Preparar a run</h2><div class="sp"></div><span class="chip">💰 T$ ${resta} de ${ouro}</span><button class="btn" id="pVoltar">✕ Voltar</button></div>
      <div class="rv-grid2"><div class="win box"><h3>Grupo <small>(${P.grupo.length}/4)</small></h3><div class="picks">`;
    for (const he of D.HEROIS) {
      const c = D.CLASSES[he.classe]; const i = P.grupo.indexOf(he.id);
      h += `<button class="pick${i >= 0 ? ' sel' : ''}" data-h="${he.id}"><span class="n">${i + 1}</span><div class="face" style="background-image:${TOK(he.token)}"></div><b>${he.nome}</b><small><span style="color:var(--gold);font-weight:800">${c.nome}</span></small></button>`;
    }
    h += `</div><p class="mut">Grupos menores sobem de nível mais rápido (o XP é dividido por quem começou a run).</p></div><div class="col">`;
    h += `<div class="win box"><h3>Bolsa e cinto</h3><p class="mut">Cada herói começa com 1 poção no cinto e o grupo leva 8 rações.</p>`;
    for (const [k, nome, ic] of [['racao', 'Ração de viagem', '🍖'], ['pocao', 'Poção de Curar Ferimentos', '🧪'], ['barraca', 'Barraca', '⛺'], ['oleo', 'Óleo de Arma Mágica', '🫙']]) {
      h += `<div class="buyrow"><span class="ic">${ic}</span><span class="nm">${nome}<small>${esc(I(k).desc)}</small></span><span class="pr">T$ ${PRECOS[k]}</span><button class="btn sm" data-menos="${k}" ${P.compras[k] ? '' : 'disabled'}>−</button><b class="q">${P.compras[k]}</b><button class="btn sm" data-mais="${k}" ${resta >= PRECOS[k] && !(k === 'barraca' && P.compras[k]) ? '' : 'disabled'}>+</button></div>`;
    }
    h += `</div>`;
    if (RUN.liberado(m, 'guilda')) {
      h += `<div class="win box"><h3>Baú da guilda</h3>${m.bau.length ? '<p class="mut">Leve até 2 itens que você trouxe de runs vencidas.</p><div class="bau">' + m.bau.map((id, k) => `<button class="itm${P.bau.includes(k) ? ' on' : ''}" data-bau="${k}"><span>${I(id).ic}</span>${esc(I(id).nome)}</button>`).join('') + '</div>' : '<p class="mut">Vazio. Vença o andar para trazer itens de volta.</p>'}</div>`;
    }
    h += `<button class="btn gold bbig" id="pIr" ${P.grupo.length ? '' : 'disabled'}>⚔ Partir para o andar 1</button></div></div>`;
    mostrar(h, 'pre');
    ligar('[data-h]', d => { const i = P.grupo.indexOf(d.h); if (i >= 0) P.grupo.splice(i, 1); else if (P.grupo.length < 4) P.grupo.push(d.h); telaPre(); });
    ligar('[data-mais]', d => { P.compras[d.mais]++; telaPre(); });
    ligar('[data-menos]', d => { P.compras[d.menos] = Math.max(0, P.compras[d.menos] - 1); telaPre(); });
    ligar('[data-bau]', d => { const k = +d.bau; const i = P.bau.indexOf(k); if (i >= 0) P.bau.splice(i, 1); else if (P.bau.length < 2) P.bau.push(k); telaPre(); });
    $('pVoltar').onclick = () => { clique(); voltarAoMenu(); };
    $('pIr').onclick = () => {
      clique(); store.set('arena.grupo', P.grupo);
      const itens = P.bau.map(k => m.bau[k]); m.bau = m.bau.filter((_, k) => !P.bau.includes(k));
      const run = RUN.novaRun({ herois: P.grupo, ouro: resta, itens, nivel: RUN.liberado(m, 'nivel2') ? 2 : 1 });
      run.bolsa.racao += P.compras.racao; run.bolsa.barraca += P.compras.barraca;
      for (let i = 0; i < P.compras.pocao; i++) RUN.darItem(run, 'pocao');
      for (let i = 0; i < P.compras.oleo; i++) RUN.darItem(run, 'oleo');
      // equipa sozinho os itens do baú no primeiro herói com o espaço livre
      for (let k = run.mochila.length - 1; k >= 0; k--) { const it = I(run.mochila[k]); const hi = run.herois.findIndex(x => ['arma', 'armadura', 'acessorio'].includes(it.slot) && !x.equip[it.slot]); if (hi >= 0) RUN.equipar(run, hi, k); }
      run.templo = RUN.liberado(m, 'templo');
      S.run = run; S.pre = null; S.sel = null; salvar(); telaMapa();
    };
  }

  /* ---------- cabeçalho comum (grupo, nível, recursos) ---------- */
  function cabecalho(titulo) {
    const run = S.run; const xp0 = RUN.XP_NIVEL[run.nivel], xp1 = RUN.XP_NIVEL[run.nivel + 1] || xp0 + 1;
    let h = `<div class="rv-head"><h2>${titulo}</h2><div class="party">`;
    run.herois.forEach((x, hi) => {
      const he = H(x.hid); const pvM = RUN.pvMaxDe(x, run.nivel), pmM = RUN.pmMaxDe(x, run.nivel); const pv = pvM - x.dano, pm = pmM - x.pmGasto;
      h += `<button class="pc${x.morto ? ' dead' : ''}" data-inv="${hi}" title="${esc(he.nome)}: ver itens"><span class="f" style="background-image:${TOK(he.token)}"></span><span class="bars">${x.morto ? '<b class="dd">MORTO</b>' : `<i class="hp"><i style="width:${pv / pvM * 100}%"></i></i><small>${pv}/${pvM}</small><i class="mp"><i style="width:${pmM ? pm / pmM * 100 : 0}%"></i></i>`}</span></button>`;
    });
    h += `</div></div><div class="rv-sub"><span class="chip gold">Nível ${run.nivel}</span><span class="xpbar"><i style="width:${Math.min(100, (run.xp - xp0) / (xp1 - xp0) * 100)}%"></i></span><span class="mut">XP ${run.xp.toLocaleString('pt-BR')} / ${xp1.toLocaleString('pt-BR')}</span><div class="sp"></div>
      <span class="chip" title="Ouro">💰 T$ ${run.ouro}</span><span class="chip" title="Rações">🍖 ${run.bolsa.racao}</span><span class="chip" title="Barraca">⛺ ${run.bolsa.barraca}</span><span class="chip" title="Itens na mochila">🎒 ${run.mochila.length}</span><button class="btn sm" id="hInv">Itens</button></div>`;
    return h;
  }
  function ligarCabecalho(volta) {
    ligar('[data-inv]', d => telaInventario(+d.inv, volta));
    const b = $('hInv'); if (b) b.onclick = () => { clique(); telaInventario(0, volta); };
  }

  /* ---------- mapa do andar ---------- */
  const MW = 1240, MH = 470;
  const pos = n => ({ x: 50 + n.c * (MW - 100) / 12, y: 60 + n.l * (MH - 120) / 3 });
  function telaMapa() {
    const run = S.run; if (!run) return voltarAoMenu();
    if (run.fim) return telaFim();
    if (run.pendente) return abrirPendente();
    const prox = RUN.proximos(run); const ids = new Set(prox.map(n => n.id)); const cam = new Set(run.caminho);
    if (S.sel != null && !ids.has(S.sel)) S.sel = null;
    let svg = `<svg viewBox="0 0 ${MW} ${MH}" class="mapa">`;
    for (const n of run.mapa.nos) for (const j of n.liga) {
      const m = run.mapa.nos[j]; const a = pos(n), b = pos(m); const feito = cam.has(n.id) && cam.has(m.id) && run.caminho.indexOf(m.id) === run.caminho.indexOf(n.id) + 1;
      const opc = n.id === run.atual && ids.has(m.id);
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${feito ? 'feito' : opc ? 'opc' : ''}"/>`;
    }
    for (const n of run.mapa.nos) {
      const p = pos(n); const st = n.id === run.atual ? 'cur' : cam.has(n.id) ? 'done' : ids.has(n.id) ? 'can' : n.c < noC() ? 'past' : '';
      const tipo = n.tipo === 'evento' && !n.visitado ? 'evento' : n.tipo; const r = n.tipo === 'chefe' ? 34 : 24;
      svg += `<g class="no ${tipo} ${st}${S.sel === n.id ? ' sel' : ''}" data-no="${n.id}" transform="translate(${p.x},${p.y})"><circle r="${r}"/><text y="${n.tipo === 'chefe' ? 11 : 8}" font-size="${n.tipo === 'chefe' ? 30 : 22}">${ICON[tipo]}</text></g>`;
    }
    svg += '</svg>';
    function noC() { return run.mapa.nos[run.atual].c; }
    let painel = '';
    const sel = S.sel != null ? run.mapa.nos[S.sel] : null;
    if (sel) {
      painel += `<div class="win box np"><small class="tag">${NOME_TIPO[sel.tipo]}</small>`;
      if (['batalha', 'elite', 'chefe'].includes(sel.tipo)) {
        const g = RUN.inimigosDoNo(run, sel); const tema = RUN.TEMAS.find(t => t.id === sel.tema);
        painel += `<h3>${esc(sel.nome)}</h3><p class="mut">${g.ids.length} inimigos · ND ${RUN.ndTxt(g.nd)}${tema ? ' · ' + tema.nome : ''}${sel.texto ? '<br>' + esc(sel.texto) : ''}</p><div class="foes">${g.ids.map(id => { const c = D.CRIATURAS[id]; return `<span class="foe${id === g.chefe ? ' boss' : ''}" title="${esc(c.nome)} (ND ${c.ndTxt})" style="background-image:${TOK(c.token)}"></span>`; }).join('')}</div>`;
        if (sel.tipo === 'elite') painel += '<p class="mut">Mais forte, mas sempre deixa um item mágico.</p>';
        if (sel.tipo === 'chefe') painel += '<p class="mut">Chefe Final: PV dobrados e redução de dano 5. Vencer encerra a run com vitória.</p>';
      } else if (sel.tipo === 'evento') painel += `<h3>Algo na estrada…</h3><p class="mut">Pode ser uma taverna, um altar, um tesouro com armadilha, alguém precisando de ajuda ou uma emboscada. Os testes usam a melhor perícia do grupo.</p>`;
      else if (sel.tipo === 'loja') painel += `<h3>${esc(sel.nome)}</h3><p class="mut">Poções, comida, barraca e algumas armas e armaduras superiores. Compra itens comuns pela metade do preço.</p>`;
      else if (sel.tipo === 'descanso') painel += `<h3>${esc(sel.nome)}</h3><p class="mut">Descanso rápido (ração) ou longo (ração + barraca, recupera tudo).</p>`;
      painel += `<button class="btn gold bbig" id="mIr">${sel.tipo === 'chefe' ? '👑 Enfrentar o chefe' : ['batalha', 'elite'].includes(sel.tipo) ? '⚔ Avançar e lutar' : '➜ Ir para lá'}</button></div>`;
    } else painel += `<div class="win box np"><h3>Escolha o caminho</h3><p class="mut">Clique num dos nós que brilham para ver o que há lá. Caminhos com mais batalhas dão mais XP e ouro; fogueiras e eventos ajudam a recuperar.</p></div>`;
    const rapido = RUN.opcoesDescanso(run, null)[0];
    painel += `<div class="win box np"><h3>Acampar aqui</h3><p class="mut">${rapido.desc} Custa ${rapido.custo}.</p><button class="btn" id="mRap" ${rapido.pode ? '' : 'disabled'}>🍖 Descanso rápido</button></div>`;
    painel += `<div class="rv-leg">${['batalha', 'elite', 'loja', 'descanso', 'evento', 'chefe'].map(t => `<span><b class="lg ${t}">${ICON[t]}</b>${NOME_TIPO[t]}</span>`).join('')}</div>`;
    painel += `<button class="btn red sm" id="mDesistir">Desistir da run</button>`;
    mostrar(cabecalho('Andar 1 · Estrada e Ruínas') + `<div class="rv-map"><div class="win mapwrap">${svg}</div><div class="rv-side">${painel}</div></div>`, 'mapa');
    ligarCabecalho(telaMapa);
    root.querySelectorAll('[data-no]').forEach(g => g.onclick = () => { const id = +g.dataset.no; if (!ids.has(id)) return; clique(); S.sel = id; telaMapa(); });
    if ($('mIr')) $('mIr').onclick = () => { clique(); const e = RUN.avancar(run, S.sel); if (e) return; S.sel = null; salvar(); abrirPendente(); };
    $('mRap').onclick = () => { clique(); RUN.descansar(run, 'rapido', null); salvar(); telaMapa(); };
    $('mDesistir').onclick = e => { clique(); if (e.target.dataset.ok) { run.fim = 'derrota'; run.desistiu = true; salvar(); telaFim(); } else { e.target.dataset.ok = 1; e.target.textContent = 'Clique de novo para desistir'; } };
  }
  function abrirPendente() {
    const run = S.run; const n = RUN.noAtual(run);
    if (run.pendente === 'batalha') return telaPreBatalha(n);
    if (run.pendente === 'loja') return telaLoja(n);
    if (run.pendente === 'descanso') return telaDescanso(n);
    if (run.pendente === 'evento') return telaEvento(n);
    if (run.pendente === 'resultado') return telaResultado();
    run.pendente = null; telaMapa();
  }
  function sair() { RUN.sairDoNo(S.run); salvar(); telaMapa(); }

  /* ---------- batalha ---------- */
  function telaPreBatalha(n) {
    const run = S.run; const g = RUN.inimigosDoNo(run, n);
    let h = cabecalho(esc(n.nome)) + `<div class="win box center-box"><small class="tag">${NOME_TIPO[n.tipo]} · ND ${RUN.ndTxt(g.nd)}</small><h2>${esc(n.nome)}</h2>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}
      <div class="foes fbig">${g.ids.map(id => { const c = D.CRIATURAS[id]; return `<div class="foe-c"><span class="foe${id === g.chefe ? ' boss' : ''}" style="background-image:${TOK(c.token)}"></span><small>${esc(c.nome)}${id === g.chefe ? ' (chefe)' : ''}<br>ND ${c.ndTxt}</small></div>`; }).join('')}</div>
      <p class="mut">Os PV, PM e itens do cinto de cada herói entram na batalha como estão. Herói desmaiado levanta com 1 PV se o grupo vencer; se sofrer dano desmaiado ou um crítico que o derrube, morre.</p>
      <div class="row" style="justify-content:center"><button class="btn sm" id="bInv">🎒 Arrumar itens antes</button><button class="btn gold bbig" id="bLutar">⚔ Lutar!</button></div></div>`;
    mostrar(h, 'prebat'); ligarCabecalho(() => telaPreBatalha(n));
    $('bInv').onclick = () => { clique(); telaInventario(0, () => telaPreBatalha(n)); };
    $('bLutar').onclick = () => { clique(); comecarBatalha(n); };
  }
  function comecarBatalha(n) {
    const run = S.run; const prep = RUN.prepararBatalha(run, n); fecharRun();
    S.batalha = { prep };
    A().iniciarRun({ cfg: prep.cfg, nome: n.nome, ajustar: st => RUN.ajustarBatalha(run, st, prep), aoFim: (st, stats) => fimBatalha(st, stats) });
  }
  function fimBatalha(st, stats) {
    const run = S.run; const prep = S.batalha.prep;
    const res = RUN.concluirBatalha(run, st, prep); res.stats = stats; res.nome = RUN.noAtual(run).nome;
    res.herois = st.unidades.filter(u => u.lado === 'h').map(u => ({ nome: u.nome, token: u.token, vivo: u.vivo, dano: (stats[u.id] || {}).dano || 0, cura: (stats[u.id] || {}).cura || 0 }));
    res.rodadas = st.rodada;
    S.res = res; run.pendente = 'resultado'; run.ultimoRes = res; salvar();
    setTimeout(() => { A().G.st = null; telaResultado(); }, 1400);
  }
  function telaResultado() {
    const run = S.run; const res = S.res || run.ultimoRes; if (!res) { run.pendente = null; return telaMapa(); }
    let h = `<div class="win box center-box ${res.venceu ? '' : 'red'}"><h2>${res.venceu ? 'Vitória!' : 'O grupo caiu…'}</h2>
      <div class="faces">${res.herois.map(x => `<div class="${x.vivo ? '' : 'x'}" style="background-image:${TOK(x.token)}" title="${esc(x.nome)}"></div>`).join('')}</div>
      <p>${esc(res.nome)} · ${res.rodadas} rodadas${res.mortos.length ? `<br><b class="redt">Mortos: ${res.mortos.map(esc).join(', ')}</b>` : ''}</p>`;
    if (res.venceu) {
      h += `<div class="loot"><span>⭐ +${res.xp} XP</span><span>💰 +T$ ${res.ouro}</span>${res.itens.map(i => `<span class="item">${I(i).ic} ${esc(I(i).nome)}</span>`).join('')}</div>`;
      if (res.subiu) h += `<div class="news">⬆ <b>O grupo sobe para o nível ${res.subiu.para}!</b><br>${novidades(res.subiu.de, res.subiu.para)}</div>`;
    }
    h += `<div class="row" style="justify-content:center"><button class="btn gold bbig" id="rSeg">${run.fim ? 'Ver o fim da run' : 'Voltar ao mapa'}</button></div></div>`;
    mostrar(cabecalho('Resultado') + h, 'res'); ligarCabecalho(telaResultado);
    $('rSeg').onclick = () => { clique(); S.res = null; delete run.ultimoRes; run.pendente = null; salvar(); if (run.fim) telaFim(); else telaMapa(); };
  }
  function novidades(de, para) {
    const out = [];
    for (const x of RUN.vivos(S.run)) {
      const a = R.criarHeroi(x.hid, de, 0), b = R.criarHeroi(x.hid, para, 0);
      const mag = b.magias.filter(m => !a.magias.includes(m)).map(m => D.MAGIAS[m].nome); const hab = b.habilidades.filter(m => !a.habilidades.includes(m)).map(m => D.HABILIDADES[m].nome);
      const it = [`PV ${a.pvMax}→${b.pvMax}`]; if (b.pmMax) it.push(`PM ${a.pmMax}→${b.pmMax}`); if (b.circulo > a.circulo) it.push(`magias de ${b.circulo}º círculo`);
      if (mag.length) it.push('novas magias: ' + mag.join(', ')); if (hab.length) it.push('novo poder: ' + hab.join(', '));
      out.push(`<b>${esc(b.nome)}</b>: ${it.join(' · ')}`);
    }
    return out.join('<br>');
  }
  function voltarDaBatalha() {
    // saiu pelo menu no meio da luta: o grupo recua e a batalha continua pendente no mapa (recomeça do zero)
    S.batalha = null; if (S.run) { telaPreBatalha(RUN.noAtual(S.run)); } else voltarAoMenu();
  }

  /* ---------- inventário ---------- */
  function telaInventario(hi, volta) {
    const run = S.run; S.inv = { hi, volta }; const x = run.herois[hi]; const he = H(x.hid);
    const slot = (s, nome) => { const id = x.equip[s]; return `<button class="slot${id ? ' full' : ''}" data-tira="${s}" ${id ? '' : 'disabled'}><small>${nome}</small>${id ? `<b>${I(id).ic} ${esc(I(id).nome)}</b><em>${esc(I(id).desc)}</em>` : '<b class="mut">vazio</b>'}</button>`; };
    let h = cabecalho('Itens do grupo') + `<div class="rv-grid2"><div class="win box"><div class="tabs">${run.herois.map((y, k) => `<button class="tab${k === hi ? ' on' : ''}${y.morto ? ' dead' : ''}" data-tab="${k}"><span class="f" style="background-image:url(${TOK(H(y.hid).token)})"></span>${esc(H(y.hid).nome.split(' ')[0])}</button>`).join('')}</div>
      <h3>${esc(he.nome)} <small>${D.CLASSES[he.classe].nome} ${run.nivel}${x.morto ? ' · morto' : ''}</small></h3>
      <div class="slots">${slot('arma', 'Arma')}${slot('armadura', 'Armadura')}${slot('acessorio', 'Acessório')}</div>
      <h3>Cinto <small>(até 3, usados na batalha)</small></h3><div class="slots c3">${x.cinto.map((id, k) => `<button class="slot${id ? ' full' : ''}" data-tira="cinto${k}" ${id ? '' : 'disabled'}><small>Cinto ${k + 1}</small>${id ? `<b>${I(id).ic} ${esc(I(id).nome)}</b>` : '<b class="mut">vazio</b>'}</button>`).join('')}</div>
      <p class="mut">Clique num item equipado para guardá-lo na mochila.</p></div>
      <div class="win box"><h3>Mochila do grupo</h3>${run.mochila.length ? '<div class="bau">' + run.mochila.map((id, k) => `<button class="itm" data-poe="${k}" ${x.morto ? 'disabled' : ''}><span>${I(id).ic}</span>${esc(I(id).nome)}<em>${esc(I(id).desc)}</em></button>`).join('') + '</div><p class="mut">Clique num item para equipar em ' + esc(he.nome.split(' ')[0]) + '.</p>' : '<p class="mut">Vazia.</p>'}
      <h3>Bolsa</h3><p>🍖 ${run.bolsa.racao} rações · ⛺ ${run.bolsa.barraca} barraca · 🪢 ${run.bolsa.corda || 0} corda</p>
      <button class="btn gold" id="iOk">✓ Pronto</button></div></div>`;
    mostrar(h, 'inv'); ligarCabecalho(volta);
    ligar('[data-tab]', d => telaInventario(+d.tab, volta));
    ligar('[data-tira]', d => { RUN.desequipar(run, hi, d.tira); salvar(); telaInventario(hi, volta); });
    ligar('[data-poe]', (d, el) => { const e = RUN.equipar(run, hi, +d.poe); if (e) { el.querySelector('em').textContent = e; return; } salvar(); telaInventario(hi, volta); });
    $('iOk').onclick = () => { clique(); S.inv = null; volta(); };
  }

  /* ---------- loja ---------- */
  function telaLoja(n) {
    const run = S.run; const est = RUN.estoqueLoja(run, n);
    let h = cabecalho('Loja') + `<div class="rv-grid2"><div class="win box"><div class="npc"><span class="f" style="background-image:${TOK('saqueadora')}"></span><div><small class="tag">Loja</small><h3>${esc(n.nome)}</h3><p class="mut">"Poção, comida, aço bom. Pague em Tibares e não me faça perder tempo."</p></div></div>
      <div class="shop">${est.map((e, k) => { const it = I(e.id); const pode = !e.vendido && run.ouro >= it.preco; return `<div class="ware${e.vendido ? ' sold' : ''}"><span class="ic">${it.ic}</span><b>${esc(it.nome)}</b><em>${esc(it.desc)}</em><div class="row"><span class="pr">T$ ${it.preco}</span>${e.fixo ? '<small class="mut">sempre</small>' : ''}<button class="btn sm gold" data-compra="${k}" ${pode ? '' : 'disabled'}>${e.vendido ? 'Vendido' : 'Comprar'}</button></div></div>`; }).join('')}</div></div>
      <div class="win box"><h3>Vender</h3>${run.mochila.length ? run.mochila.map((id, k) => { const v = RUN.precoVenda(id); return `<div class="buyrow"><span class="ic">${I(id).ic}</span><span class="nm">${esc(I(id).nome)}</span><button class="btn sm" data-vende="${k}" ${v ? '' : 'disabled'}>${v ? 'T$ ' + v : 'só na guilda'}</button></div>`; }).join('') : '<p class="mut">Nada na mochila para vender. Itens equipados precisam ir para a mochila antes (botão Itens).</p>'}
      <p class="mut">Itens de cinto comprados vão para o primeiro cinto com espaço; os outros para a mochila.</p><button class="btn gold bbig" id="lSair">➜ Seguir viagem</button></div></div>`;
    mostrar(h, 'loja'); ligarCabecalho(() => telaLoja(n));
    ligar('[data-compra]', d => { const it = I(est[+d.compra].id); let hi = null; if (it.slot === 'cinto') { hi = run.herois.findIndex(x => !x.morto && x.cinto.includes(null)); if (hi < 0) hi = null; } RUN.comprar(run, n, +d.compra, hi); salvar(); telaLoja(n); });
    ligar('[data-vende]', d => { RUN.vender(run, +d.vende); salvar(); telaLoja(n); });
    $('lSair').onclick = () => { clique(); sair(); };
  }

  /* ---------- descanso ---------- */
  function telaDescanso(n) {
    const run = S.run; const ops = RUN.opcoesDescanso(run, n);
    const mortos = run.herois.filter(x => x.morto);
    let h = cabecalho('Fogueira') + `<div class="win box center-box"><small class="tag">Descanso</small><h2>${esc(n.nome)}</h2><p>O grupo acende uma fogueira longe da estrada.${n.descansou ? ' <b>Vocês já descansaram aqui.</b>' : ''}</p><div class="rest">`;
    for (const o of ops) h += `<button class="restc" data-desc="${o.id}" ${o.pode && !n.descansou ? '' : 'disabled'}><b>${o.id === 'longo' ? '⛺' : '🍖'} ${o.nome}</b><span>${o.desc}</span><small>${o.custo}</small></button>`;
    if (run.templo && !run.usouTemplo && mortos.length) h += `<button class="restc" data-templo="1" ${run.ouro >= 100 ? '' : 'disabled'}><b>🕊 Templo da guilda</b><span>Uma vez por run: reviver ${esc(H(mortos[0].hid).nome)}.</span><small>T$ 100</small></button>`;
    h += `</div><button class="btn gold bbig" id="dSair">➜ Seguir viagem</button></div>`;
    mostrar(h, 'desc'); ligarCabecalho(() => telaDescanso(n));
    ligar('[data-desc]', d => { RUN.descansar(run, d.desc, n); salvar(); telaDescanso(n); });
    ligar('[data-templo]', () => { const x = run.herois.find(y => y.morto); x.morto = false; x.dano = Math.floor(RUN.pvMaxDe(x, run.nivel) / 2); x.pmGasto = 0; run.ouro -= 100; run.usouTemplo = true; salvar(); telaDescanso(n); });
    $('dSair').onclick = () => { clique(); sair(); };
  }

  /* ---------- evento ---------- */
  function telaEvento(n) {
    const run = S.run; const E = RUN.EVENTOS[n.evento];
    let h = cabecalho(esc(E.nome)) + `<div class="win box center-box evt"><div class="evt-ic">${E.ic}</div><small class="tag">${n.tipo === 'taverna' ? 'Taverna' : 'Evento'}</small><h2>${esc(E.nome)}</h2><p>${esc(E.texto)}</p>`;
    if (n.resolvido) {
      const r = n.resolvido;
      if (r.rolagem) h += `<div class="roll ${r.ok ? 'ok' : 'no'}">${esc(r.rolagem.quem)} testa ${r.rolagem.pericia}: 🎲 ${r.rolagem.d20} + ${r.rolagem.bonus} = <b>${r.rolagem.total}</b> contra CD ${r.rolagem.cd} · ${r.ok ? 'sucesso' : 'falha'}</div>`;
      h += `<p class="result">${esc(r.texto)}</p><button class="btn gold bbig" id="eSair">➜ Seguir viagem</button>`;
    } else {
      h += '<div class="choices">';
      for (const e of RUN.escolhasEvento(run, n)) h += `<button class="choice" data-esc="${e.id}" ${e.pode ? '' : 'disabled'}><b>${esc(e.txt)}</b>${e.pericia ? `<small>${e.pericia} (CD ${e.cd}) · ${esc(e.quem)} · <span class="pct">${e.chance}%</span></small>` : ''}${!e.pode && e.reqTxt ? `<small class="redt">precisa de ${esc(e.reqTxt)}</small>` : ''}</button>`;
      h += '</div>';
    }
    h += '</div>';
    mostrar(h, 'evento'); ligarCabecalho(() => telaEvento(n));
    ligar('[data-esc]', d => { RUN.resolverEvento(run, n, d.esc); salvar(); telaEvento(n); });
    if ($('eSair')) $('eSair').onclick = () => { clique(); sair(); };
  }

  /* ---------- fim de run ---------- */
  function telaFim() {
    const run = S.run; if (!run) return voltarAoMenu();
    if (!run.resumo) { run.resumo = RUN.encerrarRun(run, S.meta, run.desistiu); salvar(); }
    const r = run.resumo; const st = r.stats;
    let h = `<div class="win box center-box fim ${r.venceu ? '' : 'red'}"><small class="tag">Fim da run</small><h2>${r.venceu ? '🏆 Vitória! O andar 1 está limpo' : r.desistiu ? 'O grupo voltou para casa' : '💀 O grupo caiu'}</h2>
      <div class="faces">${run.herois.map(x => `<div class="${x.morto ? 'x' : ''}" style="background-image:url(${TOK(H(x.hid).token)})" title="${esc(H(x.hid).nome)}"></div>`).join('')}</div>
      <div class="pts">+${r.pts.toLocaleString('pt-BR')} <small>pontos</small></div><p class="mut">Total: ${r.total.toLocaleString('pt-BR')} pontos (XP que cada herói ganhou${r.venceu ? ' + 2.000 pela vitória' : ''})</p>
      <div class="statg"><span><b>${r.nivel}</b>nível final</span><span><b>${st.batalhas}</b>batalhas</span><span><b>${st.abates}</b>inimigos</span><span><b>${st.mortes}</b>mortes</span><span><b>T$ ${st.ouroGanho}</b>ouro achado</span></div>`;
    if (r.venceu && r.fica.length) h += `<div class="news">🎒 <b>Ficam no baú da guilda:</b> ${r.fica.map(i => I(i).ic + ' ' + esc(I(i).nome)).join(', ')}${r.ouro ? ` · T$ ${r.ouro} guardados` : ''}</div>`;
    else if (!r.venceu) h += `<p class="mut">Perdeu a run: itens e ouro ficam pelo caminho. O nível volta ao 1º na próxima.</p>`;
    for (const m of r.novos) h += `<div class="news unlock">🔓 <b>Liberado: ${esc(m.nome)}</b><br>${esc(m.desc)}</div>`;
    const prox = RUN.MARCOS.find(x => S.meta.pontos < x.pts); if (prox) h += `<p class="mut">Próximo marco: ${esc(prox.nome)} em ${prox.pts.toLocaleString('pt-BR')} pontos.</p>`;
    h += `<div class="row" style="justify-content:center"><button class="btn gold bbig" id="fNova">⚔ Nova run</button>${RUN.liberado(S.meta, 'guilda') ? '<button class="btn bbig" id="fGuilda">🏛 Guilda</button>' : ''}<button class="btn" id="fMenu">Menu</button></div></div>`;
    mostrar(h, 'fim');
    const limpar = () => { S.run = null; salvar(); };
    $('fNova').onclick = () => { clique(); limpar(); telaPre(); };
    if ($('fGuilda')) $('fGuilda').onclick = () => { clique(); limpar(); telaGuilda(); };
    $('fMenu').onclick = () => { clique(); limpar(); voltarAoMenu(); };
  }

  /* ---------- guilda ---------- */
  function telaGuilda(aba) {
    const m = S.meta; aba = aba || 'bau';
    const SALAS = [
      { id: 'bau', nome: 'Baú e Vitrine', npc: 'aegoron', desc: 'Itens trazidos de volta', marco: 'guilda' },
      { id: 'tesouraria', nome: 'Tesouraria', npc: 'dame-lia', desc: 'Família rica: +T$ 100 na partida', marco: 'bolsaRica' },
      { id: 'templo', nome: 'Templo', npc: 'hanalendariana', desc: 'Reviver na fogueira, 1×/run', marco: 'templo' },
      { id: 'torre', nome: 'Torre de treino', npc: 'zaldrin', desc: 'Começar no nível 2', marco: 'nivel2' },
    ];
    let h = `<div class="rv-head"><h2>Guilda dos Aventureiros</h2><span class="chip gold">🏅 ${m.pontos.toLocaleString('pt-BR')} pontos</span><div class="sp"></div><span class="chip">💰 T$ ${m.ouro} no cofre</span><button class="btn" id="gVoltar">✕ Voltar</button></div><div class="rv-guild"><div class="rooms">`;
    for (const s of SALAS) {
      const mk = RUN.MARCOS.find(x => x.id === s.marco); const ok = m.pontos >= mk.pts;
      h += `<button class="room${ok ? '' : ' lock'}${aba === s.id ? ' on' : ''}" data-sala="${s.id}"><span class="f" style="background-image:${TOK(s.npc)}"></span><b>${ok ? '' : '🔒 '}${s.nome}</b><small>${s.desc}</small><em class="${ok ? 'okt' : ''}">${ok ? 'Aberto' : mk.pts.toLocaleString('pt-BR') + ' pts'}</em></button>`;
    }
    h += '</div><div class="win box gpanel">';
    const sala = SALAS.find(s => s.id === aba); const mk = RUN.MARCOS.find(x => x.id === sala.marco);
    h += `<div class="npc"><span class="f" style="background-image:${TOK(sala.npc)}"></span><div><small class="tag">${sala.nome}</small><h3>${esc(mk.nome)}</h3><p class="mut">${esc(mk.desc)}</p></div></div>`;
    if (m.pontos < mk.pts) h += `<p>Faltam <b>${(mk.pts - m.pontos).toLocaleString('pt-BR')}</b> pontos. A pontuação é o XP que seus heróis acumulam em todas as runs.</p>`;
    else if (aba === 'bau') {
      h += m.bau.length ? `<p class="mut">Na pré-run você pode levar até 2 destes itens. Vender à guilda rende metade do preço do livro (o ouro fica no cofre para quando o Banco abrir).</p><div class="bau">${m.bau.map((id, k) => `<div class="itm"><span>${I(id).ic}</span>${esc(I(id).nome)}<em>${esc(I(id).desc)}</em><button class="btn sm" data-gv="${k}">Vender por T$ ${Math.floor(I(id).preco / 2).toLocaleString('pt-BR')}</button></div>`).join('')}</div>` : '<p class="mut">O baú está vazio. Itens equipados e da mochila voltam com você quando o grupo vence o andar.</p>';
    } else h += '<p class="okt"><b>Já está valendo nas suas runs.</b></p>';
    h += `<h3 style="margin-top:14px">Histórico</h3>${m.historico.length ? '<div class="hist">' + m.historico.slice(0, 8).map(x => `<div>${x.venceu ? '🏆' : '💀'} nível ${x.nivel} · +${x.pts.toLocaleString('pt-BR')} pts · ${x.herois.map(hid => H(hid).nome.split(' ')[0]).join(', ')}</div>`).join('') + '</div>' : '<p class="mut">Nenhuma run ainda.</p>'}`;
    h += '</div></div>';
    mostrar(h, 'guilda');
    ligar('[data-sala]', d => telaGuilda(d.sala));
    ligar('[data-gv]', d => { RUN.vendaGuilda(m, +d.gv); salvar(); telaGuilda('bau'); });
    $('gVoltar').onclick = () => { clique(); voltarAoMenu(); };
  }

  function continuar() { if (!S.run) return telaPre(); if (S.run.fim) return telaFim(); telaMapa(); }

  // o botão ☰ Menu fora da batalha volta ao menu principal
  $('tMenu').addEventListener('click', e => { if (!root.classList.contains('hidden')) { e.stopImmediatePropagation(); voltarAoMenu(); } }, true);
  montarBlocoMenu();
  if (window.NUVEM) {
    window.NUVEM.ouvir(() => { if (!$('menu').classList.contains('hidden')) montarBlocoMenu(); });
    window.NUVEM.puxar().then(d => { if (d) { aplicarNuvem(d); if (!$('menu').classList.contains('hidden')) montarBlocoMenu(); } else if (!store.get('arena.salvoEm', 0) && (S.meta.runs || S.run)) salvar(); });
  }
  window.RUNUI = { S, telaMapa, telaPre, telaGuilda, continuar, voltarDaBatalha, montarBlocoMenu, salvar };
})();
