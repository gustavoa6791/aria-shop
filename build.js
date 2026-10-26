#!/usr/bin/env node
// Genera el sitio estático de ARIA en /public a partir de data/productos.json
// Uso: node build.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'public');
const { config: C, productos: P } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/productos.json'), 'utf8'));

for (const p of P) {
  if (!/^[a-z0-9-]+$/.test(p.id)) throw new Error(`id inválido (solo a-z, 0-9 y guiones): ${p.id}`);
  for (const f of p.imagenes) {
    if (!/^[A-Za-z0-9._-]+$/.test(f) || f.startsWith('.')) throw new Error(`imagen inválida en ${p.id}: ${f}`);
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sitio = C.sitio.replace(/\/$/, '');
const img = (base, f) => `${base}img/${f}`;
const waLink = (p) => {
  const msg = `Hola, vi este producto en mi página: ${p.nombre}. Me interesa, ¿me das más información?\n${sitio}/p/${p.id}.html`;
  return `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
};
const waGeneric = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent('Hola, vi su página y quisiera información sobre un arreglo.')}`;

const WA_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/></svg>';
const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';

function head({ title, desc, base, ogImage, ogUrl }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.nombre)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(ogUrl)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${base}img/aria-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap">
<link rel="stylesheet" href="${base}styles.css">
</head>
<body>`;
}

function header(base, active) {
  const a = (k, href, label) => `<a href="${href}"${active === k ? ' class="on"' : ''}>${label}</a>`;
  return `<header class="wrap site-header">
<a class="logo" href="${base}index.html" aria-label="${esc(C.nombre)}, inicio"><img src="${img(base, 'aria-logo.png')}" alt=""></a>
<nav class="nav" aria-label="Principal">
${a('inicio', base + 'index.html', 'Inicio')}
${a('catalogo', base + 'catalogo.html', 'Catálogo')}
<a href="#contacto">Contacto</a>
</nav>
</header>`;
}

function footer(base, title = '¿Buscas algo especial?', sub = 'Escríbenos y armamos un arreglo a tu medida.') {
  return `<footer class="site-footer" id="contacto">
<div class="wrap">
<div class="top">
<div>
<h2>${esc(title)}</h2>
<p>${esc(sub)}</p>
<a class="btn btn-light" href="${waGeneric}" target="_blank" rel="noopener">${WA_ICON} Escribir por WhatsApp</a>
</div>
<div>
<img src="${img(base, 'aria-logo.png')}" alt="${esc(C.nombre)}, ${esc(C.lema)}">
<p class="tel">WhatsApp: ${esc(C.telefonoVisible)}</p>
</div>
</div>
<div class="copy">© ${new Date().getFullYear()} ${esc(C.nombre)} — ${esc(C.lema)}</div>
</div>
</footer>
</body>
</html>`;
}

const precio = (p) => (C.mostrarPrecios && p.precio ? `<div class="precio">${esc(p.precio)}</div>` : '');

function card(p, base, linkBase) {
  return `<a class="card" href="${linkBase}p/${p.id}.html" data-cat="${esc(p.categoria)}">
<div class="ph"><img src="${img(base, p.imagenes[0])}" alt="${esc(p.nombre)}: ${esc(p.resumen)}" loading="lazy"></div>
<h3>${esc(p.nombre)}</h3>
<p>${esc(p.resumen)}</p>${precio(p)}
</a>`;
}

// ---------- Inicio ----------
function inicio() {
  const dest = P.filter((p) => p.destacado).slice(0, 3);
  const hero = P.find((p) => p.id === 'dulce-ocre') || P[0];
  const dot = P.find((p) => p.id === 'amor-primaveral') || P[1];
  const about = P.find((p) => p.id === 'eternidad-dorada') || P[0];
  return head({ title: `${C.nombre} — ${C.lema}`, desc: C.descripcion, base: '', ogImage: `${sitio}/img/${hero.imagenes[0]}`, ogUrl: sitio + '/' }) +
`
${header('', 'inicio')}
<main>
<section class="wrap hero">
<div class="hero-text">
<p class="eyebrow">Flores secas y procesadas</p>
<h1>Naturaleza<br><em>que perdura.</em></h1>
<p class="lead">Arreglos de flores secas naturales, perfectos para decorar tus espacios con estilo. Cada pieza se arma a mano y no se marchita.</p>
<div class="hero-cta">
<a class="btn" href="catalogo.html">Ver catálogo ${ARROW}</a>
<a class="link-u" href="#destacados">Destacados</a>
</div>
</div>
<div class="hero-art"><div class="hero-frame">
<div class="arch"><img src="${img('', hero.imagenes[0])}" alt="${esc(hero.nombre)}: ${esc(hero.resumen)}"></div>
<div class="dot"><img src="${img('', dot.imagenes[0])}" alt="${esc(dot.nombre)}"></div>
</div></div>
</section>

<section class="band" aria-label="Valores"><div class="wrap">
<span>Flores secas naturales</span><span>Arreglos listos para decorar</span><span>Pedidos por WhatsApp</span>
</div></section>

<section class="wrap section" id="destacados">
<div class="section-head">
<div><p class="eyebrow" style="margin-bottom:14px">Selección</p><h2>Hechos para llenar de calidez</h2></div>
<a class="link-u" href="catalogo.html">Ver todo el catálogo</a>
</div>
<div class="grid">
${dest.map((p) => card(p, '', '')).join('\n')}
</div>
</section>

<section class="about"><div class="wrap">
<div class="pic"><div><img src="${img('', about.imagenes[0])}" alt="${esc(about.nombre)}: ${esc(about.resumen)}" loading="lazy"></div></div>
<div class="txt">
<p class="eyebrow">Sobre Aria</p>
<h2>Flores que se quedan contigo</h2>
<p>En Aria vendemos flores secas y procesadas, perfectas para decorar tus espacios con estilo. Combinamos flores, follajes y espigas en composiciones pensadas para iluminar cualquier rincón de tu casa.</p>
<a class="btn btn-outline" href="catalogo.html">Conocer los arreglos</a>
</div>
</div></section>

<section class="wrap section steps" style="padding-top:112px;padding-bottom:104px">
<h2>Pedir es muy sencillo</h2>
<div class="row">
<div class="step"><div class="n">01</div><h3>Elige tu arreglo</h3><p>Recorre el catálogo y abre el que más te guste para ver sus características.</p></div>
<div class="step"><div class="n">02</div><h3>Escríbenos</h3><p>Con un toque se abre WhatsApp con el producto y un mensaje ya listo.</p></div>
<div class="step"><div class="n">03</div><h3>Coordinamos</h3><p>Confirmamos disponibilidad, pago y entrega contigo, de forma personal.</p></div>
</div>
</section>
</main>
` + footer('');
}

// ---------- Catálogo ----------
function catalogo() {
  const cats = [['todos', 'Todos']];
  if (P.some((p) => p.categoria === 'jarron')) cats.push(['jarron', 'Con jarrón']);
  if (P.some((p) => p.categoria === 'ramo')) cats.push(['ramo', 'Ramos']);
  return head({ title: `Catálogo — ${C.nombre}`, desc: 'Arreglos de flores secas naturales en jarrones y ramos.', base: '', ogImage: `${sitio}/img/${P[0].imagenes[0]}`, ogUrl: `${sitio}/catalogo.html` }) +
`
${header('', 'catalogo')}
<main>
<section class="wrap page-title">
<p class="eyebrow">Catálogo</p>
<h1>Nuestros arreglos</h1>
<p>Flores secas naturales en jarrones y ramos. Elige uno para ver sus características.</p>
</section>
<div class="wrap chips" role="group" aria-label="Filtrar por tipo">
${cats.map(([k, l], i) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('\n')}
</div>
<section class="wrap catalog"><div class="grid" id="lista">
${P.map((p) => card(p, '', '')).join('\n')}
</div></section>
</main>
<script>
(function(){
  var chips=document.querySelectorAll('.chip'),cards=document.querySelectorAll('#lista .card');
  chips.forEach(function(c){c.addEventListener('click',function(){
    var f=c.getAttribute('data-f');
    chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});
    cards.forEach(function(k){k.hidden=!(f==='todos'||k.getAttribute('data-cat')===f)});
  })});
})();
</script>
` + footer('', '¿No encuentras lo que buscas?', 'Cuéntanos qué tienes en mente por WhatsApp.');
}

// ---------- Producto ----------
function producto(p) {
  const base = '../';
  const otros = P.filter((x) => x.id !== p.id).slice(0, 4);
  const multi = p.imagenes.length > 1;
  return head({ title: `${p.nombre} — ${C.nombre}`, desc: p.descripcion, base, ogImage: `${sitio}/img/${p.imagenes[0]}`, ogUrl: `${sitio}/p/${p.id}.html` }) +
`
${header(base, 'catalogo')}
<main>
<nav class="wrap crumbs" aria-label="Ruta"><a href="${base}index.html">Inicio</a> &nbsp;/&nbsp; <a href="${base}catalogo.html">Catálogo</a> &nbsp;/&nbsp; <span>${esc(p.nombre)}</span></nav>
<section class="wrap detail">
<div class="gallery">
<div class="main"><img id="foto" src="${img(base, p.imagenes[0])}" alt="${esc(p.nombre)}: ${esc(p.resumen)}"></div>
${multi ? `<div class="thumbs">${p.imagenes.map((f, i) => `<button class="thumb" type="button" data-src="${img(base, f)}" aria-label="Ver foto ${i + 1}" aria-current="${i === 0}"><img src="${img(base, f)}" alt=""></button>`).join('')}</div>` : ''}
</div>
<div class="info">
<p class="eyebrow">${esc(p.tipo)}</p>
<h1>${esc(p.nombre)}</h1>${C.mostrarPrecios && p.precio ? `\n<p class="precio">${esc(p.precio)}</p>` : ''}
<p class="desc">${esc(p.descripcion)}</p>
<dl class="specs">
${p.caracteristicas.map((c) => `<div><dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd></div>`).join('\n')}
</dl>
<a class="btn btn-lg" href="${waLink(p)}" target="_blank" rel="noopener">${WA_ICON} Pedir por WhatsApp</a>
</div>
</section>
<section class="others"><div class="wrap">
<div class="head"><h2>Otros arreglos</h2><a class="link-u" href="${base}catalogo.html">Ver catálogo</a></div>
<div class="row">
${otros.map((o) => `<a class="card" href="${o.id}.html"><div class="ph"><img src="${img(base, o.imagenes[0])}" alt="${esc(o.nombre)}" loading="lazy"></div><h3>${esc(o.nombre)}</h3></a>`).join('\n')}
</div>
</div></section>
</main>
${multi ? `<script>
(function(){
  var foto=document.getElementById('foto'),t=document.querySelectorAll('.thumb');
  t.forEach(function(b){b.addEventListener('click',function(){
    foto.src=b.getAttribute('data-src');
    t.forEach(function(x){x.setAttribute('aria-current',x===b)});
  })});
})();
</script>` : ''}
` + footer(base);
}

// ---------- Escribir ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'p'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) {
  const dest = f === 'styles.css' ? path.join(OUT, f) : path.join(OUT, 'img', f);
  fs.copyFileSync(path.join(ROOT, 'assets', f), dest);
}
fs.writeFileSync(path.join(OUT, 'index.html'), inicio());
fs.writeFileSync(path.join(OUT, 'catalogo.html'), catalogo());
for (const p of P) fs.writeFileSync(path.join(OUT, 'p', `${p.id}.html`), producto(p));
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${sitio}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ['/', '/catalogo.html', ...P.map((p) => `/p/${p.id}.html`)].map((u) => `<url><loc>${sitio}${u}</loc></url>`).join('\n') + `\n</urlset>\n`);
console.log(`OK: ${P.length} productos → public/`);
