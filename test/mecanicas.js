// Testes das mecânicas paralelas: voo, cego, manobras, ataque de oportunidade.
const R = require('../js/rules.js'); let falhas = 0;
const ok = (c, txt) => { console.log((c ? '✓ ' : '✗ ') + txt); if (!c) falhas++; };
function cena(herois, inimigos, extra) {
  const st = R.novaBatalha(Object.assign({ herois, nivel: 8, inimigos, mapa: 'rio', seed: 5 }, extra || {}));
  const vez = id => { st.vez = st.ordem.indexOf(id); const u = R.atual(st); u.acoes = { padrao: true, movimento: true, extra: false }; return u; };
  return { st, vez, u: id => R.porId(st, id) };
}
// voo
{ const { st, vez, u } = cena(['mari'], ['serpeJovem', 'lobo']); const s = vez('m0'); s.x = 10; s.y = 3; u('m1').x = 15; u('m1').y = 11; u('h0').x = 0; u('h0').y = 0;
  const alc = R.alcancaveis(st, s, 8).celulas; ok(alc.some(c => R.terreno(st, c.x, c.y) === '~'), 'serpe voa por cima da água');
  const l = u('m1'); l.x = 10; l.y = 3; s.x = 15; s.y = 0; ok(!R.alcancaveis(st, l, 8).celulas.some(c => R.terreno(st, c.x, c.y) === '~'), 'lobo não entra na água');
  const ev = []; s.cond = {}; const r = R.executar(st, { tipo: 'fim' }); void r; void ev;
  const m = R.porId(st, 'h0'); const t = vez('h0'); t.x = 14; t.y = 0; s.x = 15; s.y = 0; s.cond = {};
  let caiu = false; for (let i = 0; i < 20 && !caiu; i++) { t.acoes.padrao = true; R.executar(st, { tipo: 'manobra', manobra: 'derrubar', alvo: s.id }); caiu = R.tem(s, 'caido'); }
  ok(!caiu, 'quem voa não pode ser derrubado'); void m; }
// cego
{ const { st, vez, u } = cena(['mari'], ['capanga']); const m = vez('h0'); const c = u('m0'); m.x = 5; m.y = 1; c.x = 6; c.y = 1; m.cond.cego = { r: 999 }; c.pvMax = c.pv = 9999; c.defBase = 0;
  let acertos = 0, n = 300; for (let i = 0; i < n; i++) { st.vez = st.ordem.indexOf('h0'); m.acoes = { padrao: true, movimento: true }; const r = R.executar(st, { tipo: 'atacar', alvo: c.id }); if (r.ev.some(e => e.t === 'ataque' && e.acerto)) acertos++; }
  ok(acertos > n * 0.35 && acertos < n * 0.65, `cego acerta ~50% mesmo contra Def 0 (${acertos}/${n})`);
  ok(R.desprevenido(m) && R.deslocAtual(m) === 3, 'cego fica desprevenido e com metade do deslocamento'); }
// agarrar, escapar, empurrar
{ const { st, vez, u } = cena(['mari'], ['capanga']); const m = vez('h0'); const c = u('m0'); m.x = 5; m.y = 1; c.x = 6; c.y = 1;
  let conseguiu = false; for (let i = 0; i < 30 && !conseguiu; i++) { st.vez = st.ordem.indexOf('h0'); m.acoes = { padrao: true, movimento: true }; R.executar(st, { tipo: 'manobra', manobra: 'agarrar', alvo: c.id }); conseguiu = R.tem(c, 'agarrado'); }
  ok(conseguiu, 'Mari agarra o capanga'); ok(R.deslocAtual(c) === 0 && R.desprevenido(c), 'agarrado fica imóvel e desprevenido');
  ok(R.deslocAtual(m) === 0, 'quem agarra também não anda (até soltar)');
  vez('h0'); R.executar(st, { tipo: 'soltar' }); ok(!R.tem(c, 'agarrado') && !m.buff.agarrando, 'soltar libera os dois');
  for (let i = 0; i < 30 && !R.tem(c, 'agarrado'); i++) { st.vez = st.ordem.indexOf('h0'); m.acoes = { padrao: true, movimento: true }; R.executar(st, { tipo: 'manobra', manobra: 'agarrar', alvo: c.id }); }
  let escapou = false; for (let i = 0; i < 40 && !escapou; i++) { st.vez = st.ordem.indexOf('m0'); c.acoes = { padrao: true, movimento: true }; R.executar(st, { tipo: 'manobra', manobra: 'escapar' }); escapou = !R.tem(c, 'agarrado'); }
  ok(escapou, 'capanga consegue escapar');
  let x0 = c.x; for (let i = 0; i < 30 && c.x === x0; i++) { st.vez = st.ordem.indexOf('h0'); m.acoes = { padrao: true, movimento: true }; c.x = 6; x0 = 6; R.executar(st, { tipo: 'manobra', manobra: 'empurrar', alvo: c.id }); }
  ok(c.x > 6, `empurrão afasta o alvo (foi para x=${c.x})`); }
// derrubar
{ const { st, vez, u } = cena(['mari'], ['capanga']); const m = vez('h0'); const c = u('m0'); m.x = 5; m.y = 1; c.x = 6; c.y = 1;
  for (let i = 0; i < 30 && !R.tem(c, 'caido'); i++) { st.vez = st.ordem.indexOf('h0'); m.acoes = { padrao: true, movimento: true }; R.executar(st, { tipo: 'manobra', manobra: 'derrubar', alvo: c.id }); }
  ok(R.tem(c, 'caido'), 'derrubar deixa caído'); }
// ataque de oportunidade
for (const op of [false, true]) {
  const { st, vez, u } = cena(['zaldrin'], ['capanga'], { oportunidade: op }); const z = vez('h0'); const c = u('m0'); z.x = 5; z.y = 1; c.x = 6; c.y = 1; c.reacao = 0;
  const r = R.executar(st, { tipo: 'mover', x: 2, y: 1 }); const aoo = r.ev.filter(e => e.t === 'ataque' && e.oportunidade).length;
  ok(op ? aoo === 1 : aoo === 0, `${op ? 'com' : 'sem'} a regra opcional: ${aoo} ataque(s) de oportunidade ao fugir`);
  if (op) { c.reacao = 0; z.x = 5; z.y = 1; st.vez = st.ordem.indexOf('h0'); z.acoes = { padrao: true, movimento: true }; z.pv = 50; c.reacao = st.rodada; const r2 = R.executar(st, { tipo: 'mover', x: 2, y: 1 }); ok(!r2.ev.some(e => e.oportunidade), 'só um ataque de oportunidade por rodada'); }
}
// arma espiritual
{ const { st, vez, u } = cena(['hana'], ['capanga', 'capanga']); const h = vez('h0'); const c = u('m0'); const c2 = u('m1'); h.x = 5; h.y = 1; c.x = 6; c.y = 1; c2.x = 5; c2.y = 2; h.pm = 50;
  c.pvMax = c.pv = 999; c2.pvMax = c2.pv = 999; h.pvMax = h.pv = 999;
  const r = R.executar(st, { tipo: 'magia', magia: 'armaEspiritual', aprim: { ataque: 1 } }); ok(r.ok && h.buff.armaEspiritual, 'Hana invoca a arma (sustentada)');
  ok(R.opcoes(st).armaEspiritual.length >= 1, 'arma pode golpear sozinha um alvo em alcance curto');
  const pv0 = c.pv; R.executar(st, { tipo: 'armaEspiritual', alvo: c.id }); ok(c.pv < pv0, `arma golpeia automaticamente (${pv0 - c.pv} de dano)`);
  ok(!R.opcoes(st).armaEspiritual.length, 'só um golpe da arma por rodada');
  R.executar(st, { tipo: 'fim' });
  // capanga ataca: arma bloqueada (atacou), não contra-ataca
  st.vez = st.ordem.indexOf('m0'); c.acoes = { padrao: true, movimento: true }; const p1 = c.pv; R.executar(st, { tipo: 'atacar', alvo: h.id }); ok(c.pv === p1, 'depois de golpear, não contra-ataca até o próximo turno');
  // nova rodada, turno de Hana libera; dois ataques: só o primeiro sofre contra-ataque, mesmo errando
  st.rodada++; st.vez = st.ordem.indexOf('h0'); h.buff.armaEspiritual.bloq = false; h.defBase = 99;
  st.vez = st.ordem.indexOf('m0'); c.acoes = { padrao: true, movimento: true }; const a = c.pv; R.executar(st, { tipo: 'atacar', alvo: h.id }); ok(c.pv < a, 'contra-ataca mesmo quando o ataque erra');
  st.vez = st.ordem.indexOf('m1'); c2.acoes = { padrao: true, movimento: true }; const b = c2.pv; R.executar(st, { tipo: 'atacar', alvo: h.id }); ok(c2.pv === b, 'contra-ataque só 1× por rodada'); }
// posicionamento
{ const { st } = cena(['mari', 'hana', 'zaldrin', 'aria'], ['capanga']); const z = R.zonaHerois(st); const hs = st.unidades.filter(o => o.lado === 'h');
  ok(st.preparo && hs.every(o => z.some(c => c.x === o.x && c.y === o.y)), 'heróis começam dentro da zona');
  const zal = R.porId(st, 'h2'), mari = R.porId(st, 'h0'); ok(zal.x < mari.x, 'arcanista começa atrás da guerreira');
  const alvo = { x: mari.x, y: mari.y }; const antes = { x: zal.x, y: zal.y }; ok(R.reposicionar(st, 'h2', alvo.x, alvo.y) === null && zal.x === alvo.x && mari.x === antes.x && mari.y === antes.y, 'clicar numa casa ocupada troca os dois');
  ok(R.reposicionar(st, 'h2', 15, 5) !== null, 'não pode sair da zona'); R.comecar(st); ok(R.reposicionar(st, 'h2', antes.x, antes.y) !== null, 'depois de começar, não reposiciona'); }
console.log(falhas ? falhas + ' FALHAS' : 'tudo certo');
