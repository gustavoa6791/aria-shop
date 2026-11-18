const { COOKIE, env, makeToken, setSession, safeEqual, send, bodyOf, handle, validToken, readCookies } = require('../lib/admin');

module.exports = handle(async (req, res) => {
  if (req.method === 'GET') {
    return send(res, 200, { autenticado: validToken(readCookies(req)[COOKIE]) });
  }
  if (req.headers['x-requested-with'] !== 'aria-admin') return send(res, 403, { error: 'Petición no válida' });
  if (req.method === 'DELETE') {
    setSession(res, '', 0);
    return send(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });

  const { usuario, clave } = bodyOf(req);
  const okUser = safeEqual(usuario ?? '', env('ADMIN_USER'));
  const okPass = safeEqual(clave ?? '', env('ADMIN_PASSWORD'));
  if (!(okUser && okPass)) {
    await new Promise((r) => setTimeout(r, 800)); // frena adivinar claves
    return send(res, 401, { error: 'Usuario o contraseña incorrectos' });
  }
  setSession(res, makeToken());
  send(res, 200, { ok: true });
});
