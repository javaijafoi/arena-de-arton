// Lança cada magia (com e sem aprimoramentos) e confere se funciona.
const D = require('../js/data.js'); const R = require('../js/rules.js');
let falhas = 0;
for (const cls of ['arcanista', 'clerigo', 'bardo']) {
  const hid = D.HEROIS.find(h => h.classe === cls).id;
  for (const mid of D.CLASSES[cls].magias) {
    const M = D.MAGIAS[mid];
    const variantes = [{}].concat((M.aprim || []).map(a => ({ [a.id]: 1 })));
    for (const ap of variantes) {
      const st = R.novaBatalha({ herois: [hid, 'mari'], nivel: 15, inimigos: ['ogra', 'zumbi', 'capanga'], mapa: 'clareira', seed: 9 });
      const u = st.unidades[0]; st.vez = st.ordem.indexOf(u.id); u.acoes = { padrao: true, movimento: true }; u.x = 5; u.y = 5;
      const al = st.unidades[1]; al.x = 5; al.y = 6; al.pv = 10;
      const [e1, e2, e3] = st.unidades.slice(2); e1.x = 6; e1.y = 5; e2.x = 8; e2.y = 5; e3.x = 7; e3.y = 4;
      let acao = { tipo: 'magia', magia: mid, aprim: ap };
      if (M.forma === 'alvo') acao.alvo = M.alvos === 'aliado' || mid === 'curarFerimentos' ? al.id : e1.id;
      else if (M.forma !== 'si' && !M.forma.startsWith('aura')) acao.ponto = { x: mid === 'sopro' ? 5 : 7, y: mid === 'sopro' ? 7 : 5 };
      const antes = st.unidades.map(o => o.pv + '/' + JSON.stringify(o.cond) + JSON.stringify(o.buff)).join();
      const r = R.executar(st, acao);
      const depois = st.unidades.map(o => o.pv + '/' + JSON.stringify(o.cond) + JSON.stringify(o.buff)).join();
      const mudou = antes !== depois || st.teia.length;
      const ok = r.ok && mudou;
      if (!ok) falhas++;
      console.log(`${ok ? '✓' : '✗'} ${cls.padEnd(9)} ${M.nome.padEnd(26)} ${JSON.stringify(ap).padEnd(14)} ${r.ok ? '' : r.erro} ${st.log.slice(-2).join(' | ').slice(0, 110)}`);
    }
  }
}
console.log(falhas ? falhas + ' FALHAS' : 'tudo certo');
