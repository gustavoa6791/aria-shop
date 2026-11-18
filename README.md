# ARIA — tienda estática de flores secas

Sitio 100% estático (HTML + CSS), sin base de datos ni servidor. El catálogo vive en `data/productos.json`.

## Agregar o editar productos
1. Copia la foto a `assets/` (ej. `rosas-del-valle.jpg`).
2. Agrega un bloque en `data/productos.json` (usa un `id` sin espacios ni tildes; es el nombre de su página).
3. Ejecuta `node build.js` → regenera la carpeta `public/`.

Campos de cada producto: `id`, `nombre`, `tipo`, `categoria` (`jarron` o `ramo`), `resumen`, `descripcion`, `imagenes` (lista), `caracteristicas` (lista de `k`/`v`), `destacado` (true = sale en el inicio, máx. 3).

## Configuración (`config` en el mismo JSON)
- `whatsapp`: número con indicativo, sin `+` ni espacios (57315…).
- `sitio`: URL final del sitio (ej. `https://aria.vercel.app`). Se usa para el enlace del producto dentro del mensaje de WhatsApp y para la vista previa con foto.
- `mostrarPrecios`: pon `true` y agrega `"precio": "$85.000"` a cada producto para mostrarlos.

## Deploy en Vercel
- Sube la carpeta a GitHub e impórtala en Vercel (usa `vercel.json`: build `node build.js`, salida `public`), o ejecuta `npx vercel --prod` dentro de la carpeta.
- Después de tener la URL final, ponla en `sitio` y vuelve a desplegar.

## Cómo funciona el botón de WhatsApp
Abre `wa.me/<número>?text=…` con "Hola, vi este producto en tu página: <nombre>…" y el enlace de la página del producto. WhatsApp no permite adjuntar imágenes desde un enlace, pero al pegar ese enlace muestra una vista previa con la foto del producto (por eso cada producto tiene su propia página con etiquetas Open Graph).

## Panel de administración (`/admin`)
Una persona no técnica entra a `https://<sitio>/admin` con usuario y contraseña y puede **crear, editar y deshabilitar** productos (con fotos). No se borra nada: un producto deshabilitado deja de verse en la página (`"activo": false` en el JSON) pero sigue en el panel para volver a habilitarlo.

Cada cambio se guarda como commit en GitHub (`data/productos.json` y `assets/`) y Vercel redespliega solo (1–2 min).

### Variables de entorno en Vercel (Settings → Environment Variables)
| Variable | Valor |
|---|---|
| `ADMIN_USER` | usuario del panel |
| `ADMIN_PASSWORD` | contraseña larga (≥ 12 caracteres) |
| `SESSION_SECRET` | texto aleatorio de 32+ caracteres (`openssl rand -hex 32`) |
| `GITHUB_TOKEN` | token fine-grained de GitHub, solo para este repo, permiso **Contents: Read and write** |
| `GITHUB_REPO` | `gustavoa6791/aria-shop` |
| `GITHUB_BRANCH` | `main` (opcional) |

Archivos: `admin/` (interfaz), `api/` (funciones de Vercel), `lib/admin.js` (sesión, validación y acceso a GitHub).
Para probar en local usa `npx vercel dev` (con las variables en `.env.local`, que no se sube al repo).
