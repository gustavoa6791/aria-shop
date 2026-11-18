const { guard, handle, send, leerProductos } = require('../lib/admin');

module.exports = handle(async (req, res) => {
  if (!guard(req, res, ['GET'])) return;
  const { sha, data } = await leerProductos();
  send(res, 200, { sha, productos: data.productos });
});
