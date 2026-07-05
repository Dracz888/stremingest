# StreamGest

Aplicación móvil (PWA) para administrar un negocio de reventa de cuentas de streaming: clientes, planes multimoneda, pagos, recargas de cuentas propias, finanzas y alertas de vencimiento con avisos por WhatsApp.

## Cómo funciona el modelo

- **Monedas nativas:** cada plan se cobra en una moneda concreta (USD, COP, Bs…). El monto se registra y se muestra en esa misma moneda, **sin convertir a otra**. Cada método de pago pertenece a una moneda (por ejemplo Bancolombia y Nequi son COP), y en la cartera se agrupan por moneda.
- **Cliente → cuentas → planes:** al registrar un cliente eliges la(s) cuenta(s) que usa y, dentro de cada cuenta, qué planes usa (puede usar varias cuentas y no necesariamente todos los planes de cada una). De ahí se sabe cuánto debe pagar.
- **Pagos:** al registrar un pago solo eliges a qué planes ya registrados se les añaden días y cuánto se pagó. El saldo (debe / a favor) se lleva por moneda.

## Módulos

- **Inicio (Gestión):** balance por moneda (ingresos, egresos y balance de cada moneda), cartera por moneda y ranking de planes más vendidos (mes actual / 30 días / histórico).
- **Clientes:** vista consolidada por cliente con sus planes (cuenta asociada, precio y días restantes de cada uno), saldo por moneda, historial de pagos y acceso directo a WhatsApp. Desde aquí se asignan las cuentas y planes que usa.
- **Registrar (botón central):** renovación de los planes que el cliente ya tiene: se elige a cuáles añadir días y con qué método(s) se pagó. Calcula el nuevo vencimiento y el saldo por moneda.
- **Alertas:** clientes vencidos, clientes por vencer (1 día y el mismo día) y recargas por vencer (5 a 0 días), con notificaciones del navegador.
- **Menú:** catálogo de plataformas/planes (con moneda y precio), catálogo de monedas, métodos de pago, cuentas propias de streaming, recargas (egresos), plantillas de WhatsApp y respaldo de datos.

## Cómo usarla

1. Publica la carpeta en cualquier hosting estático (GitHub Pages, Netlify, Vercel) o ábrela localmente.
2. En el celular, abre la URL y usa **"Agregar a pantalla de inicio"** para instalarla como app.
3. La primera vez te pedirá crear el usuario administrador.

Los datos se guardan en el dispositivo (localStorage). Usa **Menú → Respaldo** para exportar/importar un archivo `.json` con toda la información.

## Detalles técnicos

- HTML/CSS/JS puro, sin dependencias ni proceso de build.
- PWA con service worker (funciona sin conexión una vez cargada).
- Contraseñas de usuarios con hash SHA-256.
- WhatsApp mediante enlaces `wa.me` con mensajes prellenados a partir de plantillas editables.
