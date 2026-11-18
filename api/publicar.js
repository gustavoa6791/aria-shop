// Publica todos los cambios del borrador en UN solo commit: data/productos.json + fotos nuevas.
const { guard, handle, send, bodyOf, bad, ghApi, branch, leerProductos, limpiarProducto } = require('../lib/admin');

const SHA_RE = /^[0-9a-f]{40}$/;
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
  if (actual.sha !== sha) throw Object.assign(new Error('desactualizado'), { status: 409 });
  const json = JSON.stringify({ ...actual.data, productos: limpios }, null, 2) + '\n';

  const ref = await ghApi('GET', `git/ref/heads/${encodeURIComponent(branch())}`);
  const head = ref.object.sha;
  const headCommit = await ghApi('GET', `git/commits/${head}`);
  const tree = await ghApi('POST', 'git/trees', {
    base_tree: headCommit.tree.sha,
    tree: [
      { path: 'data/productos.json', mode: '100644', type: 'blob', content: json },
      ...nuevas.map(([name, b]) => ({ path: `assets/${name}`, mode: '100644', type: 'blob', sha: b })),
    ],
  });
  const commit = await ghApi('POST', 'git/commits', {
    message: `Admin: actualizar catálogo (${limpios.length} productos${nuevas.length ? `, ${nuevas.length} fotos nuevas` : ''})`,
    tree: tree.sha,
    parents: [head],
  });
  await ghApi('PATCH', `git/refs/heads/${encodeURIComponent(branch())}`, { sha: commit.sha, force: false });

  const entry = tree.tree.find((t) => t.path === 'data/productos.json');
  send(res, 200, { ok: true, sha: entry.sha });
});
