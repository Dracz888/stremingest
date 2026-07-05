/* ============ App shell: arranque, login, navegación ============ */
"use strict";

const App = {
  view: 'dashboard',

  boot(){
    dbLoad();
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
  },

  /* ---- Pantalla de bienvenida (solo pide el nombre) ---- */
  welcomeHTML(){
    return `
    <div class="login-wrap"><div class="login-card">
      <div class="brand">
        <div class="logo">${I.play}</div>
        <h1>StreamGest</h1>
        <p>¿Cómo te llamas? Así te damos la bienvenida.</p>
      </div>
      <label>Tu nombre</label>
      <input id="wl-nombre" autocapitalize="words" placeholder="Introducir nombre"
        onkeydown="if(event.key==='Enter')App.doStart()">
      <button class="btn full" style="margin-top:20px" onclick="App.doStart()">Entrar</button>
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

  /* Vistas del menú se marcan bajo la pestaña Menú */
  menuViews: ['menu','plataformas','monedas','metodos','cuentas','recargas','plantillas','respaldo'],

  renderTabbar(){
    const n = alertCount();
    const activeTab = App.menuViews.includes(App.view) ? 'menu' : App.view;
    document.getElementById('tabbar').innerHTML = App.tabs.map(t => {
      if (t.fab) return `
        <button class="tab fab-slot" onclick="App.nav('registro')">
          <span class="fab">${I.plus}</span>
          <span class="fab-label">Registrar</span>
        </button>`;
      const badge = (t.id === 'alertas' && n > 0)
        ? `<span style="position:absolute;margin-left:22px;margin-top:-4px;background:var(--red);color:#fff;font-size:.58rem;font-weight:800;border-radius:99px;padding:1px 5px;min-width:15px">${n}</span>` : '';
      return `
        <button class="tab ${activeTab === t.id ? 'active' : ''}" onclick="App.nav('${t.id}')" style="position:relative">
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
document.addEventListener('DOMContentLoaded', () => {
  App.boot();
  // Revisión periódica de vencimientos mientras la app está abierta
  setInterval(() => { if (DB && DB.config.usuario) checkNotifications(); }, 30 * 60 * 1000);
});

/* ---- Service worker (solo sobre http/https) ---- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
