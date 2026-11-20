/* Arena de Arton — motor de regras (sem DOM). Toda mudança de estado passa por aqui
   e devolve uma lista de eventos para a interface animar. Pensado para virar
   servidor/online depois: o estado é JSON puro e o dado é semeado. */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.T20DATA;
  const PODER = (typeof module !== 'undefined' && module.exports) ? require('./poderes.js') : root.T20PODERES;
  const { ALCANCE, CUSTO_CIRCULO, ARMAS, CLASSES, HEROIS, MAGIAS, CRIATURAS, MAPAS } = D;
  const COLS = 16, ROWS = 12;

  /* ---------- dado semeado ---------- */
  function rnd(st) { // mulberry32
    let t = (st.seed = (st.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d = (st, faces) => 1 + Math.floor(rnd(st) * faces);
  function rolar(st, n, faces) { const r = []; for (let i = 0; i < n; i++) r.push(d(st, faces)); return r; }
  const soma = a => a.reduce((x, y) => x + y, 0);

  /* ---------- construção de personagens ---------- */
  const treino = n => n >= 15 ? 6 : n >= 7 ? 4 : 2;
  function circuloMax(classe, nivel) {
    if (classe === 'bardo') return Math.min(4, Math.max(1, 1 + Math.floor((nivel - 2) / 4)));
    return Math.min(5, 1 + Math.floor((nivel - 1) / 4));
  }
  // poderes: lista de poderes escolhidos (modo com poderes). Sem lista, vale a aproximação antiga (+1 a cada 4 níveis).
  function criarHeroi(hid, nivel, idx, poderes) {
    const h = HEROIS.find(x => x.id === hid); const c = CLASSES[h.classe]; const P = poderes ? PODER.contar(poderes) : null; const a = P ? PODER.atributos(c, P) : c.attr;
    const meio = Math.floor(nivel / 2), t = treino(nivel);
    const per = (k, atr) => meio + a[atr] + (c.treinadas.includes(k) ? t : 0);
    const pvMax = c.pv[0] + a.con + (nivel - 1) * Math.max(1, c.pv[1] + a.con);
    const pmMax = c.pm * nivel;
    // aprox.: poderes e itens que um herói ganha ao subir (equipamento melhor, poderes de combate)
    const def = 10 + (c.armaduraPesada ? 0 : a.des) + c.armadura + c.escudo + Math.floor((nivel - 1) / 2);
    const poder = P ? 0 : Math.floor(nivel / 4);
    const arma = ARMAS[c.arma];
    const bonusItem = nivel >= 9 ? 2 : nivel >= 4 ? 1 : 0; // arma mágica/obra-prima conforme o nível
    const u = {
      id: 'h' + idx, lado: 'h', ref: hid, nome: h.nome, token: h.token, classe: h.classe, classeNome: c.nome, nivel,
      attr: { ...a }, pv: pvMax, pvMax, pm: pmMax, pmMax, defBase: def, desloc: c.desloc,
      per: { luta: per('luta', 'for') + poder, pont: per('pont', 'des') + poder, fort: per('fort', 'con'), ref: per('ref', 'des'), von: per('von', 'sab'), inic: per('inic', 'des'), engan: per('engan', 'car') },
      arma: { ...arma, bonusItem }, bonusDano: poder, magias: (c.magias || []).filter(m => MAGIAS[m].circulo <= circuloMax(h.classe, nivel)),
      habilidades: (c.habilidades || []).filter(k => !(D.HABILIDADES[k].nivel > nivel)),
      conjurador: c.conjurador || null, circulo: c.conjurador ? circuloMax(h.classe, nivel) : 0,
      cd: c.conjurador ? 10 + meio + a[c.conjurador] : 0,
      cond: {}, buff: {}, x: 0, y: 0, vivo: true, nd: nivel, tags: ['humanoide']
    };
    if (h.classe === 'barbaro') u.rd = nivel >= 11 ? 6 : nivel >= 8 ? 4 : nivel >= 5 ? 2 : 0;
    if (h.classe === 'cavaleiro') u.rd = nivel >= 10 ? 4 : nivel >= 5 ? 2 : 0;
    if (h.classe === 'ladino') u.furtivo = [Math.ceil(nivel / 2), 6];
    if (P) PODER.aplicar(u, c, nivel, P);
    return u;
  }
  function criarCriatura(cid, idx) {
    const c = CRIATURAS[cid];
    return {
      id: 'm' + idx, lado: 'm', ref: cid, nome: c.nome, token: c.token, nd: c.nd, ndTxt: c.ndTxt, nivel: Math.max(1, Math.round(c.nd)),
      pv: c.pv, pvMax: c.pv, pm: c.pm || 0, pmMax: c.pm || 0, defBase: c.def, desloc: c.desloc,
      per: { fort: c.fort, ref: c.ref, von: c.von, inic: c.inic, luta: c.ataques[0].bonus, pont: c.distancia ? c.distancia.bonus : 0, engan: 0 },
      ataques: c.ataques, distancia: c.distancia || null, magias: c.magias || [], habilidades: [], cd: c.cd || 0, circulo: 5,
      rd: c.rd || 0, furtivo: c.furtivo || null, sopro: c.sopro ? { ...c.sopro, pronto: 0 } : null, imune: c.imune || [], tags: c.tags || [],
      tiroPreciso: !!c.tiroPreciso, voo: !!c.voo, grande: !!c.grande, chefe: !!c.chefe, aprox: !!c.aprox,
      cond: {}, buff: {}, x: 0, y: 0, vivo: true, attr: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }
    };
  }

  /* ---------- mapa ---------- */
  function terreno(st, x, y) { if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null; return st.mapa.linhas[y][x]; }
  const BLOQUEIA = new Set(['~', 'R', 'W', 't']);
  function passavel(st, x, y) { const t = terreno(st, x, y); return t !== null && !BLOQUEIA.has(t); }
  function dificil(st, x, y) { return terreno(st, x, y) === 'T' || st.teia.some(c => c.x === x && c.y === y); }
  function unidadeEm(st, x, y) { return st.unidades.find(u => u.vivo && u.x === x && u.y === y) || null; }
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const distEuc = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const adjacente = (a, b) => dist(a, b) === 1;

  function linhaCelulas(x0, y0, x1, y1) { // Bresenham
    const out = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { out.push({ x: x0, y: y0 }); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return out;
  }
  function visao(st, a, b) { // devolve {ve, cobertura}
    const cel = linhaCelulas(a.x, a.y, b.x, b.y).slice(1, -1); let cob = false;
    for (const c of cel) { const t = terreno(st, c.x, c.y); if (t === 'W') return { ve: false, cobertura: false }; if (t === 'R' || t === 'T' || t === 't') cob = true; }
    return { ve: true, cobertura: cob };
  }

  /* ---------- condições ---------- */
  const tem = (u, c) => !!u.cond[c];
  function incapaz(u) { return !u.vivo || tem(u, 'inconsciente') || tem(u, 'paralisado') || u.pv <= 0; }
  function deslocAtual(u) {
    if (tem(u, 'imovel') || tem(u, 'paralisado') || tem(u, 'agarrado') || u.buff.agarrando) return 0;
    let v = u.desloc; if (tem(u, 'lento') || tem(u, 'enredado') || tem(u, 'exausto') || tem(u, 'cego')) v = Math.floor(v / 2);
    return v;
  }
  function desprevenido(u, contra) {
    return tem(u, 'desprevenido') || tem(u, 'atordoado') || tem(u, 'cego') || tem(u, 'agarrado') || tem(u, 'paralisado') || tem(u, 'inconsciente') || (contra && u.cond.fintado && u.cond.fintado.por === contra.id);
  }
  function defesa(st, alvo, atacante, tipo, extras) {
    let v = alvo.defBase + (alvo.buff.defMagia || 0) + (alvo.buff.escudoFe || 0) + (alvo.buff.armaEspiritualDef || 0) + (alvo.buff.baluarte || 0);
    const mods = [];
    if (desprevenido(alvo, atacante)) { v -= 5; mods.push('desprevenido –5'); }
    if (tem(alvo, 'inconsciente') || tem(alvo, 'paralisado')) { v -= 10; mods.push('indefeso –10'); }
    if (tem(alvo, 'vulneravel') || tem(alvo, 'fatigado') || tem(alvo, 'exausto') || tem(alvo, 'enredado')) { v -= 2; mods.push('vulnerável –2'); }
    if (tem(alvo, 'caido')) { if (tipo === 'cac') { v -= 5; mods.push('caído –5'); } else { v += 5; mods.push('caído +5'); } }
    if (alvo.buff.investida) { v -= 2; mods.push('investida –2'); }
    if (extras && extras.cobertura) { v += 5; mods.push('cobertura +5'); }
    return { valor: v, mods };
  }
  function bonusTeste(u) { // bônus/penalidades gerais em testes (ataque incluso)
    let b = 0; const m = [];
    if (u.buff.bencao) { b += u.buff.bencao; m.push('bênção +' + u.buff.bencao); }
    if (u.buff.oracao) { b += u.buff.oracao; m.push((u.buff.oracao > 0 ? 'oração +' : 'oração ') + u.buff.oracao); }
    if (u.buff.perdicao) { b -= u.buff.perdicao; m.push('perdição –' + u.buff.perdicao); }
    if (u.buff.inspiracao) { b += u.buff.inspiracao; m.push('inspiração +' + u.buff.inspiracao); }
    if (tem(u, 'abalado') || tem(u, 'apavorado')) { b -= 2; m.push('medo –2'); }
    return { b, m };
  }
  function bonusAtaqueFisico(u) {
    let b = 0; const m = [];
    if (tem(u, 'ofuscado')) { b -= 2; m.push('ofuscado –2'); }
    if (tem(u, 'fraco') || tem(u, 'fatigado')) { b -= 2; m.push('fraco –2'); }
    if (tem(u, 'exausto')) { b -= 5; m.push('debilitado –5'); }
    if (tem(u, 'enredado')) { b -= 2; m.push('enredado –2'); }
    if (tem(u, 'agarrado')) { b -= 2; m.push('agarrado –2'); }
    return { b, m };
  }
  function resistencia(st, u, teste, cd, ev) {
    if (u.vivo === false) return true;
    let bonus = (u.per[teste] || 0) + (u.buff.baluarte || 0); const g = bonusTeste(u); bonus += g.b;
    if (teste === 'ref' && desprevenido(u)) bonus -= 5;
    if ((teste === 'fort' || teste === 'ref') && (tem(u, 'fraco') || tem(u, 'fatigado'))) bonus -= 2;
    const r = d(st, 20), total = r + bonus, ok = total >= cd; // T20: 1 e 20 naturais não têm efeito especial em testes de resistência
    ev.push({ t: 'resist', id: u.id, teste, r, total, cd, ok });
    return ok;
  }
  function aplicarCond(st, u, cond, rodadas, ev, extra) {
    if (!u.vivo) return;
    if (cond === 'caido' && u.voo) { ev.push({ t: 'texto', id: u.id, txt: 'voando' }); return; }
    const mental = ['abalado', 'apavorado', 'atordoado', 'inconsciente', 'fascinado'];
    if (u.imune && u.imune.includes('mental') && mental.includes(cond)) { ev.push({ t: 'texto', id: u.id, txt: 'imune' }); return; }
    if (u.imune && u.imune.includes('cansaco') && ['fatigado', 'exausto'].includes(cond)) { ev.push({ t: 'texto', id: u.id, txt: 'imune' }); return; }
    if (cond === 'fatigado' && tem(u, 'fatigado')) cond = 'exausto';
    if (cond === 'abalado' && tem(u, 'abalado')) cond = 'apavorado';
    const atual = u.cond[cond];
    u.cond[cond] = Object.assign({ r: Math.max(rodadas, atual ? atual.r : 0) }, extra || {});
    ev.push({ t: 'cond', id: u.id, cond });
    st.log.push(`${u.nome} fica ${NOME_COND[cond] || cond}.`);
  }
  const NOME_COND = { atordoado: 'atordoado', ofuscado: 'ofuscado', abalado: 'abalado', apavorado: 'apavorado', fatigado: 'fatigado', exausto: 'exausto',
    vulneravel: 'vulnerável', fraco: 'fraco', enredado: 'enredado', imovel: 'imóvel', lento: 'lento', caido: 'caído', inconsciente: 'inconsciente',
    emChamas: 'em chamas', desafiado: 'desafiado', cego: 'cego', agarrado: 'agarrado', acido: 'coberto de ácido', paralisado: 'paralisado no gelo', desprevenido: 'desprevenido', sangrando: 'sangrando', fintado: 'desprevenido (finta)' };

  /* ---------- dano e morte ---------- */
  function causarDano(st, alvo, valor, tipo, ev, fonte) {
    if (!alvo.vivo) return 0;
    let v = Math.max(0, valor); const jaCaido = alvo.pv <= 0;
    // Arcano de Batalha: a magia soma o atributo-chave uma vez em cada inimigo atingido
    const arc = st._arcano; if (arc && v > 0 && alvo.lado !== arc.lado && !arc.ja.has(alvo.id)) { arc.ja.add(alvo.id); v += arc.v; }
    if (alvo.rd && tipo !== 'essência' && tipo !== 'luz') v = Math.max(0, v - alvo.rd);
    if (alvo.buff.furia && alvo.nivel >= 1 && tipo !== 'essência') v = Math.max(0, v - (alvo.buff.furiaRd || 0));
    if (alvo.pvTemp > 0 && v > 0) { const t = Math.min(alvo.pvTemp, v); alvo.pvTemp -= t; v -= t; if (t) ev.push({ t: 'texto', id: alvo.id, txt: `–${t} PV temp.` }); }
    alvo.pv -= v;
    ev.push({ t: 'dano', id: alvo.id, v, tipo, pv: alvo.pv });
    if (v > 0 && tem(alvo, 'inconsciente') && alvo.cond.inconsciente.sono) { delete alvo.cond.inconsciente; ev.push({ t: 'texto', id: alvo.id, txt: 'acorda!' }); }
    verificarQueda(st, alvo, ev, v > 0 && jaCaido);
    return v;
  }
  function soltarAgarrao(st, u, ev) {
    if (u.buff.agarrando) { const o = porId(st, u.buff.agarrando); if (o && o.cond.agarrado && o.cond.agarrado.por === u.id) { delete o.cond.agarrado; ev && ev.push({ t: 'fimCond', id: o.id, cond: 'agarrado' }); } delete u.buff.agarrando; }
    if (u.cond.agarrado) { const o = porId(st, u.cond.agarrado.por); if (o) delete o.buff.agarrando; delete u.cond.agarrado; ev && ev.push({ t: 'fimCond', id: u.id, cond: 'agarrado' }); }
  }
  function verificarQueda(st, u, ev, golpeNoCaido) {
    if (!u.vivo || u.pv > 0) return;
    if (st.cfg.run && u.lado === 'h') { // roguelike: 0 PV = desmaia (sem sangrar); dano no desmaiado ou crítico que derruba = morre
      const limite = Math.min(-10, -Math.floor(u.pvMax / 2));
      const motivo = u.pv <= limite ? 'golpe massivo' : golpeNoCaido ? 'golpe no desmaiado' : st._critico ? 'crítico' : null;
      soltarAgarrao(st, u, ev);
      if (motivo) { u.vivo = false; u.cond = {}; ev.push({ t: 'morte', id: u.id }); st.log.push(`☠ ${u.nome} morre (${motivo}).`); return; }
      if (!tem(u, 'inconsciente') || u.cond.inconsciente.sono) { u.cond.inconsciente = { r: 999 }; u.cond.caido = { r: 999 }; ev.push({ t: 'cond', id: u.id, cond: 'inconsciente' }); st.log.push(`${u.nome} desmaia! Se sofrer mais dano, morre.`); }
      return;
    }
    soltarAgarrao(st, u, ev);
    if (u.lado === 'm') { u.vivo = false; u.cond = {}; ev.push({ t: 'morte', id: u.id }); st.log.push(`☠ ${u.nome} cai.`); return; }
    const limite = Math.min(-10, -Math.floor(u.pvMax / 2));
    if (u.pv <= limite) { u.vivo = false; u.cond = {}; if (u.buff.armaEspiritual) { delete u.buff.armaEspiritual; delete u.buff.armaEspiritualDef; st.log.push(`A arma espiritual de ${u.nome} se dissipa.`); } ev.push({ t: 'morte', id: u.id }); st.log.push(`☠ ${u.nome} morre.`); return; }
    if (!tem(u, 'inconsciente') || u.cond.inconsciente.sono) {
      u.cond.inconsciente = { r: 999 }; u.cond.sangrando = { r: 999 }; u.cond.caido = { r: 999 };
      ev.push({ t: 'cond', id: u.id, cond: 'inconsciente' }); st.log.push(`${u.nome} cai inconsciente e sangrando!`);
    }
  }
  function curar(st, u, v, ev) {
    if (!u.vivo) return 0;
    const antes = u.pv; u.pv = Math.min(u.pvMax, u.pv + v);
    ev.push({ t: 'cura', id: u.id, v: u.pv - antes, pv: u.pv });
    if (u.pv > 0 && tem(u, 'inconsciente') && !u.cond.inconsciente.sono) { delete u.cond.inconsciente; delete u.cond.sangrando; ev.push({ t: 'texto', id: u.id, txt: 'de pé!' }); st.log.push(`${u.nome} recobra a consciência.`); }
    return u.pv - antes;
  }

  /* ---------- batalha ---------- */
  function novaBatalha(cfg) {
    const st = { seed: cfg.seed >>> 0 || 12345, mapa: { ...MAPAS[cfg.mapa], id: cfg.mapa }, unidades: [], ordem: [], vez: 0, rodada: 1, log: [], fim: null, teia: [], turnoId: 0, cfg: { ...cfg } };
    cfg.herois.forEach((h, i) => { const u = criarHeroi(h, cfg.nivel, i, cfg.poderes && cfg.poderes[i] || undefined); if (cfg.merc === i) { u.merc = true; u.nome += ' (mercenário)'; } st.unidades.push(u); });
    cfg.inimigos.forEach((m, i) => st.unidades.push(criarCriatura(m, i)));
    posicionarHerois(st);
    posicionar(st, st.unidades.filter(u => u.lado === 'm'), [13, 12, 14, 11, 15]);
    // iniciativa
    const ini = st.unidades.map(u => ({ u, r: d(st, 20) + u.per.inic }));
    ini.sort((a, b) => b.r - a.r || (b.u.per.inic - a.u.per.inic));
    st.ordem = ini.map(o => o.u.id);
    st.iniciativa = Object.fromEntries(ini.map(o => [o.u.id, o.r]));
    st.log.push(`⚔ ${st.mapa.nome}: a batalha começa! Rodada 1.`);
    const ev = []; iniciarTurno(st, ev); st.eventosIniciais = ev;
    return st;
  }
  /* ---------- zona de posicionamento (antes da batalha, estilo FFT) ---------- */
  function zonaHerois(st) {
    const z = st.mapa.zona || { x: [0, 3], y: [3, 8] }; const cel = [];
    for (let y = z.y[0]; y <= z.y[1]; y++) for (let x = z.x[0]; x <= z.x[1]; x++) if (passavel(st, x, y) && terreno(st, x, y) !== 'T') cel.push({ x, y });
    return cel;
  }
  const FRENTE = ['guerreiro', 'barbaro', 'paladino', 'cavaleiro', 'clerigo', 'ladino'];
  function posicionarHerois(st) {
    const zona = zonaHerois(st); const meio = zona.reduce((a, c) => a + c.y, 0) / (zona.length || 1);
    const frente = zona.slice().sort((a, b) => b.x - a.x || Math.abs(a.y - meio) - Math.abs(b.y - meio));
    const herois = st.unidades.filter(u => u.lado === 'h');
    const ordem = herois.filter(u => FRENTE.includes(u.classe)).concat(herois.filter(u => !FRENTE.includes(u.classe)));
    const tras = zona.slice().sort((a, b) => a.x - b.x || Math.abs(a.y - meio) - Math.abs(b.y - meio)); const usadas = new Set(); const k = c => c.x + ',' + c.y;
    for (const u of ordem) {
      const lista = FRENTE.includes(u.classe) ? frente : tras;
      const c = lista.find(c => !usadas.has(k(c)));
      if (c) { usadas.add(k(c)); u.x = c.x; u.y = c.y; } else posicionar(st, [u], [1, 2, 3, 0]);
    }
    st.preparo = true;
  }
  /* troca de lugar durante o preparo: move o herói para uma casa da zona (troca se já houver herói lá) */
  function reposicionar(st, id, x, y) {
    if (!st.preparo) return 'A batalha já começou.';
    const u = porId(st, id); if (!u || u.lado !== 'h') return 'Escolha um herói.';
    if (!zonaHerois(st).some(c => c.x === x && c.y === y)) return 'Fora da zona de posicionamento.';
    const o = unidadeEm(st, x, y); if (o && o.lado !== 'h') return 'Casa ocupada.';
    if (o && o !== u) { o.x = u.x; o.y = u.y; }
    u.x = x; u.y = y; return null;
  }
  function comecar(st) { st.preparo = false; }
  function posicionar(st, lista, colunas) {
    const linhasPref = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10];
    let k = 0;
    for (const u of lista) {
      let ok = false;
      for (const cx of colunas) { for (const ry of linhasPref) {
        const y = linhasPref[(linhasPref.indexOf(ry) + k * 2) % linhasPref.length];
        if (passavel(st, cx, y) && !unidadeEm(st, cx, y) && terreno(st, cx, y) !== 'T') { u.x = cx; u.y = y; ok = true; break; }
      } if (ok) break; }
      if (!ok) for (let y = 0; y < ROWS && !ok; y++) for (const cx of colunas) if (passavel(st, cx, y) && !unidadeEm(st, cx, y)) { u.x = cx; u.y = y; ok = true; break; }
      k++;
    }
  }
  const atual = st => st.unidades.find(u => u.id === st.ordem[st.vez]);
  const porId = (st, id) => st.unidades.find(u => u.id === id);
  const inimigosDe = (st, u) => st.unidades.filter(o => o.vivo && o.lado !== u.lado);
  const aliadosDe = (st, u) => st.unidades.filter(o => o.vivo && o.lado === u.lado);

  function iniciarTurno(st, ev) {
    const u = atual(st); st.turnoId++;
    u.acoes = { padrao: true, movimento: true, extra: !!u.buff.velocidade, moveu: false };
    delete u.buff.investida; delete u.buff.baluarte;
    if (u.buff.armaEspiritual && typeof u.buff.armaEspiritual === 'object') u.buff.armaEspiritual.bloq = false;
    if (u.buff.agarrando) { const o = porId(st, u.buff.agarrando); if (!o || !o.vivo || !adjacente(u, o) || incapaz(u)) soltarAgarrao(st, u, ev); }
    ev.push({ t: 'turno', id: u.id, rodada: st.rodada });
    if (!u.vivo) return pularTurno(st, ev);
    // sangrando
    if (tem(u, 'sangrando')) {
      const r = d(st, 20) + u.attr.con;
      if (r >= 15) { delete u.cond.sangrando; st.log.push(`${u.nome} estabiliza.`); ev.push({ t: 'texto', id: u.id, txt: 'estável' }); }
      else { const p = d(st, 6); u.pv -= p; ev.push({ t: 'dano', id: u.id, v: p, tipo: 'sangue', pv: u.pv }); st.log.push(`${u.nome} sangra (–${p}).`); verificarQueda(st, u, ev); }
    }
    if (tem(u, 'emChamas') && u.vivo) { const n = u.cond.emChamas.dados || [1, 6]; const v = soma(rolar(st, n[0], n[1])); st.log.push(`${u.nome} queima (–${v}).`); causarDano(st, u, v, 'fogo', ev); }
    if (tem(u, 'acido') && u.vivo) { const n = u.cond.acido.dados || [2, 6]; const v = soma(rolar(st, n[0], n[1])); st.log.push(`O ácido corrói ${u.nome} (–${v}).`); causarDano(st, u, v, 'ácido', ev); }
    if (u.sopro && u.sopro.pronto > 0) u.sopro.pronto--;
    if (!u.vivo || incapaz(u) || tem(u, 'atordoado')) {
      if (u.vivo && tem(u, 'atordoado')) { st.log.push(`${u.nome} está atordoado e perde o turno.`); ev.push({ t: 'texto', id: u.id, txt: 'atordoado' }); }
      return encerrarTurno(st, ev, true);
    }
    if (tem(u, 'apavorado')) u.acoes.padrao = false;
    checarFim(st);
  }
  function pularTurno(st, ev) { return encerrarTurno(st, ev, true); }
  function encerrarTurno(st, ev, auto) {
    const u = atual(st);
    // condições com duração terminam no fim do turno de quem as sofre
    if (u) for (const k of Object.keys(u.cond)) { const c = u.cond[k]; if (c.r < 900) { c.r--; if (c.r <= 0) { delete u.cond[k]; ev.push({ t: 'fimCond', id: u.id, cond: k }); } } }
    if (u && u.cond.fintado && u.cond.fintado.turnoFim <= st.turnoId) delete u.cond.fintado;
    checarFim(st); if (st.fim) return;
    // próximo
    let guard = 0;
    do {
      st.vez++; if (st.vez >= st.ordem.length) { st.vez = 0; st.rodada++; st.log.push(`— Rodada ${st.rodada} —`); ev.push({ t: 'rodada', rodada: st.rodada }); }
      guard++;
    } while (!porId(st, st.ordem[st.vez]).vivo && guard < 50);
    iniciarTurno(st, ev);
  }
  function checarFim(st) {
    if (st.fim) return;
    const hOk = st.unidades.some(u => u.lado === 'h' && u.vivo && !incapaz(u));
    const mOk = st.unidades.some(u => u.lado === 'm' && u.vivo && !incapaz(u));
    if (!mOk) { st.fim = 'herois'; st.log.push('🏆 Vitória dos heróis!'); }
    else if (!hOk) { st.fim = 'inimigos'; st.log.push('💀 Os heróis caíram...'); }
  }

  /* ---------- movimento ---------- */
  function alcancaveis(st, u, orcamento) {
    // Dijkstra com diagonal custando 2 e terreno difícil custando o dobro (regra do Resumo)
    const dist0 = {}; const prev = {}; const k = (x, y) => x + ',' + y;
    dist0[k(u.x, u.y)] = 0; const fila = [[0, u.x, u.y]];
    while (fila.length) {
      fila.sort((a, b) => a[0] - b[0]); const [c, x, y] = fila.shift();
      if (c > dist0[k(x, y)]) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        const pass = (a, b) => u.voo ? (terreno(st, a, b) !== null && terreno(st, a, b) !== 'W') : passavel(st, a, b); // quem voa passa por cima de água, pedras e túmulos
        if (!pass(nx, ny)) continue;
        if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue; // não corta quina
        const o = unidadeEm(st, nx, ny); if (o && o.lado !== u.lado && !incapaz(o)) continue;
        let custo = (dx && dy) ? 2 : 1; if (dificil(st, nx, ny) && !(u.voo && !st.teia.some(t => t.x === nx && t.y === ny))) custo *= 2;
        const nc = c + custo; if (nc > orcamento) continue;
        if (dist0[k(nx, ny)] === undefined || nc < dist0[k(nx, ny)]) { dist0[k(nx, ny)] = nc; prev[k(nx, ny)] = [x, y]; fila.push([nc, nx, ny]); }
      }
    }
    const res = [];
    for (const key in dist0) { const [x, y] = key.split(',').map(Number); if (x === u.x && y === u.y) continue; if (unidadeEm(st, x, y)) continue; res.push({ x, y, custo: dist0[key] }); }
    return { celulas: res, caminho: (x, y) => { const p = [[x, y]]; let c = prev[k(x, y)]; while (c) { p.unshift(c); c = prev[k(c[0], c[1])]; } return p; } };
  }
  function podeMover(u) { return (u.acoes.movimento || u.acoes.padrao || u.acoes.extra) && deslocAtual(u) > 0 && !tem(u, 'caido'); }
  function gastar(u, tipo) { // tipo: 'movimento' | 'padrao' | 'completa'
    if (tipo === 'completa') { u.acoes.padrao = false; u.acoes.movimento = false; return true; }
    if (tipo === 'movimento') { if (u.acoes.movimento) { u.acoes.movimento = false; return true; } if (u.acoes.extra) { u.acoes.extra = false; return true; } if (u.acoes.padrao) { u.acoes.padrao = false; return true; } return false; }
    if (tipo === 'padrao') { if (u.acoes.padrao) { u.acoes.padrao = false; return true; } if (u.acoes.extra) { u.acoes.extra = false; u.usouExtraPadrao = true; return true; } return false; }
    if (tipo === 'padraoMagia') { if (u.acoes.padrao) { u.acoes.padrao = false; return true; } return false; }
    return false;
  }

  /* ---------- ataques ---------- */
  function flanqueado(st, atacante, alvo) {
    const ox = alvo.x * 2 - atacante.x, oy = alvo.y * 2 - atacante.y;
    return st.unidades.some(o => o.vivo && o !== atacante && o.lado === atacante.lado && !incapaz(o) && adjacente(o, alvo) && Math.abs(o.x - ox) <= 1 && Math.abs(o.y - oy) <= 1 && dist(o, { x: ox, y: oy }) <= 1 && ((o.x - alvo.x) * (atacante.x - alvo.x) + (o.y - alvo.y) * (atacante.y - alvo.y)) < 0);
  }
  function emCorpoACorpo(st, alvo, exceto) { return st.unidades.some(o => o.vivo && o.lado !== alvo.lado && o !== exceto && !incapaz(o) && adjacente(o, alvo)); }

  function perfisDeAtaque(u, distancia) {
    if (u.lado === 'h') {
      const a = u.arma; if (!!a.distancia !== !!distancia) return null;
      const base = (a.distancia ? u.per.pont : u.per.luta) + a.bonusItem + (a.bonusAtaque || 0);
      const atrD = a.acuidade ? Math.max(u.attr.for, u.attr.des) : u.attr.for;
      const forDano = a.distancia ? 0 : atrD + (a.duasMaos ? Math.floor(atrD / 2) : 0);
      return [{ nome: a.nome, bonus: base, dano: [a.dano[0], a.dano[1], forDano + a.bonusItem + (u.bonusDano || 0)], margem: a.margem, mult: a.mult, tipo: a.tipo, alcance: a.alcance, extra: a.extra || null }];
    }
    if (distancia) return u.distancia ? [{ ...u.distancia }] : null;
    return u.ataques.map(x => ({ ...x, alcance: 1 }));
  }

  function bonusAtaque(st, at, alvo, perfil, ctx) {
    const tipo = ctx.distancia ? 'dist' : 'cac';
    let bonus = perfil.bonus; const mods = [];
    const g = bonusTeste(at); bonus += g.b; mods.push(...g.m);
    const f = bonusAtaqueFisico(at); bonus += f.b; mods.push(...f.m);
    if (!ctx.distancia && tem(at, 'caido')) { bonus -= 5; mods.push('caído –5'); }
    if (!ctx.distancia && flanqueado(st, at, alvo)) { bonus += 2; mods.push('flanco +2'); ctx.flanco = true; }
    if (ctx.investida) { bonus += 2; mods.push('investida +2'); }
    if (ctx.distancia && emCorpoACorpo(st, alvo, at) && !at.tiroPreciso && !(at.habilidades || []).includes('tiroCerteiro')) { bonus -= 5; mods.push('alvo em combate –5'); }
    if (ctx.longe) { bonus -= 5; mods.push('distância –5'); }
    if (ctx.aeAtaque) { bonus += ctx.aeAtaque; mods.push('ataque especial +' + ctx.aeAtaque); }
    if (ctx.golpeDivino) { bonus += at.attr.car; mods.push('golpe divino +' + at.attr.car); }
    if (at.buff.furia && !ctx.distancia) { bonus += at.buff.furia; mods.push('fúria +' + at.buff.furia); }
    if (at.buff.desafio && at.buff.desafio === alvo.id) { bonus += 2; mods.push('desafio +2'); }
    if (at.cond.desafiado && at.cond.desafiado.por !== alvo.id && st.unidades.some(o => o.id === at.cond.desafiado.por && o.vivo && !incapaz(o))) { bonus -= 2; mods.push('desafiado –2'); }
    if (perfil.frenesi && alvo.pv < alvo.pvMax) { bonus += 2; mods.push('frenesi +2'); }
    const pd = at.poderes || {};
    if (pd.valentao && (ctx.flanco || tem(alvo, 'caido') || desprevenido(alvo, at))) { bonus += 2; mods.push('valentão +2'); ctx.valentao = true; }
    if (pd.esgrimaMagica && at.buff.inspiracao && !ctx.distancia) { const g = at.attr.car - Math.max(at.attr.for, at.arma && at.arma.acuidade ? at.attr.des : -9); if (g > 0) { bonus += g; mods.push('esgrima mágica +' + g); } }
    const defo = defesa(st, alvo, at, tipo, { cobertura: ctx.cobertura });
    // Ataque Poderoso: –2 no ataque, +5 no dano, só quando a troca compensa
    if (pd.ataquePoderoso && !ctx.distancia) {
      const ch = b => Math.max(0.05, Math.min(0.95, (21 - (defo.valor - b)) / 20)); const med = perfil.dano[0] * (perfil.dano[1] + 1) / 2 + (perfil.dano[2] || 0);
      if (ch(bonus - 2) * (med + 5) > ch(bonus) * med) { bonus -= 2; mods.push('ataque poderoso –2'); ctx.ap = true; }
    }
    return { bonus, mods, defo };
  }
  // previsão para a interface: chance de acerto e faixa de dano de cada golpe
  function previsaoAtaque(st, at, alvo, opt) {
    opt = opt || {}; const isDist = !!opt.distancia; const perfis = perfisDeAtaque(at, isDist); if (!perfis) return null;
    const ctx = { distancia: isDist, investida: !!opt.investida };
    if (isDist) { const v = visao(st, at, alvo); ctx.cobertura = v.cobertura; if (dist(at, alvo) > perfis[0].alcance) ctx.longe = true; }
    if (opt.aeAtaque) ctx.aeAtaque = 4 * opt.aeAtaque; if (opt.golpeDivino) ctx.golpeDivino = opt.golpeDivino;
    const golpes = opt.ataqueExtra ? [...perfis, ...perfis] : perfis;
    return golpes.map(p => {
      const c = { ...ctx }; const b = bonusAtaque(st, at, alvo, p, c);
      const precisa = b.defo.valor - b.bonus; const chance = Math.max(5, Math.min(95, (21 - precisa) * 5));
      let min = p.dano[0] + (p.dano[2] || 0), max = p.dano[0] * p.dano[1] + (p.dano[2] || 0);
      const fixo = (opt.aeDano ? 4 * opt.aeDano : 0) + (at.buff.furia && !isDist ? at.buff.furia : 0) + (at.buff.bencao || 0) + (at.buff.oracao || 0) + (at.buff.inspiracao || 0) - (at.buff.perdicao || 0) + (c.ap ? 5 : 0) + (c.valentao ? 2 : 0);
      min += fixo; max += fixo;
      if (opt.golpeDivino) { min += opt.golpeDivino; max += ((at.poderes || {}).armaSagrada ? 12 : 8) * opt.golpeDivino; }
      if (p.extra) { min += p.extra[0]; max += p.extra[0] * p.extra[1]; }
      if (at.buff.marca && at.buff.marca.alvo === alvo.id) { min += at.buff.marca.dados[0]; max += at.buff.marca.dados[0] * at.buff.marca.dados[1]; }
      const furt = at.furtivo && (c.flanco || desprevenido(alvo, at)) && (!isDist || dist(at, alvo) <= 6);
      if (furt) { min += at.furtivo[0]; max += at.furtivo[0] * at.furtivo[1]; }
      return { nome: p.nome, bonus: b.bonus, def: b.defo.valor, chance, min: Math.max(1, min), max: Math.max(1, max), margem: p.margem || 20, mult: p.mult || 2, mods: b.mods.concat(b.defo.mods), furtivo: !!furt };
    });
  }
  function rolarAtaque(st, at, alvo, perfil, ctx, ev) {
    const { bonus, mods, defo } = bonusAtaque(st, at, alvo, perfil, ctx);
    const r = d(st, 20), total = r + bonus;
    let acerto = r === 20 || (r !== 1 && total >= defo.valor);
    if (acerto && tem(at, 'cego') && d(st, 100) <= 50) { acerto = false; mods.push('cego: 50% de falha'); }
    const pd = at.poderes || {}; const marcado = at.buff.marca && at.buff.marca.alvo === alvo.id;
    const critico = acerto && r >= (perfil.margem || 20) - (pd.pontoFraco && marcado ? 2 : 0);
    const evA = { t: 'ataque', de: at.id, para: alvo.id, nome: perfil.nome, r, bonus, total, def: defo.valor, acerto, critico, distancia: !!ctx.distancia, oportunidade: !!ctx.oportunidade, mods: mods.concat(defo.mods) };
    ev.push(evA);
    const txtMods = evA.mods.length ? ` [${evA.mods.join(', ')}]` : '';
    if (ctx.oportunidade) st.log.push(`⚡ Ataque de oportunidade de ${at.nome}!`);
    if (!acerto) { st.log.push(`${at.nome} → ${alvo.nome} (${perfil.nome}): ${r}+${bonus}=${total} vs Def ${defo.valor} — errou${r === 1 ? ' (1 natural)' : ''}.${txtMods}`); contraArma(st, at, alvo, ctx, ev); return 0; }
    // dano
    let dados = rolar(st, perfil.dano[0] * (critico ? (perfil.mult || 2) : 1), perfil.dano[1]);
    if (pd.destruidor && !ctx.distancia && at.arma && at.arma.duasMaos) dados = dados.map(v => v <= 2 ? d(st, perfil.dano[1]) : v);
    let dano = soma(dados) + (perfil.dano[2] || 0); const partes = [`${perfil.dano[0]}d${perfil.dano[1]}${critico ? '×' + (perfil.mult || 2) : ''}`];
    if (ctx.ap) { dano += 5; partes.push('+5 ataque poderoso'); }
    if (ctx.valentao) { dano += 2; partes.push('+2 valentão'); }
    // Golpe Poderoso (bárbaro): 1 PM por um dado extra da arma, guardando PM para a fúria
    if (pd.golpePoderoso && !ctx.distancia && at.lado === 'h' && at.pm >= (at.buff.furia ? 1 : 3)) { at.pm -= 1; ev.push({ t: 'pm', id: at.id, v: -1 }); dano += soma(rolar(st, perfil.dano[0], perfil.dano[1])); partes.push(`${perfil.dano[0]}d${perfil.dano[1]} golpe poderoso`); }
    if (ctx.aeDano) { dano += ctx.aeDano; partes.push('+' + ctx.aeDano + ' especial'); }
    if (at.buff.furia && !ctx.distancia) dano += at.buff.furia;
    const gd = bonusTeste(at); const bonusDano = (at.buff.bencao || 0) + (at.buff.oracao || 0) + (at.buff.inspiracao || 0) - (at.buff.perdicao || 0); dano += bonusDano; void gd;
    let extra = 0;
    if (ctx.golpeDivino) { const f = pd.armaSagrada ? 12 : 8; extra += soma(rolar(st, ctx.golpeDivino, f)); partes.push(ctx.golpeDivino + 'd' + f + ' luz'); }
    if (at.buff.inspiracao && !ctx.distancia) {
      if (pd.golpeElemental && at.pm >= 3) { at.pm -= 1; ev.push({ t: 'pm', id: at.id, v: -1 }); extra += d(st, 6); partes.push('1d6 golpe elemental'); }
      if (pd.golpeMagico && (at.pmGanho || 0) < at.nivel) { const g = Math.min(2, at.nivel - (at.pmGanho || 0)); at.pmGanho = (at.pmGanho || 0) + g; at.pm += g; ev.push({ t: 'pm', id: at.id, v: g }); }
    }
    if (at.furtivo && (ctx.flanco || desprevenido(alvo, at)) && (!ctx.distancia || dist(at, alvo) <= 6)) {
      const fx = soma(rolar(st, at.furtivo[0], at.furtivo[1])); extra += fx; partes.push(at.furtivo[0] + 'd6 furtivo'); ev.push({ t: 'texto', id: alvo.id, txt: 'furtivo!' });
    }
    if (at.buff.marca && at.buff.marca.alvo === alvo.id) { const m = at.buff.marca.dados; extra += soma(rolar(st, m[0], m[1])); partes.push(m[0] + 'd' + m[1] + ' marca'); }
    if (perfil.extra) { extra += soma(rolar(st, perfil.extra[0], perfil.extra[1])); partes.push(perfil.extra[0] + 'd' + perfil.extra[1] + ' ' + perfil.extra[2]); }
    dano = Math.max(1, dano + extra);
    st.log.push(`${at.nome} → ${alvo.nome} (${perfil.nome}): ${r}+${bonus}=${total} vs Def ${defo.valor} — ${critico ? 'CRÍTICO! ' : 'acertou: '}${dano} de dano (${partes.join(' + ')}).${txtMods}`);
    st._critico = critico; const real = causarDano(st, alvo, dano, perfil.tipo, ev, at); st._critico = false;
    if (alvo.cond.fintado && alvo.cond.fintado.por === at.id) delete alvo.cond.fintado;
    if (perfil.derrubar && alvo.vivo && !tem(alvo, 'caido') && !alvo.voo) {
      // derrubar: manobra oposta simplificada
      const a = d(st, 20) + perfil.bonus, b = d(st, 20) + Math.max(alvo.per.luta || 0, alvo.per.ref || 0);
      if (a >= b) { alvo.cond.caido = { r: 999 }; ev.push({ t: 'cond', id: alvo.id, cond: 'caido' }); st.log.push(`${alvo.nome} é derrubado!`); }
    }
    if (perfil.veneno && alvo.vivo && !(alvo.tags || []).includes('construto')) {
      const ok = resistencia(st, alvo, 'fort', 10 + Math.floor(at.nd) + 4, ev);
      const v = soma(rolar(st, perfil.veneno[0], perfil.veneno[1])); const vv = ok ? Math.floor(v / 2) : v;
      st.log.push(`Veneno! ${alvo.nome} sofre ${vv}.`); causarDano(st, alvo, vv, 'veneno', ev);
    }
    contraArma(st, at, alvo, ctx, ev);
    return real;
  }


  /* ---------- Arma Espiritual (T20: flutua ao lado do conjurador) ----------
     Reação, 1×/rodada (2× com duas armas): quem ataca o conjurador corpo a corpo sofre 2d6, acertando ou não.
     Aprimoramento "ataque": ação livre, 1×/rodada, acerta automaticamente um alvo em alcance curto;
     se a arma atacar, não contra-ataca até o próximo turno do conjurador. */
  function armaUsosLivres(st, u) {
    const a = u.buff.armaEspiritual; if (!a || typeof a !== 'object') return 0;
    if (a.r !== st.rodada) { a.r = st.rodada; a.n = 0; }
    return (a.duas ? 2 : 1) - a.n;
  }
  function golpeArma(st, u, alvo, ev, txt) {
    const a = u.buff.armaEspiritual; a.n++;
    const v = soma(rolar(st, 2, 6)); st.log.push(`🗡 A arma espiritual de ${u.nome} ${txt} ${alvo.nome} (${v} de ${a.tipo}).`);
    ev.push({ t: 'fx', fx: 'armaEspiritual', de: u.id, para: alvo.id }); causarDano(st, alvo, v, a.tipo, ev);
  }
  function contraArma(st, at, alvo, ctx, ev) {
    const a = alvo.buff.armaEspiritual;
    if (ctx.distancia || !a || !alvo.vivo || !at.vivo || incapaz(alvo) || a.bloq) return;
    if (armaUsosLivres(st, alvo) <= 0) return;
    golpeArma(st, alvo, at, ev, 'contra-ataca');
  }
  function alvosArma(st, u) {
    const a = u.buff.armaEspiritual; if (!a || !a.ataque || armaUsosLivres(st, u) <= 0) return [];
    return inimigosDe(st, u).filter(o => dist(u, o) <= ALCANCE.curto && visao(st, u, o).ve).map(o => o.id);
  }

  /* ---------- opções do turno (para interface e IA) ---------- */
  function opcoes(st) {
    const u = atual(st); if (!u || st.fim) return null;
    const ops = { unidade: u.id, mover: null, atacar: [], distancia: [], investida: [], magias: [], habilidades: [], levantar: false, apagar: false, itens: itensUsaveis(st, u) };
    if (tem(u, 'caido') && (u.acoes.movimento || u.acoes.padrao)) ops.levantar = true;
    if (tem(u, 'emChamas') && (u.acoes.padrao || u.acoes.extra)) ops.apagar = true;
    if (podeMover(u)) ops.mover = alcancaveis(st, u, deslocAtual(u)).celulas;
    const padrao = u.acoes.padrao || u.acoes.extra;
    if (padrao) {
      for (const o of inimigosDe(st, u)) {
        if (adjacente(u, o) && perfisDeAtaque(u, false)) ops.atacar.push(o.id);
        const pd = perfisDeAtaque(u, true);
        if (pd) { const v = visao(st, u, o); const alc = pd[0].alcance; if (v.ve && dist(u, o) <= alc * 2 && dist(u, o) > 0) ops.distancia.push(o.id); }
      }
    }
    if (u.acoes.padrao && u.acoes.movimento && !tem(u, 'caido') && !tem(u, 'lento') && !tem(u, 'enredado') && perfisDeAtaque(u, false)) {
      const alc = alcancaveis(st, u, deslocAtual(u) * 2);
      for (const o of inimigosDe(st, u)) {
        const destinos = alc.celulas.filter(c => adjacente(c, o) && (Math.abs(c.x - u.x) + Math.abs(c.y - u.y)) >= 2);
        if (destinos.length) ops.investida.push(o.id);
      }
    }
    if (u.acoes.padrao && !u.buff.furia) for (const m of u.magias) { const M = MAGIAS[m]; const c = M.custoFixo || CUSTO_CIRCULO[M.circulo]; ops.magias.push({ id: m, custo: c, pode: u.pm >= c }); }
    for (const h of u.habilidades || []) {
      const H = D.HABILIDADES[h];
      if (h === 'furia') ops.habilidades.push({ id: h, pode: !u.buff.furia && u.pm >= 2 });
      if (h === 'curaMaos') ops.habilidades.push({ id: h, pode: (u.acoes.movimento || u.acoes.padrao) && u.pm >= 1 });
      if (h === 'marcaPresa') ops.habilidades.push({ id: h, pode: (u.acoes.movimento || u.acoes.padrao) && u.pm >= 1 });
      if (h === 'fintar') ops.habilidades.push({ id: h, pode: padrao });
      if (h === 'baluarte') ops.habilidades.push({ id: h, pode: !u.buff.baluarte && u.pm >= 1 });
      if (h === 'desafio') ops.habilidades.push({ id: h, pode: (u.acoes.movimento || u.acoes.padrao) && u.pm >= 1 && !u.buff.desafio });
      if (h === 'inspiracao') ops.habilidades.push({ id: h, pode: padrao && u.pm >= 2 && !u.buff.inspirou });
      void H;
    }
    ops.manobras = padrao && perfisDeAtaque(u, false) ? inimigosDe(st, u).filter(o => adjacente(u, o) && !incapaz(o)).map(o => o.id) : [];
    ops.armaEspiritual = alvosArma(st, u);
    ops.escapar = !!u.cond.agarrado && padrao; ops.soltar = !!u.buff.agarrando;
    if (u.sopro && u.sopro.pronto === 0 && u.acoes.padrao) ops.habilidades.push({ id: 'sopro', pode: true });
    return ops;
  }

  /* ---------- custo de magia ---------- */
  function custoMagia(u, mid, aprim) {
    const M = MAGIAS[mid]; let c = M.custoFixo || CUSTO_CIRCULO[M.circulo]; const erros = [];
    if (u.focoMagia && u.focoMagia.includes(mid)) c = Math.max(1, c - 1);
    for (const a of M.aprim || []) { const n = aprim && aprim[a.id] || 0; if (!n) continue; if (a.circulo && a.circulo > u.circulo) erros.push(`${a.nome} exige ${a.circulo}º círculo`); c += a.custo * n; }
    if (u.lado === 'h' && c > u.nivel) erros.push(`limite de PM por magia é ${u.nivel} (seu nível)`);
    if (c > u.pm) erros.push('PM insuficiente');
    return { custo: c, erros };
  }
  function alcanceMagia(M) { return typeof M.alcance === 'number' ? M.alcance : ALCANCE[M.alcance]; }

  /* área afetada: ponto = célula clicada */
  function areaMagia(st, u, mid, ponto, aprim) {
    const M = MAGIAS[mid]; const cel = [];
    if (M.forma === 'esfera') {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (distEuc({ x, y }, ponto) <= M.tamanho + 0.25 && visao(st, ponto, { x, y }).ve) cel.push({ x, y });
    } else if (M.forma === 'cubo') {
      const h = Math.floor(M.tamanho / 2);
      for (let y = ponto.y - h; y < ponto.y - h + M.tamanho; y++) for (let x = ponto.x - h; x < ponto.x - h + M.tamanho; x++) if (terreno(st, x, y) !== null) cel.push({ x, y });
    } else if (M.forma === 'cone') {
      const ang = Math.atan2(ponto.y - u.y, ponto.x - u.x);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (x === u.x && y === u.y) continue; const dd = distEuc(u, { x, y }); if (dd > M.tamanho + 0.5) continue;
        let da = Math.abs(Math.atan2(y - u.y, x - u.x) - ang); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da <= 0.56 + 0.2 / dd && visao(st, u, { x, y }).ve) cel.push({ x, y });
      }
    } else if (M.forma === 'linha') {
      const dx = ponto.x - u.x, dy = ponto.y - u.y, L = Math.hypot(dx, dy) || 1;
      const fx = Math.round(u.x + dx / L * M.tamanho), fy = Math.round(u.y + dy / L * M.tamanho);
      for (const c of linhaCelulas(u.x, u.y, fx, fy).slice(1)) { if (terreno(st, c.x, c.y) === null || terreno(st, c.x, c.y) === 'W') break; cel.push(c); }
    } else if (M.forma === 'auraAliados' || M.forma === 'auraInimigos' || M.forma === 'auraTodos') {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (dist(u, { x, y }) <= ALCANCE.curto) cel.push({ x, y });
    } else if (mid === 'toqueChocante' && aprim && aprim.area) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!(x === u.x && y === u.y) && distEuc(u, { x, y }) <= 4.25) cel.push({ x, y });
    }
    return cel;
  }
  function alvosValidosMagia(st, u, mid, aprim) {
    const M = MAGIAS[mid]; const alc = alcanceMagia(M);
    if (M.forma === 'si') return [u.id];
    if (M.forma !== 'alvo') return null; // área
    const lista = [];
    for (const o of st.unidades) {
      if (!o.vivo) continue;
      const alcance = (mid === 'curarFerimentos' && aprim && aprim.curto) ? ALCANCE.curto : alc;
      if (dist(u, o) > alcance) continue; if (alcance > 1 && !visao(st, u, o).ve) continue;
      if (M.alvos === 'inimigo' && o.lado === u.lado) continue;
      if (M.alvos === 'aliado' && o.lado !== u.lado) continue;
      if (alcance === 1 && o !== u && !adjacente(u, o)) continue;
      lista.push(o.id);
    }
    return lista;
  }

  /* ---------- execução ---------- */
  function executar(st, acao) {
    const u = atual(st); const ev = [];
    if (!u || st.fim) return { ok: false, erro: 'Batalha encerrada', ev };
    const falha = e => ({ ok: false, erro: e, ev: [] });
    switch (acao.tipo) {
      case 'mover': {
        if (!podeMover(u)) return falha('Sem ação de movimento.');
        const alc = alcancaveis(st, u, deslocAtual(u)); const c = alc.celulas.find(c => c.x === acao.x && c.y === acao.y);
        if (!c) return falha('Fora do alcance de movimento.');
        gastar(u, 'movimento'); const path = alc.caminho(c.x, c.y);
        percorrer(st, u, path, ev, false); u.acoes.moveu = true;
        break;
      }
      case 'levantar': {
        if (!tem(u, 'caido')) return falha('Não está caído.'); if (!gastar(u, 'movimento')) return falha('Sem ação.');
        delete u.cond.caido; ev.push({ t: 'texto', id: u.id, txt: 'levanta' }); st.log.push(`${u.nome} se levanta.`); break;
      }
      case 'apagar': {
        if (!gastar(u, 'padrao')) return falha('Sem ação padrão.'); delete u.cond.emChamas; ev.push({ t: 'texto', id: u.id, txt: 'apagou' }); st.log.push(`${u.nome} apaga as chamas.`); break;
      }
      case 'atacar': case 'distancia': {
        const alvo = porId(st, acao.alvo); if (!alvo || !alvo.vivo) return falha('Alvo inválido.');
        const isDist = acao.tipo === 'distancia';
        const perfis = perfisDeAtaque(u, isDist); if (!perfis) return falha('Sem arma para isso.');
        if (!isDist && !adjacente(u, alvo)) return falha('Alvo não está adjacente.');
        const ctx = { distancia: isDist };
        if (isDist) { const v = visao(st, u, alvo); if (!v.ve) return falha('Sem linha de visão.'); ctx.cobertura = v.cobertura; if (dist(u, alvo) > perfis[0].alcance) ctx.longe = true; if (dist(u, alvo) > perfis[0].alcance * 2) return falha('Longe demais.'); }
        // modificadores pagos
        let custo = 0; const m = acao.mods || {};
        if (m.aeAtaque && u.habilidades.includes('ataqueEspecial')) { ctx.aeAtaque = 4 * m.aeAtaque; custo += m.aeAtaque; }
        if (m.aeDano && u.habilidades.includes('ataqueEspecial')) { ctx.aeDano = 4 * m.aeDano; custo += m.aeDano; }
        if (m.golpeDivino && u.habilidades.includes('golpeDivino')) { ctx.golpeDivino = m.golpeDivino; custo += 2 + (m.golpeDivino - 1); }
        const extraAtk = m.ataqueExtra && u.habilidades.includes('ataqueExtra'); if (extraAtk) custo += 2;
        if (u.lado === 'h' && custo > u.nivel) return falha(`Limite de PM por ação é ${u.nivel}.`);
        if (custo > u.pm) return falha('PM insuficiente.');
        if (!gastar(u, 'padrao')) return falha('Sem ação padrão.');
        u.pm -= custo; if (custo) ev.push({ t: 'pm', id: u.id, v: -custo });
        const golpes = extraAtk ? [...perfis, ...perfis] : perfis;
        for (const p of golpes) { if (!alvo.vivo) break; rolarAtaque(st, u, alvo, p, { ...ctx }, ev); }
        break;
      }
      case 'investida': {
        const alvo = porId(st, acao.alvo); if (!alvo) return falha('Alvo inválido.');
        if (!(u.acoes.padrao && u.acoes.movimento)) return falha('Investida é ação completa.');
        const alc = alcancaveis(st, u, deslocAtual(u) * 2);
        let dest = acao.x !== undefined ? alc.celulas.find(c => c.x === acao.x && c.y === acao.y) : null;
        if (!dest) { const cand = alc.celulas.filter(c => adjacente(c, alvo)).sort((a, b) => a.custo - b.custo); dest = cand[0]; }
        if (!dest || !adjacente(dest, alvo)) return falha('Não alcança o alvo.');
        gastar(u, 'completa'); const path = alc.caminho(dest.x, dest.y);
        st.log.push(`${u.nome} faz uma investida!`); u.buff.investida = true;
        if (!percorrer(st, u, path, ev, true)) break;
        const perfis = perfisDeAtaque(u, false); for (const p of perfis) { if (!alvo.vivo) break; rolarAtaque(st, u, alvo, p, { investida: true }, ev); }
        break;
      }
      case 'manobra': { const r = manobra(st, u, acao, ev); if (r) return falha(r); break; }
      case 'armaEspiritual': {
        const alvo = porId(st, acao.alvo); if (!alvosArma(st, u).includes(acao.alvo)) return falha('A arma não alcança esse alvo (ou já agiu nesta rodada).');
        golpeArma(st, u, alvo, ev, 'golpeia'); u.buff.armaEspiritual.bloq = true; break;
      }
      case 'soltar': { if (!u.buff.agarrando) return falha('Não está agarrando ninguém.'); st.log.push(`${u.nome} solta o alvo.`); soltarAgarrao(st, u, ev); break; }
      case 'magia': { const r = lancarMagia(st, u, acao, ev); if (r) return falha(r); break; }
      case 'habilidade': { const r = usarHabilidade(st, u, acao, ev); if (r) return falha(r); break; }
      case 'item': { const r = usarItem(st, u, acao, ev); if (r) return falha(r); break; }
      case 'fim': encerrarTurno(st, ev); return { ok: true, ev };
      default: return falha('Ação desconhecida.');
    }
    checarFim(st);
    // fim automático do turno quando não resta nada
    if (!st.fim && !u.acoes.padrao && !u.acoes.movimento && !u.acoes.extra && !alvosArma(st, u).length) { encerrarTurno(st, ev, true); }
    else if (!st.fim && (!u.vivo || incapaz(u))) encerrarTurno(st, ev, true);
    return { ok: true, ev };
  }

  /* ---------- itens do cinto (modo roguelike) ---------- */
  const ITENS_CINTO = {
    pocao: { nome: 'Poção de Curar Ferimentos', acao: 'padrao', cura: [2, 8, 2] },
    pocaoMaior: { nome: 'Poção maior', acao: 'padrao', cura: [4, 8, 4] },
    oleo: { nome: 'Óleo de Arma Mágica', acao: 'movimento', proprio: true },
    protecao: { nome: 'Proteção Divina', acao: 'movimento', proprio: true },
    velocidade: { nome: 'Poção de Velocidade', acao: 'movimento', proprio: true },
    granada: { nome: 'Granada de Bola de Fogo', acao: 'padrao', area: [6, 6], cd: 15 },
  };
  function itensUsaveis(st, u) {
    if (!u.cinto) return [];
    return u.cinto.map((id, k) => {
      const I = id && ITENS_CINTO[id]; if (!I) return null;
      const pode = I.acao === 'padrao' ? (u.acoes.padrao || u.acoes.extra) : (u.acoes.movimento || u.acoes.padrao || u.acoes.extra);
      let alvos = [];
      if (I.cura) alvos = st.unidades.filter(o => o.vivo && o.lado === u.lado && (o === u || adjacente(u, o)) && o.pv < o.pvMax).map(o => o.id);
      else if (I.area) alvos = inimigosDe(st, u).filter(o => dist(u, o) <= ALCANCE.medio && visao(st, u, o).ve).map(o => o.id);
      else if (id === 'oleo') alvos = u.buff.oleo ? [] : [u.id];
      else if (id === 'protecao') alvos = u.buff.protecao ? [] : [u.id];
      else if (id === 'velocidade') alvos = u.buff.velocidade ? [] : [u.id];
      return { k, id, nome: I.nome, acao: I.acao, alvos, pode: pode && alvos.length > 0, proprio: !!I.proprio };
    }).filter(Boolean);
  }
  function usarItem(st, u, acao, ev) {
    const it = itensUsaveis(st, u).find(x => x.k === acao.slot); if (!it) return 'Item indisponível.';
    if (!it.pode) return 'Sem ação ou sem alvo para esse item.';
    const alvoId = acao.alvo || (it.proprio ? u.id : null); if (!it.alvos.includes(alvoId)) return 'Alvo inválido para o item.';
    const alvo = porId(st, alvoId); const I = ITENS_CINTO[it.id];
    if (!gastar(u, I.acao === 'padrao' ? 'padrao' : 'movimento')) return 'Sem ação.';
    u.cinto[it.k] = null; ev.push({ t: 'item', id: u.id, item: it.id, alvo: alvo.id });
    if (I.cura) { const v = soma(rolar(st, I.cura[0], I.cura[1])) + I.cura[2]; st.log.push(`🧪 ${u.nome} ${alvo === u ? 'bebe' : 'dá a ' + alvo.nome} ${I.nome} (+${v} PV).`); ev.push({ t: 'fx', fx: 'cura', de: u.id, para: alvo.id }); curar(st, alvo, v, ev); }
    else if (it.id === 'oleo') { u.buff.oleo = 1; u.arma.bonusAtaque = (u.arma.bonusAtaque || 0) + 1; u.bonusDano = (u.bonusDano || 0) + 1; ev.push({ t: 'texto', id: u.id, txt: '+1 arma' }); st.log.push(`🫙 ${u.nome} passa óleo na arma (+1 ataque e dano).`); }
    else if (it.id === 'protecao') { u.buff.protecao = 2; u.per.fort += 2; u.per.ref += 2; u.per.von += 2; ev.push({ t: 'texto', id: u.id, txt: '+2 resist.' }); st.log.push(`✨ ${u.nome} bebe Proteção Divina (+2 em resistências).`); }
    else if (it.id === 'velocidade') { u.buff.velocidade = true; u.acoes.extra = true; ev.push({ t: 'texto', id: u.id, txt: 'acelerado!' }); st.log.push(`⚡ ${u.nome} bebe Velocidade: ação extra por turno.`); }
    else if (I.area) {
      const alvos = st.unidades.filter(o => o.vivo && dist(o, alvo) <= 1);
      const cel = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (terreno(st, alvo.x + dx, alvo.y + dy) !== null) cel.push({ x: alvo.x + dx, y: alvo.y + dy });
      ev.push({ t: 'magia', id: u.id, magia: 'bolaDeFogo', fx: 'fogo', cor: '#ff7a2a', celulas: cel, alvos: alvos.map(a => a.id), ponto: { x: alvo.x, y: alvo.y } });
      st.log.push(`💣 ${u.nome} arremessa uma granada de bola de fogo!`); const v = soma(rolar(st, I.area[0], I.area[1])); const antes = new Map(alvos.map(o => [o, o.pv]));
      for (const o of alvos) { const ok = resistencia(st, o, 'ref', I.cd, ev); let vv = ok ? Math.floor(v / 2) : v; if (ok && o.habilidades && o.habilidades.includes('evasao')) vv = 0; causarDano(st, o, vv, 'fogo', ev); }
      resumoPV(st, antes);
    }
    return null;
  }

  /* Percorre um caminho casa a casa. Com a regra opcional de ataque de oportunidade, sair
     de uma casa adjacente a um inimigo provoca um ataque dele (um por rodada). Devolve false se caiu no meio. */
  function percorrer(st, u, path, ev, investida) {
    if (!st.cfg.oportunidade) { const f = path[path.length - 1]; u.x = f[0]; u.y = f[1]; ev.push({ t: 'mover', id: u.id, caminho: path, investida }); return true; }
    let ini = 0;
    for (let i = 1; i < path.length; i++) {
      const de = { x: path[i - 1][0], y: path[i - 1][1] }, para = { x: path[i][0], y: path[i][1] };
      const provocam = st.unidades.filter(o => o.vivo && o.lado !== u.lado && !incapaz(o) && o.reacao !== st.rodada && adjacente(o, de) && !adjacente(o, para) && perfisDeAtaque(o, false));
      if (!provocam.length) continue;
      u.x = de.x; u.y = de.y; if (i - 1 > ini) ev.push({ t: 'mover', id: u.id, caminho: path.slice(ini, i), investida });
      ini = i - 1;
      for (const o of provocam) { o.reacao = st.rodada; rolarAtaque(st, o, u, perfisDeAtaque(o, false)[0], { oportunidade: true }, ev); if (!u.vivo || incapaz(u)) return false; }
    }
    const f = path[path.length - 1]; u.x = f[0]; u.y = f[1];
    if (path.length - 1 > ini) ev.push({ t: 'mover', id: u.id, caminho: path.slice(ini), investida });
    return true;
  }
  // Manobras de combate: teste de Luta oposto (criatura grande +5)
  function testeManobra(st, at, alvo, defesaTeste) {
    const a = d(st, 20) + (at.per.luta || 0) + (at.grande ? 5 : 0) + bonusTeste(at).b;
    const b = d(st, 20) + Math.max(alvo.per.luta || 0, defesaTeste === 'ref' ? alvo.per.ref || 0 : 0) + (alvo.grande ? 5 : 0) + bonusTeste(alvo).b + (alvo.buff.baluarte || 0);
    return { a, b, ok: a > b };
  }
  function manobra(st, u, acao, ev) {
    const tipo = acao.manobra; const alvo = porId(st, acao.alvo);
    if (tipo === 'escapar') {
      if (!u.cond.agarrado) return 'Você não está agarrado.'; if (!gastar(u, 'padrao')) return 'Sem ação padrão.';
      const o = porId(st, u.cond.agarrado.por); const t = testeManobra(st, u, o, 'ref');
      ev.push({ t: 'manobra', de: u.id, para: o.id, manobra: 'escapar', a: t.a, b: t.b, ok: t.ok });
      st.log.push(`🤼 ${u.nome} tenta escapar de ${o.nome} (${t.a} vs ${t.b}): ${t.ok ? 'conseguiu!' : 'falhou.'}`);
      if (t.ok) soltarAgarrao(st, u, ev); return null;
    }
    if (!alvo || !alvo.vivo || alvo.lado === u.lado) return 'Escolha um inimigo.'; if (!adjacente(u, alvo)) return 'O alvo precisa estar adjacente.';
    if (!perfisDeAtaque(u, false)) return 'Precisa de uma arma corpo a corpo.';
    if (tipo === 'derrubar' && alvo.voo) return 'Não dá para derrubar quem está voando.';
    if (tipo === 'derrubar' && tem(alvo, 'caido')) return 'O alvo já está caído.';
    if (tipo === 'agarrar' && u.buff.agarrando) return 'Você já está agarrando alguém.';
    if (!['agarrar', 'empurrar', 'derrubar'].includes(tipo)) return 'Manobra desconhecida.';
    if (!gastar(u, 'padrao')) return 'Sem ação padrão.';
    const t = testeManobra(st, u, alvo); const nome = { agarrar: 'agarrar', empurrar: 'empurrar', derrubar: 'derrubar' }[tipo];
    ev.push({ t: 'manobra', de: u.id, para: alvo.id, manobra: tipo, a: t.a, b: t.b, ok: t.ok });
    st.log.push(`🤼 ${u.nome} tenta ${nome} ${alvo.nome} (${t.a} vs ${t.b}): ${t.ok ? 'conseguiu!' : 'falhou.'}`);
    if (!t.ok) return null;
    if (tipo === 'derrubar') aplicarCond(st, alvo, 'caido', 999, ev);
    if (tipo === 'agarrar') { soltarAgarrao(st, alvo, ev); alvo.cond.agarrado = { r: 999, por: u.id }; u.buff.agarrando = alvo.id; ev.push({ t: 'cond', id: alvo.id, cond: 'agarrado' }); }
    if (tipo === 'empurrar') {
      const casas = 1 + Math.floor((t.a - t.b) / 5); const sx = Math.sign(alvo.x - u.x), sy = Math.sign(alvo.y - u.y); const cam = [[alvo.x, alvo.y]];
      for (let k = 0; k < casas; k++) { const nx = alvo.x + sx, ny = alvo.y + sy; if (!(alvo.voo ? terreno(st, nx, ny) !== null && terreno(st, nx, ny) !== 'W' : passavel(st, nx, ny)) || unidadeEm(st, nx, ny)) break; alvo.x = nx; alvo.y = ny; cam.push([nx, ny]); }
      if (cam.length > 1) { soltarAgarrao(st, alvo, ev); ev.push({ t: 'mover', id: alvo.id, caminho: cam, empurrao: true }); st.log.push(`${alvo.nome} é empurrado ${(cam.length - 1) * 1.5} m.`); }
      else st.log.push(`${alvo.nome} não tem para onde ir.`);
    }
    return null;
  }
  function lancarMagia(st, u, acao, ev) {
    const M = MAGIAS[acao.magia]; if (!M || !u.magias.includes(acao.magia)) return 'Magia desconhecida.';
    if (u.buff.furia) return 'Não pode lançar magias em fúria.';
    if (!u.acoes.padrao) return 'Sem ação padrão (Velocidade não serve para magias).';
    const aprim = acao.aprim || {}; const cm = custoMagia(u, acao.magia, aprim); if (cm.erros.length) return cm.erros[0];
    // alvo / área
    let alvos = []; let cel = null;
    if (M.forma === 'alvo' || M.forma === 'si') {
      const validos = alvosValidosMagia(st, u, acao.magia, aprim);
      if (acao.magia === 'toqueChocante' && aprim.area) { cel = areaMagia(st, u, acao.magia, u, aprim); }
      else if (M.forma === 'si') alvos = [u];
      else {
        const lista = acao.alvos || [acao.alvo];
        for (const id of lista) if (!validos.includes(id)) return 'Alvo fora de alcance ou inválido.';
        alvos = lista.map(id => porId(st, id));
      }
    } else {
      const p = acao.ponto || { x: u.x, y: u.y };
      if (['esfera', 'cubo'].includes(M.forma) && (dist(u, p) > alcanceMagia(M) || !visao(st, u, p).ve)) return 'Ponto fora de alcance.';
      cel = areaMagia(st, u, acao.magia, p, aprim);
    }
    if (cel) {
      alvos = st.unidades.filter(o => o.vivo && cel.some(c => c.x === o.x && c.y === o.y));
      if (M.forma === 'auraAliados') alvos = alvos.filter(o => o.lado === u.lado);
      if (M.forma === 'auraInimigos') alvos = alvos.filter(o => o.lado !== u.lado);
      if (M.aliadosApenas) alvos = alvos.filter(o => o.lado === u.lado);
    }
    gastar(u, 'padraoMagia'); u.pm -= cm.custo; ev.push({ t: 'pm', id: u.id, v: -cm.custo });
    const aprTxt = Object.entries(aprim).filter(([, n]) => n).map(([k, n]) => { const a = M.aprim.find(x => x.id === k); return a ? a.nome + (n > 1 ? ' ×' + n : '') : k; });
    st.log.push(`✨ ${u.nome} lança ${M.nome} (${cm.custo} PM${aprTxt.length ? '; ' + aprTxt.join(', ') : ''}).`);
    ev.push({ t: 'magia', id: u.id, magia: acao.magia, fx: M.fx, cor: M.cor, alvos: alvos.map(a => a.id), celulas: cel, ponto: acao.ponto || null });
    const cd = u.cd + ((u.poderes || {}).arteMagica && u.buff.inspiracao ? 2 : 0);
    const n = k => aprim[k] || 0;
    const res = (o, teste) => resistencia(st, o, teste, cd - (teste === 'fort' && acao.magia === 'toqueChocante' && o.lado === 'h' && ['guerreiro', 'paladino', 'clerigo'].includes(o.classe) ? 5 : 0), ev);
    const ndOk = (o, base) => { let lim = base; if (n('nd5')) lim = 5; if (n('nd10')) lim = 10; return (o.lado === 'h' ? o.nivel : o.nd) <= lim; };
    const morto = o => (o.tags || []).includes('morto-vivo');
    const danoArea = (o, valor, tipo, efeito, teste) => {
      const ok = res(o, teste); let v = valor;
      if (ok) { if (efeito === 'metade') v = Math.floor(v / 2); if (o.habilidades && o.habilidades.includes('evasao') && teste === 'ref') { v = 0; ev.push({ t: 'texto', id: o.id, txt: 'evasão' }); } }
      causarDano(st, o, v, tipo, ev); return ok;
    };
    const antes = new Map(st.unidades.map(o => [o, o.pv]));
    if (u.arcanoBatalha) st._arcano = { lado: u.lado, v: u.arcanoBatalha, ja: new Set() };
    try { efeitoMagia(st, u, acao, alvos, cel, n, res, ndOk, morto, danoArea, ev); } finally { st._arcano = null; }
    resumoPV(st, antes);
    return null;
  }
  function resumoPV(st, antes) {
    const partes = [];
    for (const [o, pv] of antes) { if (o.pv === pv) continue; const dlt = o.pv - pv; partes.push(`${o.nome} ${dlt < 0 ? '–' + (-dlt) : '+' + dlt}${!o.vivo ? ' ☠' : o.pv <= 0 ? ' (caído)' : ''}`); }
    if (partes.length) st.log.push('   ' + partes.join(' · '));
  }
  function efeitoMagia(st, u, acao, alvos, cel, n, res, ndOk, morto, danoArea, ev) {
    const M = MAGIAS[acao.magia];
    switch (acao.magia) {
      case 'setaInfalivel': case 'setaMilicia': {
        if (acao.magia === 'setaMilicia') { const v = soma(rolar(st, 3, 8)) + 6; causarDano(st, alvos[0], v, 'essência', ev); break; }
        const qt = n('cinco') ? 5 : n('tres') ? 3 : 2; const dado = n('lancas') ? [1, 8] : [1, 4];
        const lista = acao.alvos && acao.alvos.length ? acao.alvos.map(id => porId(st, id)) : [alvos[0]];
        for (let i = 0; i < qt; i++) { const o = lista[i % lista.length]; if (!o.vivo) continue; ev.push({ t: 'fx', fx: 'seta', de: u.id, para: o.id, cor: M.cor }); causarDano(st, o, soma(rolar(st, dado[0], dado[1])) + 1, 'essência', ev); }
        break;
      }
      case 'explosaoChamas': { const v = soma(rolar(st, 2 + n('dano'), 6)); for (const o of alvos) { const ok = danoArea(o, v, 'fogo', 'metade', 'ref'); if (!ok && n('chamas') && o.vivo) aplicarCond(st, o, 'emChamas', 999, ev); } break; }
      case 'bolaDeFogo': { const v = soma(rolar(st, 6 + 2 * n('dano'), 6)); for (const o of alvos) danoArea(o, v, 'fogo', 'metade', 'ref'); break; }
      case 'relampago': { const v = soma(rolar(st, 6 + 2 * n('dano'), 6)); for (const o of alvos) danoArea(o, v, 'eletricidade', 'metade', 'ref'); break; }
      case 'raioSolar': {
        for (const o of alvos) {
          if (n('cura') && o.lado === u.lado) { curar(st, o, soma(rolar(st, 4, 8)), ev); continue; }
          const v = soma(rolar(st, 4 + n('dano'), morto(o) ? 12 : 8)); const ok = danoArea(o, v, 'luz', 'metade', 'ref'); if (!ok && o.vivo) aplicarCond(st, o, 'ofuscado', 1, ev);
        } break;
      }
      case 'armaduraArcana': u.buff.defMagia = 4 + n('mais'); ev.push({ t: 'texto', id: u.id, txt: '+' + u.buff.defMagia + ' Def' }); break;
      case 'escudoDaFe': alvos[0].buff.escudoFe = 2 + n('mais'); ev.push({ t: 'texto', id: alvos[0].id, txt: '+' + alvos[0].buff.escudoFe + ' Def' }); break;
      case 'armaEspiritual': {
        u.buff.armaEspiritual = { ataque: !!n('ataque'), duas: !!n('duas'), tipo: n('essencia') ? 'essência' : 'impacto', r: 0, n: 0, bloq: false };
        const def = (n('def') ? 1 : 0) + n('def2'); if (def) u.buff.armaEspiritualDef = def; else delete u.buff.armaEspiritualDef;
        ev.push({ t: 'texto', id: u.id, txt: n('duas') ? 'duas armas espirituais' : 'arma espiritual' }); break;
      }
      case 'sono': {
        const o = alvos[0]; if (!ndOk(o, 2) || (o.imune || []).includes('sono')) { ev.push({ t: 'texto', id: o.id, txt: 'não afeta' }); st.log.push(`${o.nome} não é afetado (ND alto ou imune).`); break; }
        if (res(o, 'von')) aplicarCond(st, o, 'fatigado', 1, ev); else { o.cond.inconsciente = { r: 999, sono: true }; o.cond.caido = { r: 999 }; ev.push({ t: 'cond', id: o.id, cond: 'inconsciente' }); st.log.push(`${o.nome} adormece.`); }
        break;
      }
      case 'teia': {
        for (const c of cel) if (passavel(st, c.x, c.y) && !st.teia.some(t => t.x === c.x && t.y === c.y)) st.teia.push({ x: c.x, y: c.y });
        for (const o of alvos) if (!res(o, 'ref')) { aplicarCond(st, o, 'enredado', 999, ev); if (n('imovel')) aplicarCond(st, o, 'imovel', 2, ev); }
        ev.push({ t: 'teia' }); break;
      }
      case 'leque': {
        for (const o of alvos) { if (!ndOk(o, 2)) { ev.push({ t: 'texto', id: o.id, txt: 'não afeta' }); continue; } const ok = res(o, 'von'); aplicarCond(st, o, 'ofuscado', ok ? 1 : 2, ev); if (!ok) aplicarCond(st, o, 'atordoado', 1, ev); }
        break;
      }
      case 'toqueChocante': {
        const v = soma(rolar(st, 2 + n('dano'), 8)) + 2 + n('dano');
        for (const o of alvos) { if (o === u) continue; danoArea(o, v, 'eletricidade', 'metade', 'fort'); } break;
      }
      case 'raioEnfraquecimento': { const o = alvos[0]; const ok = res(o, 'fort'); if (n('exausto')) aplicarCond(st, o, ok ? 'fatigado' : 'exausto', 999, ev); else aplicarCond(st, o, ok ? 'vulneravel' : 'fatigado', 999, ev); break; }
      case 'despedacar': { const o = alvos[0]; let v = soma(rolar(st, 1 + n('dano'), 8)) + 2 + 2 * n('dano'); if ((o.tags || []).includes('construto')) v *= 2; const ok = res(o, 'fort'); causarDano(st, o, ok ? Math.floor(v / 2) : v, 'impacto', ev); if (!ok && o.vivo) aplicarCond(st, o, 'atordoado', 1, ev); break; }
      case 'amedrontar': { const o = alvos[0]; if (!ndOk(o, 2) || !['humanoide', 'animal'].includes((o.tags || [])[0])) { ev.push({ t: 'texto', id: o.id, txt: 'não afeta' }); st.log.push(`${o.nome} não é afetado (ND alto ou tipo imune).`); break; } const ok = res(o, 'von'); aplicarCond(st, o, ok ? 'abalado' : 'apavorado', ok ? 2 : 2, ev); break; }
      case 'curarFerimentos': {
        const o = alvos[0]; const v = soma(rolar(st, 2 + n('mais'), 8)) + 2 + n('mais');
        if (morto(o)) { const ok = res(o, 'von'); causarDano(st, o, ok ? Math.floor(v / 2) : v, 'luz', ev); } else curar(st, o, v, ev);
        break;
      }
      case 'infligirFerimentos': {
        const o = alvos[0]; const v = soma(rolar(st, 2 + n('dano'), 8)) + 2 + n('dano');
        if (morto(o)) { curar(st, o, v, ev); break; } const ok = res(o, 'fort'); causarDano(st, o, ok ? Math.floor(v / 2) : v, 'trevas', ev); if (!ok && n('fraco') && o.vivo) aplicarCond(st, o, 'fraco', 999, ev); break;
      }
      case 'bencao': for (const o of alvos) { o.buff.bencao = Math.max(o.buff.bencao || 0, 1 + n('mais')); ev.push({ t: 'texto', id: o.id, txt: 'abençoado' }); } break;
      case 'perdicao': for (const o of alvos) { if ((o.imune || []).includes('mental')) continue; o.buff.perdicao = Math.max(o.buff.perdicao || 0, 1 + n('mais')); ev.push({ t: 'texto', id: o.id, txt: 'amaldiçoado' }); } break;
      case 'oracao': for (const o of alvos) { const b = 2 + n('mais'); if (o.lado === u.lado) o.buff.oracao = b; else o.buff.oracao = -b; ev.push({ t: 'texto', id: o.id, txt: o.lado === u.lado ? 'oração +' + b : 'oração –' + b }); } break;
      case 'sopro': for (const o of alvos) { curar(st, o, soma(rolar(st, 2 + n('mais'), 8)) + 4 + 2 * n('mais'), ev); for (const c of ['abalado', 'apavorado', 'fatigado', 'exausto']) delete o.cond[c]; } break;
      case 'flechaAcida': { const o = alvos[0]; const v = soma(rolar(st, 4 + n('dano'), 6)); const ok = res(o, 'ref'); causarDano(st, o, v, 'ácido', ev); if (!ok && o.vivo) aplicarCond(st, o, 'acido', 2, ev, { dados: [2 + n('dano'), 6] }); break; }
      case 'velocidade': alvos[0].buff.velocidade = true; alvos[0].acoes && alvos[0] !== u && (alvos[0].acoes.extra = false); ev.push({ t: 'texto', id: alvos[0].id, txt: 'acelerado!' }); break;
      case 'lancaIgnea': {
        const o = alvos[0]; const v = soma(rolar(st, 8 + 2 * n('dano'), 6)); const ok = res(o, 'ref'); causarDano(st, o, ok ? Math.floor(v / 2) : v, 'fogo', ev);
        if (!ok && o.vivo) aplicarCond(st, o, 'emChamas', 999, ev, { dados: [2 + n('dano'), 6] });
        for (const a of st.unidades.filter(a => a.vivo && a !== o && adjacente(a, o))) if (!res(a, 'ref')) aplicarCond(st, a, 'emChamas', 999, ev);
        break;
      }
      case 'raioPolar': { const o = alvos[0]; const v = soma(rolar(st, 10 + 2 * n('dano'), 8)); const ok = res(o, 'fort'); causarDano(st, o, ok ? Math.floor(v / 2) : v, 'frio', ev); if (o.vivo) aplicarCond(st, o, ok ? 'lento' : 'paralisado', ok ? 1 : 2, ev); break; }
      case 'colunaChamas': { const v = soma(rolar(st, 6 + n('dano'), 6)) + soma(rolar(st, 6, 6)); for (const o of alvos) danoArea(o, v, 'fogo', 'metade', 'ref'); break; }
      case 'coleraAzgher': {
        for (const o of alvos) { const v = soma(rolar(st, 10 + 2 * n('dano'), morto(o) ? 8 : 6)); const ok = danoArea(o, v, 'fogo', 'metade', 'ref'); if (!ok && o.vivo) { aplicarCond(st, o, 'cego', 1 + d(st, 4), ev); aplicarCond(st, o, 'emChamas', 999, ev); } }
        break;
      }
      case 'desintegrar': {
        const o = alvos[0]; const ok = res(o, 'fort'); const v = ok ? soma(rolar(st, 2 + n('dano'), 12)) : soma(rolar(st, 10 + 2 * n('dano'), 12));
        causarDano(st, o, v, 'essência', ev); if (o.pv <= 0 && o.vivo) { o.pv = -999; o.vivo = false; o.cond = {}; ev.push({ t: 'morte', id: o.id }); st.log.push(`💨 ${o.nome} vira pó!`); }
        break;
      }
      case 'amarras': { const o = alvos[0]; if (!res(o, 'ref')) aplicarCond(st, o, 'imovel', 1 + d(st, 4), ev); break; }
      default: break;
    }
    return null;
  }

  function usarHabilidade(st, u, acao, ev) {
    const h = acao.hab;
    if (h === 'furia') {
      if (u.buff.furia) return 'Já está em fúria.'; const extra = Math.min(acao.extra || 0, Math.floor(u.nivel / 5)); const custo = 2 + extra;
      if (u.pm < custo) return 'PM insuficiente.'; u.pm -= custo; u.buff.furia = 2 + extra; u.buff.furiaRd = 0;
      if ((u.poderes || {}).almaBronze) { u.pvTemp = (u.pvTemp || 0) + u.nivel + u.attr.for; ev.push({ t: 'texto', id: u.id, txt: `+${u.nivel + u.attr.for} PV temp.` }); }
      ev.push({ t: 'pm', id: u.id, v: -custo }); ev.push({ t: 'fx', fx: 'furia', de: u.id }); ev.push({ t: 'texto', id: u.id, txt: 'FÚRIA!' }); st.log.push(`🔥 ${u.nome} entra em fúria (+${u.buff.furia} ataque e dano).`); return null;
    }
    if (h === 'curaMaos') {
      const alvo = porId(st, acao.alvo || u.id); if (!alvo || (alvo !== u && !adjacente(u, alvo)) || alvo.lado !== u.lado) return 'Alvo precisa ser você ou um aliado adjacente.';
      const extra = Math.min(acao.extra || 0, Math.floor((u.nivel - 1) / 4)); const custo = 1 + extra; if (u.pm < custo) return 'PM insuficiente.';
      if (!gastar(u, 'movimento')) return 'Sem ação de movimento.'; u.pm -= custo; ev.push({ t: 'pm', id: u.id, v: -custo });
      const v = soma(rolar(st, 1 + extra, 8)) + 1 + extra; ev.push({ t: 'fx', fx: 'cura', de: u.id, para: alvo.id }); st.log.push(`✋ ${u.nome} usa Cura pelas Mãos em ${alvo.nome}.`); curar(st, alvo, v, ev); return null;
    }
    if (h === 'marcaPresa') {
      const alvo = porId(st, acao.alvo); if (!alvo || alvo.lado === u.lado) return 'Escolha um inimigo.'; if (u.pm < 1) return 'PM insuficiente.';
      if (!gastar(u, 'movimento')) return 'Sem ação de movimento.'; u.pm -= 1; ev.push({ t: 'pm', id: u.id, v: -1 });
      const dados = u.nivel >= 13 ? [2, 8] : u.nivel >= 9 ? [1, 12] : u.nivel >= 5 ? [1, 8] : [1, 4];
      u.buff.marca = { alvo: alvo.id, dados }; ev.push({ t: 'fx', fx: 'marca', de: u.id, para: alvo.id }); ev.push({ t: 'texto', id: alvo.id, txt: 'marcado' }); st.log.push(`🎯 ${u.nome} marca ${alvo.nome} como presa (+${dados[0]}d${dados[1]}).`); return null;
    }
    if (h === 'fintar') {
      const alvo = porId(st, acao.alvo); if (!alvo || alvo.lado === u.lado || dist(u, alvo) > ALCANCE.curto) return 'Escolha um inimigo em alcance curto.';
      if (!gastar(u, 'padrao')) return 'Sem ação padrão.';
      const a = d(st, 20) + u.per.engan + bonusTeste(u).b, b = d(st, 20) + alvo.per.ref;
      ev.push({ t: 'fx', fx: 'finta', de: u.id, para: alvo.id });
      if (a >= b) { alvo.cond.fintado = { r: 999, por: u.id, turnoFim: st.turnoId + st.ordem.length }; ev.push({ t: 'texto', id: alvo.id, txt: 'enganado!' }); st.log.push(`🃏 ${u.nome} finta ${alvo.nome} (${a} vs ${b}): ele fica desprevenido contra o próximo ataque.`); }
      else { ev.push({ t: 'texto', id: alvo.id, txt: 'não caiu' }); st.log.push(`${u.nome} tenta fintar ${alvo.nome} (${a} vs ${b}) e falha.`); }
      return null;
    }
    if (h === 'baluarte') {
      if (u.buff.baluarte) return 'Baluarte já está ativo.'; const extra = Math.min(acao.extra || 0, Math.floor(u.nivel / 4)); const custo = 1 + extra;
      if (u.pm < custo) return 'PM insuficiente.'; u.pm -= custo; u.buff.baluarte = 2 + 2 * extra;
      ev.push({ t: 'pm', id: u.id, v: -custo }); ev.push({ t: 'fx', fx: 'baluarte', de: u.id }); ev.push({ t: 'texto', id: u.id, txt: '+' + u.buff.baluarte + ' Def' });
      st.log.push(`🛡 ${u.nome} ergue o Baluarte (+${u.buff.baluarte} na Defesa e resistências até o próximo turno).`); return null;
    }
    if (h === 'desafio') {
      const alvo = porId(st, acao.alvo); if (!alvo || alvo.lado === u.lado || dist(u, alvo) > ALCANCE.curto) return 'Escolha um inimigo em alcance curto.';
      if (u.pm < 1) return 'PM insuficiente.'; if (!gastar(u, 'movimento')) return 'Sem ação de movimento.'; u.pm -= 1; ev.push({ t: 'pm', id: u.id, v: -1 });
      u.buff.desafio = alvo.id; alvo.cond.desafiado = { r: 999, por: u.id };
      ev.push({ t: 'fx', fx: 'marca', de: u.id, para: alvo.id }); ev.push({ t: 'cond', id: alvo.id, cond: 'desafiado' });
      st.log.push(`⚔ ${u.nome} desafia ${alvo.nome}: ele sofre –2 para atacar outros alvos.`); return null;
    }
    if (h === 'inspiracao') {
      const extra = Math.min(acao.extra || 0, Math.floor(u.nivel / 4)); const custo = 2 + 2 * extra; if (u.pm < custo) return 'PM insuficiente.';
      if (!gastar(u, 'padrao')) return 'Sem ação padrão.'; u.pm -= custo; ev.push({ t: 'pm', id: u.id, v: -custo }); u.buff.inspirou = true;
      for (const o of aliadosDe(st, u)) if (dist(u, o) <= ALCANCE.curto) { o.buff.inspiracao = 1 + extra; ev.push({ t: 'texto', id: o.id, txt: 'inspirado' }); }
      ev.push({ t: 'fx', fx: 'inspiracao', de: u.id }); st.log.push(`🎵 ${u.nome} inspira o grupo (+${1 + extra}).`); return null;
    }
    if (h === 'sopro') {
      if (!u.sopro || u.sopro.pronto > 0) return 'Ainda recarregando.'; if (!gastar(u, 'padrao')) return 'Sem ação padrão.';
      const p = acao.ponto; const dx = p.x - u.x, dy = p.y - u.y, L = Math.hypot(dx, dy) || 1;
      const cel = []; for (const c of linhaCelulas(u.x, u.y, Math.round(u.x + dx / L * 10), Math.round(u.y + dy / L * 10)).slice(1)) { if (terreno(st, c.x, c.y) === null || terreno(st, c.x, c.y) === 'W') break; cel.push(c); }
      const alvos = st.unidades.filter(o => o.vivo && cel.some(c => c.x === o.x && c.y === o.y));
      ev.push({ t: 'magia', id: u.id, magia: 'sopro', fx: 'acido', cor: '#9dff3a', celulas: cel, alvos: alvos.map(a => a.id) });
      st.log.push(`🐉 ${u.nome} cospe ácido!`); const v = soma(rolar(st, u.sopro.dano[0], u.sopro.dano[1])); const antes = new Map(alvos.map(o => [o, o.pv]));
      for (const o of alvos) { const ok = resistencia(st, o, 'ref', u.sopro.cd, ev); let vv = ok ? Math.floor(v / 2) : v; if (ok && o.habilidades && o.habilidades.includes('evasao')) vv = 0; causarDano(st, o, vv, 'ácido', ev); }
      resumoPV(st, antes); u.sopro.pronto = u.sopro.recarga; return null;
    }
    return 'Habilidade desconhecida.';
  }

  const API = { COLS, ROWS, novaBatalha, executar, opcoes, atual, porId, alcancaveis, deslocAtual, areaMagia, alvosValidosMagia, custoMagia, alcanceMagia,
    visao, dist, adjacente, terreno, passavel, dificil, unidadeEm, incapaz, tem, defesa, perfisDeAtaque, flanqueado, emCorpoACorpo, inimigosDe, aliadosDe,
    criarHeroi, criarCriatura, circuloMax, itensUsaveis, ITENS_CINTO, zonaHerois, reposicionar, comecar, NOME_COND, linhaCelulas, distEuc, previsaoAtaque, desprevenido };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.T20 = API;
})(this);
