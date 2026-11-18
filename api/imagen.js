// Sube una foto como "blob" de Git (todavía sin commit). El commit se hace una sola vez en /api/publicar.
const { guard, handle, send, bodyOf, bad, ghApi } = require('../lib/admin');

const MAX_BYTES = 3 * 1024 * 1024;
const NAME_RE = /^[a-z0-9-]{1,60}-[a-z0-9]{3,12}\.jpg$/;

module.exports = handle(async (req, res) => {
  if (!guard(req, res, ['POST'])) return;

  const { archivo, data } = bodyOf(req);
  if (typeof archivo !== 'string' || !NAME_RE.test(archivo)) throw bad('Nombre de foto inválido');
  if (typeof data !== 'string') throw bad('Foto inválida');
  const buf = Buffer.from(data.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  if (buf.length < 1000 || buf.length > MAX_BYTES) throw bad('La foto es muy pequeña o muy pesada');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw bad('La foto debe ser JPG');

  const blob = await ghApi('POST', 'git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
  send(res, 200, { archivo, blob: blob.sha });
});
