/* Configuração do Arena de Arton.
   tokensBase: de onde vêm os retratos (arquivos <id>.jpg). Troque a URL para mudar de hospedagem;
   deixe '' para usar só os emblemas genéricos. Se a imagem não carregar, o emblema aparece sozinho. */
window.ARENA_CONFIG = {
  tokensBase: 'https://raw.githubusercontent.com/javaijafoi/arton-assets/main/tokens/',
  // retratos 48x48 em pixel (menus) e recortes do mapa de Arton (mapa da run); mesmo repositório de arte
  pixelBase: 'https://raw.githubusercontent.com/javaijafoi/arton-assets/main/tokens-px/',
  mapasBase: 'https://raw.githubusercontent.com/javaijafoi/arton-assets/main/mapas/'
};
/* Este repositório NÃO contém arte. Os retratos (da Jambô, homenagem de fã) vêm de tokensBase;
   se não carregarem, cada personagem usa um emblema gerado. */
window.ARENA_TOK = (function () {
  const BASE = window.ARENA_CONFIG.tokensBase || '';
  const emblema = n => {
    let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
    const ini = n.split('-').filter(w => w.length > 2 || n.split('-').length < 3).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="50%" cy="35%"><stop offset="0" stop-color="hsl(${h},55%,48%)"/><stop offset="1" stop-color="hsl(${(h + 30) % 360},60%,20%)"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><path d="M50 14 78 26v22c0 18-12 31-28 38C34 79 22 66 22 48V26z" fill="none" stroke="#f5c542" stroke-width="3" opacity=".55"/><text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="34" fill="#f4f1ea">${ini}</text></svg>`;
    return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
  };
  const f = n => (BASE ? `url('${BASE}${n}.jpg'),` : '') + emblema(n);
  // versão pixel (png 48x48) para os menus; cai no retrato normal e depois no emblema
  const PX = window.ARENA_CONFIG.pixelBase || '';
  f.px = n => (PX ? `url('${PX}${n}.png'),` : '') + f(n);
  f.mapa = nome => window.ARENA_CONFIG.mapasBase ? window.ARENA_CONFIG.mapasBase + nome : '';
  return f;
})();
