/* Arena de Arton — modo roguelike (sem DOM). Guarda o estado da run (mapa do andar,
   grupo, ouro, itens, XP) e o progresso permanente (pontuação, guilda, baú).
   Tudo é JSON puro e o dado é semeado, igual ao motor de combate. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./data.js') : root.T20DATA;
  const R = node ? require('./rules.js') : root.T20;

  /* ---------- dado semeado da run ---------- */
  function rnd(o) {
    let t = (o.seed = (o.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const dado = (o, f) => 1 + Math.floor(rnd(o) * f);
  const rolar = (o, n, f, b) => { let s = b || 0; for (let i = 0; i < n; i++) s += dado(o, f); return s; };
  const escolher = (o, a) => a[Math.floor(rnd(o) * a.length)];
  function embaralhar(o, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(o) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- regras do livro usadas aqui ---------- */
  // XP necessário por nível (tabela de T20): 2º = 1.000, 3º = 3.000, 4º = 6.000 ...
  const XP_NIVEL = [0, 0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000];
  // ajuste do roguelike: o andar tem ~8 batalhas, então o XP do livro é acelerado para o grupo chegar ao chefe no 3º nível
  const XP_MULT = 1.5;
  const nivelDoXP = xp => { let n = 1; while (n < 20 && xp >= XP_NIVEL[n + 1]) n++; return n; };
  // ND de um grupo de inimigos: equivalência do livro (dois do mesmo ND = ND+2; um ND abaixo soma +1 etc.)
  const ndEq = nd => nd >= 1 ? nd : nd >= 0.5 ? -1 : nd >= 0.25 ? -3 : -5;
  function ndEncontro(ids) {
    const s = ids.reduce((a, id) => a + Math.pow(2, ndEq(D.CRIATURAS[id].nd) / 2), 0);
    const v = 2 * Math.log2(s) + 1e-9;
    return v >= 1 ? Math.round(v * 4) / 4 : v >= -1.5 ? 0.5 : 0.25;
  }
  const ndTxt = n => n === 0.25 ? '1/4' : n === 0.5 ? '1/2' : String(+n.toFixed(2)).replace('.', ',');

  /* ---------- itens (nomes, preços e efeitos do Livro Base; efeitos simplificados) ---------- */
  // slot: arma | armadura | acessorio | cinto | bolsa.  ef: efeitos passivos aplicados ao herói na batalha.
  const ITENS = {
    // cinto (uso em batalha)
    pocao: { nome: 'Poção de Curar Ferimentos', slot: 'cinto', preco: 50, ic: '🧪', desc: 'Cura 2d8+2 PV. Ação padrão; pode dar a um aliado adjacente, até desmaiado.', uso: { cura: [2, 8, 2] } },
    pocaoMaior: { nome: 'Poção de Curar Ferimentos (maior)', slot: 'cinto', preco: 300, ic: '🧪', desc: 'Cura 4d8+4 PV. Ação padrão; pode dar a um aliado adjacente.', uso: { cura: [4, 8, 4] } },
    oleo: { nome: 'Óleo de Arma Mágica', slot: 'cinto', preco: 60, ic: '🫙', desc: '+1 em ataque e dano até o fim da batalha. Ação de movimento.', uso: { arma: 1 } },
    protecao: { nome: 'Poção de Proteção Divina', slot: 'cinto', preco: 60, ic: '✨', desc: '+2 em testes de resistência até o fim da batalha. Ação de movimento.', uso: { protecao: 2 } },
    granada: { nome: 'Granada de Bola de Fogo', slot: 'cinto', preco: 300, ic: '💣', desc: '6d6 de fogo no alvo e em quem estiver ao lado dele (Reflexos CD 15 reduz à metade). Alcance médio.', uso: { area: [6, 6], cd: 15, tipo: 'fogo' } },
    velocidade: { nome: 'Poção de Velocidade', slot: 'cinto', preco: 300, ic: '⚡', desc: 'Uma ação padrão extra por turno até o fim da batalha. Ação de movimento.', uso: { velocidade: true } },
    // bolsa (entre batalhas)
    racao: { nome: 'Ração de viagem', slot: 'bolsa', preco: 6, ic: '🍖', desc: 'Frango assado, pão e queijo: um dia de estrada para um herói. Descansar gasta uma por herói vivo.' },
    barraca: { nome: 'Barraca', slot: 'bolsa', preco: 40, ic: '⛺', desc: 'Permite descanso longo numa fogueira (recupera tudo).' },
    corda: { nome: 'Corda', slot: 'bolsa', preco: 10, ic: '🪢', desc: 'Ajuda em alguns eventos (escalar, descer, amarrar).' },
    // armas superiores (melhoria no item que o herói já usa)
    certeira: { nome: 'Arma superior (certeira)', slot: 'arma', preco: 450, ic: '🗡', desc: '+1 nos testes de ataque.', ef: { ataque: 1 } },
    cruel: { nome: 'Arma superior (cruel)', slot: 'arma', preco: 450, ic: '🗡', desc: '+1 nas rolagens de dano.', ef: { dano: 1 } },
    certeiraCruel: { nome: 'Arma superior (certeira e cruel)', slot: 'arma', preco: 3000, ic: '🗡', desc: '+1 no ataque e +1 no dano.', ef: { ataque: 1, dano: 1 } },
    // armas mágicas (só elite, chefe e evento)
    flamejante: { nome: 'Arma flamejante', slot: 'arma', preco: 18000, ic: '🔥', magico: true, desc: '+1d6 de dano de fogo em cada acerto.', ef: { extra: [1, 6, 'fogo'] } },
    congelante: { nome: 'Arma congelante', slot: 'arma', preco: 18000, ic: '❄', magico: true, desc: '+1d6 de dano de frio em cada acerto.', ef: { extra: [1, 6, 'frio'] } },
    eletrica: { nome: 'Arma elétrica', slot: 'arma', preco: 18000, ic: '⚡', magico: true, desc: '+1d6 de dano de eletricidade em cada acerto.', ef: { extra: [1, 6, 'eletricidade'] } },
    ameacadora: { nome: 'Arma ameaçadora', slot: 'arma', preco: 18000, ic: '🎯', magico: true, desc: 'A margem de ameaça da arma dobra (19-20 vira 17-20).', ef: { ameacadora: true } },
    // armaduras
    reforcada: { nome: 'Armadura superior (reforçada)', slot: 'armadura', preco: 450, ic: '🛡', desc: '+1 na Defesa.', ef: { def: 1 } },
    defensora: { nome: 'Armadura defensora', slot: 'armadura', preco: 18000, ic: '🛡', magico: true, desc: '+2 na Defesa.', ef: { def: 2 } },
    protetora: { nome: 'Armadura protetora', slot: 'armadura', preco: 18000, ic: '🛡', magico: true, desc: '+1 na Defesa e +2 em testes de resistência.', ef: { def: 1, res: 2 } },
    // acessórios menores
    sustento: { nome: 'Anel do Sustento', slot: 'acessorio', preco: 3000, ic: '💍', magico: true, desc: 'Não precisa comer: descansa sem gastar ração.', ef: { sustento: true } },
    luvas: { nome: 'Luvas da Delicadeza', slot: 'acessorio', preco: 4500, ic: '🧤', magico: true, desc: '+1 Destreza (pontaria, Reflexos, iniciativa e Defesa sem armadura pesada).', ef: { des: 1 } },
    manoplas: { nome: 'Manoplas da Força do Ogro', slot: 'acessorio', preco: 4500, ic: '🥊', magico: true, desc: '+1 Força (luta e dano corpo a corpo).', ef: { for: 1 } },
    manto: { nome: 'Manto da Resistência', slot: 'acessorio', preco: 4500, ic: '🧥', magico: true, desc: '+2 em testes de resistência.', ef: { res: 2 } },
    torque: { nome: 'Torque do Vigor', slot: 'acessorio', preco: 4500, ic: '📿', magico: true, desc: '+1 Constituição (+1 PV por nível e Fortitude).', ef: { con: 1 } },
    anelProtecao: { nome: 'Anel da Proteção', slot: 'acessorio', preco: 9000, ic: '💍', magico: true, desc: '+2 na Defesa.', ef: { def: 2 } },
    // acessórios médios (chefe)
    vitalidade: { nome: 'Anel da Vitalidade', slot: 'acessorio', preco: 21000, ic: '💍', magico: true, desc: '+10 PV.', ef: { pv: 10 } },
    robustez: { nome: 'Amuleto da Robustez', slot: 'acessorio', preco: 25500, ic: '📿', magico: true, desc: '+2 Constituição.', ef: { con: 2 } },
    cintoGigante: { nome: 'Cinto da Força do Gigante', slot: 'acessorio', preco: 25500, ic: '🎗', magico: true, desc: '+2 Força.', ef: { for: 2 } },
    pulseiras: { nome: 'Pulseiras da Celeridade', slot: 'acessorio', preco: 25500, ic: '⌚', magico: true, desc: '+2 Destreza.', ef: { des: 2 } },
  };
  const LOJA_FIXOS = ['pocao', 'racao', 'barraca'];
  const LOJA_SORTEIO = ['pocaoMaior', 'oleo', 'protecao', 'granada', 'velocidade', 'corda', 'certeira', 'cruel', 'reforcada'];
  const DROP_ELITE = ['sustento', 'luvas', 'manoplas', 'manto', 'torque', 'anelProtecao', 'certeiraCruel', 'flamejante', 'congelante', 'eletrica'];
  const DROP_CHEFE = ['vitalidade', 'robustez', 'cintoGigante', 'pulseiras', 'defensora', 'protetora', 'ameacadora', 'flamejante'];
  const DROP_COMUM = ['pocao', 'pocao', 'oleo', 'protecao', 'racao', 'pocaoMaior'];

  /* ---------- inimigos do andar 1: estrada e ruínas ---------- */
  const TEMAS = [
    { id: 'bandidos', nome: 'bandidos', mapas: ['estrada', 'clareira'], pool: ['capanga', 'saqueador', 'saqueadora', 'barbaroErmos', 'minotauro'] },
    { id: 'kobolds', nome: 'kobolds', mapas: ['estrada', 'clareira'], pool: ['kobold', 'koboldFunda', 'capanga'] },
    { id: 'feras', nome: 'feras', mapas: ['clareira', 'rio'], pool: ['lobo', 'urso', 'homemPiranha'] },
    { id: 'ruinas', nome: 'mortos das ruínas', mapas: ['cripta'], pool: ['zumbi', 'cultista', 'zumbiTurba'] },
    { id: 'puristas', nome: 'puristas', mapas: ['estrada', 'rio'], pool: ['soldadoPurista', 'capanga', 'sargentoPurista', 'arcanoGuerra'] },
  ];
  const NOMES_ENC = {
    bandidos: ['Emboscada na estrada', 'Pedágio dos saqueadores', 'Acampamento bandido', 'Assalto na ponte'],
    kobolds: ['Toca kobold', 'Armadilha dos kobolds', 'Kobolds na trilha'],
    feras: ['Uivos na mata', 'Território das feras', 'Caçada no vau'],
    ruinas: ['Ruínas assombradas', 'A capela caída', 'Cemitério da estrada'],
    puristas: ['Patrulha purista', 'Posto de controle', 'Caçadores de hereges'],
  };
  const CHEFES = [
    { id: 'minotauro', nome: 'O Rei da Estrada', chefe: 'minotauro', escolta: ['capanga', 'saqueadora', 'saqueador'], mapa: 'clareira', texto: 'O minotauro que comanda os bandidos da região quer o seu ouro.' },
    { id: 'necromante', nome: 'A Capela Profanada', chefe: 'cultista', escolta: ['zumbi', 'zumbi', 'zumbiTurba'], mapa: 'cripta', texto: 'Um cultista ergue os mortos das ruínas para servi-lo.' },
    { id: 'barbaro', nome: 'O Senhor dos Ermos', chefe: 'barbaroErmos', escolta: ['lobo', 'lobo', 'saqueadora'], mapa: 'clareira', texto: 'Um bárbaro e sua matilha fizeram das ruínas o seu covil.' },
  ];

  function gerarGrupo(o, alvo, tema, min, max) {
    let melhor = null;
    for (let k = 0; k < 160; k++) {
      const n = min + Math.floor(rnd(o) * (max - min + 1)); const ids = [];
      for (let i = 0; i < n; i++) ids.push(escolher(o, tema.pool));
      const nd = ndEncontro(ids); const err = Math.abs(nd - alvo) + (nd > alvo ? 0.15 : 0);
      if (!melhor || err < melhor.err) melhor = { ids, nd, err };
      if (err < 0.1) break;
    }
    melhor.ids.sort((a, b) => D.CRIATURAS[b].nd - D.CRIATURAS[a].nd);
    return melhor;
  }

  /* ---------- mapa do andar ---------- */
  const COLS = 12, LANES = 4; // coluna 0 = partida, 1..11 = nós, 12 = chefe
  function gerarMapa(o) {
    const nos = []; const col = [];
    nos.push({ id: 0, c: 0, l: 1.5, tipo: 'inicio', liga: [] }); col[0] = [0];
    for (let c = 1; c <= COLS - 1; c++) {
      col[c] = [];
      const lanes = c === 1 || c === COLS - 1 ? [0, 1, 2, 3] : embaralhar(o, [0, 1, 2, 3]).slice(0, rnd(o) < 0.7 ? 4 : 3).sort();
      for (const l of lanes) { const n = { id: nos.length, c, l, tipo: 'batalha', liga: [] }; nos.push(n); col[c].push(n.id); }
    }
    const chefe = { id: nos.length, c: COLS, l: 1.5, tipo: 'chefe', liga: [] }; nos.push(chefe); col[COLS] = [chefe.id];
    // arestas: cada nó liga aos nós da coluna seguinte em faixas vizinhas
    for (let c = 0; c < COLS; c++) {
      for (const id of col[c]) {
        const a = nos[id]; const prox = col[c + 1].map(j => nos[j]);
        let alvos = c === 0 || c + 1 === COLS ? prox : prox.filter(b => Math.abs(b.l - a.l) <= 1);
        if (!alvos.length) alvos = [prox.slice().sort((x, y) => Math.abs(x.l - a.l) - Math.abs(y.l - a.l))[0]];
        if (c > 0 && c + 1 < COLS && alvos.length > 2) alvos = embaralhar(o, alvos).slice(0, 2);
        a.liga = alvos.map(b => b.id);
      }
      // todo nó da coluna seguinte precisa de entrada
      for (const j of col[c + 1]) {
        if (!col[c].some(i => nos[i].liga.includes(j))) {
          const b = nos[j]; const src = col[c].map(i => nos[i]).sort((x, y) => Math.abs(x.l - b.l) - Math.abs(y.l - b.l))[0]; src.liga.push(j);
        }
      }
    }
    // tipos por coluna
    for (let c = 1; c <= COLS - 1; c++) {
      for (const id of col[c]) {
        const n = nos[id]; const r = rnd(o);
        if (c <= 2) n.tipo = 'batalha';
        else if (c === COLS - 1) n.tipo = 'descanso';
        else if (c === 6) n.tipo = r < 0.5 ? 'loja' : r < 0.8 ? 'evento' : 'batalha';
        else if (c >= 4 && r < 0.2) n.tipo = 'elite';
        else if (r < 0.37) n.tipo = 'evento';
        else if (r < 0.45 && c >= 4) n.tipo = 'descanso';
        else if (r < 0.5 && c >= 3) n.tipo = 'loja';
        else n.tipo = 'batalha';
      }
    }
    // garante uma loja na coluna 6 e uma elite no meio
    if (!col[6].some(i => nos[i].tipo === 'loja')) nos[escolher(o, col[6])].tipo = 'loja';
    for (const c of [5, 8]) if (!col[c].some(i => nos[i].tipo === 'elite')) nos[escolher(o, col[c])].tipo = 'elite';
    // evita duas lojas ou dois descansos seguidos no mesmo caminho
    for (const n of nos) for (const j of n.liga) { const m = nos[j]; if (m.tipo === n.tipo && (n.tipo === 'loja' || n.tipo === 'descanso') && m.c < COLS - 1) m.tipo = 'batalha'; }
    return { nos, colunas: COLS };
  }

  /* ---------- run ---------- */
  const MAX_CINTO = 3;
  function novaRun(cfg) {
    const seed = (cfg.seed >>> 0) || ((Math.random() * 1e9) | 0);
    const run = {
      v: 1, seed, sorte: { seed: seed ^ 0x5bd1e995 }, andar: 1, xp: 0, nivel: 1, ouro: cfg.ouro != null ? cfg.ouro : 150,
      herois: cfg.herois.slice(0, 4).map(hid => ({ hid, dano: 0, pmGasto: 0, morto: false, equip: { arma: null, armadura: null, acessorio: null }, cinto: ['pocao', null, null] })),
      bolsa: { racao: 4, barraca: 0, corda: 0 }, mochila: [],
      mapa: null, atual: 0, caminho: [0], log: [], fim: null, pendente: null,
      stats: { batalhas: 0, elites: 0, abates: 0, xp: 0, ouroGanho: 0, mortes: 0, rodadas: 0 },
      nivelInicial: cfg.nivel || 1,
    };
    if (run.nivelInicial > 1) { run.xp = XP_NIVEL[run.nivelInicial]; run.nivel = run.nivelInicial; }
    for (const it of cfg.itens || []) darItem(run, it);
    run.mapa = gerarMapa(run.sorte);
    for (const n of run.mapa.nos) prepararNo(run, n);
    return run;
  }
  const vivos = run => run.herois.filter(h => !h.morto);
  const noAtual = run => run.mapa.nos[run.atual];
  function proximos(run) { if (run.fim || run.pendente) return []; return noAtual(run).liga.map(i => run.mapa.nos[i]); }

  // conteúdo fixo de cada nó (sorteado ao criar o mapa, para o jogador poder planejar)
  function prepararNo(run, n) {
    const o = run.sorte;
    if (n.tipo === 'batalha' || n.tipo === 'elite') {
      const tema = n.c <= 2 ? escolher(o, TEMAS.filter(t => t.id !== 'puristas' && t.id !== 'ruinas')) : escolher(o, TEMAS);
      n.tema = tema.id; n.mapaId = escolher(o, tema.mapas); n.nome = escolher(o, NOMES_ENC[tema.id]);
      if (n.tipo === 'elite') n.nome = 'Elite: ' + n.nome;
    }
    if (n.tipo === 'chefe') { const C = escolher(o, CHEFES); n.chefeId = C.id; n.nome = C.nome; n.texto = C.texto; n.mapaId = C.mapa; }
    if (n.tipo === 'evento') n.evento = escolher(o, Object.keys(EVENTOS));
    if (n.tipo === 'loja') n.nome = 'Mercadora de estrada';
    if (n.tipo === 'descanso') n.nome = n.c === COLS - 1 ? 'Fogueira antes do chefe' : 'Fogueira';
  }
  // nível esperado do grupo em cada coluna (o grupo sai do 1º e chega ao 4º no chefe)
  function alvoND(run, n) {
    const nv = run.nivel;
    if (n.tipo === 'chefe') return nv + 1;
    if (n.tipo === 'elite') return nv + (n.c <= 5 ? 0.5 : 1);
    if (n.c <= 1) return Math.max(0.5, nv - 0.5);
    return nv;
  }
  function inimigosDoNo(run, n) {
    if (n.grupo && n.grupoNivel === run.nivel) return n.grupo;
    const o = { seed: run.seed ^ (n.id * 2654435761) ^ (run.nivel * 97) };
    let g;
    if (n.tipo === 'chefe') {
      const C = CHEFES.find(c => c.id === n.chefeId);
      // Chefe Final: PV dobrados contam como +2 de ND; a escolta cresce com o nível do grupo
      const alvo = run.nivel + 1.5; let escolta = [];
      for (let k = 0; k <= C.escolta.length; k++) { const e = C.escolta.slice(0, k); if (k === 0 || ndEncontro([C.chefe, C.chefe, ...e]) <= alvo + 0.25) escolta = e; }
      g = { ids: [C.chefe, ...escolta], chefe: C.chefe };
      g.nd = ndEncontro([C.chefe, C.chefe, ...escolta]);
    } else {
      const tema = TEMAS.find(t => t.id === n.tema); const alvo = alvoND(run, n);
      g = gerarGrupo(o, alvo, tema, n.tipo === 'elite' ? 2 : 2, n.tipo === 'elite' ? 4 : 5);
    }
    n.grupo = g; n.grupoNivel = run.nivel; return g;
  }

  /* ---------- herói na batalha: aplica dano, PM, itens ---------- */
  function efeitosDe(h) { return ['arma', 'armadura', 'acessorio'].map(s => h.equip[s] && ITENS[h.equip[s]]).filter(Boolean).map(I => I.ef || {}); }
  function aplicarItens(u, h, nivel) {
    const c = D.CLASSES[u.classe];
    for (const ef of efeitosDe(h)) {
      if (ef.ataque) u.arma.bonusAtaque = (u.arma.bonusAtaque || 0) + ef.ataque;
      if (ef.dano) u.bonusDano = (u.bonusDano || 0) + ef.dano;
      if (ef.extra) u.arma.extra = ef.extra;
      if (ef.ameacadora) u.arma.margem = 21 - (21 - u.arma.margem) * 2;
      if (ef.def) u.defBase += ef.def;
      if (ef.res) { u.per.fort += ef.res; u.per.ref += ef.res; u.per.von += ef.res; }
      if (ef.pv) { u.pvMax += ef.pv; u.pv += ef.pv; }
      if (ef.for) { u.attr.for += ef.for; u.per.luta += ef.for; }
      if (ef.des) { u.attr.des += ef.des; u.per.pont += ef.des; u.per.ref += ef.des; u.per.inic += ef.des; if (!c.armaduraPesada) u.defBase += ef.des; }
      if (ef.con) { u.attr.con += ef.con; u.per.fort += ef.con; u.pvMax += ef.con * nivel; u.pv += ef.con * nivel; }
    }
  }
  function unidadeHeroi(h, nivel, idx) { const u = R.criarHeroi(h.hid, nivel, idx); aplicarItens(u, h, nivel); return u; }
  function pvMaxDe(h, nivel) { return unidadeHeroi(h, nivel, 0).pvMax; }
  function pmMaxDe(h, nivel) { return unidadeHeroi(h, nivel, 0).pmMax; }

  function prepararBatalha(run, n) {
    n = n || noAtual(run);
    const g = inimigosDoNo(run, n); const grupo = vivos(run);
    const cfg = { herois: grupo.map(h => h.hid), nivel: run.nivel, inimigos: g.ids, mapa: n.mapaId, seed: (run.seed ^ (n.id * 7919) ^ (run.stats.batalhas * 104729)) >>> 0, run: true };
    return { cfg, grupo, chefe: g.chefe || null, nd: g.nd };
  }
  // chamado logo depois de R.novaBatalha: ajusta heróis e o chefe
  function ajustarBatalha(run, st, prep) {
    const hs = st.unidades.filter(u => u.lado === 'h');
    hs.forEach((u, i) => {
      const h = prep.grupo[i]; u.runIdx = run.herois.indexOf(h);
      aplicarItens(u, h, run.nivel);
      u.pv = Math.max(1, u.pvMax - h.dano); u.pm = Math.max(0, u.pmMax - h.pmGasto);
      u.cinto = h.cinto.slice();
    });
    if (prep.chefe) {
      const b = st.unidades.find(u => u.lado === 'm' && u.ref === prep.chefe);
      if (b) { b.pvMax *= 2; b.pv = b.pvMax; b.rd = Math.max(b.rd || 0, 5); b.chefe = true; b.nome = b.nome + ' (chefe)'; b.pm += 2 * Math.round(b.nd); b.pmMax = b.pm; }
    }
    st.cfg.run = true;
  }
  // depois da batalha: devolve o estado ao grupo e calcula recompensas
  function concluirBatalha(run, st, prep) {
    const n = noAtual(run); const venceu = st.fim === 'herois';
    const res = { venceu, xp: 0, ouro: 0, itens: [], mortos: [], subiu: null, nd: prep.nd };
    run.stats.batalhas++; run.stats.rodadas += st.rodada;
    run.stats.abates += st.unidades.filter(u => u.lado === 'm' && !u.vivo).length;
    for (const u of st.unidades.filter(x => x.lado === 'h')) {
      const h = run.herois[u.runIdx];
      h.cinto = u.cinto.slice();
      if (!u.vivo) { h.morto = true; h.dano = 0; h.pmGasto = 0; res.mortos.push(u.nome); run.stats.mortes++; continue; }
      if (!venceu) { h.morto = true; res.mortos.push(u.nome); run.stats.mortes++; continue; } // grupo caído: inimigos acabam com os desmaiados
      const pv = Math.max(1, u.pv); // desmaiado levanta com 1 PV se o grupo vencer
      h.dano = u.pvMax - pv; h.pmGasto = u.pmMax - u.pm;
    }
    if (!venceu) { run.fim = 'derrota'; run.log.push(`💀 O grupo caiu em ${n.nome}.`); return res; }
    // XP: ND × 1.000 dividido pelo tamanho do grupo (heróis que começaram a run)
    const ndXp = n.tipo === 'chefe' ? prep.nd + 0 : prep.nd;
    res.xp = Math.round(ndXp * 1000 * XP_MULT / run.herois.length);
    const antes = run.nivel; run.xp += res.xp; run.stats.xp += res.xp; run.nivel = Math.min(20, nivelDoXP(run.xp));
    if (run.nivel > antes) res.subiu = { de: antes, para: run.nivel };
    // tesouro: proporcional ao ND (aprox. da tabela de tesouro do livro, mais baixa no andar 1)
    const o = run.sorte;
    res.ouro = Math.round((20 + 35 * Math.max(0.5, prep.nd)) * (0.7 + rnd(o) * 0.6) * (n.tipo === 'elite' ? 1.6 : n.tipo === 'chefe' ? 2.5 : 1));
    run.ouro += res.ouro; run.stats.ouroGanho += res.ouro;
    if (n.tipo === 'elite') { res.itens.push(escolher(o, DROP_ELITE)); run.stats.elites++; }
    else if (n.tipo === 'chefe') res.itens.push(escolher(o, DROP_CHEFE));
    else if (rnd(o) < 0.4) res.itens.push(escolher(o, DROP_COMUM));
    for (const it of res.itens) darItem(run, it);
    if (n.tipo === 'chefe') { run.fim = 'vitoria'; run.log.push('🏆 O chefe do andar caiu!'); }
    run.log.push(`⚔ ${n.nome}: vitória (+${res.xp} XP, +T$ ${res.ouro}${res.itens.length ? ', ' + res.itens.map(i => ITENS[i].nome).join(', ') : ''}).`);
    return res;
  }

  /* ---------- itens: dar, equipar, cinto, vender ---------- */
  function darItem(run, id) {
    const I = ITENS[id]; if (!I) return;
    if (I.slot === 'bolsa') { run.bolsa[id] = (run.bolsa[id] || 0) + (id === 'racao' ? 4 : 1); return; }
    if (I.slot === 'cinto') { for (const h of vivos(run)) { const k = h.cinto.indexOf(null); if (k >= 0) { h.cinto[k] = id; return; } } }
    run.mochila.push(id);
  }
  function equipar(run, hi, idxMochila) {
    const h = run.herois[hi]; const id = run.mochila[idxMochila]; const I = ITENS[id]; if (!h || !I || h.morto) return 'Herói inválido.';
    if (I.slot === 'cinto') { const k = h.cinto.indexOf(null); if (k < 0) return 'Cinto cheio (3 itens).'; h.cinto[k] = id; run.mochila.splice(idxMochila, 1); return null; }
    if (!['arma', 'armadura', 'acessorio'].includes(I.slot)) return 'Esse item fica na bolsa.';
    const pvAntes = pvMaxDe(h, run.nivel);
    run.mochila.splice(idxMochila, 1); if (h.equip[I.slot]) run.mochila.push(h.equip[I.slot]); h.equip[I.slot] = id;
    const pvDepois = pvMaxDe(h, run.nivel); if (pvDepois < pvAntes) h.dano = Math.max(0, h.dano - (pvAntes - pvDepois));
    return null;
  }
  function desequipar(run, hi, slot) {
    const h = run.herois[hi]; if (!h) return 'Herói inválido.';
    if (slot.startsWith('cinto')) { const k = +slot.slice(5); if (!h.cinto[k]) return 'Vazio.'; run.mochila.push(h.cinto[k]); h.cinto[k] = null; return null; }
    if (!h.equip[slot]) return 'Vazio.'; run.mochila.push(h.equip[slot]); h.equip[slot] = null;
    h.dano = Math.min(h.dano, pvMaxDe(h, run.nivel) - 1); return null;
  }

  /* ---------- loja ---------- */
  function estoqueLoja(run, n) {
    if (n.estoque) return n.estoque;
    const o = { seed: run.seed ^ (n.id * 40503) };
    const sorteio = embaralhar(o, LOJA_SORTEIO).slice(0, 5);
    n.estoque = [...LOJA_FIXOS.map(id => ({ id, fixo: true })), ...sorteio.map(id => ({ id, fixo: false, vendido: false }))];
    return n.estoque;
  }
  function comprar(run, n, k, hi) {
    const e = estoqueLoja(run, n)[k]; if (!e || e.vendido) return 'Esgotado.';
    const I = ITENS[e.id]; if (run.ouro < I.preco) return 'Ouro insuficiente.';
    if (I.slot === 'cinto' && hi != null) { const h = run.herois[hi]; const j = h.cinto.indexOf(null); if (j < 0) return 'Cinto cheio.'; h.cinto[j] = e.id; }
    else if (I.slot === 'bolsa') run.bolsa[e.id] = (run.bolsa[e.id] || 0) + 1;
    else run.mochila.push(e.id);
    run.ouro -= I.preco; if (!e.fixo) e.vendido = true; return null;
  }
  function precoVenda(id) { const I = ITENS[id]; return I.magico ? 0 : Math.floor(I.preco / 2); }
  function vender(run, idxMochila) {
    const id = run.mochila[idxMochila]; if (!id) return 'Nada aí.'; const v = precoVenda(id);
    if (!v) return 'A mercadora não tem ouro para itens mágicos. Leve à guilda.';
    run.mochila.splice(idxMochila, 1); run.ouro += v; return null;
  }

  /* ---------- descanso ---------- */
  function semComer(h) { return h.equip.acessorio === 'sustento'; }
  function racoesNecessarias(run) { return vivos(run).filter(h => !semComer(h)).length; }
  function opcoesDescanso(run, n) {
    const out = []; const precisa = racoesNecessarias(run);
    out.push({ id: 'rapido', nome: 'Descanso rápido', desc: 'Recupera metade dos PV e PM perdidos.', custo: `${precisa} ração`, pode: run.bolsa.racao >= precisa });
    if (n && (n.tipo === 'descanso')) out.push({ id: 'longo', nome: 'Descanso longo', desc: 'Recupera todos os PV e PM.', custo: `${precisa} ração + barraca`, pode: run.bolsa.racao >= precisa && run.bolsa.barraca > 0 });
    if (n && n.tipo === 'taverna') out.push({ id: 'quarto', nome: 'Quarto na taverna', desc: 'Cama, comida quente: recupera tudo.', custo: 'T$ 60', pode: run.ouro >= 60 });
    return out;
  }
  function descansar(run, tipo, n) {
    const op = opcoesDescanso(run, n).find(o => o.id === tipo); if (!op || !op.pode) return 'Não dá para descansar assim.';
    if (tipo === 'quarto') run.ouro -= 60; else run.bolsa.racao -= racoesNecessarias(run);
    for (const h of vivos(run)) {
      if (tipo === 'rapido') { h.dano = Math.floor(h.dano / 2); h.pmGasto = Math.floor(h.pmGasto / 2); } else { h.dano = 0; h.pmGasto = 0; }
    }
    if (n) n.descansou = true;
    run.log.push(`🏕 ${op.nome}.`); return null;
  }

  /* ---------- eventos "?" (testes de perícia) ---------- */
  // bônus do melhor herói vivo numa perícia (aproximação: atributo-chave + metade do nível + treino)
  const PERICIAS = {
    atletismo: { nome: 'Atletismo', attr: 'for', classes: ['guerreiro', 'barbaro', 'cavaleiro', 'paladino'] },
    ladinagem: { nome: 'Ladinagem', attr: 'des', classes: ['ladino'] },
    percepcao: { nome: 'Percepção', attr: 'sab', classes: ['cacador', 'ladino', 'clerigo'] },
    religiao: { nome: 'Religião', attr: 'sab', classes: ['clerigo', 'paladino'] },
    misticismo: { nome: 'Misticismo', attr: 'int', classes: ['arcanista', 'bardo'] },
    diplomacia: { nome: 'Diplomacia', attr: 'car', classes: ['bardo', 'paladino', 'cavaleiro'] },
    sobrevivencia: { nome: 'Sobrevivência', attr: 'sab', classes: ['cacador', 'barbaro'] },
    reflexos: { nome: 'Reflexos', attr: 'des', classes: ['ladino', 'guerreiro', 'cacador'] },
  };
  function bonusPericia(run, p) {
    const P = PERICIAS[p]; let best = null;
    for (const h of vivos(run)) {
      const H = D.HEROIS.find(x => x.id === h.hid); const c = D.CLASSES[H.classe];
      const b = Math.floor(run.nivel / 2) + c.attr[P.attr] + (P.classes.includes(H.classe) ? 2 : 0);
      if (!best || b > best.b) best = { b, nome: H.nome.split(' ')[0] };
    }
    return best || { b: 0, nome: '—' };
  }
  const chance = (b, cd) => Math.max(5, Math.min(95, (21 - (cd - b)) * 5));
  function feridos(run) { return vivos(run); }
  function danoGrupo(run, v) { for (const h of feridos(run)) { const mx = pvMaxDe(h, run.nivel); h.dano = Math.min(mx - 1, h.dano + v); } }

  // Cada evento: texto + escolhas. Escolha: { id, txt, pericia?, cd?, req?(run), ok(run,o) -> texto, falha(run,o) -> texto }
  const EVENTOS = {
    bau: {
      nome: 'O baú da torre caída', ic: '🗝',
      texto: 'Entre as pedras de uma torre desabada há um baú de ferro. A fechadura parece armada com uma agulha.',
      escolhas: [
        { id: 'abrir', txt: 'Desarmar a armadilha e abrir', pericia: 'ladinagem', cd: 15, ok: (r, o) => { const it = escolher(o, ['pocaoMaior', 'granada', 'certeira', 'reforcada', 'velocidade']); darItem(r, it); const t = rolar(o, 3, 6, 0) * 10; r.ouro += t; return `Clique. O baú abre: T$ ${t} e ${ITENS[it].nome}.`; }, falha: (r, o) => { const v = rolar(o, 1, 6, 1); const h0 = r.herois.filter(h => !h.morto)[0]; h0.dano = Math.min(pvMaxDe(h0, r.nivel) - 1, h0.dano + v); return `A agulha envenenada pica a mão de quem tentou (–${v} PV). O baú emperra.`; } },
        { id: 'forcar', txt: 'Arrebentar a tampa', pericia: 'atletismo', cd: 17, ok: (r, o) => { const t = rolar(o, 2, 6, 0) * 10; r.ouro += t; return `A tampa cede com um estalo. Dentro, T$ ${t}.`; }, falha: (r, o) => { const v = rolar(o, 2, 6, 0); danoGrupo(r, Math.ceil(v / 2)); return `A agulha dispara um gás: todo o grupo tosse (–${Math.ceil(v / 2)} PV cada).`; } },
        { id: 'seguir', txt: 'Deixar o baú e seguir viagem', ok: () => 'Melhor não arriscar.' },
      ]
    },
    altar: {
      nome: 'Altar esquecido', ic: '⛩',
      texto: 'Um pequeno altar à beira da estrada, coberto de musgo. Ainda há velas e uma tigela de oferendas.',
      escolhas: [
        { id: 'rezar', txt: 'Rezar pedindo proteção', pericia: 'religiao', cd: 14, ok: (r) => { for (const h of vivos(r)) { h.dano = 0; h.pmGasto = Math.floor(h.pmGasto / 2); } return 'Uma luz morna envolve o grupo: PV recuperados e metade dos PM.'; }, falha: () => 'Nada acontece. Os deuses estão ocupados hoje.' },
        { id: 'oferenda', txt: 'Deixar T$ 50 de oferenda', req: r => r.ouro >= 50, reqTxt: 'T$ 50', ok: (r, o) => { r.ouro -= 50; for (const h of vivos(r)) h.dano = Math.floor(h.dano / 2); const it = rnd(o) < 0.5 ? 'protecao' : 'pocao'; darItem(r, it); return `O altar brilha. Metade dos ferimentos se fecha e surge ${ITENS[it].nome}.`; } },
        { id: 'saquear', txt: 'Pegar as moedas da tigela', ok: (r, o) => { const t = rolar(o, 2, 6, 0) * 5; r.ouro += t; if (rnd(o) < 0.5) { danoGrupo(r, 3); return `T$ ${t}… e uma maldição: –3 PV em cada herói.`; } return `T$ ${t}. Ninguém viu.`; } },
      ]
    },
    companheiro: {
      nome: 'Viajante ferido', ic: '🩹',
      texto: 'Um aventureiro está caído na trilha, ferido por lobos. Ele pede ajuda e promete recompensa.',
      escolhas: [
        { id: 'curar', txt: 'Tratar as feridas', pericia: 'sobrevivencia', cd: 13, ok: (r, o) => { const t = 40 + rolar(o, 2, 6, 0) * 5; r.ouro += t; darItem(r, 'pocao'); return `Ele se recupera e paga T$ ${t}, além de uma poção.`; }, falha: (r) => { r.bolsa.racao = Math.max(0, r.bolsa.racao - 2); return 'Vocês fazem o que dá. Ele sobrevive, mas leva duas rações para o caminho.'; } },
        { id: 'pocao', txt: 'Dar uma poção a ele', req: r => vivos(r).some(h => h.cinto.includes('pocao')), reqTxt: 'uma poção', ok: (r, o) => { const h = vivos(r).find(x => x.cinto.includes('pocao')); h.cinto[h.cinto.indexOf('pocao')] = null; const it = escolher(o, ['certeira', 'reforcada', 'cruel']); darItem(r, it); return `Grato, ele entrega o que tinha de melhor: ${ITENS[it].nome}.`; } },
        { id: 'seguir', txt: 'Seguir viagem', ok: () => 'Vocês seguem. Os uivos ficam para trás.' },
      ]
    },
    mercador: {
      nome: 'Mercador ambulante', ic: '🐴',
      texto: 'Uma carroça parada. O mercador tem pressa e faz preço bom em poções.',
      escolhas: [
        { id: 'pocoes', txt: 'Comprar 2 poções de cura por T$ 80', req: r => r.ouro >= 80, reqTxt: 'T$ 80', ok: (r) => { r.ouro -= 80; darItem(r, 'pocao'); darItem(r, 'pocao'); return 'Duas poções no cinto.'; } },
        { id: 'pechinchar', txt: 'Pechinchar uma poção maior', pericia: 'diplomacia', cd: 15, req: r => r.ouro >= 180, reqTxt: 'T$ 180', ok: (r) => { r.ouro -= 180; darItem(r, 'pocaoMaior'); return 'Uma poção maior por T$ 100. Pechincha!'; }, falha: () => 'Ele não baixa o preço e segue viagem.' },
        { id: 'seguir', txt: 'Deixar para lá', ok: () => 'A carroça some na curva.' },
      ]
    },
    emboscada: {
      nome: 'Silêncio suspeito', ic: '👁',
      texto: 'A mata ficou quieta demais. Pode ser uma emboscada.',
      escolhas: [
        { id: 'olhar', txt: 'Procurar sinais', pericia: 'percepcao', cd: 15, ok: (r, o) => { const t = rolar(o, 2, 6, 0) * 10; r.ouro += t; return `Vocês acham o esconderijo dos bandidos vazio: T$ ${t}.`; }, falha: (r, o) => { const v = rolar(o, 1, 6, 2); danoGrupo(r, v); return `Flechas! Os bandidos atiram e fogem (–${v} PV em cada herói).`; } },
        { id: 'correr', txt: 'Passar correndo', pericia: 'reflexos', cd: 12, ok: () => 'Vocês passam antes que alguém reaja.', falha: (r, o) => { const v = rolar(o, 1, 4, 1); danoGrupo(r, v); return `Uma rede e pedradas: –${v} PV em cada herói.`; } },
      ]
    },
    taverna: {
      nome: 'Taverna do Javali Torto', ic: '🍺', taverna: true,
      texto: 'Uma taverna de beira de estrada, fumaça e cheiro de ensopado.',
      escolhas: [
        { id: 'quarto', txt: 'Alugar quartos (recupera tudo)', req: r => r.ouro >= 60, reqTxt: 'T$ 60', ok: (r) => { r.ouro -= 60; for (const h of vivos(r)) { h.dano = 0; h.pmGasto = 0; } return 'Cama de palha nunca foi tão boa. Grupo recuperado.'; } },
        { id: 'comida', txt: 'Comprar provisões (4 rações por T$ 20)', req: r => r.ouro >= 20, reqTxt: 'T$ 20', ok: (r) => { r.ouro -= 20; r.bolsa.racao += 4; return '+4 rações na bolsa.'; } },
        { id: 'boatos', txt: 'Ouvir boatos', pericia: 'diplomacia', cd: 12, ok: (r, o) => { const t = rolar(o, 1, 6, 0) * 10; r.ouro += t; return `Um bêbado conta onde escondeu economias. Vocês acham T$ ${t}.`; }, falha: () => 'Só histórias de pescador.' },
      ]
    },
    santuario: {
      nome: 'Santuário de Lena', ic: '🕊', reviver: true,
      texto: 'Uma clériga guarda um santuário de cura. Ela pode trazer de volta quem caiu, por um preço.',
      escolhas: [
        { id: 'reviver', txt: 'Reviver um herói (T$ 300)', req: r => r.ouro >= 300 && r.herois.some(h => h.morto), reqTxt: 'T$ 300 e um herói morto', ok: (r) => { const h = r.herois.find(x => x.morto); h.morto = false; h.dano = Math.floor(pvMaxDe(h, r.nivel) / 2); h.pmGasto = 0; r.ouro -= 300; const H = D.HEROIS.find(x => x.id === h.hid); return `${H.nome} volta à vida, fraco mas de pé.`; } },
        { id: 'curar', txt: 'Pedir uma bênção de cura', pericia: 'religiao', cd: 12, ok: (r) => { for (const h of vivos(r)) h.dano = 0; return 'Os ferimentos do grupo se fecham.'; }, falha: (r) => { for (const h of vivos(r)) h.dano = Math.floor(h.dano * 0.75); return 'A bênção é fraca, mas ajuda um pouco.'; } },
        { id: 'seguir', txt: 'Agradecer e seguir', ok: () => 'Que Lena os acompanhe.' },
      ]
    },
  };
  function escolhasEvento(run, n) {
    const E = EVENTOS[n.evento];
    return E.escolhas.map(e => {
      const r = { id: e.id, txt: e.txt, pode: !e.req || e.req(run), reqTxt: e.reqTxt || '' };
      if (e.pericia) { const b = bonusPericia(run, e.pericia); r.pericia = PERICIAS[e.pericia].nome; r.cd = e.cd; r.quem = b.nome; r.chance = chance(b.b, e.cd); }
      return r;
    });
  }
  function resolverEvento(run, n, escolhaId) {
    const E = EVENTOS[n.evento]; const e = E.escolhas.find(x => x.id === escolhaId); if (!e) return { erro: 'Escolha inválida.' };
    if (e.req && !e.req(run)) return { erro: 'Requisito: ' + e.reqTxt };
    const o = run.sorte; let ok = true, rolagem = null;
    if (e.pericia) { const b = bonusPericia(run, e.pericia); const d20 = dado(o, 20); rolagem = { d20, bonus: b.b, total: d20 + b.b, cd: e.cd, quem: b.nome, pericia: PERICIAS[e.pericia].nome }; ok = d20 === 20 || (d20 !== 1 && d20 + b.b >= e.cd); }
    const texto = ok ? e.ok(run, o) : e.falha(run, o);
    n.resolvido = { escolha: escolhaId, ok, texto, rolagem };
    run.log.push(`${E.ic} ${E.nome}: ${texto}`);
    return n.resolvido;
  }

  /* ---------- andar pelo mapa ---------- */
  function avancar(run, id) {
    const n = run.mapa.nos[id]; if (!n || !proximos(run).some(x => x.id === id)) return 'Caminho inválido.';
    run.atual = id; run.caminho.push(id); n.visitado = true;
    if (n.tipo === 'evento' && EVENTOS[n.evento].taverna) n.tipo = 'taverna';
    if (['batalha', 'elite', 'chefe'].includes(n.tipo)) run.pendente = 'batalha';
    else if (n.tipo === 'evento' || n.tipo === 'taverna') run.pendente = 'evento';
    else if (n.tipo === 'loja') run.pendente = 'loja';
    else if (n.tipo === 'descanso') run.pendente = 'descanso';
    return null;
  }
  function sairDoNo(run) { run.pendente = null; }

  /* ---------- progresso permanente ---------- */
  const MARCOS = [
    { id: 'guilda', pts: 1500, nome: 'Guilda dos Aventureiros', desc: 'Abre a guilda: baú com os itens que você trouxe de volta e venda à guilda.' },
    { id: 'bolsaRica', pts: 8000, nome: 'Família rica', desc: 'Começa a run com T$ 100 a mais.' },
    { id: 'templo', pts: 16000, nome: 'Templo', desc: 'Uma vez por run, reviva um herói por T$ 200 na fogueira.' },
    { id: 'nivel2', pts: 30000, nome: 'Torre de treino', desc: 'O grupo começa a run no nível 2.' },
  ];
  function novoMeta() { return { v: 1, pontos: 0, porClasse: {}, runs: 0, vitorias: 0, bau: [], ouro: 0, melhor: 0, historico: [] }; }
  function liberado(meta, id) { const m = MARCOS.find(x => x.id === id); return !!m && meta.pontos >= m.pts; }
  // fim de run: soma pontuação (XP histórico), guarda itens e ouro se venceu
  function encerrarRun(run, meta, desistiu) {
    const venceu = run.fim === 'vitoria'; const antes = meta.pontos;
    const pts = run.stats.xp + (venceu ? 2000 : 0); // XP que cada herói ganhou na run + bônus por vencer o andar
    meta.pontos += pts; meta.runs++; if (venceu) meta.vitorias++;
    for (const h of run.herois) { const c = D.HEROIS.find(x => x.id === h.hid).classe; meta.porClasse[c] = (meta.porClasse[c] || 0) + run.stats.xp; }
    const fica = [];
    if (venceu) {
      for (const h of run.herois) { for (const s of ['arma', 'armadura', 'acessorio']) if (h.equip[s]) fica.push(h.equip[s]); }
      for (const it of run.mochila) if (ITENS[it].slot !== 'cinto') fica.push(it);
      meta.bau.push(...fica); meta.ouro += run.ouro;
    }
    const novos = MARCOS.filter(m => antes < m.pts && meta.pontos >= m.pts);
    const resumo = { venceu, desistiu: !!desistiu, pts, total: meta.pontos, fica, ouro: venceu ? run.ouro : 0, novos, nivel: run.nivel, stats: { ...run.stats } };
    meta.melhor = Math.max(meta.melhor, pts);
    meta.historico.unshift({ data: Date.now(), venceu, pts, nivel: run.nivel, herois: run.herois.map(h => h.hid) }); meta.historico = meta.historico.slice(0, 20);
    return resumo;
  }
  function vendaGuilda(meta, idx) { const id = meta.bau[idx]; if (!id) return 'Nada aí.'; const v = Math.floor(ITENS[id].preco / 2); meta.bau.splice(idx, 1); meta.ouro += v; return null; }

  const API = {
    ITENS, EVENTOS, TEMAS, CHEFES, MARCOS, XP_NIVEL, PERICIAS, MAX_CINTO, LOJA_FIXOS,
    novaRun, gerarMapa, proximos, noAtual, avancar, sairDoNo, vivos, inimigosDoNo, ndEncontro, ndTxt, nivelDoXP,
    prepararBatalha, ajustarBatalha, concluirBatalha, unidadeHeroi, pvMaxDe, pmMaxDe,
    darItem, equipar, desequipar, estoqueLoja, comprar, vender, precoVenda,
    opcoesDescanso, descansar, racoesNecessarias, escolhasEvento, resolverEvento, bonusPericia,
    novoMeta, liberado, encerrarRun, vendaGuilda,
  };
  if (node) module.exports = API; else root.T20RUN = API;
})(this);
