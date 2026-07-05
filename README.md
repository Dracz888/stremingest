# StreamGest

Aplicación móvil (PWA) para administrar un negocio de reventa de cuentas de streaming: clientes, planes, pagos multimoneda, recargas de cuentas propias, finanzas y alertas de vencimiento con avisos por WhatsApp.

## Módulos

- **Inicio (Gestión):** ingresos, egresos, balance, cartera por moneda y ranking de planes más vendidos (mes actual / 30 días / histórico).
- **Clientes:** vista consolidada por cliente con sus planes, días restantes de cada uno, saldo (debe / al día), historial de pagos y acceso directo a WhatsApp.
- **Registrar (botón central):** registro de pagos con varios planes por registro (cada uno con su propia duración) y varios métodos de pago/monedas (con tasa de cambio cuando aplica). Calcula automáticamente el total en USD, los vencimientos y el saldo del cliente.
- **Alertas:** clientes vencidos, clientes por vencer (1 día y el mismo día) y recargas por vencer (5 a 0 días), con notificaciones del navegador.
- **Menú:** catálogo de plataformas/planes (con precio USD), catálogo de métodos de pago (editable), cuentas propias de streaming, recargas (egresos), gestión de accesos (usuarios), plantillas de WhatsApp y respaldo de datos.

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
