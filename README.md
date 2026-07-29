# StreamGest

Aplicación móvil (PWA) para administrar un negocio de reventa de cuentas de streaming: clientes, planes multimoneda, pagos, recargas de cuentas propias, finanzas y alertas de vencimiento con avisos por WhatsApp.

## Cómo funciona el modelo

- **Monedas nativas:** cada plan se cobra en una moneda concreta (USD, COP, Bs…). El monto se registra y se muestra en esa misma moneda, **sin convertir a otra**. Cada método de pago pertenece a una moneda (por ejemplo Bancolombia y Nequi son COP), y en la cartera se agrupan por moneda.
- **Cliente → cuentas → planes:** al registrar un cliente eliges la(s) cuenta(s) que usa y, dentro de cada cuenta, qué planes usa (puede usar varias cuentas y no necesariamente todos los planes de cada una). De ahí se sabe cuánto debe pagar.
- **Pagos:** al registrar un pago solo eliges a qué planes ya registrados se les añaden días y cuánto se pagó. El saldo (debe / a favor) se lleva por moneda.

## Módulos

- **Inicio (Gestión):** balance por moneda (ingresos, egresos y balance de cada moneda), cartera por moneda y ranking de planes más vendidos (mes actual / 30 días / histórico).
- **Clientes:** vista consolidada por cliente con sus planes (cuenta asociada, precio y días restantes de cada uno), saldo por moneda, notas del cliente, historial de pagos y acceso directo a WhatsApp. Desde aquí se asignan las cuentas y planes que usa.
- **Registrar (botón central):** renovación de los planes que el cliente ya tiene: se elige a cuáles añadir días y con qué método(s) se pagó. Calcula el nuevo vencimiento y el saldo por moneda, y admite una nota opcional del pago.
- **Alertas:** clientes vencidos, clientes por vencer (1 día y el mismo día) y recargas por vencer (5 a 0 días), con notificaciones del navegador. Si la recarga tiene nombre de cliente, se muestra en la alerta y en la notificación.
- **Menú:** catálogo de plataformas/planes (con moneda y precio), catálogo de monedas, métodos de pago, cuentas propias de streaming, recargas (egresos, con nombre de cliente opcional), plantillas de WhatsApp y respaldo de datos.

## Cómo usarla

1. Publica la carpeta en cualquier hosting estático (GitHub Pages, Netlify, Vercel) o ábrela localmente.
2. En el celular, abre la URL y usa **"Agregar a pantalla de inicio"** para instalarla como app.
3. La primera vez te pedirá crear el usuario administrador.

Los datos se guardan en el dispositivo (localStorage). Usa **Menú → Respaldo** para exportar/importar un archivo `.json` con toda la información.

## Compartir con otras personas (sincronización en la nube)

**Menú → Compartir / Sincronizar** permite que varias personas **vean y editen** los mismos datos en vivo, limitado solo a quien tú quieras mediante una **clave**.

- **Espacio compartido:** creas un espacio y obtienes un **código** y defines una **clave**. Quien tenga ambos (se los pasas por WhatsApp, por ejemplo) entra en *"Unirme a un espacio"* y queda sincronizado. Los cambios de cualquiera se reflejan en los demás.
- **Privacidad:** los datos se **cifran en el dispositivo con AES-GCM** usando tu clave (derivada con PBKDF2). En la nube solo hay texto cifrado; sin la clave no se puede leer, aunque se conozca el código.
- **Sin secretos en el repositorio:** la sincronización usa tu propio proyecto **gratuito de Firebase (Firestore)**. Pegas la configuración de tu proyecto dentro de la app (se guarda solo en tu dispositivo). La propia pantalla incluye el paso a paso y las **reglas de Firestore** listas para copiar.
- **Modelo de conflictos:** gana la última escritura (*last-write-wins*) sobre el conjunto de datos; pensado para equipos pequeños (1–3 personas).

## Detalles técnicos

- HTML/CSS/JS puro, sin dependencias ni proceso de build.
- PWA con service worker (funciona sin conexión una vez cargada).
- Contraseñas de usuarios con hash SHA-256.
- WhatsApp mediante enlaces `wa.me` con mensajes prellenados a partir de plantillas editables.
