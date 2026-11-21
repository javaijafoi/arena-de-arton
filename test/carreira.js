// Carreira de um jogador: várias runs seguidas com o mesmo progresso permanente (pontos, cofre, guilda).
// A cada run o jogador sorteia 4 heróis, leva os 2 melhores itens do baú e, no fim, compra melhorias
// da guilda na ordem abaixo assim que o cofre deixa. Mede a vitória em cada run da carreira.
// Uso: node test/carreira.js [carreiras] [runs] [semente0] [saida.json]
const D = require('../js/data.js'); const RUN = require('../js/run.js'); const { jogar, sorteio } = require('./run-sim.js');
const NC = +process.argv[2] || 10, NR = +process.argv[3] || 20, S0 = +process.argv[4] || 1, OUT = process.argv[5];
const ORDEM = (process.env.ORDEM || 'banco,contratos,bolsaRica,armeiro,mestres,templo,nivel2,lendarios,arsenal').split(',');
// PRECOS=id:valor,... troca o preço das melhorias só nesta simulação (para testar a curva)
for (const par of (process.env.PRECOS || '').split(',').filter(Boolean)) { const [id, v] = par.split(':'); RUN.MELHORIAS.find(x => x.id === id).custo = +v; }
// ordem de compra dos lendários (LEND=lista para testar um de cada vez)
const LEND = (process.env.LEND || 'armColosso,lamCampeao,anelTita,coroaReis,lamTormenta,mantoArquimago').split(',').filter(Boolean);
const por = Array.from({ length: NR }, () => ({ vit: 0, andar: 0, cofre: 0, pts: 0, guardou: 0, compras: {} }));
for (let c = 0; c < NC; c++) {
  const meta = RUN.novoMeta(); const semente = (S0 + c) * 7919;
  for (let r = 0; r < NR; r++) {
    // leva do baú os 2 itens mais caros
    const idx = meta.bau.map((id, k) => [k, RUN.ITENS[id].preco]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const itens = idx.map(k => meta.bau[k]); meta.bau = meta.bau.filter((_, k) => !idx.includes(k));
    const run = RUN.novaRun({ ...RUN.cfgDaGuilda(meta), herois: sorteio(semente + r), seed: semente * 31 + r, itens });
    if (RUN.tem(meta, 'armeiro')) for (const x of run.herois) if (!x.equip.arma) x.equip.arma = 'certeira';
    for (let k = run.mochila.length - 1; k >= 0; k--) { const it = RUN.ITENS[run.mochila[k]]; const hi = run.herois.findIndex(x => ['arma', 'armadura', 'acessorio'].includes(it.slot) && !x.equip[it.slot]); if (hi >= 0) RUN.equipar(run, hi, k); }
    jogar(run, { merc: run.mercLiberado });
    const res = RUN.encerrarRun(run, meta);
    // compra melhorias: segue a ordem; vende sobras do baú se o próximo item da lista estiver quase no bolso
    for (const id of ORDEM) {
      if (id === 'arsenal') { for (const L of LEND) { if ((meta.arsenal || []).includes(L) || !RUN.liberado(meta, 'lendas')) continue; if (meta.ouro >= RUN.ITENS[L].preco) RUN.comprarLendario(meta, L); else break; } continue; }
      if (RUN.tem(meta, id)) continue; const M = RUN.MELHORIAS.find(x => x.id === id); if (!RUN.liberado(meta, M.marco)) continue; if (meta.ouro >= M.custo) RUN.comprarMelhoria(meta, id); else break;
    }
    const P = por[r]; P.vit += res.venceu ? 1 : 0; P.andar += res.venceu ? 6 : res.andar; P.cofre += meta.ouro; P.pts += meta.pontos; P.guardou += res.ouro;
    for (const M of RUN.MELHORIAS) if (RUN.tem(meta, M.id)) P.compras[M.id] = (P.compras[M.id] || 0) + 1;
    P.compras.lend = (P.compras.lend || 0) + RUN.arsenal(meta).length / LEND.length;
  }
  process.stderr.write('.');
}
const out = { NC, NR, ORDEM, por };
if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(out));
else for (let r = 0; r < NR; r++) { const P = por[r]; console.log(`run ${r + 1}: vitória ${(100 * P.vit / NC).toFixed(0)}% · andar médio ${(P.andar / NC).toFixed(1)} · cofre T$ ${Math.round(P.cofre / NC)} · ${Object.entries(P.compras).map(([k, v]) => k + ' ' + Math.round(100 * v / NC) + '%').join(', ')}`); }
