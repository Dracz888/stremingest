/* ============ App shell: arranque, login, navegación ============ */
"use strict";

const App = {
  view: 'dashboard',

  boot(){
    dbLoad();
    const screen = document.getElementById('screen');
    const main = document.getElementById('main');
    const tabbar = document.getElementById('tabbar');

    if (!DB.users.length) {
      // Primera vez: crear el administrador
      main.innerHTML = ''; tabbar.classList.add('hidden');
      screen.innerHTML = App.setupHTML();
      return;
    }
    if (!Auth.init()) {
      main.innerHTML = ''; tabbar.classList.add('hidden');
      screen.innerHTML = App.loginHTML();
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

  /* ---- Pantallas de acceso ---- */
  setupHTML(){
    return `
    <div class="login-wrap"><div class="login-card">
      <div class="brand">
        <div class="logo">${I.play}</div>
        <h1>StreamGest</h1>
        <p>Configura tu cuenta de administrador para empezar</p>
      </div>
      <label>Usuario administrador</label>
      <input id="su-usuario" autocapitalize="none" placeholder="Ej: adriano">
      <label>Contraseña</label>
      <input id="su-clave" type="password" placeholder="mínimo 4 caracteres">
      <label>Repetir contraseña</label>
      <input id="su-clave2" type="password" placeholder="repite la contraseña">
      <button class="btn full" style="margin-top:20px" onclick="App.doSetup()">Crear administrador</button>
    </div></div>`;
  },

  async doSetup(){
    const u = document.getElementById('su-usuario').value;
    const c1 = document.getElementById('su-clave').value;
    const c2 = document.getElementById('su-clave2').value;
    if (c1 !== c2) return toast('Las contraseñas no coinciden', true);
    const err = await Auth.createUser(u, c1, null);
    if (err) return toast(err, true);
    await Auth.login(u.trim(), c1);
    toast('Bienvenido a StreamGest');
    App.showApp();
  },

  loginHTML(){
    return `
    <div class="login-wrap"><div class="login-card">
      <div class="brand">
        <div class="logo">${I.play}</div>
        <h1>StreamGest</h1>
        <p>Gestión de cuentas de streaming</p>
      </div>
      <label>Usuario</label>
      <input id="lg-usuario" autocapitalize="none" placeholder="usuario"
        onkeydown="if(event.key==='Enter')document.getElementById('lg-clave').focus()">
      <label>Contraseña</label>
      <input id="lg-clave" type="password" placeholder="contraseña"
        onkeydown="if(event.key==='Enter')App.doLogin()">
      <button class="btn full" style="margin-top:20px" onclick="App.doLogin()">Entrar</button>
    </div></div>`;
  },

  async doLogin(){
    const err = await Auth.login(
      document.getElementById('lg-usuario').value,
      document.getElementById('lg-clave').value
    );
    if (err) return toast(err, true);
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
  menuViews: ['menu','plataformas','metodos','cuentas','recargas','accesos','plantillas','respaldo'],

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
  setInterval(() => { if (Auth.current) checkNotifications(); }, 30 * 60 * 1000);
});

/* ---- Service worker (solo sobre http/https) ---- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
