/* ============ App shell: arranque, bienvenida, navegación ============ */
"use strict";

const App = {
  view: 'dashboard',

  boot(){
    dbLoad();
    Theme.apply();
    const main = document.getElementById('main');
    const tabbar = document.getElementById('tabbar');

    if (!DB.config.usuario) {
      // Primera vez: solo pedimos el nombre para dar la bienvenida
      main.innerHTML = ''; tabbar.classList.add('hidden');
      document.getElementById('screen').innerHTML = App.welcomeHTML();
      setTimeout(() => { const el = document.getElementById('wl-nombre'); if (el) el.focus(); }, 50);
      return;
    }
    App.showApp();
  },

  showApp(){
    document.getElementById('screen').innerHTML = '';
    document.getElementById('tabbar').classList.remove('hidden');
    App.renderTabbar();
    App.nav('dashboard');
    checkNotifications();
    if (typeof Sync !== 'undefined') Sync.start();
  },

  welcomeHTML(){
    return `
    <div class="login-wrap"><div class="login-card">
      <div class="brand">
        <div class="logo">${I.play}</div>
        <h1>StreamGest</h1>
        <p>Administra tus clientes, pagos y cuentas de streaming desde un solo lugar.</p>
      </div>
      <label>Tu nombre</label>
      <input id="wl-nombre" autocapitalize="words" placeholder="¿Cómo te llamas?"
        onkeydown="if(event.key==='Enter')App.doStart()">
      <button class="btn full" style="margin-top:20px" onclick="App.doStart()">Comenzar</button>
    </div></div>`;
  },

  doStart(){
    const nombre = document.getElementById('wl-nombre').value.trim();
    if (!nombre) return toast('Escribe tu nombre para continuar', true);
    DB.config.usuario = nombre;
    dbSave();
    toast('¡Bienvenido, ' + nombre + '!');
    App.showApp();
  },

  /* ---- Navegación ---- */
  tabs: [
    { id: 'dashboard', label: 'Inicio',   icon: 'home' },
    { id: 'clientes',  label: 'Clientes', icon: 'users' },
    { id: 'registro',  label: '',         icon: 'plus', fab: true },
    { id: 'alertas',   label: 'Alertas',  icon: 'bell' },
    { id: 'menu',      label: 'Menú',     icon: 'menu' }
  ],

  /* Vistas que se marcan bajo la pestaña Menú */
  menuViews: ['menu','plataformas','monedas','metodos','cuentas','movimientos','recargas','plantillas','sync','respaldo','ajustes'],

  renderTabbar(){
    const n = alertCount();
    const activeTab = App.menuViews.includes(App.view) ? 'menu' : App.view;
    document.getElementById('tabbar').innerHTML = App.tabs.map(t => {
      if (t.fab) return `
        <button class="tab fab-slot" onclick="App.nav('registro')" aria-label="Registrar pago">
          <span class="fab">${I.plus}</span>
          <span class="fab-label">Registrar</span>
        </button>`;
      const badge = (t.id === 'alertas' && n > 0) ? `<span class="badge">${n}</span>` : '';
      return `
        <button class="tab ${activeTab === t.id ? 'active' : ''}" onclick="App.nav('${t.id}')">
          ${badge}${I[t.icon]}<span>${t.label}</span>
        </button>`;
    }).join('');
  },

  nav(view){
    if (typeof V[view] !== 'function') view = 'dashboard';
    App.view = view;
    V[view]();
    App.renderTabbar();
    window.scrollTo(0, 0);
  },

  /* Re-render de la vista actual (tras guardar algo) */
  refresh(){
    App.nav(App.view);
  },

  render(html){
    document.getElementById('main').innerHTML = html;
  }
};

/* ---- Arranque ---- */
Theme.apply(); // aplica el tema guardado antes de cargar datos (evita el "flash")
document.addEventListener('DOMContentLoaded', () => {
  App.boot();
  // Revisión periódica de vencimientos mientras la app está abierta
  setInterval(() => { if (DB && DB.config.usuario) checkNotifications(); }, 30 * 60 * 1000);
});

/* ---- Service worker (solo sobre http/https) ----
   Cuando hay una versión nueva publicada, toma el control y la página
   se recarga una vez automáticamente. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => { reg.update(); }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); });
    }
  });
}
