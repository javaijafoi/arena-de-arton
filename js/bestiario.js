/* Arena de Arton — bestiário dos andares 2 a 5 do roguelike.
   Os nomes e o ND vêm de Ameaças de Arton. Os números não: as fichas do livro foram feitas para
   heróis com todos os poderes e itens, e os heróis deste jogo são mais simples. Por isso cada
   criatura é gerada por uma curva por ND (ajustada no simulador, test/run-sim.js) e um papel
   (bruto, fera, tanque, ágil, atirador, arcano, divino, dragão). */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const D = node ? require('./data.js') : root.T20DATA;

  // curva base por ND (heróis do jogo no nível = ND acertam ~60% e levam ~4 golpes para cair)
  const curva = n => ({
    pv: Math.round(8 * n + 0.25 * n * n + 10), def: Math.round(12 + 1.1 * n), atk: Math.round(11 + 0.6 * n), dano: 6 + 1.25 * n,
    forte: Math.round(3 + 0.7 * n), medio: Math.round(2 + 0.5 * n), fraco: Math.round(0.35 * n), inic: Math.round(2 + 0.5 * n),
  });
  // dano médio → dados [k, faces, bônus]
  function dados(media, faces) { const k = Math.max(1, Math.round(media / (faces * 1.6))); return [k, faces, Math.max(0, Math.round(media - k * (faces + 1) / 2))]; }
  const ataque = (nome, bonus, media, faces, tipo, x) => ({ nome, bonus, dano: dados(media, faces), margem: 20, mult: 2, tipo, ...(x || {}) });
  // o círculo das magias acompanha o ND (conjurador de ND baixo não tem bola de fogo)
  // raio polar e desintegrar ficam só com chefes (paralisar ou tirar 60 PV de um herói por turno é demais para lutas comuns)
  const MAGIAS_ARCANO = n => n >= 9 ? ['bolaDeFogo', 'relampago', 'amarras'] : n >= 6 ? ['relampago', 'setaMilicia', 'amarras'] : ['setaMilicia', 'amarras'];
  const MAGIAS_DIVINO = n => n >= 12 ? ['colunaChamas', 'infligirFerimentos'] : ['infligirFerimentos'];

  function criatura(nome, nd, papel, x) {
    x = x || {}; const c = curva(nd); const ndTxt = String(nd);
    const b = { nome, nd, ndTxt, token: x.token || nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      pv: c.pv, def: c.def, fort: c.medio, ref: c.medio, von: c.medio, inic: c.inic, desloc: 6, tags: [x.tipo || 'monstro'], aprox: true };
    const arma = x.arma || 'Garra', tipo = x.dano || 'corte';
    switch (papel) {
      case 'bruto':
        b.pv = Math.round(c.pv * 1.2); b.def -= 1; b.fort = c.forte; b.ref = c.fraco;
        b.ataques = [ataque(arma, c.atk + 1, c.dano * 0.9, 10, tipo)]; break;
      case 'fera':
        b.fort = c.forte; b.ref = c.medio; b.von = c.fraco; b.inic += 2; b.desloc = 8;
        b.ataques = [ataque(x.arma || 'Mordida', c.atk, c.dano * 0.55, 8, 'perfuração'), ataque(x.arma2 || 'Garra', c.atk, c.dano * 0.5, 6, 'corte')]; break;
      case 'tanque':
        b.pv = Math.round(c.pv * 1.3); b.def += 3; b.rd = Math.floor(nd / 3); b.fort = c.forte; b.ref = c.fraco; b.inic -= 2; b.desloc = 4;
        b.ataques = [ataque(arma, c.atk, c.dano * 0.45, 10, 'impacto'), ataque(arma, c.atk, c.dano * 0.45, 10, 'impacto')];
        if (x.tipo === 'construto') b.imune = ['mental', 'sono', 'cansaco']; break;
      case 'agil':
        b.pv = Math.round(c.pv * 0.8); b.def += 2; b.ref = c.forte; b.inic += 5; b.furtivo = [Math.ceil(nd / 5), 6];
        b.ataques = [ataque(arma, c.atk, c.dano * 0.35, 6, tipo, { margem: 19 }), ataque(arma, c.atk, c.dano * 0.35, 6, tipo, { margem: 19 })]; break;
      case 'atirador':
        b.pv = Math.round(c.pv * 0.75); b.ref = c.forte; b.inic += 4; b.tiroPreciso = true; b.aprox = false;
        b.ataques = [ataque(x.arma || 'Espada curta', c.atk - 2, c.dano * 0.5, 6, 'corte')];
        b.distancia = { nome: x.tiro || 'Arco longo', bonus: c.atk + 1, dano: dados(c.dano * 0.8, 10), alcance: 20, margem: 19, mult: 3, tipo: 'perfuração' }; break;
      case 'arcano': case 'divino':
        b.pv = Math.round(c.pv * 0.65); b.def -= 2; b.von = c.forte; b.aprox = false;
        b.pm = Math.round(2 * nd + 4); b.cd = Math.round(13 + 0.8 * nd); b.atrMagia = Math.round(3 + nd / 4);
        b.magias = (papel === 'arcano' ? MAGIAS_ARCANO : MAGIAS_DIVINO)(nd);
        b.ataques = [ataque(x.arma || 'Cajado', c.atk - 2, c.dano * 0.45, 6, 'impacto')]; break;
      case 'dragao':
        b.pv = Math.round(c.pv * 1.2); b.def += 1; b.fort = c.forte; b.ref = c.medio; b.von = c.forte; b.voo = true; b.grande = true; b.desloc = 8;
        b.ataques = [ataque('Mordida', c.atk + 1, c.dano * 0.55, 10, 'perfuração'), ataque('Garra', c.atk + 1, c.dano * 0.4, 8, 'corte')];
        b.sopro = { nome: x.sopro || 'Sopro', dano: [Math.max(2, Math.round(nd * 0.6)), 6], cd: Math.round(12 + 0.8 * nd), recarga: 3 }; break;
    }
    for (const k of ['voo', 'grande', 'rd', 'imune', 'magias']) if (x[k] != null) b[k] = x[k];
    if (x.extra) b.ataques.forEach(a => { a.extra = x.extra; });
    if (x.tipo) b.tags = [x.tipo];
    return b;
  }

  const NOVAS = {
    // andar 2 · Florestas de Tollon (níveis 4 a 8)
    tigre: criatura('Tigre', 3, 'fera', { tipo: 'animal' }),
    warg: criatura('Warg', 3, 'fera', { tipo: 'monstro', grande: true }),
    rinoceronte: criatura('Rinoceronte', 4, 'bruto', { tipo: 'animal', arma: 'Chifre', dano: 'perfuração', grande: true }),
    gnollLider: criatura('Gnoll Líder de Alcateia', 5, 'bruto', { tipo: 'humanoide', arma: 'Machado de batalha' }),
    hobgoblinAtirador: criatura('Hobgoblin Atirador', 5, 'atirador', { tipo: 'humanoide', tiro: 'Lança de fogo' }),
    orcRei: criatura('Orc Rei', 6, 'bruto', { tipo: 'humanoide', arma: 'Lança', dano: 'perfuração' }),
    bugbear: criatura('Bugbear Guarda-Costas', 6, 'bruto', { tipo: 'humanoide', arma: 'Machado de guerra' }),
    gnollXama: criatura('Gnoll Xamã de Marah', 6, 'divino', { tipo: 'humanoide' }),
    manticora: criatura('Mantícora', 6, 'fera', { voo: true, grande: true }),
    orcXama: criatura('Orc Xamã', 7, 'divino', { tipo: 'humanoide' }),
    ogroCacador: criatura('Ogro Caçador', 7, 'bruto', { tipo: 'humanoide', arma: 'Tacape', dano: 'impacto', grande: true }),
    quimera: criatura('Quimera', 8, 'dragao', { sopro: 'Sopro de fogo' }),
    dragaoJovem: criatura('Dragão Jovem do Ocaso', 7, 'dragao', { sopro: 'Sopro sombrio' }),
    // andar 3 · Montanhas Uivantes (níveis 8 a 12)
    mamute: criatura('Mamute', 8, 'bruto', { tipo: 'animal', arma: 'Presas', dano: 'perfuração', grande: true }),
    ursoCavernas: criatura('Urso das Cavernas', 8, 'fera', { tipo: 'animal', grande: true }),
    morteGlacial: criatura('Morte Glacial', 9, 'agil', { arma: 'Espada curta', extra: [1, 6, 'frio'] }),
    keylor: criatura('Keylor', 9, 'bruto', { tipo: 'humanoide', arma: 'Machado de guerra', grande: true }),
    golemBronze: criatura('Golem de Bronze', 9, 'tanque', { tipo: 'construto', arma: 'Pancada' }),
    golemFerro: criatura('Golem de Ferro', 10, 'tanque', { tipo: 'construto', arma: 'Pancada' }),
    tuntram: criatura('Tuntram', 10, 'bruto', { tipo: 'animal', arma: 'Chifres', dano: 'perfuração', grande: true }),
    dracomante: criatura('Dracomante', 8, 'arcano', { tipo: 'humanoide' }),
    bruxaGoblin: criatura('Bruxa Goblin', 11, 'arcano', { tipo: 'humanoide', magias: ['raioPolar', 'bolaDeFogo', 'amarras'] }),
    dragaoAdulto: criatura('Dragão Adulto', 11, 'dragao', { sopro: 'Sopro de gelo' }),
    golemPedra: criatura('Golem de Pedra', 12, 'tanque', { tipo: 'construto', arma: 'Pancada', grande: true }),
    // andar 4 · Aslothia, o reino dos mortos (níveis 12 a 16)
    mortalha: criatura('Mortalha', 11, 'agil', { tipo: 'morto-vivo', arma: 'Toque drenante', dano: 'trevas' }),
    reiTiranoEsqueleto: criatura('Rei-Tirano Esqueleto', 12, 'bruto', { tipo: 'morto-vivo', arma: 'Mordida', dano: 'perfuração', grande: true }),
    necrodracoEsqueleto: criatura('Necrodraco Esqueleto', 12, 'dragao', { tipo: 'morto-vivo', sopro: 'Sopro necrótico' }),
    sacerdoteAgonia: criatura('Sacerdote da Agonia', 10, 'divino', { tipo: 'humanoide' }),
    lyuba: criatura('Lyuba', 14, 'bruto', { tipo: 'morto-vivo', arma: 'Presas espectrais', dano: 'perfuração', grande: true }),
    fantasmaAncestral: criatura('Fantasma Ancestral', 14, 'agil', { tipo: 'morto-vivo', arma: 'Toque drenante', dano: 'trevas', voo: true }),
    necrodracoZumbi: criatura('Necrodraco Zumbi', 14, 'dragao', { tipo: 'morto-vivo', sopro: 'Sopro necrótico' }),
    senhorMumias: criatura('Senhor das Múmias', 15, 'bruto', { tipo: 'morto-vivo', arma: 'Ankh solar', dano: 'impacto' }),
    lich: criatura('Lich', 15, 'arcano', { tipo: 'morto-vivo', magias: ['raioPolar', 'bolaDeFogo', 'relampago', 'amarras'] }),
    // andar 5 · Área de Tormenta (níveis 16 a 20)
    akaOni: criatura('Aka Oni', 9, 'bruto', { tipo: 'lefeu', arma: 'Tetsubo', dano: 'impacto', extra: [1, 6, 'trevas'] }),
    aspectoAharadak: criatura('Aspecto de Aharadak', 10, 'fera', { tipo: 'lefeu', grande: true }),
    reishidLider: criatura('Reishid Líder de Culto', 12, 'agil', { tipo: 'lefeu', arma: 'Adaga da Tormenta', dano: 'perfuração', extra: [1, 8, 'trevas'] }),
    arquibruxo: criatura('Arquibruxo da Tormenta', 14, 'arcano', { tipo: 'lefeu' }),
    dragaoVeneravel: criatura('Dragão Venerável', 15, 'dragao', { sopro: 'Sopro de fogo' }),
    elementalCorrompido: criatura('Elemental Corrompido', 16, 'tanque', { tipo: 'lefeu', arma: 'Pancada', extra: [2, 6, 'ácido'], grande: true }),
    rubro: criatura('Rubro, Forma Final', 16, 'agil', { tipo: 'lefeu', extra: [1, 6, 'trevas'] }),
    necrodracoLich: criatura('Necrodraco Lich', 20, 'dragao', { tipo: 'morto-vivo', sopro: 'Sopro necrótico' }),
  };
  for (const k in NOVAS) if (!D.CRIATURAS[k]) D.CRIATURAS[k] = NOVAS[k];

  const API = { NOVAS, criatura, curva };
  if (node) module.exports = API; else root.T20BESTIARIO = API;
})(this);
