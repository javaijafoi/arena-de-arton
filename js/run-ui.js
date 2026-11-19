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
    root.className = 'rv px ' + (cls || ''); root.innerHTML = html; window.scrollTo(0, 0); document.body.classList.add('em-run');
    $('topSub').textContent = S.run ? `Roguelike · andar ${S.run.andar} · nível ${S.run.nivel}` : 'Roguelike';
    $('tMenu').classList.remove('hidden');
  }
  function ligar(sel, fn) { root.querySelectorAll(sel).forEach(el => el.onclick = e => { clique(); fn(el.dataset, el, e); }); }
  function fecharRun() { root.className = 'hidden'; root.innerHTML = ''; document.body.classList.remove('em-run'); }
  const PX = n => TOK.px(n);
  const COR_CLASSE = { guerreiro: '#e0312b', barbaro: '#c0461f', paladino: '#ffc83d', clerigo: '#3b82f6', arcanista: '#9b4dff', cacador: '#3fbf5a', ladino: '#2fae8f', bardo: '#e04fa0', cavaleiro: '#8a8fb0' };
  const corH = he => COR_CLASSE[he.classe] || '#888';
  const face = (tok, cls, st) => `<span class="face-px ${cls || ''}" style="background-image:${PX(tok)};${st || ''}"></span>`;
  const barra = (titulo, dir) => `<div class="win pbar"><button class="btn sm" id="pbMenu">☰ Menu</button><h2>${titulo}</h2><div class="r">${dir || ''}</div></div>`;
  function ligarBarra() { const b = $('pbMenu'); if (b) b.onclick = () => { clique(); voltarAoMenu(); }; }

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

  /* ---------- pré-run: montar o grupo ---------- */
  function telaPre() {
    const m = S.meta; const ouro = 150 + (RUN.liberado(m, 'bolsaRica') ? 100 : 0);
    S.pre = S.pre || { grupo: store.get('arena.grupo', ['mari', 'hana', 'zaldrin', 'aria']).slice(0, 4), compras: { racao: 0, pocao: 0, barraca: 0, oleo: 0 }, bau: [] };
    const P = S.pre; const PRECOS = { racao: 1, pocao: 30, barraca: 10, oleo: 30 };
    const gasto = Object.entries(P.compras).reduce((a, [k, v]) => a + v * PRECOS[k], 0); const resta = ouro - gasto;
    if (!P.ver || !H(P.ver)) P.ver = P.grupo[0] || D.HEROIS[0].id;
    const ver = H(P.ver); const cv = D.CLASSES[ver.classe]; const u = R.criarHeroi(ver.id, 1, 0); const noGrupo = P.grupo.includes(ver.id);
    let h = barra('Monte o grupo', `<span class="gold">T$ ${resta}</span><span>🏅 ${m.pontos.toLocaleString('pt-BR')}</span>`);
    h += '<div class="pg"><div class="pg-vagas">';
    for (let i = 0; i < 4; i++) {
      const id = P.grupo[i];
      if (!id) { h += `<div class="vaga vazia">+</div>`; continue; }
      const he = H(id); h += `<button class="vaga${id === P.ver ? ' on' : ''}" data-ver="${id}"><span class="n">${i + 1}</span>${face(he.token)}<div><b>${esc(he.nome.split(' ')[0])}</b><small>${D.CLASSES[he.classe].nome}</small></div></button>`;
    }
    h += '</div>';
    const habs = (u.habilidades || []).map(k => D.HABILIDADES[k]).filter(Boolean);
    const mags = (u.magias || []).slice(0, 3).map(k => D.MAGIAS[k]).filter(Boolean);
    h += `<div class="scroll pg-heroi"><div class="arte" style="background-image:${TOK(ver.token)}"></div><div class="txt"><h3>${esc(ver.nome)}</h3><div class="cl">${cv.nome}</div><p>${esc(cv.descricao || '')}</p>
      <div class="st"><span>PV <b>${u.pvMax}</b></span><span>PM <b>${u.pmMax}</b></span><span>Defesa <b>${u.defBase}</b></span><span>Desloc. <b>${u.desloc}m</b></span></div>
      ${u.arma ? `<div class="hab">⚔ ${esc(u.arma.nome)} · ${u.arma.dano[0]}d${u.arma.dano[1]}</div>` : ''}${habs.map(x => `<div class="hab">✦ ${esc(x.nome)}</div>`).join('')}${mags.map(x => `<div class="hab">✧ ${esc(x.nome)}</div>`).join('')}
      <button class="btn ${noGrupo ? '' : 'gold'}" id="pTroca" ${!noGrupo && P.grupo.length >= 4 ? 'disabled' : ''}>${noGrupo ? 'Tirar do grupo' : P.grupo.length >= 4 ? 'Grupo cheio' : 'Chamar para o grupo'}</button></div></div>`;
    h += `<div class="win pg-lista"><h3>Heróis <small>(${P.grupo.length}/4 no grupo)</small></h3><div class="grade">`;
    for (const he of D.HEROIS) h += `<button class="ch${he.id === P.ver ? ' on' : ''}${P.grupo.includes(he.id) ? ' no' : ''}" data-ver="${he.id}" style="--c:${corH(he)}">${face(he.token)}<small>${esc(he.nome.split(' ').slice(-1)[0])}</small></button>`;
    h += `</div><p class="mut" style="margin-top:10px">Grupos menores sobem de nível mais rápido: o XP é dividido por quem começou a run.</p></div>`;
    h += '<div class="pg-compra"><div class="win"><h3>Bolsa e cinto <small>cada herói já leva 1 poção; o grupo, 8 rações</small></h3>';
    for (const [k, nome, ic] of [['racao', 'Ração de viagem', '🍖'], ['pocao', 'Poção de Curar Ferimentos', '🧪'], ['barraca', 'Barraca', '⛺'], ['oleo', 'Óleo de Arma Mágica', '🫙']]) {
      h += `<div class="buyrow"><span class="ic">${ic}</span><span class="nm">${nome}<small>${esc(I(k).desc)}</small></span><span class="pr">T$ ${PRECOS[k]}</span><button class="btn sm" data-menos="${k}" ${P.compras[k] ? '' : 'disabled'}>−</button><b class="q">${P.compras[k]}</b><button class="btn sm" data-mais="${k}" ${resta >= PRECOS[k] && !(k === 'barraca' && P.compras[k]) ? '' : 'disabled'}>+</button></div>`;
    }
    h += '</div>';
    if (RUN.liberado(m, 'guilda')) h += `<div class="win"><h3>Baú da guilda</h3>${m.bau.length ? '<p class="mut">Leve até 2 itens trazidos de runs vencidas.</p><div class="bau">' + m.bau.map((id, k) => `<button class="itm${P.bau.includes(k) ? ' on' : ''}" data-bau="${k}"><span>${I(id).ic}</span>${esc(I(id).nome)}</button>`).join('') + '</div>' : '<p class="mut">Vazio. Vença o andar para trazer itens de volta.</p>'}</div>`;
    else h += '<div class="win"><h3>Baú da guilda</h3><p class="mut">🔒 Abre com a guilda, em 1.500 pontos.</p></div>';
    h += `<div class="pg-ir"><button class="btn gold" id="pIr" ${P.grupo.length ? '' : 'disabled'}>⚔ Começar a run</button></div></div></div>`;
    mostrar(h, 'pre'); ligarBarra();
    ligar('[data-ver]', d => { P.ver = d.ver; telaPre(); });
    $('pTroca').onclick = () => { clique(); const i = P.grupo.indexOf(P.ver); if (i >= 0) P.grupo.splice(i, 1); else if (P.grupo.length < 4) P.grupo.push(P.ver); telaPre(); };
    ligar('[data-mais]', d => { P.compras[d.mais]++; telaPre(); });
    ligar('[data-menos]', d => { P.compras[d.menos] = Math.max(0, P.compras[d.menos] - 1); telaPre(); });
    ligar('[data-bau]', d => { const k = +d.bau; const i = P.bau.indexOf(k); if (i >= 0) P.bau.splice(i, 1); else if (P.bau.length < 2) P.bau.push(k); telaPre(); });
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
    let h = `<div class="rv-head"><button class="btn sm" id="pbMenu">☰ Menu</button><h2>${titulo}</h2><div class="party">`;
    run.herois.forEach((x, hi) => {
      const he = H(x.hid); const pvM = RUN.pvMaxDe(x, run.nivel), pmM = RUN.pmMaxDe(x, run.nivel); const pv = pvM - x.dano, pm = pmM - x.pmGasto;
      h += `<button class="pc${x.morto ? ' dead' : ''}" data-inv="${hi}" title="${esc(he.nome)}: ver itens"><span class="f" style="background-image:${TOK(he.token)}"></span><span class="bars">${x.morto ? '<b class="dd">MORTO</b>' : `<i class="hp"><i style="width:${pv / pvM * 100}%"></i></i><small>${pv}/${pvM}</small><i class="mp"><i style="width:${pmM ? pm / pmM * 100 : 0}%"></i></i>`}</span></button>`;
    });
    h += `</div></div><div class="rv-sub"><span class="chip gold">Nível ${run.nivel}</span><span class="xpbar"><i style="width:${Math.min(100, (run.xp - xp0) / (xp1 - xp0) * 100)}%"></i></span><span class="mut">XP ${run.xp.toLocaleString('pt-BR')} / ${xp1.toLocaleString('pt-BR')}</span><div class="sp"></div>
      <span class="chip" title="Ouro">💰 T$ ${run.ouro}</span><span class="chip" title="Rações">🍖 ${run.bolsa.racao}</span><span class="chip" title="Barraca">⛺ ${run.bolsa.barraca}</span><span class="chip" title="Itens na mochila">🎒 ${run.mochila.length}</span><button class="btn sm" id="hInv">Itens</button></div>`;
    return h;
  }
  function ligarCabecalho(volta) {
    ligarBarra();
    ligar('[data-inv]', d => telaInventario(+d.inv, volta));
    const b = $('hInv'); if (b) b.onclick = () => { clique(); telaInventario(0, volta); };
  }

  /* ---------- mapa do andar, sobre o mapa de Arton ---------- */
  // celular: retrato (sobe do sul para o norte); PC: paisagem (de oeste para leste)
  const COR_NO = { inicio: '#3fbf5a', batalha: '#e0312b', elite: '#7a1d8f', loja: '#ffc83d', descanso: '#e07a1f', evento: '#9b4dff', taverna: '#a06c3a', chefe: '#b5251f' };
  function posNo(n, retrato) {
    const t = n.c / 12, f = n.l / 3;
    return retrato ? { x: 14 + f * 72, y: 94 - t * 82 } : { x: 7 + t * 83, y: 20 + f * 62 };
  }
  function rostoDoNo(run, n) {
    if (!['batalha', 'elite', 'chefe'].includes(n.tipo)) return null;
    const g = RUN.inimigosDoNo(run, n); const id = g.chefe || g.ids[0]; return id ? D.CRIATURAS[id].token : null;
  }
  function telaMapa() {
    const run = S.run; if (!run) return voltarAoMenu();
    if (run.fim) return telaFim();
    if (run.pendente) return abrirPendente();
    const prox = RUN.proximos(run); const ids = new Set(prox.map(n => n.id)); const cam = new Set(run.caminho);
    if (S.sel != null && !ids.has(S.sel)) S.sel = null;
    const retrato = window.matchMedia('(max-width:860px)').matches;
    const cAtual = run.mapa.nos[run.atual].c;
    const xp0 = RUN.XP_NIVEL[run.nivel], xp1 = RUN.XP_NIVEL[run.nivel + 1] || xp0 + 1;
    let h = barra('Andar 1 · Deheon', `<span class="gold">T$ ${run.ouro}</span><span title="Rações">🍖 ${run.bolsa.racao}</span><span title="Mochila">🎒 ${run.mochila.length}</span>`);
    h += '<div class="pmapa"><div class="pm-herois">';
    run.herois.forEach((x, hi) => {
      const he = H(x.hid); const pvM = RUN.pvMaxDe(x, run.nivel), pmM = RUN.pmMaxDe(x, run.nivel); const pv = pvM - x.dano, pm = pmM - x.pmGasto;
      h += `<button class="htab${x.morto ? ' morto' : ''}" data-inv="${hi}" style="--c:${corH(he)}" title="${esc(he.nome)}: ver itens">${face(he.token)}<div class="t">${esc(he.nome.split(' ')[0])}${x.morto ? ' ✝' : ''}<div class="b"><i style="width:${x.morto ? 0 : pv / pvM * 100}%;${pv / pvM < .35 ? 'background:var(--red)' : ''}"></i></div><div class="b bm"><i style="width:${pmM ? pm / pmM * 100 : 0}%"></i></div></div></button>`;
    });
    h += `<div class="win pm-res">Nível <b class="gold">${run.nivel}</b><br>✦ XP ${run.xp.toLocaleString('pt-BR')} / ${xp1.toLocaleString('pt-BR')}<br>⛺ Barracas ${run.bolsa.barraca}<button class="btn sm" id="hInv">🎒 Itens</button></div></div>`;
    // mapa
    const img = TOK.mapa(retrato ? 'arton-retrato.png' : 'arton-paisagem.png');
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    for (const n of run.mapa.nos) for (const j of n.liga) {
      const m2 = run.mapa.nos[j]; const a = posNo(n, retrato), b = posNo(m2, retrato);
      const feito = cam.has(n.id) && cam.has(m2.id) && run.caminho.indexOf(m2.id) === run.caminho.indexOf(n.id) + 1;
      const opc = n.id === run.atual && ids.has(m2.id);
      const cor = feito ? '#8a5a2a' : opc ? '#ffc83d' : '#f1e2b0';
      const dash = feito ? '' : 'stroke-dasharray="8 6"';
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#000" stroke-width="${feito || opc ? 8 : 5}" ${dash} vector-effect="non-scaling-stroke" opacity="${feito || opc ? 1 : m2.c > cAtual ? .55 : .2}"/><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${cor}" stroke-width="${feito || opc ? 4 : 2}" ${dash} vector-effect="non-scaling-stroke" opacity="${feito || opc ? 1 : m2.c > cAtual ? .55 : .2}"/>`;
    }
    svg += '</svg>';
    let nos = '';
    for (const n of run.mapa.nos) {
      const p = posNo(n, retrato);
      const st = n.id === run.atual ? 'atual feito' : cam.has(n.id) ? 'feito' : ids.has(n.id) ? 'pode' : n.c <= cAtual ? 'passado' : 'futuro';
      const tipo = n.tipo === 'evento' && n.visitado ? 'evento' : n.tipo;
      const rosto = (ids.has(n.id) || n.tipo === 'chefe' || cam.has(n.id)) ? rostoDoNo(run, n) : null;
      const dentro = rosto ? face(rosto) : (tipo === 'evento' ? '?' : ICON[tipo]);
      const rot = n.tipo === 'chefe' ? esc(n.nome || 'Chefe') : (ids.has(n.id) || n.id === S.sel) ? esc(n.tipo === 'evento' ? 'Evento' : n.nome || NOME_TIPO[n.tipo]) : n.tipo === 'inicio' ? 'Ruínas de Tyrondir' : '';
      nos += `<div class="nd ${st}${n.tipo === 'chefe' ? ' chefe' : ''}${S.sel === n.id ? ' sel' : ''}" style="left:${p.x}%;top:${p.y}%"><button class="f" data-no="${n.id}" style="--c:${COR_NO[tipo] || '#555'}" aria-label="${esc(NOME_TIPO[tipo] || tipo)}">${dentro}</button>${rot ? `<span class="l">${rot}</span>` : ''}</div>`;
    }
    const pa = posNo(run.mapa.nos[run.atual], retrato);
    nos += `<div class="pm-grupo" style="left:${pa.x}%;top:calc(${pa.y}% - 26px)">${RUN.vivos(run).map(x => face(H(x.hid).token)).join('')}</div>`;
    h += `<div class="pm-win" id="pmWin"><div class="pm-in" style="${img ? `background-image:url('${img}');` : 'background:#5a7a3a;'}aspect-ratio:${retrato ? '200 / 353' : '380 / 279'}"><div class="win pm-chap"><small>ANDAR 1</small><b>ESTRADA E RUÍNAS</b></div>${svg}${nos}</div></div>`;
    // painel do nó
    const sel = S.sel != null ? run.mapa.nos[S.sel] : null;
    let pn = '<div class="scroll pm-info">';
    if (sel) {
      if (['batalha', 'elite', 'chefe'].includes(sel.tipo)) {
        const g = RUN.inimigosDoNo(run, sel); const tema = RUN.TEMAS.find(t => t.id === sel.tema); const rosto = rostoDoNo(run, sel);
        pn += `${face(rosto, 'big')}<div><small class="tag" style="color:#7a5a1a">${NOME_TIPO[sel.tipo]}${tema ? ' · ' + esc(tema.nome) : ''}</small><h3>${esc(sel.nome)}</h3></div>${sel.texto ? `<q>${esc(sel.texto)}</q>` : ''}
          <div class="foes">${g.ids.map(id => { const c = D.CRIATURAS[id]; return face(c.token, id === g.chefe ? 'boss' : '', '').replace('<span', `<span title="${esc(c.nome)} (ND ${c.ndTxt})"`); }).join('')}</div><div>${g.ids.length} inimigos · ND <b>${RUN.ndTxt(g.nd)}</b></div>`;
        if (sel.tipo === 'elite') pn += '<p class="mut">Mais forte, mas sempre deixa um item mágico.</p>';
        if (sel.tipo === 'chefe') pn += '<p class="mut">Chefe Final: PV dobrados e redução de dano 5. Vencer encerra a run com vitória.</p>';
      } else {
        const ic = sel.tipo === 'evento' ? '?' : ICON[sel.tipo];
        const txt = sel.tipo === 'evento' ? ['Algo na estrada…', 'Pode ser uma taverna, um altar, um tesouro com armadilha, alguém precisando de ajuda ou uma emboscada. Os testes usam a melhor perícia do grupo.']
          : sel.tipo === 'loja' ? [sel.nome, 'Poções, comida, barraca e algumas armas e armaduras superiores. Compra itens comuns pela metade do preço.']
          : [sel.nome, 'Descanso rápido (ração) ou longo (ração + barraca, recupera tudo).'];
        pn += `<span class="face-px big" style="display:grid;place-items:center;font-size:40px;background:${COR_NO[sel.tipo]}">${ic}</span><div><small class="tag" style="color:#7a5a1a">${NOME_TIPO[sel.tipo]}</small><h3>${esc(txt[0])}</h3></div><p>${esc(txt[1])}</p>`;
      }
      pn += `<button class="btn gold bbig" id="mIr">${sel.tipo === 'chefe' ? '👑 Enfrentar o chefe' : ['batalha', 'elite'].includes(sel.tipo) ? 'Viajar e lutar ▶' : 'Viajar ▶'}</button>`;
    } else {
      pn += `<span class="face-px big" style="display:grid;place-items:center;font-size:40px;background:var(--par3);border-color:var(--par2)">🧭</span><h3>Escolha o caminho</h3><p>Toque num dos nós que piscam para ver o que há lá. Mais batalhas dão mais XP e ouro; fogueiras e eventos ajudam a recuperar.</p>
        <div class="pm-leg">${['batalha', 'elite', 'loja', 'descanso', 'evento', 'chefe'].map(t => `<span><b style="--c:${COR_NO[t]}">${t === 'evento' ? '?' : ICON[t]}</b>${NOME_TIPO[t]}</span>`).join('')}</div>`;
    }
    const rapido = RUN.opcoesDescanso(run, null)[0];
    pn += `<div class="acamp"><button class="btn sm" id="mRap" ${rapido.pode ? '' : 'disabled'} title="${esc(rapido.desc)}">🍖 Acampar aqui (${rapido.custo})</button> <button class="btn red sm" id="mDesistir">Desistir</button></div></div>`;
    h += pn + '</div>';
    mostrar(h, 'mapa'); ligarBarra();
    ligarCabecalho(telaMapa);
    root.querySelectorAll('[data-no]').forEach(g => g.onclick = () => { const id = +g.dataset.no; if (!ids.has(id)) return; clique(); S.sel = id; telaMapa(); });
    if ($('mIr')) $('mIr').onclick = () => { clique(); const e = RUN.avancar(run, S.sel); if (e) return; S.sel = null; salvar(); abrirPendente(); };
    $('mRap').onclick = () => { clique(); RUN.descansar(run, 'rapido', null); salvar(); telaMapa(); };
    $('mDesistir').onclick = e => { clique(); if (e.target.dataset.ok) { run.fim = 'derrota'; run.desistiu = true; salvar(); telaFim(); } else { e.target.dataset.ok = 1; e.target.textContent = 'Toque de novo para desistir'; } };
    // leva a rolagem até o grupo
    const w = $('pmWin'); if (w) { const alvo = root.querySelector('.nd.atual'); if (alvo) { const r1 = w.getBoundingClientRect(), r2 = alvo.getBoundingClientRect(); w.scrollTop += r2.top - r1.top - w.clientHeight * 0.6; } }
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

  /* ---------- guilda: salão com balcões e NPCs ---------- */
  const SALAS = [
    { id: 'bau', nome: 'Baú e Vitrine', npc: 'aegoron', quem: 'Sir Aegoron', fala: 'Guardo o que vocês trazem. Vendo pela metade, nem um tibar a mais.', desc: 'Itens trazidos de volta', marco: 'guilda' },
    { id: 'tesouraria', nome: 'Tesouraria', npc: 'dame-lia', quem: 'Dame Lia', fala: 'Uma família rica abre muitas portas. E bolsas.', desc: '+T$ 100 na partida', marco: 'bolsaRica' },
    { id: 'templo', nome: 'Templo', npc: 'hanalendariana', quem: 'Hanalendariana', fala: 'A fogueira pode trazer alguém de volta. Uma vez.', desc: 'Reviver 1×/run', marco: 'templo' },
    { id: 'torre', nome: 'Torre de treino', npc: 'zaldrin', quem: 'Zaldrin', fala: 'Treino antes da estrada. Menos susto depois.', desc: 'Começar no nível 2', marco: 'nivel2' },
  ];
  function telaGuilda(aba) {
    const m = S.meta; aba = aba || 'bau';
    let h = barra('Guilda dos Aventureiros', `<span>🏅 ${m.pontos.toLocaleString('pt-BR')}</span><span class="gold">T$ ${m.ouro} no cofre</span>`);
    h += '<div class="pgu"><div class="salao"><span class="ban" style="left:14%"></span><span class="ban" style="left:48%"></span><span class="ban" style="left:82%"></span>';
    for (const s of SALAS) {
      const mk = RUN.MARCOS.find(x => x.id === s.marco); const ok = m.pontos >= mk.pts;
      h += `<button class="balcao${ok ? '' : ' fechado'}${aba === s.id ? ' on' : ''}" data-sala="${s.id}"><span class="tg">${ok ? 'ABERTO' : mk.pts.toLocaleString('pt-BR') + ' pts'}</span>${face(s.npc)}<div class="mesa">${ok ? '' : '🔒 '}${s.nome}<small>${s.desc}</small></div></button>`;
    }
    h += '</div>';
    const sala = SALAS.find(s => s.id === aba); const mk = RUN.MARCOS.find(x => x.id === sala.marco); const ok = m.pontos >= mk.pts;
    h += `<div class="scroll npc-p"><div class="hd">${face(sala.npc)}<div><small class="tag" style="color:#7a5a1a">${sala.nome.toUpperCase()}</small><h3>${esc(sala.quem)}</h3><q>${esc(sala.fala)}</q></div></div>`;
    h += `<p><b>${esc(mk.nome)}:</b> ${esc(mk.desc)}</p>`;
    if (!ok) h += `<p>Faltam <b>${(mk.pts - m.pontos).toLocaleString('pt-BR')}</b> pontos. A pontuação é o XP que seus heróis acumulam em todas as runs.</p>`;
    else if (aba === 'bau') {
      h += m.bau.length ? `<p class="mut">Na pré-run você pode levar até 2 destes itens. Vender à guilda rende metade do preço do livro (o ouro fica no cofre).</p><div class="bau">${m.bau.map((id, k) => `<div class="itm"><span>${I(id).ic}</span>${esc(I(id).nome)}<em>${esc(I(id).desc)}</em><button class="btn sm" data-gv="${k}">Vender por T$ ${Math.floor(I(id).preco / 2).toLocaleString('pt-BR')}</button></div>`).join('')}</div>` : '<p class="mut">O baú está vazio. Itens equipados e da mochila voltam com você quando o grupo vence o andar.</p>';
    } else h += '<p class="okt"><b>Já está valendo nas suas runs.</b></p>';
    h += `<h3 style="margin-top:12px">Histórico</h3>${m.historico.length ? '<div class="hist">' + m.historico.slice(0, 6).map(x => `<div>${x.venceu ? '🏆' : '💀'} nível ${x.nivel} · +${x.pts.toLocaleString('pt-BR')} pts · ${x.herois.map(hid => H(hid).nome.split(' ')[0]).join(', ')}</div>`).join('') + '</div>' : '<p class="mut">Nenhuma run ainda.</p>'}`;
    h += '</div></div>';
    mostrar(h, 'guilda'); ligarBarra();
    ligar('[data-sala]', d => telaGuilda(d.sala));
    ligar('[data-gv]', d => { RUN.vendaGuilda(m, +d.gv); salvar(); telaGuilda('bau'); });
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
