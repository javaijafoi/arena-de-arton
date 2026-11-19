/* Arena de Arton — save na nuvem (Supabase central dos apps, schema "arena").
   Cada aparelho tem um código (id + segredo) guardado no localStorage. Com o mesmo código,
   outro aparelho carrega o mesmo progresso. O localStorage continua sendo a cópia local. */
(function () {
  'use strict';
  const CFG = Object.assign({ url: 'https://xhncsuemwfybihpxzvfj.supabase.co', chave: 'sb_publishable_MJ29j25WCA42QkQedXvJew_2yrxz-2I' }, window.ARENA_NUVEM || {});
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } } };
  const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : hex(16).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-4$3-a$4-$5').slice(0, 36));
  function conta() { let c = ls.get('arena.nuvem'); if (!c || !c.id || !c.segredo) { c = { id: uuid(), segredo: hex(16) }; ls.set('arena.nuvem', c); } return c; }
  const N = { estado: 'local', ultimo: null, erro: null, ouvintes: [] };
  const avisar = () => N.ouvintes.forEach(f => { try { f(N); } catch (e) { /* ok */ } });
  async function rpc(fn, corpo) {
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CFG.chave, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || 'HTTP ' + r.status); return j;
  }
  let timer = null, pendente = null;
  function agendar(meta, run) {
    pendente = { meta, run }; ls.set('arena.salvoEm', Date.now());
    clearTimeout(timer); timer = setTimeout(enviar, 1500);
  }
  async function enviar() {
    if (!pendente || !navigator.onLine) return; const c = conta(); const p = pendente; pendente = null;
    N.estado = 'salvando'; avisar();
    try { const t = await rpc('arena_salvar', { p_id: c.id, p_segredo: c.segredo, p_meta: p.meta, p_run: p.run }); N.estado = 'nuvem'; N.ultimo = t; N.erro = null; ls.set('arena.salvoEm', Date.parse(t) || Date.now()); }
    catch (e) { N.estado = 'erro'; N.erro = e.message; pendente = pendente || p; }
    avisar();
  }
  // carrega da nuvem; devolve {meta, run} se a nuvem for mais nova que o save local
  async function puxar(forcar) {
    const c = conta();
    try {
      const d = await rpc('arena_carregar', { p_id: c.id, p_segredo: c.segredo }); N.estado = 'nuvem'; avisar();
      if (!d) return null; const t = Date.parse(d.atualizado) || 0; const local = ls.get('arena.salvoEm') || 0;
      if (forcar || t > local + 2000) { ls.set('arena.salvoEm', t); return d; }
      return null;
    } catch (e) { N.estado = 'erro'; N.erro = e.message; avisar(); return null; }
  }
  const codigo = () => { const c = conta(); return c.id + '.' + c.segredo; };
  async function usarCodigo(txt) {
    const m = String(txt || '').trim().match(/^([0-9a-f-]{36})\.([0-9a-f]{24,})$/i); if (!m) throw new Error('Código inválido.');
    const d = await rpc('arena_carregar', { p_id: m[1], p_segredo: m[2] }); if (!d) throw new Error('Nenhum save com esse código.');
    ls.set('arena.nuvem', { id: m[1], segredo: m[2] }); ls.set('arena.salvoEm', Date.parse(d.atualizado) || Date.now()); return d;
  }
  window.addEventListener('online', () => { if (pendente) enviar(); });
  Object.assign(N, { agendar, enviar, puxar, codigo, usarCodigo, ouvir: f => N.ouvintes.push(f) });
  window.NUVEM = N;
})();
