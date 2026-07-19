# StreamGest 2.0

Rediseño completo de la app de gestión de reventa de cuentas de streaming.
**Compatible con los datos y respaldos de la versión anterior** (misma clave de
almacenamiento y mismas migraciones): si la abres en el mismo navegador, tus
datos aparecen tal cual; también puedes importar cualquier respaldo `.json` viejo.

## Novedades frente a la versión 1

- 🎨 **Interfaz renovada** con tema **claro / oscuro / automático** (Menú → Ajustes).
- 📊 **Gráfico de ingresos vs egresos** de los últimos 6 meses, por moneda.
- 💰 Nuevo indicador **"Por cobrar"** (deuda total de clientes) y **próximas renovaciones** en el inicio.
- 🔍 **Filtros en Clientes**: vencidos, por vencer, con deuda, al día, sin planes; y orden por nombre / vencimiento / recientes.
- ✏️ **Todo editable**: registros de pago (fecha, montos, métodos, tasa) y recargas (cuenta, fecha, días, montos).
- 🔁 Botón **"Repetir recarga"** para renovar una cuenta con un toque.
- ⚡ **Chips de días rápidos** (7/15/30/60/90) al renovar planes y recargar cuentas.
- 📝 **Notas en los pagos** y botón para **copiar** el mensaje de WhatsApp sin abrirlo.
- 📤 **Exportar a Excel (CSV)**: lista de clientes y movimientos (respetando filtros).
- ⚙️ **Pantalla de Ajustes**: nombre, tema, y días de aviso configurables para clientes y recargas.
- ✅ Diálogos de confirmación propios (ya no usa los del navegador), botones de "volver" en los submenús, secciones ordenadas en el menú y recordatorio del último respaldo.

## Cómo usarla

1. Publica esta carpeta en cualquier hosting estático (GitHub Pages, Netlify, Vercel) o ábrela localmente.
2. En el celular, abre la URL y usa **"Agregar a pantalla de inicio"** para instalarla como app (PWA, funciona sin conexión).
3. La primera vez te pedirá tu nombre.

Los datos se guardan en el dispositivo (localStorage). Usa **Menú → Respaldo**
para exportar/importar un `.json`, y **Menú → Compartir / Sincronizar** para
compartir los datos cifrados con tu equipo mediante tu propio proyecto gratuito
de Firebase (igual que en la versión 1).

## Detalles técnicos

- HTML/CSS/JS puro, sin dependencias ni proceso de build.
- PWA con service worker (funciona sin conexión una vez cargada).
- Sincronización cifrada en el dispositivo con AES-GCM (clave derivada con PBKDF2).
- WhatsApp mediante enlaces `wa.me` con plantillas editables.
