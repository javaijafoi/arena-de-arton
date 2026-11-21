/* Arena de Arton — modo roguelike (sem DOM). Guarda o estado da run (mapa do andar,
   grupo, ouro, itens, XP) e o progresso permanente (pontuação, guilda, baú).
   Tudo é JSON puro e o dado é semeado, igual ao motor de combate. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./data.js') : root.T20DATA;
  const BEST = node ? require('./bestiario.js') : root.T20BESTIARIO; // soma as criaturas dos andares 2 a 5 em D.CRIATURAS
  const R = node ? require('./rules.js') : root.T20;
  const PODER = node ? require('./poderes.js') : root.T20PODERES;

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
  // ajuste do roguelike: o andar tem ~8 batalhas, então o XP do livro é acelerado (o grupo chega ao chefe perto do teto do andar)
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
    pocao: { nome: 'Poção de Curar Ferimentos', slot: 'cinto', preco: 75, ic: '🧪', desc: 'Cura 2d8+2 PV. Ação padrão; pode dar a um aliado adjacente, até desmaiado.', uso: { cura: [2, 8, 2] } },
    pocaoMaior: { nome: 'Poção de Curar Ferimentos (maior)', slot: 'cinto', preco: 300, ic: '🧪', desc: 'Cura 4d8+4 PV. Ação padrão; pode dar a um aliado adjacente.', uso: { cura: [4, 8, 4] } },
    oleo: { nome: 'Óleo de Arma Mágica', slot: 'cinto', preco: 60, ic: '🫙', desc: '+1 em ataque e dano até o fim da batalha. Ação de movimento.', uso: { arma: 1 } },
    protecao: { nome: 'Poção de Proteção Divina', slot: 'cinto', preco: 60, ic: '✨', desc: '+2 em testes de resistência até o fim da batalha. Ação de movimento.', uso: { protecao: 2 } },
    granada: { nome: 'Granada de Bola de Fogo', slot: 'cinto', preco: 300, ic: '💣', desc: '6d6 de fogo no alvo e em quem estiver ao lado dele (Reflexos CD 15 reduz à metade). Alcance médio.', uso: { area: [6, 6], cd: 15, tipo: 'fogo' } },
    velocidade: { nome: 'Poção de Velocidade', slot: 'cinto', preco: 300, ic: '⚡', desc: 'Uma ação padrão extra por turno até o fim da batalha. Ação de movimento.', uso: { velocidade: true } },
    // bolsa (entre batalhas)
    racao: { nome: 'Ração de viagem', slot: 'bolsa', preco: 3, ic: '🍖', desc: 'Frango assado, pão e queijo: um dia de estrada para um herói. Descansar gasta uma por herói vivo.' },
    barraca: { nome: 'Barraca', slot: 'bolsa', preco: 60, ic: '⛺', desc: 'Permite descanso longo numa fogueira (recupera tudo).' },
    corda: { nome: 'Corda', slot: 'bolsa', preco: 10, ic: '🪢', desc: 'Ajuda em alguns eventos (escalar, descer, amarrar).' },
    // armas superiores (melhoria no item que o herói já usa)
    certeira: { nome: 'Arma superior (certeira)', slot: 'arma', preco: 700, ic: '🗡', desc: '+1 nos testes de ataque.', ef: { ataque: 1 } },
    cruel: { nome: 'Arma superior (cruel)', slot: 'arma', preco: 700, ic: '🗡', desc: '+1 nas rolagens de dano.', ef: { dano: 1 } },
    certeiraCruel: { nome: 'Arma superior (certeira e cruel)', slot: 'arma', preco: 3000, ic: '🗡', desc: '+1 no ataque e +1 no dano.', ef: { ataque: 1, dano: 1 } },
    // armas mágicas (só elite, chefe e evento)
    flamejante: { nome: 'Arma flamejante', slot: 'arma', preco: 18000, ic: '🔥', magico: true, desc: '+1d6 de dano de fogo em cada acerto.', ef: { extra: [1, 6, 'fogo'] } },
    congelante: { nome: 'Arma congelante', slot: 'arma', preco: 18000, ic: '❄', magico: true, desc: '+1d6 de dano de frio em cada acerto.', ef: { extra: [1, 6, 'frio'] } },
    eletrica: { nome: 'Arma elétrica', slot: 'arma', preco: 18000, ic: '⚡', magico: true, desc: '+1d6 de dano de eletricidade em cada acerto.', ef: { extra: [1, 6, 'eletricidade'] } },
    ameacadora: { nome: 'Arma ameaçadora', slot: 'arma', preco: 18000, ic: '🎯', magico: true, desc: 'A margem de ameaça da arma dobra (19-20 vira 17-20).', ef: { ameacadora: true } },
    // armaduras
    reforcada: { nome: 'Armadura superior (reforçada)', slot: 'armadura', preco: 700, ic: '🛡', desc: '+1 na Defesa.', ef: { def: 1 } },
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
  // a partir do andar 2 a loja passa a ter itens mágicos (índice = andar em que entram)
  const LOJA_POR_ANDAR = [[], [], ['certeiraCruel', 'sustento', 'luvas', 'manoplas', 'manto', 'torque'], ['anelProtecao', 'flamejante', 'congelante', 'eletrica', 'ameacadora', 'defensora', 'protetora'], ['vitalidade', 'robustez', 'cintoGigante', 'pulseiras'], []];
  const DROP_ELITE = ['sustento', 'luvas', 'manoplas', 'manto', 'torque', 'anelProtecao', 'certeiraCruel', 'flamejante', 'congelante', 'eletrica'];
  const DROP_CHEFE = ['vitalidade', 'robustez', 'cintoGigante', 'pulseiras', 'defensora', 'protetora', 'ameacadora', 'flamejante'];
  const DROP_COMUM = ['pocao', 'pocao', 'oleo', 'protecao', 'racao', 'pocaoMaior'];

  /* ---------- inimigos: temas de cada andar (o andar 1 usa as criaturas do Livro Base; 2 a 5, as de js/bestiario.js) ---------- */
  const TEMAS = [
    // andar 1 · Estrada de Deheon (níveis 1 a 4)
    { id: 'bandidos', nome: 'bandidos', mapas: ['estrada', 'clareira'], pool: ['capanga', 'saqueador', 'saqueadora', 'barbaroErmos', 'minotauro'] },
    { id: 'kobolds', nome: 'kobolds', mapas: ['estrada', 'clareira'], pool: ['kobold', 'koboldFunda', 'capanga'] },
    { id: 'feras', nome: 'feras', mapas: ['clareira', 'rio'], pool: ['lobo', 'urso', 'homemPiranha'] },
    { id: 'ruinas', nome: 'mortos das ruínas', mapas: ['cripta'], pool: ['zumbi', 'cultista', 'zumbiTurba'] },
    { id: 'puristas', nome: 'puristas', mapas: ['estrada', 'rio'], pool: ['soldadoPurista', 'capanga', 'sargentoPurista', 'arcanoGuerra'] },
    // andar 2 · Florestas de Tollon (níveis 4 a 8)
    { id: 'goblinoides', andar: 2, nome: 'goblinoides', mapas: ['estrada', 'clareira'], pool: ['hobgoblinAtirador', 'bugbear', 'gnollLider', 'gnollXama'] },
    { id: 'ferasTollon', andar: 2, nome: 'feras da mata', mapas: ['clareira', 'rio'], pool: ['tigre', 'warg', 'manticora', 'rinoceronte'] },
    { id: 'ogros', andar: 2, nome: 'ogros', mapas: ['clareira', 'estrada'], pool: ['ogroCacador', 'orcXama', 'rinoceronte', 'gnollLider'] },
    // andar 3 · Montanhas Uivantes (níveis 8 a 12)
    { id: 'gelo', andar: 3, nome: 'feras do gelo', mapas: ['clareira', 'rio'], pool: ['mamute', 'ursoCavernas', 'morteGlacial', 'warg'] },
    { id: 'construtos', andar: 3, nome: 'construtos anões', mapas: ['cripta', 'estrada'], pool: ['golemBronze', 'golemFerro', 'dracomante'] },
    { id: 'gigantes', andar: 3, nome: 'gigantes', mapas: ['clareira', 'estrada'], pool: ['keylor', 'tuntram', 'ogroCacador', 'gnollXama'] },
    { id: 'serpes', andar: 3, nome: 'serpes', mapas: ['rio', 'clareira'], pool: ['dragaoJovem', 'dracomante', 'quimera', 'manticora'] },
    // andar 4 · Aslothia (níveis 12 a 16)
    { id: 'esqueletos', andar: 4, nome: 'ossadas antigas', mapas: ['cripta', 'clareira'], pool: ['reiTiranoEsqueleto', 'necrodracoEsqueleto', 'mortalha', 'golemFerro'] },
    { id: 'fantasmas', andar: 4, nome: 'fantasmas', mapas: ['cripta', 'rio'], pool: ['fantasmaAncestral', 'mortalha', 'sacerdoteAgonia'] },
    { id: 'colossos', andar: 4, nome: 'mortos colossais', mapas: ['clareira', 'estrada'], pool: ['lyuba', 'reiTiranoEsqueleto', 'sacerdoteAgonia', 'mortalha'] },
    // andar 5 · Área de Tormenta (níveis 16 a 20)
    { id: 'lefeu', andar: 5, nome: 'lefeu', mapas: ['estrada', 'cripta'], pool: ['akaOni', 'aspectoAharadak', 'reishidLider', 'arquibruxo'] },
    { id: 'corrompidos', andar: 5, nome: 'corrompidos', mapas: ['rio', 'cripta'], pool: ['elementalCorrompido', 'rubro', 'reishidLider', 'aspectoAharadak'] },
    { id: 'dragoesTormenta', andar: 5, nome: 'dragões da tempestade', mapas: ['clareira', 'rio'], pool: ['dragaoVeneravel', 'arquibruxo', 'aspectoAharadak', 'rubro'] },
  ];
  const NOMES_ENC = {
    bandidos: ['Emboscada na estrada', 'Pedágio dos saqueadores', 'Acampamento bandido', 'Assalto na ponte'],
    kobolds: ['Toca kobold', 'Armadilha dos kobolds', 'Kobolds na trilha'],
    feras: ['Uivos na mata', 'Território das feras', 'Caçada no vau'],
    ruinas: ['Ruínas assombradas', 'A capela caída', 'Cemitério da estrada'],
    puristas: ['Patrulha purista', 'Posto de controle', 'Caçadores de hereges'],
    goblinoides: ['Acampamento hobgoblin', 'Batedores da Aliança Negra', 'Matilha gnoll', 'Tambores na mata'],
    ferasTollon: ['Covil na mata fechada', 'Trilha dos predadores', 'Olhos entre as árvores'],
    ogros: ['Caverna do ogro', 'Ponte dos ogros', 'Fogueira dos brutos'],
    gelo: ['Nevasca', 'Manada no desfiladeiro', 'Gelo que caça'],
    construtos: ['Forja abandonada', 'Guardiões do salão anão', 'Portão de bronze'],
    gigantes: ['Passo dos gigantes', 'Rochas que rolam', 'Acampamento nas alturas'],
    serpes: ['Ninho nos penhascos', 'Asas sobre o vale', 'Caverna das serpes'],
    esqueletos: ['Campo de ossos', 'Ossário real', 'A marcha dos esqueletos'],
    fantasmas: ['Névoa que sussurra', 'O castelo vazio', 'Velório sem fim'],
    colossos: ['Gigantes que não morrem', 'Cemitério dos titãs', 'Terra que treme'],
    lefeu: ['Chuva rubra', 'Carne que se mexe', 'O céu sangra'],
    corrompidos: ['Pântano corrompido', 'Pedras que gritam', 'Matéria vermelha'],
    dragoesTormenta: ['Asas na tempestade', 'Raios rubros', 'O ninho do fim'],
  };
  const CHEFES = [
    { id: 'minotauro', nome: 'O Rei da Estrada', chefe: 'minotauro', escolta: ['capanga', 'saqueadora', 'saqueador'], mapa: 'clareira', texto: 'O minotauro que comanda os bandidos da região quer o seu ouro.' },
    { id: 'necromante', nome: 'A Capela Profanada', chefe: 'cultista', escolta: ['zumbi', 'zumbi', 'zumbiTurba'], mapa: 'cripta', texto: 'Um cultista ergue os mortos das ruínas para servi-lo.' },
    { id: 'barbaro', nome: 'O Senhor dos Ermos', chefe: 'barbaroErmos', escolta: ['lobo', 'lobo', 'saqueadora'], mapa: 'clareira', texto: 'Um bárbaro e sua matilha fizeram das ruínas o seu covil.' },
    { id: 'quimera', andar: 2, nome: 'A Fera de Três Cabeças', chefe: 'quimera', escolta: ['manticora', 'tigre', 'tigre'], mapa: 'clareira', texto: 'Uma quimera caça tudo o que entra na floresta.' },
    { id: 'orcRei', andar: 2, nome: 'O Rei dos Orcs', chefe: 'orcRei', escolta: ['orcXama', 'gnollLider', 'gnollLider'], mapa: 'estrada', texto: 'Um rei orc juntou as tribos da mata para marchar sobre Deheon.' },
    { id: 'cacador', andar: 2, nome: 'O Caçador de Tollon', chefe: 'ogroCacador', escolta: ['warg', 'warg', 'hobgoblinAtirador'], mapa: 'clareira', texto: 'Um ogro caçador e seus wargs vigiam a saída da floresta.' },
    { id: 'dragao', andar: 3, nome: 'O Dragão das Uivantes', chefe: 'dragaoAdulto', escolta: ['dracomante', 'dragaoJovem', 'dracomante'], mapa: 'rio', texto: 'Um dragão adulto e seus servos dracomantes guardam o passo.' },
    { id: 'golemPedra', andar: 3, nome: 'O Salão dos Golens', chefe: 'golemPedra', escolta: ['dracomante', 'golemBronze', 'golemFerro'], mapa: 'cripta', texto: 'O guardião de pedra de uma fortaleza anã acorda.' },
    { id: 'bruxa', andar: 3, nome: 'A Bruxa da Montanha', chefe: 'bruxaGoblin', escolta: ['keylor', 'morteGlacial', 'morteGlacial'], mapa: 'clareira', texto: 'Uma bruxa goblin manda nos gigantes das alturas.' },
    { id: 'lich', andar: 4, nome: 'O Lich da Torre', chefe: 'lich', escolta: ['mortalha', 'sacerdoteAgonia', 'fantasmaAncestral'], mapa: 'cripta', texto: 'Um lich estuda a morte do alto de sua torre.' },
    { id: 'mumias', andar: 4, nome: 'O Senhor das Múmias', chefe: 'senhorMumias', escolta: ['reiTiranoEsqueleto', 'sacerdoteAgonia', 'mortalha'], mapa: 'cripta', texto: 'O senhor das múmias quer o grupo no seu exército.' },
    { id: 'necrodraco', andar: 4, nome: 'As Asas Podres', chefe: 'necrodracoZumbi', escolta: ['necrodracoEsqueleto', 'mortalha'], mapa: 'clareira', texto: 'Um necrodraco zumbi cobre o céu de Aslothia.' },
    { id: 'necrodracoLich', andar: 5, nome: 'O Necrodraco Lich', chefe: 'necrodracoLich', escolta: ['arquibruxo', 'reishidLider'], mapa: 'cripta', texto: 'O mais antigo dos mortos fez da tempestade rubra o seu trono. É a última luta.' },
    { id: 'rubro', andar: 5, nome: 'Rubro, Forma Final', chefe: 'rubro', escolta: ['arquibruxo', 'akaOni', 'akaOni'], mapa: 'rio', texto: 'O coração da Área de Tormenta tomou forma. É a última luta.' },
    { id: 'veneravel', andar: 5, nome: 'O Dragão Venerável', chefe: 'dragaoVeneravel', escolta: ['aspectoAharadak', 'arquibruxo', 'reishidLider'], mapa: 'clareira', texto: 'Um dragão antigo, tocado pela Tormenta, guarda o fim do caminho. É a última luta.' },
  ];
  // os 5 andares: cada um sobe cerca de 4 níveis e termina num chefe (o do andar 5 é o chefe final, no nível 20)
  const ANDARES = [null,
    { nome: 'Estrada de Deheon', inicio: 'Ruínas de Tyrondir', teto: 4, loja: 'Mercadora de estrada' },
    { nome: 'Florestas de Tollon', inicio: 'Orla da floresta', teto: 8, loja: 'Mascate élfico' },
    { nome: 'Montanhas Uivantes', inicio: 'Pé da montanha', teto: 12, loja: 'Entreposto anão' },
    { nome: 'Aslothia', inicio: 'Fronteira dos mortos', teto: 16, loja: 'Contrabandista' },
    { nome: 'Área de Tormenta', inicio: 'Borda da tempestade', teto: 20, loja: 'Último mercador' },
  ];
  const ULTIMO_ANDAR = ANDARES.length - 1;
  const andarDe = x => x.andar || 1;
  const tetoDe = run => ANDARES[run.andar || 1].teto;

  // dos andares 2 em diante, a conta do livro (dois do mesmo ND = ND+2) erra com os heróis do jogo: um monstro sozinho
  // é fácil e três já são muito. O peso corrige isso só na hora de montar o grupo (o ND mostrado continua o do livro).
  const PESO_QTD = [0, -2, 0, 3, 5, 6.5];
  const ndPesado = (ids, nd) => nd + PESO_QTD[Math.min(5, ids.length)];
  function gerarGrupo(o, alvo, tema, min, max) {
    let melhor = null; const pesa = (tema.andar || 1) >= 2; const bons = [];
    for (let k = 0; k < 160; k++) {
      const n = min + Math.floor(rnd(o) * (max - min + 1)); const ids = [];
      for (let i = 0; i < n; i++) ids.push(escolher(o, tema.pool));
      // dos andares 2 em diante: no máximo um conjurador por grupo (dois lançando bola de fogo toda rodada é demais)
      if (pesa && ids.filter(id => (D.CRIATURAS[id].magias || []).length).length > 1) continue;
      const nd = ndEncontro(ids); const ef = pesa ? ndPesado(ids, nd) : nd; const err = Math.abs(ef - alvo) + (ef > alvo ? 0.15 : 0);
      if (!melhor || err < melhor.err) melhor = { ids, nd, err };
      if (pesa) { if (err < 0.6) bons.push({ ids, nd, err }); if (bons.length >= 6) break; }
      else if (err < 0.1) break;
    }
    // andares 2+: sorteia entre os grupos que servem (dá variedade); andar 1 fica como era
    const g = pesa && bons.length ? bons[Math.floor(rnd(o) * bons.length)] : melhor;
    g.ids.sort((a, b) => D.CRIATURAS[b].nd - D.CRIATURAS[a].nd);
    return g;
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
    // arestas sem cruzamento: as duas colunas são percorridas de cima para baixo ao mesmo tempo
    // (cada nó liga a um bloco contínuo de vizinhos na coluna seguinte, então nenhuma linha cruza outra)
    for (let c = 0; c < COLS; c++) {
      const A = col[c].map(i => nos[i]).sort((x, y) => x.l - y.l), B = col[c + 1].map(j => nos[j]).sort((x, y) => x.l - y.l);
      const liga = (a, b) => { if (!a.liga.includes(b.id)) a.liga.push(b.id); };
      if (A.length === 1 || B.length === 1) { for (const a of A) for (const b of B) liga(a, b); continue; }
      let i = 0, k = 0; liga(A[0], B[0]);
      while (i < A.length - 1 || k < B.length - 1) {
        const na = i < A.length - 1 ? A[i + 1].l : Infinity, nb = k < B.length - 1 ? B[k + 1].l : Infinity;
        if (na < nb) i++;
        else if (nb < na) k++;
        else { if (rnd(o) < 0.35) liga(A[i], B[k + 1]); else if (rnd(o) < 0.35) liga(A[i + 1], B[k]); i++; k++; }
        liga(A[i], B[k]);
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
      herois: cfg.herois.slice(0, 4).map(hid => ({ hid, dano: 0, pmGasto: 0, morto: false, equip: { arma: null, armadura: null, acessorio: null }, cinto: ['pocao', null, null], pvTreino: (cfg.treino && cfg.treino[(D.HEROIS.find(x => x.id === hid) || {}).classe]) * PV_TREINO || 0, ...(cfg.semPoderes ? {} : { poderes: [], pend: 0 }) })),
      merc: null, mercLiberado: cfg.mercLiberado !== undefined ? !!cfg.mercLiberado : true,
      bolsa: { racao: 4, barraca: 0, corda: 0 }, mochila: [],
      mapa: null, atual: 0, caminho: [0], log: [], fim: null, pendente: null,
      stats: { batalhas: 0, elites: 0, abates: 0, xp: 0, ouroGanho: 0, mortes: 0, rodadas: 0 },
      nivelInicial: cfg.nivel || 1,
    };
    if (run.nivelInicial > 1) { run.xp = XP_NIVEL[run.nivelInicial]; run.nivel = run.nivelInicial; }
    // começar num andar mais fundo (simulador e testes): o grupo chega no nível do teto do andar anterior
    if (cfg.andar > 1) { run.andar = Math.min(ULTIMO_ANDAR, cfg.andar); run.nivel = ANDARES[run.andar - 1].teto; run.xp = XP_NIVEL[run.nivel]; run.nivelInicial = run.nivel; }
    for (const h of run.herois) if (h.poderes) h.pend = run.nivel - 1; // começando acima do 1º nível: os poderes atrasados ficam para escolher
    for (const it of cfg.itens || []) darItem(run, it);
    run.mapa = gerarMapa(run.sorte);
    for (const n of run.mapa.nos) prepararNo(run, n);
    return run;
  }
  const vivos = run => run.herois.filter(h => !h.morto);
  const noAtual = run => run.mapa.nos[run.atual];
  function proximos(run) { if (run.fim || run.pendente || run.proxAndar) return []; return noAtual(run).liga.map(i => run.mapa.nos[i]); }

  // conteúdo fixo de cada nó (sorteado ao criar o mapa, para o jogador poder planejar)
  function prepararNo(run, n) {
    const o = run.sorte;
    if (n.tipo === 'batalha' || n.tipo === 'elite') {
      const doAndar = TEMAS.filter(t => andarDe(t) === (run.andar || 1));
      const tema = run.andar === 1 && n.c <= 2 ? escolher(o, doAndar.filter(t => t.id !== 'puristas' && t.id !== 'ruinas')) : escolher(o, doAndar);
      n.tema = tema.id; n.mapaId = escolher(o, tema.mapas); n.nome = escolher(o, NOMES_ENC[tema.id]);
      if (n.tipo === 'elite') n.nome = 'Elite: ' + n.nome;
    }
    if (n.tipo === 'chefe') { const C = escolher(o, CHEFES.filter(c => andarDe(c) === (run.andar || 1))); n.chefeId = C.id; n.nome = C.nome; n.texto = C.texto; n.mapaId = C.mapa; }
    if (n.tipo === 'evento') n.evento = escolher(o, Object.keys(EVENTOS));
    if (n.tipo === 'loja') n.nome = ANDARES[run.andar || 1].loja;
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
    const o = { seed: run.seed ^ (n.id * 2654435761) ^ (run.nivel * 97) ^ ((run.andar || 1) * 7777) };
    let g;
    if (n.tipo === 'chefe') {
      const C = CHEFES.find(c => c.id === n.chefeId);
      // Chefe Final: PV dobrados contam como +2 de ND; a escolta cresce com o nível do grupo
      const alvo = run.nivel + ((C.andar || 1) >= 2 ? 4 : 1.5); let escolta = [];
      const ef = e => { const nd = ndEncontro([C.chefe, C.chefe, ...e]); return (C.andar || 1) >= 2 ? ndPesado([C.chefe, ...e], nd) : nd; };
      for (let k = 0; k <= C.escolta.length; k++) { const e = C.escolta.slice(0, k); if (k === 0 || ef(e) <= alvo + 0.25) escolta = e; }
      g = { ids: [C.chefe, ...escolta], chefe: C.chefe };
      g.nd = ndEncontro([C.chefe, C.chefe, ...escolta]);
    } else {
      const tema = TEMAS.find(t => t.id === n.tema); const alvo = alvoND(run, n);
      const andar2 = (tema.andar || 1) >= 2;
      g = gerarGrupo(o, alvo, tema, andar2 ? 1 : 2, andar2 ? 4 : n.tipo === 'elite' ? 4 : 5);
    }
    n.grupo = g; n.grupoNivel = run.nivel; return g;
  }

  /* ---------- herói na batalha: aplica dano, PM, itens ---------- */
  function efeitosDe(h) { const e = ['arma', 'armadura', 'acessorio'].map(s => h.equip[s] && ITENS[h.equip[s]]).filter(Boolean).map(I => I.ef || {}); if (h.pvTreino) e.push({ pvTreino: h.pvTreino }); return e; }
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
      if (ef.pvTreino) { u.pvMax += ef.pvTreino; u.pv += ef.pvTreino; }
      if (ef.for) { u.attr.for += ef.for; u.per.luta += ef.for; }
      if (ef.des) { u.attr.des += ef.des; u.per.pont += ef.des; u.per.ref += ef.des; u.per.inic += ef.des; if (!c.armaduraPesada) u.defBase += ef.des; }
      if (ef.con) { u.attr.con += ef.con; u.per.fort += ef.con; u.pvMax += ef.con * nivel; u.pv += ef.con * nivel; }
    }
  }
  function unidadeHeroi(h, nivel, idx) { const u = R.criarHeroi(h.hid, nivel, idx, h.poderes); aplicarItens(u, h, nivel); return u; }
  function pvMaxDe(h, nivel) { return h.merc ? fichaMerc(h.tipo, nivel).pv : unidadeHeroi(h, nivel, 0).pvMax; }
  function pmMaxDe(h, nivel) { return h.merc ? fichaMerc(h.tipo, nivel).pm || 0 : unidadeHeroi(h, nivel, 0).pmMax; }

  function prepararBatalha(run, n) {
    n = n || noAtual(run);
    const g = inimigosDoNo(run, n); const grupo = vivos(run);
    if (run.merc) atualizarMerc(run);
    const cfg = { herois: grupo.map(h => h.hid), poderes: grupo.map(h => h.poderes || null), mercCriatura: run.merc ? criaturaMerc(run.merc.tipo, run.nivel) : null, nivel: run.nivel, inimigos: g.ids, mapa: n.mapaId, seed: (run.seed ^ (n.id * 7919) ^ (run.stats.batalhas * 104729) ^ ((run.andar || 1) * 31337)) >>> 0, run: true };
    return { cfg, grupo: run.merc ? grupo.concat([run.merc]) : grupo, chefe: g.chefe || null, nd: g.nd };
  }
  // chamado logo depois de R.novaBatalha: ajusta heróis e o chefe
  function ajustarBatalha(run, st, prep) {
    const hs = st.unidades.filter(u => u.lado === 'h');
    hs.forEach((u, i) => {
      const h = prep.grupo[i]; u.runIdx = h.merc ? -1 : run.herois.indexOf(h);
      if (!h.merc) aplicarItens(u, h, run.nivel);
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
      if (u.runIdx < 0) { // mercenário: se cai, vai embora (dá para contratar outro)
        if (!u.vivo || !venceu) { res.mortos.push(u.nome); run.log.push(`☠ ${u.nome} cai em combate.`); run.merc = null; continue; }
        run.merc.dano = u.pvMax - Math.max(1, u.pv); run.merc.pmGasto = Math.max(0, u.pmMax - u.pm); continue;
      }
      const h = run.herois[u.runIdx];
      h.cinto = u.cinto.slice();
      if (!u.vivo) { h.morto = true; h.dano = 0; h.pmGasto = 0; res.mortos.push(u.nome); run.stats.mortes++; continue; }
      if (!venceu) { h.morto = true; res.mortos.push(u.nome); run.stats.mortes++; continue; } // grupo caído: inimigos acabam com os desmaiados
      const pv = Math.max(1, u.pv); // desmaiado levanta com 1 PV se o grupo vencer
      h.dano = u.pvMax - pv; h.pmGasto = Math.max(0, u.pmMax - u.pm);
    }
    if (!venceu) { run.fim = 'derrota'; run.log.push(`💀 O grupo caiu em ${n.nome}.`); return res; }
    // XP: ND × 1.000 dividido pelo tamanho do grupo (heróis que começaram a run)
    const ndXp = n.tipo === 'chefe' ? prep.nd + 0 : prep.nd;
    res.xp = Math.round(ndXp * 1000 * XP_MULT / run.herois.length);
    // o nível para no teto do andar (4, 8, 12, 16, 20); o XP que passa do teto não conta (o que fazer depois do 20 fica para depois)
    const antes = run.nivel; const teto = tetoDe(run); run.stats.xp += res.xp;
    run.xp = run.andar < ULTIMO_ANDAR ? Math.min(run.xp + res.xp, XP_NIVEL[teto]) : run.xp + res.xp;
    // vencer o chefe garante o teto: o grupo começa o próximo andar no nível certo
    if (n.tipo === 'chefe' && run.xp < XP_NIVEL[teto]) run.xp = XP_NIVEL[teto];
    run.nivel = Math.min(teto, nivelDoXP(run.xp));
    if (run.nivel > antes) { res.subiu = { de: antes, para: run.nivel }; for (const h of run.herois) if (h.poderes) h.pend = (h.pend || 0) + run.nivel - antes; }
    // tesouro: proporcional ao ND (aprox. da tabela de tesouro do livro, mais baixa no andar 1)
    const o = run.sorte;
    // acima do ND 4 o tesouro cresce mais rápido (como a tabela do livro), para os itens mágicos da loja caberem no bolso
    const escala = 1 + Math.pow(Math.max(0, prep.nd - 4), 2) / 30;
    res.ouro = Math.round((20 + 35 * Math.max(0.5, prep.nd)) * escala * (0.7 + rnd(o) * 0.6) * (n.tipo === 'elite' ? 1.6 : n.tipo === 'chefe' ? 2.5 : 1));
    run.ouro += res.ouro; run.stats.ouroGanho += res.ouro;
    if (n.tipo === 'elite') { res.itens.push(escolher(o, DROP_ELITE)); run.stats.elites++; }
    else if (n.tipo === 'chefe') res.itens.push(escolher(o, DROP_CHEFE));
    else if (rnd(o) < 0.4) res.itens.push(escolher(o, DROP_COMUM));
    for (const it of res.itens) darItem(run, it);
    if (n.tipo === 'chefe') {
      run.andaresVencidos = (run.andaresVencidos || 0) + 1;
      if (run.andar >= ULTIMO_ANDAR) { run.fim = 'vitoria'; run.log.push('🏆 O chefe final caiu! Arton está salva.'); }
      else { run.proxAndar = true; res.andarLimpo = run.andar; run.log.push(`🏆 O chefe do andar ${run.andar} caiu!`); }
    }
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
    const o = { seed: run.seed ^ (n.id * 40503) ^ ((run.andar || 1) * 8191) };
    const a = run.andar || 1;
    const pool = LOJA_SORTEIO.concat(...LOJA_POR_ANDAR.slice(2, a + 1)); const fixos = a >= 3 ? ['pocaoMaior', 'racao', 'barraca'] : LOJA_FIXOS;
    const sorteio = embaralhar(o, pool.filter(id => !fixos.includes(id))).slice(0, a >= 2 ? 6 : 5);
    n.estoque = [...fixos.map(id => ({ id, fixo: true })), ...sorteio.map(id => ({ id, fixo: false, vendido: false }))];
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
    if (n && n.tipo === 'taverna') out.push({ id: 'quarto', nome: 'Quarto na taverna', desc: 'Cama, comida quente: recupera tudo.', custo: 'T$ 90', pode: run.ouro >= 90 });
    return out;
  }
  function descansar(run, tipo, n) {
    const op = opcoesDescanso(run, n).find(o => o.id === tipo); if (!op || !op.pode) return 'Não dá para descansar assim.';
    if (tipo === 'quarto') run.ouro -= 90; else run.bolsa.racao -= racoesNecessarias(run);
    for (const h of vivos(run).concat(run.merc ? [run.merc] : [])) {
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
        { id: 'quarto', txt: 'Alugar quartos (recupera tudo)', req: r => r.ouro >= 90, reqTxt: 'T$ 90', ok: (r) => { r.ouro -= 90; for (const h of vivos(r)) { h.dano = 0; h.pmGasto = 0; } return 'Cama de palha nunca foi tão boa. Grupo recuperado.'; } },
        { id: 'comida', txt: 'Comprar provisões (4 rações por T$ 10)', req: r => r.ouro >= 10, reqTxt: 'T$ 10', ok: (r) => { r.ouro -= 10; r.bolsa.racao += 4; return '+4 rações na bolsa.'; } },
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
  // depois do chefe: o grupo descansa (PV e PM cheios, mortos continuam mortos) e entra no próximo andar, com mapa novo
  // entre um andar e outro o grupo passa por uma cidade: o templo de lá revive os caídos (pago com o ouro da run)
  const custoReviverAndar = run => 100 * run.nivel;
  function reviverNaCidade(run, hi) {
    const h = run.herois[hi]; if (!run.proxAndar || !h || !h.morto) return 'Nada a fazer.';
    const c = custoReviverAndar(run); if (run.ouro < c) return 'Ouro insuficiente.';
    run.ouro -= c; h.morto = false; h.dano = 0; h.pmGasto = 0; run.log.push(`⛪ ${(D.HEROIS.find(x => x.id === h.hid) || {}).nome} volta à vida no templo (T$ ${c}).`);
    return null;
  }
  function proximoAndar(run) {
    if (!run.proxAndar || run.andar >= ULTIMO_ANDAR) return 'Ainda não.';
    run.andar++; run.proxAndar = false; run.pendente = null;
    for (const h of vivos(run).concat(run.merc ? [run.merc] : [])) { h.dano = 0; h.pmGasto = 0; }
    run.mapa = gerarMapa(run.sorte); run.atual = 0; run.caminho = [0];
    for (const n of run.mapa.nos) prepararNo(run, n);
    run.log.push(`🗺 Andar ${run.andar}: ${ANDARES[run.andar].nome}.`);
    return null;
  }

  /* ---------- poderes ao subir de nível (um por nível a partir do 2º) ---------- */
  function poderesDisponiveis(run, hi) { const h = run.herois[hi]; return h && h.poderes ? PODER.disponiveis(h.hid, run.nivel, h.poderes) : []; }
  function escolherPoder(run, hi, id) {
    const h = run.herois[hi]; if (!h || !h.poderes) return 'Sem poderes neste modo.';
    if (!(h.pend > 0)) return 'Nenhum poder para escolher agora.';
    if (!PODER.pode(h.hid, run.nivel, h.poderes, id)) return 'Este poder não está disponível.';
    const pvA = pvMaxDe(h, run.nivel); h.poderes.push(id); h.pend--;
    const pvB = pvMaxDe(h, run.nivel); if (pvB < pvA) h.dano = Math.max(0, h.dano - (pvA - pvB)); // (nenhum poder tira PV hoje)
    return null;
  }
  // escolhe sozinho todos os poderes pendentes (simulador; e o botão "a IA escolhe")
  function autoPoderes(run, hi) { const h = run.herois[hi]; while (h && h.poderes && h.pend > 0) { const p = PODER.escolhaIA(h.hid, run.nivel, h.poderes); if (!p) { h.pend = 0; break; } escolherPoder(run, hi, p); } }
  const poderesPendentes = run => run.herois.reduce((a, h) => a + (h.poderes && !h.morto ? h.pend || 0 : 0), 0);

  /* ---------- mercenário: um NPC (ficha simples, como as do Guia de NPCs), jogado pela IA ----------
     Não é herói com classe: não tem poderes nem habilidades, só ataque. Tem ND igual à metade do
     nível do grupo (no 1º nível é ND 1/2, como o brucutu do Guia de NPCs),
     não divide XP nem come ração. Se cair, vai embora. */
  const NPC_MERC = {
    brucutu: { nome: 'Brucutu', papel: 'bruto', arma: 'Clava', dano: 'impacto', token: 'capanga', desc: 'Força bruta corpo a corpo.' },
    guarda: { nome: 'Guarda', papel: 'tanque', arma: 'Lança', dano: 'perfuração', token: 'soldado-purista', desc: 'Lento e duro de derrubar; segura a linha.' },
    besteiro: { nome: 'Besteiro', papel: 'atirador', arma: 'Adaga', tiro: 'Besta pesada', token: 'saqueadora', desc: 'Atira de longe.' },
  };
  const ndMerc = nivel => Math.max(0.5, Math.floor(nivel / 2));
  function criaturaMerc(tipo, nivel) {
    const N = NPC_MERC[tipo]; const nd = ndMerc(nivel); const id = `merc_${tipo}_${nd}`;
    if (!D.CRIATURAS[id]) { const c = BEST.criatura(N.nome, nd, N.papel, { arma: N.arma, dano: N.dano, tiro: N.tiro, token: N.token, tipo: 'humanoide' }); c.ndTxt = nd === 0.5 ? '1/2' : String(nd); c.merc = true; D.CRIATURAS[id] = c; }
    return id;
  }
  const custoMerc = run => 50 * run.nivel;
  function mercDisponiveis() { return Object.keys(NPC_MERC); }
  function podeContratar(run) { return run.mercLiberado !== false && !run.merc && (run.pendente === 'loja' || !!run.proxAndar); }
  function contratarMerc(run, tipo) {
    if (run.mercLiberado === false) return 'Contratar mercenários se libera na guilda.';
    if (!podeContratar(run)) return 'Só dá para contratar na loja ou na cidade, e um por vez.';
    if (!NPC_MERC[tipo]) return 'Esse mercenário não existe.';
    const c = custoMerc(run); if (run.ouro < c) return 'Ouro insuficiente.';
    run.ouro -= c; run.merc = { tipo, merc: true, dano: 0, pmGasto: 0, morto: false, cinto: [null, null, null], nivel: run.nivel };
    run.log.push(`🤝 ${NPC_MERC[tipo].nome} entra no grupo como mercenário (T$ ${c}).`); return null;
  }
  function dispensarMerc(run) { if (!run.merc) return 'Não há mercenário.'; run.log.push(`👋 ${NPC_MERC[run.merc.tipo].nome} deixa o grupo.`); run.merc = null; return null; }
  function atualizarMerc(run) {
    const m = run.merc; if (!m) return;
    if (m.nivel !== run.nivel) { const pvA = pvMaxDe(m, m.nivel), pvB = pvMaxDe(m, run.nivel); m.dano = Math.max(0, m.dano - Math.max(0, pvB - pvA)); m.nivel = run.nivel; }
  }
  function fichaMerc(tipo, nivel) { return D.CRIATURAS[criaturaMerc(tipo, nivel)]; }

  /* ---------- progresso permanente ---------- */
  const MARCOS = [
    { id: 'guilda', pts: 1500, nome: 'Guilda dos Aventureiros', desc: 'Abre a guilda: baú, venda à guilda, Banco e treino de classe.' },
    { id: 'bolsaRica', pts: 8000, nome: 'Família rica e Armeiro', desc: 'Libera na guilda a Família rica (+T$ 100 na partida) e o Armeiro.' },
    { id: 'templo', pts: 16000, nome: 'Templo', desc: 'Libera o Templo na guilda: reviver um herói por run.' },
    { id: 'nivel2', pts: 30000, nome: 'Torre de treino', desc: 'Libera a Torre na guilda: começar a run no nível 2.' },
  ];
  function novoMeta() { return { v: 1, pontos: 0, porClasse: {}, runs: 0, vitorias: 0, bau: [], ouro: 0, melhor: 0, historico: [] }; }
  function liberado(meta, id) { const m = MARCOS.find(x => x.id === id); return !!m && meta.pontos >= m.pts; }
  // pontos liberam o acesso; o ouro do cofre paga. Melhorias compradas valem para todas as runs.
  const PV_TREINO = 4; const TREINO_CUSTO = [800, 1600, 3200];
  const MELHORIAS = [
    { id: 'banco', marco: 'guilda', custo: 5000, nome: 'Banco', desc: 'Guarda 25% do ouro da run no cofre mesmo se o grupo cair.' },
    { id: 'armeiro', marco: 'bolsaRica', custo: 20000, nome: 'Armeiro', desc: 'Cada herói começa a run com uma arma superior (certeira).' },
    { id: 'bolsaRica', marco: 'bolsaRica', custo: 12000, nome: 'Família rica', desc: 'Começa a run com T$ 100 a mais.' },
    { id: 'templo', marco: 'templo', custo: 30000, nome: 'Templo', desc: 'Uma vez por run, reviva um herói por T$ 200 na fogueira.' },
    { id: 'nivel2', marco: 'nivel2', custo: 60000, nome: 'Torre de treino', desc: 'O grupo começa a run no nível 2.' },
    { id: 'contratos', marco: 'guilda', custo: 12000, nome: 'Mural de contratos', desc: 'Libera contratar um mercenário (NPC jogado pela IA) nas lojas e cidades.' },
    { id: 'mestres', marco: 'bolsaRica', custo: 40000, nome: 'Mestres da guilda', desc: 'Ao subir de nível, cada herói escolhe um poder do Livro Base (em vez do bônus genérico).' },
  ];
  // configuração de uma run nova a partir do que a guilda já liberou
  function cfgDaGuilda(meta) {
    return { ouro: 150 + (tem(meta, 'bolsaRica') ? 100 : 0), nivel: tem(meta, 'nivel2') ? 2 : 1, treino: meta.treino || {}, semPoderes: !tem(meta, 'mestres'), mercLiberado: tem(meta, 'contratos') };
  }
  function tem(meta, id) { return !!(meta.compras && meta.compras[id]) && liberado(meta, (MELHORIAS.find(x => x.id === id) || {}).marco); }
  function comprarMelhoria(meta, id) {
    const M = MELHORIAS.find(x => x.id === id); if (!M) return 'Não existe.'; if (!liberado(meta, M.marco)) return 'Ainda bloqueado.';
    meta.compras = meta.compras || {}; if (meta.compras[id]) return 'Já comprado.'; if (meta.ouro < M.custo) return 'Ouro insuficiente no cofre.';
    meta.ouro -= M.custo; meta.compras[id] = true; return null;
  }
  function custoTreino(meta, classe) { const n = (meta.treino || {})[classe] || 0; return n < TREINO_CUSTO.length ? TREINO_CUSTO[n] : null; }
  function comprarTreino(meta, classe) {
    if (!liberado(meta, 'guilda')) return 'Ainda bloqueado.'; const c = custoTreino(meta, classe); if (c == null) return 'Treino completo.'; if (meta.ouro < c) return 'Ouro insuficiente no cofre.';
    meta.ouro -= c; meta.treino = meta.treino || {}; meta.treino[classe] = (meta.treino[classe] || 0) + 1; return null;
  }
  // fim de run: soma pontuação (XP histórico), guarda itens e ouro se venceu
  function encerrarRun(run, meta, desistiu) {
    const venceu = run.fim === 'vitoria'; const antes = meta.pontos; const andares = run.andaresVencidos || 0;
    const pts = run.stats.xp + 2000 * andares + (venceu ? 10000 : 0); // XP que cada herói ganhou + bônus por andar limpo e pela vitória final
    meta.pontos += pts; meta.runs++; if (venceu) meta.vitorias++;
    for (const h of run.herois) { const c = D.HEROIS.find(x => x.id === h.hid).classe; meta.porClasse[c] = (meta.porClasse[c] || 0) + run.stats.xp; }
    const fica = [];
    meta.melhorAndar = Math.max(meta.melhorAndar || 0, run.andar || 1);
    const traz = venceu || andares >= 1; // quem limpou ao menos um andar traz equipamento e mochila para o baú
    if (traz) {
      for (const h of run.herois) { for (const s of ['arma', 'armadura', 'acessorio']) if (h.equip[s]) fica.push(h.equip[s]); }
      for (const it of run.mochila) if (ITENS[it].slot !== 'cinto') fica.push(it);
      meta.bau.push(...fica);
    }
    if (venceu) meta.ouro += run.ouro;
    // sem a vitória final: o Banco guarda 25% e cada andar limpo guarda mais 20% (até 80%)
    const parte = Math.min(0.8, (tem(meta, 'banco') ? 0.25 : 0) + 0.2 * andares);
    const guardado = !venceu ? Math.floor(run.ouro * parte) : 0; meta.ouro += guardado;
    const novos = MARCOS.filter(m => antes < m.pts && meta.pontos >= m.pts);
    const resumo = { venceu, desistiu: !!desistiu, andar: run.andar || 1, andares, pts, total: meta.pontos, fica, ouro: venceu ? run.ouro : guardado, guardado, novos, nivel: run.nivel, stats: { ...run.stats } };
    meta.melhor = Math.max(meta.melhor, pts);
    meta.historico.unshift({ data: Date.now(), venceu, pts, nivel: run.nivel, andar: run.andar || 1, herois: run.herois.map(h => h.hid) }); meta.historico = meta.historico.slice(0, 20);
    return resumo;
  }
  function vendaGuilda(meta, idx) { const id = meta.bau[idx]; if (!id) return 'Nada aí.'; const v = Math.floor(ITENS[id].preco / 2); meta.bau.splice(idx, 1); meta.ouro += v; return null; }

  const API = {
    ITENS, EVENTOS, TEMAS, CHEFES, ANDARES, ULTIMO_ANDAR, proximoAndar, reviverNaCidade, custoReviverAndar, MARCOS, XP_NIVEL, PERICIAS, MAX_CINTO, LOJA_FIXOS,
    poderesDisponiveis, escolherPoder, autoPoderes, poderesPendentes, custoMerc, mercDisponiveis, podeContratar, NPC_MERC, fichaMerc, ndMerc, criaturaMerc, contratarMerc, dispensarMerc, atualizarMerc, novaRun, gerarMapa, proximos, noAtual, avancar, sairDoNo, vivos, inimigosDoNo, ndEncontro, ndTxt, nivelDoXP,
    prepararBatalha, ajustarBatalha, concluirBatalha, unidadeHeroi, pvMaxDe, pmMaxDe,
    darItem, equipar, desequipar, estoqueLoja, comprar, vender, precoVenda,
    opcoesDescanso, descansar, racoesNecessarias, escolhasEvento, resolverEvento, bonusPericia,
    novoMeta, liberado, encerrarRun, cfgDaGuilda, vendaGuilda, MELHORIAS, tem, comprarMelhoria, custoTreino, comprarTreino, PV_TREINO, TREINO_CUSTO,
  };
  if (node) module.exports = API; else root.T20RUN = API;
})(this);
