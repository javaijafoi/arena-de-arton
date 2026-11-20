// Testa a curva do bestiário: pares e trios de criaturas geradas, em vários níveis.
const D = require('../js/data.js'); const R = require('../js/rules.js'); const IA = require('../js/ai.js'); const B = require('../js/bestiario.js');
const N = +process.argv[2] || 10; const grupo = (process.argv[3] || 'mari,hana,zaldrin,aria').split(',');
function lutar(st) { let g = 0; while (!st.fim && g < 800) { const t = st.turnoId; let p = 0; while (!st.fim && st.turnoId === t && p < 10) { const a = IA.proximaAcao(st); const r = R.executar(st, a); if (!r.ok) R.executar(st, { tipo: 'fim' }); p++; } if (!st.fim && st.turnoId === t) R.executar(st, { tipo: 'fim' }); g++; if (st.rodada > 30) { st.fim = 'inimigos'; break; } } }
function caso(nivel, ids) { let v = 0, perda = 0; for (let s = 1; s <= N; s++) { const st = R.novaBatalha({ herois: grupo, nivel, inimigos: ids, mapa: 'clareira', seed: s * 7919 + nivel, run: true }); R.comecar(st); lutar(st); const hs = st.unidades.filter(u => u.lado === 'h'); if (st.fim === 'herois') v++; perda += hs.reduce((a, u) => a + (u.vivo ? 1 - Math.max(0, u.pv) / u.pvMax : 1), 0) / hs.length; } return `${(100 * v / N).toFixed(0)}%/${(100 * perda / N).toFixed(0)}%`; }
const papeis = ['bruto', 'fera', 'tanque', 'agil', 'atirador', 'arcano', 'divino', 'dragao'];
for (const L of [5, 8, 12, 16, 19]) {
  const linha = [];
  for (const [k, q] of [[1, 'solo+2'], [2, 'par'], [3, 'trio']]) {
    const nd = k === 1 ? L + 1 : k === 2 ? L - 2 : L - 4;
    const ids = []; for (let i = 0; i < k; i++) { const p = papeis[(L + i * 3) % papeis.length]; const id = `t_${p}_${nd}`; D.CRIATURAS[id] = B.criatura('T', nd, p); ids.push(id); }
    linha.push(`${q}(ND${nd}) ${caso(L, ids)}`);
  }
  const pp = papeis.map(p => { const id = `p_${p}_${L}`; D.CRIATURAS[id] = B.criatura('T', L - 2, p); return `${p} ${caso(L, [id, id])}`; });
  console.log(`nv${L}: ${linha.join(' | ')}\n   pares por papel: ${pp.join(' · ')}`);
}
