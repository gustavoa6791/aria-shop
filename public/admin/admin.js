(function () {
  'use strict';
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  // base = lo publicado; draft = tu copia de trabajo; pending = fotos nuevas aún sin subir (nombre -> data URL)
  var state = { sha: null, base: [], draft: [], pending: {} };
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  function photoSrc(name) { return state.pending[name] || '/img/' + name; }
  function changedIds() {
    var baseById = {};
    state.base.forEach(function (p) { baseById[p.id] = JSON.stringify(p); });
    var out = [];
    state.draft.forEach(function (p) { if (baseById[p.id] !== JSON.stringify(p)) out.push(p.id); });
    if (!out.length && JSON.stringify(state.base.map(function (p) { return p.id; })) !== JSON.stringify(state.draft.map(function (p) { return p.id; }))) out.push('_orden');
    return out;
  }
  window.addEventListener('beforeunload', function (e) { if (changedIds().length) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- helpers ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function show(node) { clear(app); app.appendChild(node); window.scrollTo(0, 0); }
  var toastTimer;
  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, bad ? 6000 : 4500);
  }

  function api(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aria-admin' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && url !== '/api/login') { renderLogin('Tu sesión venció. Ingresa de nuevo.'); }
        if (!r.ok) { var e = new Error(data.error || 'Error inesperado'); e.status = r.status; throw e; }
        return data;
      });
    });
  }

  function slug(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  }

  // Reduce la foto a máx. 1200 px y la pasa a JPG (liviana para la web).
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1200, w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, max / Math.max(w, hh));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(hh * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
      img.src = url;
    });
  }

  // ---------- login ----------
  function renderLogin(msg) {
    var err = h('p', { class: 'err', role: 'alert' }, msg || '');
    var u = h('input', { type: 'text', id: 'u', autocomplete: 'username', required: true });
    var p = h('input', { type: 'password', id: 'p', autocomplete: 'current-password', required: true });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Ingresar');
    var form = h('form', { class: 'login', onsubmit: function (e) {
      e.preventDefault();
      btn.disabled = true; err.textContent = '';
      api('POST', '/api/login', { usuario: u.value, clave: p.value })
        .then(loadList)
        .catch(function (ex) { err.textContent = ex.message; btn.disabled = false; });
    } },
      h('img', { src: '/img/aria-logo.png', alt: 'ARIA' }),
      h('h1', {}, 'Administrar'),
      h('label', { for: 'u' }, 'Usuario'), u,
      h('label', { for: 'p' }, 'Contraseña'), p,
      err,
      h('div', { class: 'bar' }, btn),
      h('p', { class: 'back' }, h('a', { href: '/' }, '← Volver al inicio'))
    );
    show(form);
    u.focus();
  }

  // ---------- listado ----------
  function loadList() {
    show(h('p', { class: 'loading' }, 'Cargando productos…'));
    return api('GET', '/api/productos').then(function (d) {
      state.sha = d.sha; state.base = d.productos; state.draft = clone(d.productos); state.pending = {};
      renderList();
    }).catch(function (e) { if (e.status !== 401) { toast(e.message, true); } });
  }

  // Sube las fotos nuevas y publica todo en un solo commit.
  function publish(btn) {
    var usadas = {};
    state.draft.forEach(function (p) { p.imagenes.forEach(function (f) { usadas[f] = true; }); });
    var nuevas = Object.keys(state.pending).filter(function (n) { return usadas[n]; });
    var blobs = {};
    btn.disabled = true; btn.textContent = 'Publicando…';
    return nuevas.reduce(function (p, name) {
      return p.then(function () {
        return api('POST', '/api/imagen', { archivo: name, data: state.pending[name] }).then(function (r) { blobs[name] = r.blob; });
      });
    }, Promise.resolve()).then(function () {
      return api('POST', '/api/publicar', { sha: state.sha, productos: state.draft, blobs: blobs });
    }).then(function (r) {
      state.sha = r.sha; state.base = clone(state.draft);
      toast('Publicado. El cambio se verá en la página en 1 o 2 minutos.');
      renderList();
    }).catch(function (e) {
      toast('No se pudo publicar: ' + e.message, true);
      btn.disabled = false; btn.textContent = 'Guardar todos los cambios';
    });
  }

  function renderList() {
    var cambios = changedIds();
    var baseIds = {};
    state.base.forEach(function (p) { baseIds[p.id] = true; });
    var list = h('div', { class: 'list' });
    if (!state.draft.length) list.appendChild(h('p', {}, 'Aún no hay productos. Crea el primero.'));
    state.draft.forEach(function (p, i) {
      var off = p.activo === false;
      var sinPublicar = cambios.indexOf(p.id) >= 0;
      var toggle = h('button', { class: 'btn sm ' + (off ? 'ok' : 'ghost'), type: 'button', onclick: function () {
        state.draft[i] = Object.assign({}, p, { activo: off });
        renderList();
      } }, off ? 'Habilitar' : 'Deshabilitar');
      list.appendChild(h('div', { class: 'row' + (off ? ' off' : '') },
        h('img', { class: 'thumb', src: photoSrc(p.imagenes[0]), alt: '' }),
        h('div', { class: 'info' },
          h('strong', {}, p.nombre),
          h('span', {}, p.resumen),
          h('div', {}, h('span', { class: 'badge' + (off ? ' off' : '') }, off ? 'Deshabilitado' : 'Activo'),
            p.destacado && !off ? h('span', { class: 'badge star' }, 'Destacado') : null,
            sinPublicar ? h('span', { class: 'badge draft' }, baseIds[p.id] ? 'Sin publicar' : 'Nuevo, sin publicar') : null)
        ),
        h('div', { class: 'acts' },
          h('button', { class: 'btn sm', type: 'button', onclick: function () { renderForm(i); } }, 'Editar'),
          toggle)
      ));
    });

    var banner = null;
    if (cambios.length) {
      var pubBtn = h('button', { class: 'btn ok', type: 'button' }, 'Guardar todos los cambios');
      pubBtn.addEventListener('click', function () { publish(pubBtn); });
      var n = cambios.filter(function (c) { return c !== '_orden'; }).length || 1;
      banner = h('div', { class: 'banner', role: 'status' },
        h('p', {}, 'Tienes ' + n + (n === 1 ? ' producto' : ' productos') + ' con cambios sin publicar. Aún no se ven en la página.'),
        h('div', { class: 'acts' }, pubBtn,
          h('button', { class: 'btn ghost', type: 'button', onclick: function () {
            if (confirm('¿Descartar todos los cambios sin publicar?')) { state.draft = clone(state.base); state.pending = {}; renderList(); }
          } }, 'Descartar cambios')));
    }

    show(h('div', { class: 'wrap' },
      h('div', { class: 'topbar' },
        h('div', {}, h('img', { src: '/img/aria-logo.png', alt: 'ARIA' }), h('h1', {}, 'Productos')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn', type: 'button', onclick: function () { renderForm(-1); } }, '+ Nuevo producto'),
          h('a', { class: 'btn ghost', href: '/' }, '← Volver al inicio'),
          h('button', { class: 'btn ghost', type: 'button', onclick: function () {
            if (changedIds().length && !confirm('Tienes cambios sin publicar que se perderán. ¿Salir de todos modos?')) return;
            api('DELETE', '/api/login').then(function () { renderLogin(); });
          } }, 'Salir'))
      ),
      banner,
      list
    ));
  }

  // ---------- formulario ----------
  function renderForm(index) {
    var nuevo = index < 0;
    var orig = nuevo
      ? { nombre: '', tipo: 'Arreglo en jarrón', categoria: 'jarron', resumen: '', descripcion: '', imagenes: [],
          caracteristicas: [{ k: 'Flores', v: 'Secas naturales' }, { k: 'Jarrón', v: '' }, { k: 'Altura total', v: '' }],
          destacado: false, activo: true }
      : state.draft[index];
    var fotos = orig.imagenes.map(function (f) { return { archivo: f, src: photoSrc(f) }; });
    var kvs = orig.caracteristicas.map(function (c) { return { k: c.k, v: c.v }; });

    var f = {
      nombre: h('input', { type: 'text', id: 'f-nombre', maxlength: '80', value: orig.nombre, required: true }),
      tipo: h('input', { type: 'text', id: 'f-tipo', maxlength: '60', value: orig.tipo, required: true }),
      categoria: h('select', { id: 'f-cat' },
        h('option', { value: 'jarron', selected: orig.categoria === 'jarron' }, 'Arreglo en jarrón'),
        h('option', { value: 'ramo', selected: orig.categoria === 'ramo' }, 'Ramo')),
      resumen: h('input', { type: 'text', id: 'f-resumen', maxlength: '140', value: orig.resumen, required: true }),
      descripcion: h('textarea', { id: 'f-desc', maxlength: '1500', required: true }, orig.descripcion),
      destacado: h('input', { type: 'checkbox', id: 'f-dest', checked: orig.destacado === true }),
      activo: h('input', { type: 'checkbox', id: 'f-act', checked: orig.activo !== false })
    };
    var kvBox = h('div', {});
    var photoBox = h('div', { class: 'photos' });
    var err = h('p', { class: 'err', role: 'alert' });

    function drawKv() {
      clear(kvBox);
      kvs.forEach(function (row, i) {
        kvBox.appendChild(h('div', { class: 'kv' },
          h('input', { type: 'text', 'aria-label': 'Característica', placeholder: 'Ej. Altura total', maxlength: '60', value: row.k, oninput: function (e) { row.k = e.target.value; } }),
          h('input', { type: 'text', 'aria-label': 'Valor', placeholder: 'Ej. 40 cm', maxlength: '120', value: row.v, oninput: function (e) { row.v = e.target.value; } }),
          h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Quitar', onclick: function () { kvs.splice(i, 1); drawKv(); } }, '✕')
        ));
      });
    }
    function drawPhotos() {
      clear(photoBox);
      fotos.forEach(function (ft, i) {
        function mv(d) { var t = fotos[i]; fotos[i] = fotos[i + d]; fotos[i + d] = t; drawPhotos(); }
        photoBox.appendChild(h('div', { class: 'photo' },
          h('img', { src: ft.src, alt: 'Foto ' + (i + 1) }),
          i === 0 ? h('div', { class: 'main' }, 'Principal') : null,
          h('div', { class: 'pa' },
            h('button', { type: 'button', 'aria-label': 'Mover a la izquierda', disabled: i === 0, onclick: function () { mv(-1); } }, '←'),
            h('button', { type: 'button', 'aria-label': 'Mover a la derecha', disabled: i === fotos.length - 1, onclick: function () { mv(1); } }, '→'),
            h('button', { type: 'button', 'aria-label': 'Quitar foto', onclick: function () { fotos.splice(i, 1); drawPhotos(); } }, '✕'))
        ));
      });
    }
    drawKv(); drawPhotos();

    var picker = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'f-fotos', onchange: function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      e.target.value = '';
      if (fotos.length + files.length > 8) { err.textContent = 'Máximo 8 fotos por producto.'; return; }
      err.textContent = '';
      files.reduce(function (p, file) {
        return p.then(function () { return resizeImage(file).then(function (d) { fotos.push({ data: d, src: d }); drawPhotos(); }); });
      }, Promise.resolve()).catch(function (ex) { err.textContent = ex.message; });
    } });

    var saveBtn = h('button', { class: 'btn', type: 'submit' }, nuevo ? 'Crear producto' : 'Aplicar cambios');

    var form = h('form', { class: 'card', onsubmit: function (e) {
      e.preventDefault();
      err.textContent = '';
      if (!fotos.length) { err.textContent = 'Agrega al menos una foto.'; return; }
      var nombre = f.nombre.value.trim();
      var id = orig.id;
      if (nuevo) {
        var base = slug(nombre) || 'producto', n = 1; id = base;
        while (state.draft.some(function (p) { return p.id === id; })) { n++; id = base + '-' + n; }
      }
      // Las fotos nuevas quedan en memoria hasta publicar; aquí solo se arma el borrador.
      var archivos = fotos.map(function (ft, k) {
        if (ft.archivo) return ft.archivo;
        ft.archivo = id + '-' + Date.now().toString(36) + k.toString(36) + '.jpg';
        state.pending[ft.archivo] = ft.data;
        return ft.archivo;
      });
      var prod = {
        id: id, nombre: nombre, tipo: f.tipo.value.trim(), categoria: f.categoria.value,
        resumen: f.resumen.value.trim(), descripcion: f.descripcion.value.trim(),
        imagenes: archivos,
        caracteristicas: kvs.filter(function (r) { return r.k.trim() && r.v.trim(); }),
        destacado: f.destacado.checked, activo: f.activo.checked
      };
      if (nuevo) state.draft.unshift(prod); else state.draft[index] = prod;
      toast('Cambio aplicado. Pulsa «Guardar todos los cambios» para publicarlo.');
      renderList();
    } },
      h('h2', {}, nuevo ? 'Nuevo producto' : 'Editar: ' + orig.nombre),
      h('label', { for: 'f-nombre' }, 'Nombre'), f.nombre,
      h('div', { class: 'grid2' },
        h('div', {}, h('label', { for: 'f-cat' }, 'Categoría'), f.categoria),
        h('div', {}, h('label', { for: 'f-tipo' }, 'Tipo (texto que se muestra)'), f.tipo)),
      h('label', { for: 'f-resumen' }, 'Resumen corto'), f.resumen,
      h('p', { class: 'hint' }, 'Una línea, ej. "Jarrón de vidrio blanco con textura · 36 cm". Se ve en el catálogo.'),
      h('label', { for: 'f-desc' }, 'Descripción'), f.descripcion,
      h('label', {}, 'Características'), kvBox,
      h('button', { class: 'btn ghost sm', type: 'button', onclick: function () { if (kvs.length < 10) { kvs.push({ k: '', v: '' }); drawKv(); } } }, '+ Agregar característica'),
      h('label', { for: 'f-fotos' }, 'Fotos'),
      h('p', { class: 'hint' }, 'La primera es la principal. Usa las flechas para cambiar el orden. Se reducen solas para que la página cargue rápido.'),
      picker, photoBox,
      h('div', { class: 'feat' }, f.destacado, h('label', { for: 'f-dest' }, 'Destacado en el inicio (el inicio muestra máximo 3)')),
      h('div', { class: 'feat' }, f.activo, h('label', { for: 'f-act' }, 'Visible en la página (desmárcalo para deshabilitarlo)')),
      err,
      h('div', { class: 'bar' }, saveBtn,
        h('button', { class: 'btn ghost', type: 'button', onclick: renderList }, 'Cancelar'))
    );
    show(h('div', { class: 'wrap' }, form));
    f.nombre.focus();
  }

  // ---------- inicio ----------
  api('GET', '/api/login').then(function (r) { if (r.autenticado) loadList(); else renderLogin(); })
    .catch(function () { renderLogin(); });
})();
