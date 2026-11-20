/* Arena de Arton — poderes escolhidos ao subir de nível (Tormenta20, Livro Base).
   Em T20 o herói ganha um poder por nível a partir do 2º: de classe ou geral (combate, destino, magia).
   Aqui entram só os que fazem diferença no tabuleiro. Os nomes são os do livro; as descrições são
   resumos nossos. Quando um poder é ativado no livro (gastar PM, sofrer penalidade), o jogo usa sozinho
   quando compensa, para não encher a tela de botões. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./data.js') : root.T20DATA;

  const ATR = { for: 'Força', des: 'Destreza', con: 'Constituição', int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma' };
  const TODAS = Object.keys(D.CLASSES);
  const corpo = x => !x.arma.distancia;
  const PODERES = {};
  // Aumento de Atributo existe em todas as classes (até duas vezes no mesmo atributo)
  for (const k in ATR) PODERES['aum_' + k] = { nome: `Aumento de Atributo (${ATR[k]})`, desc: `+1 em ${ATR[k]}. Pode escolher duas vezes.`, classes: TODAS, max: 2, tipo: 'classe' };
  Object.assign(PODERES, {
    // ---- gerais de combate e destino ----
    vitalidade: { nome: 'Vitalidade', desc: '+1 PV por nível e +2 em Fortitude.', req: x => x.a.con >= 1, reqTxt: 'Con 1', tipo: 'geral' },
    vontadeFerro: { nome: 'Vontade de Ferro', desc: '+1 PM a cada dois níveis e +2 em Vontade.', req: x => x.a.sab >= 1, reqTxt: 'Sab 1', tipo: 'geral' },
    esquiva: { nome: 'Esquiva', desc: '+2 na Defesa e em Reflexos.', req: x => x.a.des >= 1, reqTxt: 'Des 1', tipo: 'geral' },
    encouracado: { nome: 'Encouraçado', desc: '+2 na Defesa usando armadura pesada (+2 a mais com Inexpugnável).', req: x => !!x.c.armaduraPesada, reqTxt: 'armadura pesada', tipo: 'geral' },
    inexpugnavel: { nome: 'Inexpugnável', desc: '+2 em todos os testes de resistência usando armadura pesada.', req: x => x.tem('encouracado') && x.nivel >= 6, reqTxt: 'Encouraçado, 6º nível', tipo: 'geral' },
    estiloDuasMaos: { nome: 'Estilo de Duas Mãos', desc: '+5 nas rolagens de dano com arma de duas mãos.', req: x => x.a.for >= 2 && !!x.arma.duasMaos, reqTxt: 'For 2, arma de duas mãos', tipo: 'geral' },
    estiloUmaArma: { nome: 'Estilo de Uma Arma', desc: 'Arma numa mão e nada na outra: +2 na Defesa e nos ataques.', req: x => corpo(x) && !x.arma.duasMaos && !x.c.escudo, reqTxt: 'arma de uma mão, sem escudo', tipo: 'geral' },
    estiloArmaEscudo: { nome: 'Estilo de Arma e Escudo', desc: 'O escudo dá +2 a mais na Defesa.', req: x => x.c.escudo > 0, reqTxt: 'escudo', tipo: 'geral' },
    estiloDisparo: { nome: 'Estilo de Disparo', desc: 'Soma a Destreza no dano com arco.', req: x => !!x.arma.distancia, reqTxt: 'arma de disparo', tipo: 'geral' },
    focoArma: { nome: 'Foco em Arma', desc: '+2 nos testes de ataque com a sua arma.', tipo: 'geral' },
    ataquePoderoso: { nome: 'Ataque Poderoso', desc: '–2 no ataque corpo a corpo para +5 no dano. O jogo usa quando compensa.', req: x => x.a.for >= 1 && corpo(x), reqTxt: 'For 1', tipo: 'geral' },
    acuidade: { nome: 'Acuidade com Arma', desc: 'Com arma leve, usa Destreza em vez de Força no ataque e no dano.', req: x => x.a.des >= 1 && !!x.arma.leve, reqTxt: 'Des 1, arma leve', tipo: 'geral' },
    // ---- guerreiro ----
    especArma: { nome: 'Especialização em Arma', desc: '+2 nas rolagens de dano com a sua arma.', classes: ['guerreiro'], tipo: 'classe' },
    valentao: { nome: 'Valentão', desc: '+2 no ataque e no dano contra inimigo caído, desprevenido ou flanqueado.', classes: ['guerreiro'], tipo: 'classe' },
    especArmadura: { nome: 'Especialização em Armadura', desc: 'Redução de dano 5 usando armadura pesada.', classes: ['guerreiro', 'cavaleiro'], req: x => x.nivel >= 12 && !!x.c.armaduraPesada, reqTxt: '12º nível', tipo: 'classe' },
    solidez: { nome: 'Solidez', desc: 'Soma o bônus do escudo nos testes de resistência.', classes: ['guerreiro', 'cavaleiro'], req: x => x.c.escudo > 0, reqTxt: 'escudo', tipo: 'classe' },
    // ---- bárbaro ----
    peleFerro: { nome: 'Pele de Ferro', desc: '+2 na Defesa sem armadura pesada.', classes: ['barbaro'], req: x => !x.c.armaduraPesada, tipo: 'classe' },
    peleAco: { nome: 'Pele de Aço', desc: 'Pele de Ferro passa a dar +5.', classes: ['barbaro'], req: x => x.tem('peleFerro') && x.nivel >= 8, reqTxt: 'Pele de Ferro, 8º nível', tipo: 'classe' },
    golpePoderoso: { nome: 'Golpe Poderoso', desc: 'Ao acertar corpo a corpo, 1 PM para um dado extra de dano da arma. Usado quando sobra PM.', classes: ['barbaro'], tipo: 'classe' },
    almaBronze: { nome: 'Alma de Bronze', desc: 'Ao entrar em fúria, ganha PV temporários iguais a nível + Força.', classes: ['barbaro'], tipo: 'classe' },
    criticoBrutal: { nome: 'Crítico Brutal', desc: 'O multiplicador de crítico corpo a corpo sobe em +1.', classes: ['barbaro'], req: x => x.nivel >= 6, reqTxt: '6º nível', tipo: 'classe' },
    destruidor: { nome: 'Destruidor', desc: 'Com arma de duas mãos, rola de novo os 1 e 2 do dano.', classes: ['barbaro', 'guerreiro'], req: x => x.a.for >= 1 && !!x.arma.duasMaos, reqTxt: 'For 1, arma de duas mãos', tipo: 'classe' },
    // ---- paladino ----
    armaSagrada: { nome: 'Arma Sagrada', desc: 'O dado do Golpe Divino vira d12 (espada longa, arma de Khalmyr).', classes: ['paladino'], tipo: 'classe' },
    // ---- arcanista ----
    poderMagico: { nome: 'Poder Mágico', desc: '+1 PM por nível. Pode escolher duas vezes.', classes: ['arcanista'], max: 2, tipo: 'classe' },
    arcanoBatalha: { nome: 'Arcano de Batalha', desc: 'Soma a Inteligência no dano das magias.', classes: ['arcanista'], tipo: 'classe' },
    fortalecimentoArcano: { nome: 'Fortalecimento Arcano', desc: '+1 na CD das magias (+2 com magias de 4º círculo).', classes: ['arcanista'], req: x => x.nivel >= 5, reqTxt: '5º nível', tipo: 'classe' },
    // ---- caçador ----
    arqueiro: { nome: 'Arqueiro', desc: 'Soma a Sabedoria no dano à distância.', classes: ['cacador', 'guerreiro'], req: x => x.a.sab >= 1 && !!x.arma.distancia, reqTxt: 'Sab 1, arma à distância', tipo: 'classe' },
    pontoFraco: { nome: 'Ponto Fraco', desc: '+2 na margem de ameaça contra a presa marcada.', classes: ['cacador'], tipo: 'classe' },
    // ---- cavaleiro ----
    escudeiro: { nome: 'Escudeiro', desc: 'Um escudeiro cuida do equipamento: +1 no dano e +1 na Defesa.', classes: ['cavaleiro'], tipo: 'classe' },
    armaduraHonra: { nome: 'Armadura da Honra', desc: 'Começa cada batalha com 5 + Carisma PV temporários.', classes: ['cavaleiro'], tipo: 'classe' },
    // ---- bardo ----
    esgrimaMagica: { nome: 'Esgrima Mágica', desc: 'Sob Inspiração, ataca corpo a corpo com Carisma (Atuação) em vez de Força.', classes: ['bardo'], tipo: 'classe' },
    golpeMagico: { nome: 'Golpe Mágico', desc: 'Sob Inspiração, cada acerto corpo a corpo dá 2 PM temporários (até o nível por batalha).', classes: ['bardo'], req: x => x.tem('esgrimaMagica'), reqTxt: 'Esgrima Mágica', tipo: 'classe' },
    golpeElemental: { nome: 'Golpe Elemental', desc: 'Sob Inspiração, 1 PM por acerto corpo a corpo para +1d6 de fogo. Usado quando sobra PM.', classes: ['bardo'], req: x => x.tem('golpeMagico'), reqTxt: 'Golpe Mágico', tipo: 'classe' },
    arteMagica: { nome: 'Arte Mágica', desc: 'Sob Inspiração, +2 na CD das suas magias.', classes: ['bardo'], tipo: 'classe' },
  });
  // Foco em Magia (geral de magia): uma magia da lista do herói custa 1 PM a menos (mínimo 1)
  for (const k of TODAS) for (const m of D.CLASSES[k].magias || []) {
    const id = 'foco_' + m; if (PODERES[id]) { PODERES[id].classes.push(k); continue; }
    PODERES[id] = { nome: `Foco em Magia (${D.MAGIAS[m].nome})`, desc: `${D.MAGIAS[m].nome} custa 1 PM a menos (mínimo 1).`, classes: [k], magia: m, tipo: 'magia', req: x => x.circulo >= D.MAGIAS[m].circulo, reqTxt: `magias de ${D.MAGIAS[m].circulo}º círculo` };
  }

  const contar = lista => { const P = {}; for (const p of lista || []) P[p] = (P[p] || 0) + 1; return P; };
  function atributos(c, P) { const a = { ...c.attr }; for (const k in ATR) a[k] += P['aum_' + k] || 0; return a; }
  function circuloMax(classe, nivel) {
    // igual a rules.js (bardo: 2º círculo no 6º nível; os outros a cada 4 níveis)
    if (!D.CLASSES[classe].conjurador) return 0;
    if (classe === 'bardo') return Math.min(4, Math.max(1, 1 + Math.floor((nivel - 2) / 4)));
    return Math.min(5, 1 + Math.floor((nivel - 1) / 4));
  }
  // pode escolher agora? (o herói já tem `lista`; o nível é o do grupo)
  function pode(hid, nivel, lista, id) {
    const h = D.HEROIS.find(x => x.id === hid); const c = D.CLASSES[h.classe]; const p = PODERES[id]; if (!p) return false;
    const P = contar(lista);
    if ((P[id] || 0) >= (p.max || 1)) return false;
    if (p.classes && !p.classes.includes(h.classe)) return false;
    const x = { c, a: atributos(c, P), nivel, arma: D.ARMAS[c.arma], circulo: circuloMax(h.classe, nivel), tem: k => !!P[k] };
    return !p.req || p.req(x);
  }
  function disponiveis(hid, nivel, lista) { return Object.keys(PODERES).filter(id => pode(hid, nivel, lista, id)); }

  // escolha automática (mercenário, simulador): a ordem é o que um jogador experiente pegaria para cada classe
  const ORDEM = {
    guerreiro: ['especArma', 'focoArma', 'ataquePoderoso', 'estiloArmaEscudo', 'encouracado', 'aum_for', 'vitalidade', 'valentao', 'aum_for', 'inexpugnavel', 'aum_con', 'especArmadura', 'solidez', 'aum_con', 'aum_des', 'esquiva'],
    barbaro: ['estiloDuasMaos', 'ataquePoderoso', 'peleFerro', 'golpePoderoso', 'focoArma', 'aum_for', 'destruidor', 'criticoBrutal', 'almaBronze', 'aum_for', 'peleAco', 'vitalidade', 'aum_con', 'aum_con', 'esquiva'],
    paladino: ['focoArma', 'estiloArmaEscudo', 'encouracado', 'armaSagrada', 'aum_car', 'ataquePoderoso', 'aum_for', 'vitalidade', 'aum_car', 'inexpugnavel', 'aum_for', 'aum_con'],
    clerigo: ['aum_sab', 'vontadeFerro', 'foco_curarFerimentos', 'estiloArmaEscudo', 'encouracado', 'aum_sab', 'vitalidade', 'foco_bencao', 'inexpugnavel', 'foco_infligirFerimentos', 'foco_oracao', 'aum_con', 'foco_raioSolar', 'foco_colunaChamas', 'aum_con'],
    arcanista: ['poderMagico', 'arcanoBatalha', 'aum_int', 'esquiva', 'fortalecimentoArcano', 'aum_int', 'poderMagico', 'foco_bolaDeFogo', 'vitalidade', 'vontadeFerro', 'foco_relampago', 'foco_lancaIgnea', 'foco_raioPolar', 'aum_des', 'aum_con'],
    cacador: ['estiloDisparo', 'arqueiro', 'focoArma', 'pontoFraco', 'aum_des', 'esquiva', 'aum_des', 'vitalidade', 'aum_sab', 'vontadeFerro', 'aum_sab', 'aum_con'],
    ladino: ['acuidade', 'focoArma', 'estiloUmaArma', 'esquiva', 'aum_des', 'aum_des', 'vitalidade', 'aum_con', 'aum_int', 'aum_con'],
    cavaleiro: ['escudeiro', 'estiloArmaEscudo', 'encouracado', 'armaduraHonra', 'focoArma', 'ataquePoderoso', 'vitalidade', 'inexpugnavel', 'aum_con', 'aum_for', 'solidez', 'especArmadura', 'aum_car', 'aum_for'],
    bardo: ['esgrimaMagica', 'golpeMagico', 'arteMagica', 'golpeElemental', 'focoArma', 'aum_car', 'esquiva', 'aum_car', 'estiloUmaArma', 'vitalidade', 'foco_velocidade', 'aum_des', 'aum_con'],
  };
  function escolhaIA(hid, nivel, lista) {
    const h = D.HEROIS.find(x => x.id === hid); const disp = disponiveis(hid, nivel, lista); if (!disp.length) return null;
    const P = contar(lista);
    for (const id of ORDEM[h.classe] || []) if (disp.includes(id) && (P[id] || 0) < ORDEM[h.classe].filter(x => x === id).length) return id;
    return disp.find(id => id.startsWith('aum_')) || disp[0];
  }
  // todos os poderes de um herói gerado pela IA até um nível (mercenário)
  function poderesIA(hid, nivel) { const l = []; for (let n = 2; n <= nivel; n++) { const p = escolhaIA(hid, n, l); if (p) l.push(p); } return l; }

  /* efeitos no herói (chamado por criarHeroi, depois dos valores da classe) */
  function aplicar(u, c, nivel, P) {
    const q = id => P[id] || 0;
    u.poderes = P; u.arma.bonusAtaque = u.arma.bonusAtaque || 0; u.bonusDano = u.bonusDano || 0;
    const res = v => { u.per.fort += v; u.per.ref += v; u.per.von += v; };
    if (q('vitalidade')) { u.pvMax += nivel; u.per.fort += 2; }
    if (q('vontadeFerro')) { u.pmMax += Math.floor(nivel / 2); u.per.von += 2; }
    if (q('poderMagico')) u.pmMax += nivel * q('poderMagico');
    if (q('esquiva')) { u.defBase += 2; u.per.ref += 2; }
    if (q('encouracado')) u.defBase += 2 + (q('inexpugnavel') ? 2 : 0);
    if (q('inexpugnavel')) res(2);
    if (q('estiloArmaEscudo')) u.defBase += 2;
    if (q('estiloUmaArma')) { u.defBase += 2; u.arma.bonusAtaque += 2; }
    if (q('focoArma')) u.arma.bonusAtaque += 2;
    if (q('especArma')) u.bonusDano += 2;
    if (q('estiloDuasMaos')) u.bonusDano += 5;
    if (q('estiloDisparo')) u.bonusDano += u.attr.des;
    if (q('arqueiro')) u.bonusDano += Math.min(u.attr.sab, nivel);
    if (q('escudeiro')) { u.bonusDano += 1; u.defBase += 1; }
    if (q('peleFerro') && !c.armaduraPesada) u.defBase += q('peleAco') ? 5 : 2;
    if (q('especArmadura')) u.rd = (u.rd || 0) + 5;
    if (q('solidez')) res(c.escudo + (q('estiloArmaEscudo') ? 2 : 0));
    if (q('criticoBrutal')) u.arma.mult += 1;
    if (q('acuidade') && u.attr.des > u.attr.for) { u.per.luta += u.attr.des - u.attr.for; u.arma.acuidade = true; }
    if (q('arcanoBatalha')) u.arcanoBatalha = u.attr[c.conjurador] || 0;
    if (q('fortalecimentoArcano')) u.cd += u.circulo >= 4 ? 2 : 1;
    if (q('armaduraHonra')) u.pvTemp = 5 + u.attr.car;
    u.focoMagia = Object.keys(P).filter(k => k.startsWith('foco_')).map(k => k.slice(5));
    u.pv = u.pvMax; u.pm = u.pmMax;
  }

  const API = { PODERES, ATR, contar, atributos, pode, disponiveis, escolhaIA, poderesIA, aplicar, ORDEM };
  if (node) module.exports = API; else root.T20PODERES = API;
})(this);
