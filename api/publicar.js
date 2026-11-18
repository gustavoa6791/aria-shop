// Publica todos los cambios del borrador en UN solo commit: data/productos.json + fotos nuevas.
const crypto = require('crypto');
const { guard, handle, send, bodyOf, bad, ghApi, branch, leerProductos, limpiarProducto } = require('../lib/admin');

const SHA_RE = /^[0-9a-f]{40}$/;
const FILE_RE = /^[A-Za-z0-9._-]+$/;
const NAME_RE = /^[a-z0-9-]{1,60}-[a-z0-9]{3,12}\.jpg$/;

module.exports = handle(async (req, res) => {
  if (!guard(req, res, ['POST'])) return;

  const { sha, productos, blobs } = bodyOf(req);
  if (typeof sha !== 'string' || !Array.isArray(productos)) throw bad('Datos incompletos');
  if (productos.length > 200) throw bad('Demasiados productos');
  const limpios = productos.map(limpiarProducto);
  if (new Set(limpios.map((p) => p.id)).size !== limpios.length) throw bad('Hay productos con el mismo identificador');

  // Fotos nuevas: solo las que algún producto usa y que ya se subieron como blob.
  const usadas = new Set(limpios.flatMap((p) => p.imagenes));
  const fotos = Object.entries(blobs && typeof blobs === 'object' ? blobs : {});
  for (const [name, b] of fotos) {
    if (!NAME_RE.test(name) || typeof b !== 'string' || !SHA_RE.test(b)) throw bad('Foto inválida');
  }
  const nuevas = fotos.filter(([name]) => usadas.has(name));

  const actual = await leerProductos(); // conserva "config" y detecta ediciones simultáneas
  if (actual.sha !== sha) throw Object.assign(new Error('desactualizado'), { status: 409, stale: true });
  const json = JSON.stringify({ ...actual.data, productos: limpios }, null, 2) + '\n';

  const ref = await ghApi('GET', `git/ref/heads/${encodeURIComponent(branch())}`);
  const head = ref.object.sha;
  const headCommit = await ghApi('GET', `git/commits/${head}`);

  // Productos eliminados: se borran sus fotos (si ningún otro producto las usa) y sus páginas generadas.
  const quedan = new Set(limpios.map((p) => p.id));
  const eliminados = actual.data.productos.filter((p) => !quedan.has(p.id));
  const aBorrar = new Set();
  if (eliminados.length) {
    const existentes = await ghApi('GET', `git/trees/${headCommit.tree.sha}?recursive=1`);
    const hay = (p) => existentes.truncated || existentes.tree.some((t) => t.path === p);
    for (const p of eliminados) {
      if (hay(`public/p/${p.id}.html`)) aBorrar.add(`public/p/${p.id}.html`);
      for (const f of p.imagenes || []) {
        if (usadas.has(f) || !FILE_RE.test(f)) continue;
        for (const path of [`assets/${f}`, `public/img/${f}`]) if (hay(path)) aBorrar.add(path);
      }
    }
  }

  const tree = await ghApi('POST', 'git/trees', {
    base_tree: headCommit.tree.sha,
    tree: [
      { path: 'data/productos.json', mode: '100644', type: 'blob', content: json },
      ...nuevas.map(([name, b]) => ({ path: `assets/${name}`, mode: '100644', type: 'blob', sha: b })),
      ...[...aBorrar].map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
    ],
  });
  const commit = await ghApi('POST', 'git/commits', {
    message: `Admin: actualizar catálogo (${limpios.length} productos${nuevas.length ? `, ${nuevas.length} fotos nuevas` : ''}${eliminados.length ? `, ${eliminados.length} eliminados` : ''})`,
    tree: tree.sha,
    parents: [head],
  });
  await ghApi('PATCH', `git/refs/heads/${encodeURIComponent(branch())}`, { sha: commit.sha, force: false });

  // sha de Git del archivo nuevo (la respuesta de la API solo trae las carpetas de primer nivel)
  const buf = Buffer.from(json);
  const nuevoSha = crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
  send(res, 200, { ok: true, sha: nuevoSha });
});
