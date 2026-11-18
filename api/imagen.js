const { guard, handle, send, bodyOf, bad, gh } = require('../lib/admin');

const MAX_BYTES = 3 * 1024 * 1024;

module.exports = handle(async (req, res) => {
  if (!guard(req, res, ['POST'])) return;

  const { id, data } = bodyOf(req);
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(id)) throw bad('Identificador inválido');
  if (typeof data !== 'string') throw bad('Foto inválida');
  const buf = Buffer.from(data.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  if (buf.length < 1000 || buf.length > MAX_BYTES) throw bad('La foto es muy pequeña o muy pesada');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw bad('La foto debe ser JPG');

  const archivo = `${id}-${Date.now().toString(36)}.jpg`;
  await gh('PUT', `assets/${archivo}`, {
    message: `Admin: foto de ${id}`,
    content: buf.toString('base64'),
  });
  send(res, 200, { archivo });
});
