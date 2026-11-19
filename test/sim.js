// Simula a escada de encontros com IA nos dois lados. Uso: node test/sim.js [n] [grupo]
const D = require('../js/data.js'); const R = require('../js/rules.js'); const IA = require('../js/ai.js');
const N = +process.argv[2] || 40;
const grupo = (process.argv[3] || 'mari,hana,zaldrin,aria').split(',');
const erros = {}; const usoAcoes = {};
for (const E of D.ENCONTROS) {
  let vit = 0, rod = 0, mortos = 0, caidos = 0, timeout = 0;
  for (let s = 1; s <= N; s++) {
    const st = R.novaBatalha({ herois: grupo, nivel: E.nivel, inimigos: E.inimigos, mapa: E.mapa, seed: s * 7919 + E.nivel, oportunidade: !!process.env.OP });
    let guard = 0;
    while (!st.fim && guard < 600) {
      const turno = st.turnoId; let passos = 0;
      while (!st.fim && st.turnoId === turno && passos < 10) {
        const a = IA.proximaAcao(st); const r = R.executar(st, a);
        const k = a.tipo + (a.magia ? ':' + a.magia : a.hab ? ':' + a.hab : '');
        usoAcoes[k] = (usoAcoes[k] || 0) + 1;
        if (!r.ok) { const ke = k + ' → ' + r.erro; erros[ke] = (erros[ke] || 0) + 1; R.executar(st, { tipo: 'fim' }); }
        passos++;
      }
      if (!st.fim && st.turnoId === turno) R.executar(st, { tipo: 'fim' });
      guard++;
      if (st.rodada > 30) { timeout++; break; }
    }
    if (st.fim === 'herois') vit++;
    rod += st.rodada;
    mortos += st.unidades.filter(u => u.lado === 'h' && !u.vivo).length;
    caidos += st.unidades.filter(u => u.lado === 'h' && u.vivo && u.pv <= 0).length;
  }
  console.log(`${String(E.nivel).padStart(2)} ${E.nome.padEnd(20)} vitória ${(100 * vit / N).toFixed(0).padStart(3)}%  rodadas ${(rod / N).toFixed(1)}  mortos/luta ${(mortos / N).toFixed(2)} caídos ${(caidos / N).toFixed(2)} ${timeout ? 'TIMEOUT ' + timeout : ''}`);
}
console.log('\nErros:', erros);
console.log('Ações:', Object.entries(usoAcoes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join('  '));
