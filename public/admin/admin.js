(function () {
  'use strict';
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var state = { sha: null, productos: [] };

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
      h('div', { class: 'bar' }, btn)
    );
    show(form);
    u.focus();
  }

  // ---------- listado ----------
  function loadList() {
    show(h('p', { class: 'loading' }, 'Cargando productos…'));
    return api('GET', '/api/productos').then(function (d) {
      state.sha = d.sha; state.productos = d.productos; renderList();
    }).catch(function (e) { if (e.status !== 401) { toast(e.message, true); } });
  }

  function persist(productos) {
    return api('PUT', '/api/productos', { sha: state.sha, productos: productos }).then(function (r) {
      state.sha = r.sha; state.productos = productos;
    });
  }

  function renderList() {
    var list = h('div', { class: 'list' });
    if (!state.productos.length) list.appendChild(h('p', {}, 'Aún no hay productos. Crea el primero.'));
    state.productos.forEach(function (p, i) {
      var off = p.activo === false;
      var toggle = h('button', { class: 'btn sm ' + (off ? 'ok' : 'ghost'), type: 'button', onclick: function () {
        var verbo = off ? 'habilitar' : 'deshabilitar';
        if (!off && !confirm('¿Deshabilitar "' + p.nombre + '"? Dejará de verse en la página, pero podrás habilitarlo de nuevo.')) return;
        toggle.disabled = true;
        var copia = state.productos.map(function (x, j) { return j === i ? Object.assign({}, x, { activo: off }) : x; });
        persist(copia).then(function () {
          toast('Listo. El cambio se verá en la página en 1 o 2 minutos.');
          renderList();
        }).catch(function (e) { toast('No se pudo ' + verbo + ': ' + e.message, true); toggle.disabled = false; });
      } }, off ? 'Habilitar' : 'Deshabilitar');
      list.appendChild(h('div', { class: 'row' + (off ? ' off' : '') },
        h('img', { class: 'thumb', src: '/img/' + p.imagenes[0], alt: '' }),
        h('div', { class: 'info' },
          h('strong', {}, p.nombre),
          h('span', {}, p.resumen),
          h('div', {}, h('span', { class: 'badge' + (off ? ' off' : '') }, off ? 'Deshabilitado' : 'Activo'),
            p.destacado && !off ? h('span', { class: 'badge star' }, 'Destacado') : null)
        ),
        h('div', { class: 'acts' },
          h('button', { class: 'btn sm', type: 'button', onclick: function () { renderForm(i); } }, 'Editar'),
          toggle)
      ));
    });
    show(h('div', { class: 'wrap' },
      h('div', { class: 'topbar' },
        h('div', {}, h('img', { src: '/img/aria-logo.png', alt: 'ARIA' }), h('h1', {}, 'Productos')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn', type: 'button', onclick: function () { renderForm(-1); } }, '+ Nuevo producto'),
          h('a', { class: 'btn ghost', href: '/', target: '_blank', rel: 'noopener' }, 'Ver página'),
          h('button', { class: 'btn ghost', type: 'button', onclick: function () {
            api('DELETE', '/api/login').then(function () { renderLogin(); });
          } }, 'Salir'))
      ),
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
      : state.productos[index];
    var fotos = orig.imagenes.map(function (f) { return { archivo: f, src: '/img/' + f }; });
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

    var saveBtn = h('button', { class: 'btn', type: 'submit' }, nuevo ? 'Crear producto' : 'Guardar cambios');

    var form = h('form', { class: 'card', onsubmit: function (e) {
      e.preventDefault();
      err.textContent = '';
      if (!fotos.length) { err.textContent = 'Agrega al menos una foto.'; return; }
      var nombre = f.nombre.value.trim();
      var id = orig.id;
      if (nuevo) {
        var base = slug(nombre) || 'producto', n = 1; id = base;
        while (state.productos.some(function (p) { return p.id === id; })) { n++; id = base + '-' + n; }
      }
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
      // 1) sube las fotos nuevas, 2) guarda el producto
      Promise.all(fotos.map(function (ft) {
        if (ft.archivo) return Promise.resolve(ft.archivo);
        return api('POST', '/api/imagen', { id: id, data: ft.data }).then(function (r) { return r.archivo; });
      })).then(function (archivos) {
        var prod = {
          id: id, nombre: nombre, tipo: f.tipo.value.trim(), categoria: f.categoria.value,
          resumen: f.resumen.value.trim(), descripcion: f.descripcion.value.trim(),
          imagenes: archivos,
          caracteristicas: kvs.filter(function (r) { return r.k.trim() && r.v.trim(); }),
          destacado: f.destacado.checked, activo: f.activo.checked
        };
        var lista = nuevo ? [prod].concat(state.productos)
          : state.productos.map(function (p, i) { return i === index ? prod : p; });
        return persist(lista);
      }).then(function () {
        toast('Guardado. El cambio se verá en la página en 1 o 2 minutos.');
        renderList();
      }).catch(function (ex) {
        err.textContent = ex.message; saveBtn.disabled = false; saveBtn.textContent = nuevo ? 'Crear producto' : 'Guardar cambios';
      });
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
