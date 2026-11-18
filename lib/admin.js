// Utilidades compartidas por las funciones /api/* del panel de administración.
const crypto = require('crypto');

const COOKIE = 'aria_admin';
const MAX_AGE = 60 * 60 * 8; // 8 horas

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

// ---------- Sesión (cookie firmada) ----------
const sign = (data) => crypto.createHmac('sha256', env('SESSION_SECRET')).update(data).digest('base64url');

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function validToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function readCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function setSession(res, token, maxAge = MAX_AGE) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- HTTP ----------
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const bodyOf = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

// Verifica método, sesión y cabecera anti-CSRF. Devuelve true si la petición puede continuar.
function guard(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    send(res, 405, { error: 'Método no permitido' });
    return false;
  }
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'aria-admin') {
    send(res, 403, { error: 'Petición no válida' });
    return false;
  }
  if (!validToken(readCookies(req)[COOKIE])) {
    send(res, 401, { error: 'Sesión vencida. Vuelve a ingresar.' });
    return false;
  }
  return true;
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      console.error('[admin]', e.message);
      const msg = e.stale
        ? 'Otra persona cambió los datos mientras editabas. Recarga la página e inténtalo de nuevo.'
        : status === 400 ? e.message
        : status === 409 || status === 422 ? 'GitHub rechazó el cambio, inténtalo de nuevo en un momento.'
        : 'No se pudo completar la acción. Inténtalo de nuevo.';
      send(res, status, { error: msg });
    }
  };
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// ---------- GitHub ----------
async function ghApi(method, route, body) {
  const repo = env('GITHUB_REPO');
  const r = await fetch(`https://api.github.com/repos/${repo}/${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aria-admin',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || `GitHub ${r.status}`), { status: r.status });
  return data;
}

const branch = () => process.env.GITHUB_BRANCH || 'main';

// Lee un archivo del repo (Contents API).
const gh = (file) => ghApi('GET', `contents/${file}?ref=${encodeURIComponent(branch())}`);

async function leerProductos() {
  const f = await gh('data/productos.json');
  return { sha: f.sha, data: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')) };
}

// ---------- Validación de productos ----------
const FILE_RE = /^[A-Za-z0-9._-]+$/;

function texto(v, max, campo, requerido = true) {
  if (typeof v !== 'string') throw bad(`${campo}: valor inválido`);
  const s = v.trim();
  if (requerido && !s) throw bad(`${campo} es obligatorio`);
  if (s.length > max) throw bad(`${campo} es demasiado largo (máx. ${max})`);
  return s;
}

function limpiarProducto(p) {
  if (!p || typeof p !== 'object') throw bad('Producto inválido');
  const id = texto(p.id, 60, 'Identificador');
  if (!/^[a-z0-9-]+$/.test(id)) throw bad('Identificador inválido');
  const categoria = p.categoria;
  if (!['jarron', 'ramo'].includes(categoria)) throw bad('Categoría inválida');
  if (!Array.isArray(p.imagenes) || p.imagenes.length < 1 || p.imagenes.length > 8) throw bad('Agrega entre 1 y 8 fotos');
  const imagenes = p.imagenes.map((f) => {
    if (typeof f !== 'string' || !FILE_RE.test(f) || f.startsWith('.')) throw bad('Nombre de foto inválido');
    return f;
  });
  const caracteristicas = (Array.isArray(p.caracteristicas) ? p.caracteristicas : [])
    .slice(0, 10)
    .map((c) => ({ k: texto(c && c.k, 60, 'Característica', false), v: texto(c && c.v, 120, 'Valor', false) }))
    .filter((c) => c.k && c.v);
  return {
    id,
    nombre: texto(p.nombre, 80, 'Nombre'),
    tipo: texto(p.tipo, 60, 'Tipo'),
    categoria,
    resumen: texto(p.resumen, 140, 'Resumen'),
    descripcion: texto(p.descripcion, 1500, 'Descripción'),
    imagenes,
    caracteristicas,
    destacado: p.destacado === true,
    activo: p.activo !== false,
  };
}

module.exports = {
  COOKIE, env, makeToken, setSession, safeEqual, send, bodyOf, guard, handle, bad,
  ghApi, branch, gh, leerProductos, limpiarProducto, validToken, readCookies,
};
