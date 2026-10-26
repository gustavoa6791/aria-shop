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
Abre `wa.me/<número>?text=…` con "Hola, vi este producto en mi página: <nombre>…" y el enlace de la página del producto. WhatsApp no permite adjuntar imágenes desde un enlace, pero al pegar ese enlace muestra una vista previa con la foto del producto (por eso cada producto tiene su propia página con etiquetas Open Graph).
