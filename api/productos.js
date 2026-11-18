const { guard, handle, send, bodyOf, bad, gh, leerProductos, limpiarProducto } = require('../lib/admin');

module.exports = handle(async (req, res) => {
  if (!guard(req, res, ['GET', 'PUT'])) return;

  if (req.method === 'GET') {
    const { sha, data } = await leerProductos();
    return send(res, 200, { sha, productos: data.productos });
  }

  const { sha, productos } = bodyOf(req);
  if (typeof sha !== 'string' || !Array.isArray(productos)) throw bad('Datos incompletos');
  if (productos.length > 200) throw bad('Demasiados productos');
  const limpios = productos.map(limpiarProducto);
  const ids = new Set(limpios.map((p) => p.id));
  if (ids.size !== limpios.length) throw bad('Hay productos con el mismo identificador');

  const actual = await leerProductos(); // conserva "config"
  if (actual.sha !== sha) throw Object.assign(new Error('desactualizado'), { status: 409 });
  const nuevo = { ...actual.data, productos: limpios };
  const r = await gh('PUT', 'data/productos.json', {
    message: 'Admin: actualizar productos',
    content: Buffer.from(JSON.stringify(nuevo, null, 2) + '\n').toString('base64'),
    sha: actual.sha,
  });
  send(res, 200, { ok: true, sha: r.content.sha });
});
