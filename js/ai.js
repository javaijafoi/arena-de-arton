/* Arena de Arton — IA simples. Devolve UMA ação por vez para a unidade da vez.
   Usada para testar o jogo sozinho e, se o jogador quiser, para controlar um lado. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const R = node ? require('./rules.js') : root.T20;
  const D = node ? require('./data.js') : root.T20DATA;
  const M = D.MAGIAS;

  const vivosInimigos = (st, u) => R.inimigosDe(st, u).filter(o => !R.incapaz(o));
  const fracao = o => o.pv / o.pvMax;
  const ehConjurador = u => (u.magias || []).length > 0 && !(u.ataques && u.ataques.length && !u.pm);
  const atiraDeLonge = u => (u.lado === 'h' && u.arma && u.arma.distancia) || (u.lado === 'm' && u.distancia && u.ataques[0].bonus < u.distancia.bonus);

  // melhor nível de aprimoramento "dano" que cabe no orçamento
  function aprimDano(u, mid, base) {
    const ap = {}; const A = (M[mid].aprim || []).find(a => a.id === 'dano'); if (!A || u.lado !== 'h') return ap;
    const lim = Math.min(u.nivel, u.pm - Math.max(2, Math.floor(u.pmMax * 0.15)));
    let c = base; let n = 0;
    while (c + A.custo <= lim && (!A.circulo || A.circulo <= u.circulo) && n < 6) { c += A.custo; n++; }
    if (n) ap.dano = n; return ap;
  }
  function podePagar(u, mid, aprim) { return R.custoMagia(u, mid, aprim).erros.length === 0; }

  // Avalia magias ofensivas e escolhe a melhor (valor ~ dano esperado)
  function melhorMagia(st, u) {
    if (!u.acoes.padrao || u.buff.furia) return null;
    const ini = vivosInimigos(st, u); if (!ini.length) return null;
    let melhor = null; const consid = (v, acao) => { if (v > 0 && (!melhor || v > melhor.v)) melhor = { v, acao }; };
    for (const mid of u.magias || []) {
      const S = M[mid]; const base = S.custoFixo || D.CUSTO_CIRCULO[S.circulo];
      if (u.pm < base) continue;
      const reserva = u.lado === 'h' && u.pm - base < 1 && !['curarFerimentos'].includes(mid);
      void reserva;
      if (['curarFerimentos', 'sopro', 'escudoDaFe', 'velocidade', 'armaduraArcana', 'armaEspiritual', 'bencao', 'oracao'].includes(mid)) continue;
      let aprim = {};
      if (['bolaDeFogo', 'relampago', 'explosaoChamas', 'colunaChamas', 'coleraAzgher', 'desintegrar', 'flechaAcida', 'lancaIgnea', 'raioPolar', 'raioSolar', 'toqueChocante', 'infligirFerimentos', 'despedacar'].includes(mid)) aprim = aprimDano(u, mid, base);
      if (mid === 'setaInfalivel') { if (u.circulo >= 2 && podePagar(u, mid, { lancas: 1, cinco: 1 })) aprim = { lancas: 1, cinco: 1 }; else if (podePagar(u, mid, { tres: 1 })) aprim = { tres: 1 }; }
      if (['sono', 'leque', 'amedrontar'].includes(mid) && u.circulo >= 2 && podePagar(u, mid, { nd5: 1 })) aprim = { nd5: 1 };
      if (!podePagar(u, mid, aprim)) aprim = {};
      if (!podePagar(u, mid, aprim)) continue;
      const custo = R.custoMagia(u, mid, aprim).custo;
      const peso = v => v - custo * (u.lado === 'h' ? 0.6 : 0.2);
      if (S.forma === 'alvo') {
        const validos = (R.alvosValidosMagia(st, u, mid, aprim) || []).map(id => R.porId(st, id)).filter(o => o.lado !== u.lado && !R.incapaz(o));
        for (const o of validos) {
          let v = 0; const nd = o.lado === 'h' ? o.nivel : o.nd;
          switch (mid) {
            case 'setaInfalivel': v = (aprim.cinco ? 5 : aprim.tres ? 3 : 2) * (aprim.lancas ? 5.5 : 3.5); break;
            case 'setaMilicia': v = 19.5; break;
            case 'toqueChocante': v = 11 + 5.5 * (aprim.dano || 0); break;
            case 'infligirFerimentos': v = (11 + 5.5 * (aprim.dano || 0)) * ((o.tags || []).includes('morto-vivo') ? -1 : 0.8); break;
            case 'despedacar': v = (6.5 + 6.5 * (aprim.dano || 0)) * ((o.tags || []).includes('construto') ? 2 : 1) + 6; break;
            case 'flechaAcida': v = 14 + 3.5 * (aprim.dano || 0) + 5; break;
            case 'lancaIgnea': v = 28 + 7 * (aprim.dano || 0) + 6; break;
            case 'raioPolar': v = 45 + 9 * (aprim.dano || 0) + 15; break;
            case 'desintegrar': v = 45 + 13 * (aprim.dano || 0); break;
            case 'sono': { const lim = aprim.nd5 ? 5 : 2; v = (nd <= lim && !(o.imune || []).includes('sono')) ? 6 + o.pv * 0.35 : 0; break; }
            case 'amedrontar': { const lim = aprim.nd5 ? 5 : 2; v = (nd <= lim && ['humanoide', 'animal'].includes((o.tags || [])[0]) && !R.tem(o, 'apavorado')) ? 7 : 0; break; }
            case 'raioEnfraquecimento': v = R.tem(o, 'fatigado') || R.tem(o, 'exausto') ? 0 : 4 + o.pv * 0.08; break;
            case 'amarras': v = R.tem(o, 'imovel') ? 0 : (o.arma && o.arma.distancia ? 2 : 6); break;
            default: v = 0;
          }
          if (o.pv <= v) v += 4; // chance de derrubar
          consid(peso(v), { tipo: 'magia', magia: mid, aprim, alvo: o.id });
        }
      } else if (['esfera', 'cubo', 'cone', 'linha'].includes(S.forma)) {
        const pontos = ini.map(o => ({ x: o.x, y: o.y }));
        for (const p of pontos) {
          if (['esfera', 'cubo'].includes(S.forma) && (R.dist(u, p) > R.alcanceMagia(S) || !R.visao(st, u, p).ve)) continue;
          if (S.forma === 'cone' && R.distEuc(u, p) > S.tamanho + 0.5) continue;
          const cel = R.areaMagia(st, u, mid, p, aprim);
          const atingidos = st.unidades.filter(o => o.vivo && cel.some(c => c.x === o.x && c.y === o.y));
          if (atingidos.includes(u) && S.forma !== 'cone' && S.forma !== 'linha') continue;
          let v = 0;
          for (const o of atingidos) {
            const amigo = o.lado === u.lado; let val = 0; const nd = o.lado === 'h' ? o.nivel : o.nd;
            switch (mid) {
              case 'bolaDeFogo': case 'relampago': val = (21 + 7 * (aprim.dano || 0)) * 0.75; break;
              case 'colunaChamas': val = (42 + 3.5 * (aprim.dano || 0)) * 0.75; break;
              case 'coleraAzgher': val = (35 + 7 * (aprim.dano || 0)) * 0.8; break;
              case 'explosaoChamas': val = (7 + 3.5 * (aprim.dano || 0)) * 0.75; break;
              case 'raioSolar': val = 18 * 0.75 * ((o.tags || []).includes('morto-vivo') ? 1.5 : 1); break;
              case 'teia': val = R.tem(o, 'enredado') ? 0 : 4; break;
              case 'leque': val = nd <= (aprim.nd5 ? 5 : 2) ? 7 : 0; break;
              default: val = 0;
            }
            if (!amigo && R.incapaz(o)) val = 0;
            v += amigo ? -val * 1.6 : val;
          }
          consid(peso(v), { tipo: 'magia', magia: mid, aprim, ponto: p });
        }
      } else if (S.forma === 'auraInimigos') {
        if (st.rodada > 3) continue;
        const n = ini.filter(o => R.dist(u, o) <= 6 && !o.buff.perdicao).length; consid(peso(n * 2.2), { tipo: 'magia', magia: mid, aprim: {} });
      }
    }
    return melhor;
  }

  function suporte(st, u) {
    if (!u.acoes.padrao || u.buff.furia) return null;
    const aliados = R.aliadosDe(st, u);
    const pode = (mid, ap) => (u.magias || []).includes(mid) && podePagar(u, mid, ap || {});
    // cura
    const feridos = aliados.filter(a => a.pv <= 0 || fracao(a) < 0.45).sort((a, b) => fracao(a) - fracao(b));
    if (feridos.length) {
      if (pode('sopro') && feridos.length >= 2) {
        for (const f of feridos) { if (R.distEuc(u, f) > 4.5) continue; const cel = R.areaMagia(st, u, 'sopro', f, {}); const n = aliados.filter(a => cel.some(c => c.x === a.x && c.y === a.y) && fracao(a) < 0.7).length; if (n >= 2) return { tipo: 'magia', magia: 'sopro', aprim: {}, ponto: { x: f.x, y: f.y } }; }
      }
      for (const f of feridos) {
        if (pode('curarFerimentos')) {
          let ap = {}; const extra = Math.max(0, Math.min(u.nivel - 1, u.pm - 1, 3)); if (extra) ap.mais = extra;
          const longe = R.dist(u, f) > 1 && f !== u;
          if (longe && pode('curarFerimentos', { ...ap, curto: 1 })) ap.curto = 1;
          while (!podePagar(u, 'curarFerimentos', ap) && ap.mais) { ap.mais--; if (!ap.mais) delete ap.mais; }
          const validos = R.alvosValidosMagia(st, u, 'curarFerimentos', ap);
          if (podePagar(u, 'curarFerimentos', ap) && validos.includes(f.id)) return { tipo: 'magia', magia: 'curarFerimentos', aprim: ap, alvo: f.id };
        }
      }
    }
    // abertura: buffs
    const ini = vivosInimigos(st, u);
    const perto = ini.some(o => R.dist(u, o) <= 8);
    if (st.rodada <= 2 || perto) {
      if (pode('oracao') && !u.buff.oracao && aliados.filter(a => R.dist(u, a) <= 6).length >= 2) return { tipo: 'magia', magia: 'oracao', aprim: {} };
      if (pode('bencao') && !u.buff.bencao && !u.buff.oracao && aliados.filter(a => R.dist(u, a) <= 6 && !a.buff.bencao).length >= 3 && st.rodada <= 2) return { tipo: 'magia', magia: 'bencao', aprim: {} };
      if (pode('armaEspiritual') && !u.buff.armaEspiritual && perto && !(typeof process !== 'undefined' && process.env.NOAE)) {
        for (const ap of [{ ataque: 1, duas: 1, essencia: 1 }, { ataque: 1, duas: 1 }, { ataque: 1, def: 1 }, { ataque: 1 }, { def: 1 }, {}]) if (pode('armaEspiritual', ap)) return { tipo: 'magia', magia: 'armaEspiritual', aprim: ap };
      }
      if (pode('armaduraArcana') && !u.buff.defMagia && st.rodada <= 1) return { tipo: 'magia', magia: 'armaduraArcana', aprim: {} };
      if (pode('velocidade') && u.pm >= 6) {
        const val = R.alvosValidosMagia(st, u, 'velocidade', {});
        const alvo = aliados.filter(a => val.includes(a.id) && !a.buff.velocidade && !R.incapaz(a) && (a.classe === 'guerreiro' || a.classe === 'barbaro' || a.classe === 'cacador' || a.classe === 'paladino'))[0];
        if (alvo) return { tipo: 'magia', magia: 'velocidade', aprim: {}, alvo: alvo.id };
      }
      if (pode('escudoDaFe') && st.rodada <= 1) { const alvo = aliados.find(a => a !== u && R.dist(u, a) <= 1 && !a.buff.escudoFe && (a.classe === 'guerreiro' || a.classe === 'paladino' || a.classe === 'barbaro')); if (alvo) return { tipo: 'magia', magia: 'escudoDaFe', aprim: {}, alvo: alvo.id }; }
    }
    return null;
  }

  function celulaAdjLivre(st, u, alvo, celulas) {
    let best = null;
    for (const c of celulas) {
      if (R.dist(c, alvo) !== 1) continue;
      let score = -c.custo * 0.3;
      // procura flanco
      const ox = alvo.x * 2 - c.x, oy = alvo.y * 2 - c.y; const op = R.unidadeEm(st, ox, oy);
      if (op && op.lado === u.lado) score += 3;
      if (R.dificil(st, c.x, c.y)) score -= 0.5;
      if (!best || score > best.score) best = { ...c, score };
    }
    return best;
  }

  function escolherAlvoCac(st, u, lista) {
    return lista.map(id => R.porId(st, id)).sort((a, b) => {
      const ia = R.incapaz(a) ? 1 : 0, ib = R.incapaz(b) ? 1 : 0; if (ia !== ib) return ia - ib;
      return a.pv - b.pv;
    })[0];
  }

  function modsAtaque(st, u, alvo) {
    const m = {}; if (u.lado !== 'h') return m;
    let orc = Math.min(u.nivel, u.pm);
    const habs = u.habilidades || [];
    if (habs.includes('ataqueExtra') && orc >= 2) { m.ataqueExtra = true; orc -= 2; }
    if (habs.includes('golpeDivino') && orc >= 2 && (alvo.pv > 12 || (alvo.tags || []).includes('morto-vivo'))) { const n = Math.min(1 + Math.floor((orc - 2)), 1 + Math.floor(u.nivel / 4)); m.golpeDivino = n; orc -= 2 + (n - 1); }
    if (habs.includes('ataqueEspecial') && orc >= 1 && u.pm > 2) { const n = Math.min(orc, 1 + Math.floor(u.nivel / 4)); if (alvo.defBase >= 17) m.aeAtaque = n; else m.aeDano = n; }
    return m;
  }

  // itens do cinto (modo roguelike): poções de cura em quem está caído ou quase, granada em grupos, óleo/velocidade colado no inimigo
  function usarCinto(st, u, ops, ini) {
    const its = (ops.itens || []).filter(i => i.pode); if (!its.length) return null;
    const cura = its.filter(i => i.id === 'pocao' || i.id === 'pocaoMaior').sort((a, b) => (a.id === 'pocaoMaior') - (b.id === 'pocaoMaior'));
    for (const c of cura) {
      const alvos = c.alvos.map(id => R.porId(st, id));
      const caido = alvos.find(o => o.pv <= 0); if (caido) return { tipo: 'item', slot: c.k, alvo: caido.id };
      if (alvos.includes(u) && fracao(u) < 0.3 && !(u.magias || []).includes('curarFerimentos')) return { tipo: 'item', slot: c.k, alvo: u.id };
    }
    const perto = ini.some(o => R.adjacente(u, o)) || (atiraDeLonge(u) && ini.some(o => R.visao(st, u, o).ve));
    const g = its.find(i => i.id === 'granada');
    if (g) {
      let melhor = null;
      for (const id of g.alvos) { const o = R.porId(st, id); const viz = st.unidades.filter(x => x.vivo && R.dist(x, o) <= 1); const ini2 = viz.filter(x => x.lado !== u.lado).length, ali = viz.filter(x => x.lado === u.lado).length; if (!ali && ini2 >= 2 && (!melhor || ini2 > melhor.n)) melhor = { n: ini2, id }; }
      if (melhor) return { tipo: 'item', slot: g.k, alvo: melhor.id };
    }
    if (perto && u.acoes.movimento) for (const id of ['velocidade', 'oleo', 'protecao']) { const i = its.find(x => x.id === id); if (i && (id !== 'protecao' || ini.some(o => (o.magias || []).length))) return { tipo: 'item', slot: i.k, alvo: u.id }; }
    return null;
  }

  function proximaAcao(st) {
    const u = R.atual(st); if (!u || st.fim) return null;
    const ops = R.opcoes(st); if (!ops) return null;
    if (ops.levantar) return { tipo: 'levantar' };
    if (ops.escapar && !ops.atacar.length) return { tipo: 'manobra', manobra: 'escapar' };
    if (ops.escapar && u.cond.agarrado && R.porId(st, u.cond.agarrado.por) && (u.lado === 'h' ? u.classe === 'arcanista' || u.classe === 'cacador' : !!u.distancia)) return { tipo: 'manobra', manobra: 'escapar' };
    if (ops.apagar && u.pv < u.pvMax * 0.5) return { tipo: 'apagar' };
    const ini = vivosInimigos(st, u);
    if (!ini.length) return { tipo: 'fim' };
    const item = usarCinto(st, u, ops, ini); if (item) return item;
    // arma espiritual sustentada: ação livre, golpeia sozinha
    if (ops.armaEspiritual && ops.armaEspiritual.length) {
      const alvo = ops.armaEspiritual.map(id => R.porId(st, id)).filter(o => !R.incapaz(o)).sort((a, b) => a.pv - b.pv)[0];
      if (alvo) return { tipo: 'armaEspiritual', alvo: alvo.id };
    }

    // fúria antes de tudo (livre)
    const hab = id => ops.habilidades.find(h => h.id === id && h.pode);
    if (hab('furia') && ini.some(o => R.dist(u, o) <= 14)) return { tipo: 'habilidade', hab: 'furia', extra: Math.min(Math.floor(u.nivel / 5), u.pm - 2, u.nivel - 2) };
    // cura pelas mãos
    if (hab('curaMaos')) {
      const alvo = R.aliadosDe(st, u).filter(a => (a === u || R.adjacente(u, a)) && (a.pv <= 0 || fracao(a) < 0.4)).sort((a, b) => fracao(a) - fracao(b))[0];
      if (alvo && u.acoes.movimento) return { tipo: 'habilidade', hab: 'curaMaos', alvo: alvo.id, extra: Math.min(Math.floor((u.nivel - 1) / 4), u.pm - 1) };
    }
    // marca da presa no alvo mais forte à vista
    if (hab('marcaPresa') && u.acoes.movimento && (!u.buff.marca || !R.porId(st, u.buff.marca.alvo).vivo)) {
      const alvo = ini.filter(o => R.visao(st, u, o).ve).sort((a, b) => b.pv - a.pv)[0]; if (alvo) return { tipo: 'habilidade', hab: 'marcaPresa', alvo: alvo.id };
    }
    // sopro (monstro)
    if (hab('sopro')) {
      let best = null;
      for (const o of ini) { const dx = o.x - u.x, dy = o.y - u.y, L = Math.hypot(dx, dy); if (L > 10) continue; const cel = R.linhaCelulas(u.x, u.y, Math.round(u.x + dx / L * 10), Math.round(u.y + dy / L * 10)); const n = ini.filter(a => cel.some(c => c.x === a.x && c.y === a.y)).length; if (!best || n > best.n) best = { n, p: { x: o.x, y: o.y } }; }
      if (best && best.n >= 2) return { tipo: 'habilidade', hab: 'sopro', ponto: best.p };
    }
    // baluarte quando há inimigos por perto; desafio no inimigo mais perigoso
    if (hab('baluarte') && ini.some(o => R.dist(u, o) <= 2) && u.pm >= 2) return { tipo: 'habilidade', hab: 'baluarte', extra: Math.min(Math.floor(u.nivel / 4), u.pm - 2, Math.floor(u.pm / 4)) };
    if (hab('desafio') && u.acoes.movimento) { const alvo = ini.filter(o => R.dist(u, o) <= 6).sort((a, b) => b.pv - a.pv)[0]; if (alvo) return { tipo: 'habilidade', hab: 'desafio', alvo: alvo.id }; }
    // inspiração
    if (hab('inspiracao') && !u.buff.inspirou && st.rodada <= 2) return { tipo: 'habilidade', hab: 'inspiracao', extra: Math.min(Math.floor(u.nivel / 4), Math.floor((u.pm - 2) / 2)) };
    // suporte / magias
    const sup = suporte(st, u); if (sup) return sup;
    const mag = melhorMagia(st, u);
    const adj = ops.atacar.filter(id => !R.incapaz(R.porId(st, id)));
    // valor do ataque físico para comparar
    const valorFisico = u.lado === 'm' ? u.ataques.reduce((s, a) => s + a.dano[0] * (a.dano[1] + 1) / 2 + a.dano[2], 0) * 0.6 : 8;
    if (mag && (mag.v > valorFisico * (adj.length ? 1 : 0.6) || ehConjurador(u) && u.lado === 'h')) {
      // conjurador colado num inimigo: ainda lança (sem ataque de oportunidade no jogo)
      return mag.acao;
    }
    // fintar: ladino sem flanco
    if (hab('fintar') && u.classe === 'ladino' && u.acoes.padrao && u.acoes.extra === false && adj.length) {
      const alvo = R.porId(st, adj[0]);
      if (!R.flanqueado(st, u, alvo) && !alvo.cond.fintado && u.acoes.movimento === false) { /* sem ação sobrando para atacar depois */ }
    }
    // ataque corpo a corpo
    if (adj.length && !atiraDeLonge(u)) { const alvo = escolherAlvoCac(st, u, adj); return { tipo: 'atacar', alvo: alvo.id, mods: modsAtaque(st, u, alvo) }; }
    // distância
    const distOk = ops.distancia.filter(id => !R.incapaz(R.porId(st, id)));
    if (distOk.length && (atiraDeLonge(u) || !perfisCac(u))) {
      // se está colado num inimigo e pode se mover, afasta primeiro
      if (u.acoes.movimento && R.emCorpoACorpo(st, u) && ops.mover && !u.acoes.moveu) {
        const fuga = ops.mover.filter(c => !ini.some(o => R.dist(c, o) <= 1)).sort((a, b) => a.custo - b.custo)[0];
        if (fuga) return { tipo: 'mover', x: fuga.x, y: fuga.y };
      }
      const alvo = distOk.map(id => R.porId(st, id)).sort((a, b) => scoreTiro(st, u, a) - scoreTiro(st, u, b))[0];
      return { tipo: 'distancia', alvo: alvo.id, mods: modsAtaque(st, u, alvo) };
    }
    if (adj.length) { const alvo = escolherAlvoCac(st, u, adj); return { tipo: 'atacar', alvo: alvo.id, mods: modsAtaque(st, u, alvo) }; }
    // investida
    if (ops.investida.length && !atiraDeLonge(u)) {
      const alvo = ops.investida.map(id => R.porId(st, id)).filter(o => !R.incapaz(o)).sort((a, b) => R.dist(u, a) - R.dist(u, b) || a.pv - b.pv)[0];
      if (alvo) return { tipo: 'investida', alvo: alvo.id };
    }
    // mover
    if (ops.mover && ops.mover.length) {
      const alvo = ini.slice().sort((a, b) => R.dist(u, a) - R.dist(u, b) || a.pv - b.pv)[0];
      if (atiraDeLonge(u) || (ehConjurador(u) && u.lado === 'h' && u.classe !== 'clerigo')) {
        // procura uma casa com visão de algum inimigo, sem ficar adjacente
        const boas = ops.mover.filter(c => !ini.some(o => R.dist(c, o) <= 1) && ini.some(o => R.visao(st, c, o).ve && R.dist(c, o) <= 14));
        if (boas.length && !ini.some(o => R.visao(st, u, o).ve && R.dist(u, o) <= 14)) { boas.sort((a, b) => a.custo - b.custo); return { tipo: 'mover', x: boas[0].x, y: boas[0].y }; }
        if (!ini.some(o => R.visao(st, u, o).ve)) { const c = maisPerto(ops.mover, alvo); if (c) return { tipo: 'mover', x: c.x, y: c.y }; }
        if (u.acoes.padrao) { /* nada útil a fazer com a ação padrão */ }
        return { tipo: 'fim' };
      }
      const adjCel = celulaAdjLivre(st, u, alvo, ops.mover);
      if (adjCel) return { tipo: 'mover', x: adjCel.x, y: adjCel.y };
      const c = maisPerto(ops.mover, alvo);
      if (c && R.dist(c, alvo) < R.dist(u, alvo)) return { tipo: 'mover', x: c.x, y: c.y };
    }
    return { tipo: 'fim' };
  }
  function perfisCac(u) { return R.perfisDeAtaque(u, false); }
  function scoreTiro(st, u, o) { let s = o.pv; if (R.visao(st, u, o).cobertura) s += 15; if (R.emCorpoACorpo(st, o, u) && !u.tiroPreciso && !(u.habilidades || []).includes('tiroCerteiro')) s += 20; if (u.buff.marca && u.buff.marca.alvo === o.id) s -= 10; return s; }
  function maisPerto(celulas, alvo) { return celulas.slice().sort((a, b) => (R.distEuc(a, alvo) + a.custo * 0.05) - (R.distEuc(b, alvo) + b.custo * 0.05))[0]; }

  // joga o turno inteiro (para simulação); devolve eventos
  function jogarTurno(st, maxPassos) {
    const id = R.atual(st).id; const turno = st.turnoId; let passos = 0; const ev = [];
    while (!st.fim && st.turnoId === turno && passos < (maxPassos || 8)) {
      let a = proximaAcao(st); let r = R.executar(st, a);
      if (!r.ok) { r = R.executar(st, { tipo: 'fim' }); a = { tipo: 'fim', erro: r.erro }; }
      ev.push(...r.ev); passos++;
    }
    if (!st.fim && st.turnoId === turno) ev.push(...R.executar(st, { tipo: 'fim' }).ev);
    void id; return ev;
  }

  const API = { proximaAcao, jogarTurno };
  if (node) module.exports = API; else root.T20IA = API;
})(this);
