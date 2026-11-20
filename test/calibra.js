// Calibra o bestiário: luta isolada, grupo cheio de PV no nível L contra um encontro de ND ≈ alvo.
// Uso: node test/calibra.js [n por caso] [grupo]
const D = require('../js/data.js'); const R = require('../js/rules.js'); const IA = require('../js/ai.js'); const RUN = require('../js/run.js');
const N = +process.argv[2] || 12;
const grupo = (process.argv[3] || 'mari,hana,zaldrin,aria').split(',');
function lutar(st) {
  let guard = 0;
  while (!st.fim && guard < 800) {
    const turno = st.turnoId; let passos = 0;
    while (!st.fim && st.turnoId === turno && passos < 10) { const a = IA.proximaAcao(st); const r = R.executar(st, a); if (!r.ok) R.executar(st, { tipo: 'fim' }); passos++; }
    if (!st.fim && st.turnoId === turno) R.executar(st, { tipo: 'fim' });
    guard++; if (st.rodada > 30) { st.fim = 'inimigos'; break; }
  }
}
function caso(nivel, ids, chefe) {
  let v = 0, perda = 0, rod = 0;
  for (let s = 1; s <= N; s++) {
    const st = R.novaBatalha({ herois: grupo, nivel, inimigos: ids, mapa: 'clareira', seed: s * 7919 + nivel, run: true });
    if (chefe) { const b = st.unidades.find(u => u.lado === 'm' && u.ref === chefe); b.pvMax *= 2; b.pv = b.pvMax; b.rd = Math.max(b.rd || 0, 5); b.chefe = true; }
    R.comecar(st); lutar(st);
    const hs = st.unidades.filter(u => u.lado === 'h');
    if (st.fim === 'herois') v++;
    perda += hs.reduce((a, u) => a + (u.vivo ? 1 - Math.max(0, u.pv) / u.pvMax : 1), 0) / hs.length; rod += st.rodada;
  }
  return `vit ${(100 * v / N).toFixed(0)}% perda PV ${(100 * perda / N).toFixed(0)}% rodadas ${(rod / N).toFixed(1)}`;
}
const tema = id => RUN.TEMAS.find(t => t.id === id);
function grupoPara(nivel, temaId) { // mesma busca do jogo (gerarGrupo) via inimigosDoNo num nó falso
  const run = { seed: 12345, nivel, andar: (tema(temaId).andar || 1) }; const n = { id: Math.floor(Math.random() * 1e6), tipo: 'batalha', tema: temaId, c: 5 };
  return RUN.inimigosDoNo(run, n);
}
console.log('referência andar 1');
for (const [nv, t] of [[2, 'bandidos'], [3, 'puristas'], [3, 'feras']]) { const g = grupoPara(nv, t); console.log(` nv${nv} ${t} ND ${g.nd} [${g.ids}] → ${caso(nv, g.ids)}`); }
for (const [nv, t] of [[4, 'goblinoides'], [5, 'ferasTollon'], [6, 'ogros'], [8, 'gelo'], [9, 'construtos'], [10, 'gigantes'], [11, 'serpes'], [12, 'esqueletos'], [13, 'fantasmas'], [15, 'colossos'], [16, 'lefeu'], [18, 'corrompidos'], [19, 'dragoesTormenta']]) {
  const g = grupoPara(nv, t); console.log(` nv${nv} ${t} ND ${g.nd} [${g.ids}] → ${caso(nv, g.ids)}`);
}
console.log('chefes');
for (const C of RUN.CHEFES) { const nv = RUN.ANDARES[C.andar || 1].teto - 1; const run = { seed: 1, nivel: nv, andar: C.andar || 1 }; const g = RUN.inimigosDoNo(run, { id: 99, tipo: 'chefe', chefeId: C.id }); console.log(` ${C.id} nv${nv} ND ${g.nd} [${g.ids}] → ${caso(nv, g.ids, g.chefe)}`); }
