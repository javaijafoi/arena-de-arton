// Simula runs inteiras do roguelike com a IA jogando pelos dois lados.
// Uso: node test/run-sim.js [n] [grupo] [--v]
const D = require('../js/data.js'); const R = require('../js/rules.js'); const IA = require('../js/ai.js'); const RUN = require('../js/run.js');
const N = +process.argv[2] || 20;
const grupo = (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'mari,hana,zaldrin,aria').split(',');
const VERB = process.argv.includes('--v');

function lutar(st) {
  let guard = 0;
  while (!st.fim && guard < 800) {
    const turno = st.turnoId; let passos = 0;
    while (!st.fim && st.turnoId === turno && passos < 10) { const a = IA.proximaAcao(st); const r = R.executar(st, a); if (!r.ok) { if (VERB) console.log('   erro IA', a.tipo, r.erro); R.executar(st, { tipo: 'fim' }); } passos++; }
    if (!st.fim && st.turnoId === turno) R.executar(st, { tipo: 'fim' });
    guard++; if (st.rodada > 30) { st.fim = 'inimigos'; break; }
  }
}
const pvFrac = run => { const v = RUN.vivos(run); return v.reduce((a, h) => a + 1 - h.dano / RUN.pvMaxDe(h, run.nivel), 0) / Math.max(1, v.length); };

function jogarRun(seed) {
  const run = RUN.novaRun({ herois: grupo, seed });
  const trilha = [];
  while (!run.fim) {
    // equipa o que estiver na mochila
    for (let k = run.mochila.length - 1; k >= 0; k--) {
      const I = RUN.ITENS[run.mochila[k]]; if (!['arma', 'armadura', 'acessorio', 'cinto'].includes(I.slot)) continue;
      const hi = run.herois.findIndex(h => !h.morto && (I.slot === 'cinto' ? h.cinto.includes(null) : !h.equip[I.slot]));
      if (hi >= 0) RUN.equipar(run, hi, k);
    }
    const prox = RUN.proximos(run); if (!prox.length) break;
    const f = pvFrac(run);
    const peso = n => ({ batalha: 3, elite: f > 0.75 ? 4 : 0, loja: run.ouro > 60 ? 5 : 1, descanso: f < 0.7 ? 6 : 1, evento: 3, chefe: 9 }[n.tipo] || 1) + Math.random();
    const n = prox.sort((a, b) => peso(b) - peso(a))[0];
    RUN.avancar(run, n.id); trilha.push(n.tipo[0]);
    if (run.pendente === 'batalha') {
      const prep = RUN.prepararBatalha(run); const st = R.novaBatalha(prep.cfg); RUN.ajustarBatalha(run, st, prep); R.comecar(st);
      lutar(st); const res = RUN.concluirBatalha(run, st, prep);
      if (VERB) console.log(`  [${n.c}] ${n.nome} ND ${RUN.ndTxt(prep.nd)} (${prep.cfg.inimigos.join(',')}) nv${prep.cfg.nivel} → ${res.venceu ? 'V' : 'D'} r${st.rodada} xp+${res.xp} T$+${res.ouro} ${res.mortos.length ? 'mortos:' + res.mortos.join(',') : ''} pv ${(pvFrac(run) * 100).toFixed(0)}%`);
      if (n.tipo === 'chefe') { const k = n.chefeId + ' nv' + prep.cfg.nivel + ' ' + prep.cfg.inimigos.length + 'ini'; CH[k] = CH[k] || [0, 0]; CH[k][res.venceu ? 0 : 1]++; }
      if (run.fim === 'derrota') { run.morreuEm = n; break; }
    } else if (run.pendente === 'loja') {
      const est = RUN.estoqueLoja(run, n);
      const quer = ['pocao', 'pocao', 'racao', 'racao', 'certeira', 'reforcada', 'cruel', 'pocaoMaior', 'barraca', 'granada', 'oleo'];
      for (const id of quer) { const k = est.findIndex(e => e.id === id && !e.vendido); if (k < 0) continue; if (id === 'barraca' && run.bolsa.barraca) continue; const hi = run.herois.findIndex(h => !h.morto && h.cinto.includes(null)); RUN.comprar(run, n, k, RUN.ITENS[id].slot === 'cinto' ? (hi >= 0 ? hi : null) : null); }
    } else if (run.pendente === 'descanso') {
      if (RUN.descansar(run, 'longo', n)) RUN.descansar(run, 'rapido', n);
    } else if (run.pendente === 'evento') {
      const es = RUN.escolhasEvento(run, n).filter(e => e.pode); const e = es.sort((a, b) => (b.chance || 70) - (a.chance || 70))[0];
      const r = RUN.resolverEvento(run, n, e.id); if (VERB) console.log(`  [${n.c}] evento ${n.evento}: ${r.texto}`);
    }
    RUN.sairDoNo(run);
    // descanso rápido quando o grupo está mal e há ração
    if (!run.fim && pvFrac(run) < 0.5 && run.bolsa.racao >= RUN.racoesNecessarias(run) + 2) RUN.descansar(run, 'rapido', null);
  }
  return { run, trilha: trilha.join('') };
}

const CH = {};
let vit = 0, niveis = 0, mortes = 0, ouro = 0; const morreu = {}; const t0 = Date.now();
for (let s = 1; s <= N; s++) {
  if (VERB) console.log(`Run ${s}`);
  const { run, trilha } = jogarRun(s * 1013);
  if (run.fim === 'vitoria') vit++;
  niveis += run.nivel; mortes += run.stats.mortes; ouro += run.ouro;
  const onde = run.fim === 'vitoria' ? 'venceu' : run.morreuEm ? `col ${run.morreuEm.c} ${run.morreuEm.tipo}` : 'parou';
  morreu[onde] = (morreu[onde] || 0) + 1;
  if (VERB || N <= 10) console.log(`Run ${s}: ${run.fim} nível ${run.nivel} XP ${run.xp} T$ ${run.ouro} batalhas ${run.stats.batalhas} mortes ${run.stats.mortes} trilha ${trilha} mochila ${run.mochila.length}`);
}
console.log(`\n${N} runs (${grupo.join(', ')}): vitória ${(100 * vit / N).toFixed(0)}%, nível final médio ${(niveis / N).toFixed(1)}, mortes/run ${(mortes / N).toFixed(1)}, T$ final ${(ouro / N).toFixed(0)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log('Fim:', JSON.stringify(morreu)); console.log('Chefes [venceu, perdeu]:', JSON.stringify(CH));
