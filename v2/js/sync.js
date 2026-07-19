/* ============ Sincronización en la nube (compartir con clave) ============
   Guarda los datos en un "espacio compartido" en Firebase (Firestore) para que
   varias personas los VEAN y EDITEN en vivo. El acceso se limita con una CLAVE:
   los datos se cifran en el dispositivo con AES-GCM (WebCrypto) usando esa clave,
   así que sin la clave el contenido no se puede leer aunque se conozca el código.

   No hay secretos en el repositorio: cada usuario pega la configuración de SU
   proyecto de Firebase dentro de la app (se guarda solo en su dispositivo).
================================================================= */
"use strict";

/* ---- Utilidades base64 <-> bytes ---- */
function bytesToB64(bytes){
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
function b64ToBytes(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---- Cifrado: clave (texto) -> llave AES-256 vía PBKDF2 ---- */
async function deriveKey(clave, saltB64){
  const salt = b64ToBytes(saltB64);
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptJSON(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}
async function decryptJSON(key, ivB64, ctB64){
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---- Código de espacio (aleatorio, sin caracteres ambiguos) ---- */
function randomWorkspaceCode(){
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
  const r = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  for (let i = 0; i < r.length; i++) s += A[r[i] % A.length];
  return s;
}
function normalizeCode(input){
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function displayCode(code){
  return (normalizeCode(code).match(/.{1,4}/g) || []).join('-');
}

/* =================================================================
   Objeto Sync
================================================================= */
const Sync = {
  CFG_KEY:   'sg_sync_cfg',
  STATE_KEY: 'sg_sync_state',
  CLAVE_KEY: 'sg_sync_clave',
  DEV_KEY:   'sg_device_id',
  FB_VERSION: '10.12.2',

  cfg: null,        // config de Firebase (objeto)
  state: null,      // { workspaceId, salt, enabled }
  clave: null,      // clave en texto (solo en este dispositivo)
  key: null,        // CryptoKey derivada
  fs: null,         // instancia de Firestore
  unsub: null,      // cancelar suscripción en vivo
  applying: false,  // estamos aplicando un cambio remoto (no re-subir)
  pushTimer: null,
  lastRev: 0,       // último updatedAt visto/subido
  status: 'off',    // off | connecting | online | error
  _loading: null,

  /* ---- Persistencia local de la configuración ---- */
  loadLocal(){
    try { this.cfg = JSON.parse(localStorage.getItem(this.CFG_KEY) || 'null'); } catch(e){ this.cfg = null; }
    try { this.state = JSON.parse(localStorage.getItem(this.STATE_KEY) || 'null'); } catch(e){ this.state = null; }
    this.clave = localStorage.getItem(this.CLAVE_KEY) || null;
  },
  persistState(){
    if (this.state) localStorage.setItem(this.STATE_KEY, JSON.stringify(this.state));
    else localStorage.removeItem(this.STATE_KEY);
    if (this.clave != null) localStorage.setItem(this.CLAVE_KEY, this.clave);
    else localStorage.removeItem(this.CLAVE_KEY);
  },
  saveConfig(cfg){
    this.cfg = cfg;
    localStorage.setItem(this.CFG_KEY, JSON.stringify(cfg));
  },
  deviceId(){
    let id = localStorage.getItem(this.DEV_KEY);
    if (!id) { id = uid(); localStorage.setItem(this.DEV_KEY, id); }
    return id;
  },
  isActive(){ return !!(this.state && this.state.enabled); },
  isConfigured(){ return !!this.cfg && !!this.cfg.projectId; },

  setStatus(s){
    this.status = s;
    if (window.App && App.view === 'sync') { try { V.sync(); } catch(e){} }
  },

  /* ---- Carga del SDK de Firebase (solo cuando se usa) ---- */
  loadFirebase(){
    if (window.firebase && firebase.firestore) return Promise.resolve();
    if (this._loading) return this._loading;
    const load = src => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('No se pudo cargar Firebase (¿sin conexión?).'));
      document.head.appendChild(s);
    });
    const base = 'https://www.gstatic.com/firebasejs/' + this.FB_VERSION + '/';
    this._loading = load(base + 'firebase-app-compat.js')
      .then(() => load(base + 'firebase-firestore-compat.js'));
    return this._loading;
  },

  async ensureApp(){
    if (!this.isConfigured()) throw new Error('Falta la configuración de Firebase.');
    await this.loadFirebase();
    if (!firebase.apps.length) firebase.initializeApp(this.cfg);
    this.fs = firebase.firestore();
  },

  docRef(id){ return this.fs.collection('workspaces').doc(id || this.state.workspaceId); },

  /* ---- Arranque automático al abrir la app (si hay espacio activo) ---- */
  async start(){
    this.loadLocal();
    if (!this.isConfigured() || !this.isActive() || this.clave == null) return;
    this.setStatus('connecting');
    try {
      await this.ensureApp();
      this.key = await deriveKey(this.clave, this.state.salt);
      this.subscribe();
    } catch(e){
      console.error('Sync start', e);
      this.setStatus('error');
    }
  },

  /* ---- Suscripción en vivo a los cambios remotos ---- */
  subscribe(){
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.unsub = this.docRef().onSnapshot(async snap => {
      this.setStatus('online');
      if (!snap.exists) return;
      if (snap.metadata.hasPendingWrites) return; // eco de nuestra propia escritura
      const d = snap.data();
      if (d.deviceId === this.deviceId()) { this.lastRev = d.updatedAt; return; }
      if (d.updatedAt === this.lastRev) return;
      try {
        const remote = await decryptJSON(this.key, d.iv, d.ct);
        this.lastRev = d.updatedAt;
        this.applyRemote(remote);
      } catch(e){ console.error('No se pudo descifrar el cambio remoto', e); }
    }, err => { console.error('Sync onSnapshot', err); this.setStatus('error'); });
  },

  /* ---- Aplica datos remotos al DB local (conservando el nombre local) ---- */
  applyRemote(remote){
    const myName = (DB && DB.config) ? DB.config.usuario : '';
    this.applying = true;
    try {
      DB = remote;
      if (!DB.config) DB.config = {};
      if (myName) DB.config.usuario = myName;
      try { dbMigrate(); } catch(e){ console.error('migrate remoto', e); }
      dbSaveLocal();
    } finally {
      this.applying = false;
    }
    if (window.App && DB.config && DB.config.usuario) {
      try { App.renderTabbar(); App.refresh(); } catch(e){}
    }
    toast('Datos actualizados desde la nube');
  },

  /* ---- Aviso desde dbSave(): programa subida con retraso ---- */
  onLocalSave(){
    if (!this.isActive() || this.applying || !this.key) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), 800);
  },

  /* ---- Sube el estado actual del DB (cifrado) ---- */
  async push(){
    if (!this.key || !this.fs || !this.isActive()) return;
    try {
      const enc = await encryptJSON(this.key, DB);
      const updatedAt = Date.now();
      this.lastRev = updatedAt;
      await this.docRef().set({
        iv: enc.iv, ct: enc.ct, salt: this.state.salt,
        updatedAt, deviceId: this.deviceId(), v: 1
      });
      this.setStatus('online');
    } catch(e){ console.error('Sync push', e); this.setStatus('error'); }
  },

  /* ---- Crear un espacio compartido nuevo con la clave dada ---- */
  async create(clave){
    await this.ensureApp();
    const workspaceId = randomWorkspaceCode();
    const salt = bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
    this.state = { workspaceId, salt, enabled: true };
    this.clave = clave;
    this.key = await deriveKey(clave, salt);
    this.persistState();
    await this.push();     // sube los datos actuales
    this.subscribe();
    return workspaceId;
  },

  /* ---- Unirse a un espacio existente (verifica la clave descifrando) ---- */
  async join(codeInput, clave){
    await this.ensureApp();
    const workspaceId = normalizeCode(codeInput);
    if (!workspaceId) throw new Error('Escribe el código del espacio.');
    const snap = await this.docRef(workspaceId).get();
    if (!snap.exists) throw new Error('No existe un espacio con ese código.');
    const d = snap.data();
    const key = await deriveKey(clave, d.salt);
    let remote;
    try { remote = await decryptJSON(key, d.iv, d.ct); }
    catch(e){ throw new Error('Clave incorrecta para este espacio.'); }
    this.state = { workspaceId, salt: d.salt, enabled: true };
    this.clave = clave; this.key = key;
    this.persistState();
    this.lastRev = d.updatedAt;
    this.applyRemote(remote);
    this.subscribe();
    return workspaceId;
  },

  /* ---- Desconectar: deja de sincronizar pero conserva los datos y el espacio ---- */
  disconnect(){
    if (this.unsub) { this.unsub(); this.unsub = null; }
    clearTimeout(this.pushTimer);
    if (this.state) { this.state.enabled = false; this.persistState(); }
    this.setStatus('off');
  },

  /* ---- Reconectar a un espacio ya configurado en este dispositivo ---- */
  reconnect(){
    if (!this.state) return;
    this.state.enabled = true;
    this.persistState();
    this.start();
  },

  /* ---- Salir del espacio en este dispositivo (mantiene los datos locales) ---- */
  leave(){
    if (this.unsub) { this.unsub(); this.unsub = null; }
    clearTimeout(this.pushTimer);
    this.state = null; this.clave = null; this.key = null;
    this.lastRev = 0;
    this.persistState();
    this.setStatus('off');
  },

  statusLabel(){
    switch (this.status) {
      case 'online':     return { txt: 'Conectado y sincronizando', cls: 'green' };
      case 'connecting': return { txt: 'Conectando…',               cls: 'amber' };
      case 'error':      return { txt: 'Sin conexión con la nube',  cls: 'red' };
      default:           return { txt: 'Desconectado',              cls: 'gray' };
    }
  }
};

/* =================================================================
   VISTA: Compartir / Sincronizar (Menú)
================================================================= */
V.sync = function(){
  Sync.loadLocal();

  // 1) Sin configuración de Firebase todavía
  if (!Sync.isConfigured()) return V._syncSetup();

  // 2) Configurado pero sin espacio: crear o unirse
  if (!Sync.state) return V._syncHome();

  // 3) Con espacio (activo o pausado): estado y controles
  return V._syncStatus();
};

/* ---- Paso 1: pegar configuración de Firebase ---- */
V._syncSetup = function(){
  const html = `
  ${headHTML({ title: 'Compartir', sub: 'Sincroniza tus datos en la nube', back: 'menu' })}
  <div class="note">
    Para compartir tus datos con otras personas (que puedan <b>verlos y editarlos</b>)
    necesitas un proyecto gratuito de <b>Firebase</b>. Se configura una sola vez.
  </div>
  <div class="card" style="font-size:.85rem;line-height:1.5">
    <b>Cómo obtener la configuración (5 min):</b>
    <ol style="margin:8px 0 0 18px;padding:0;color:var(--muted)">
      <li>Entra a <b>console.firebase.google.com</b> y crea un proyecto.</li>
      <li>Menú <b>Compilación → Firestore Database → Crear base de datos</b> (modo producción).</li>
      <li>En <b>Reglas</b>, pega las reglas que están más abajo y publica.</li>
      <li>Configuración del proyecto → <b>Tus apps</b> → agrega una app <b>Web</b> (&lt;/&gt;).</li>
      <li>Copia el objeto <b>firebaseConfig</b> y pégalo aquí abajo.</li>
    </ol>
  </div>
  <label>Configuración de Firebase (firebaseConfig)</label>
  <textarea id="sy-cfg" rows="9" placeholder='{
  "apiKey": "…",
  "authDomain": "tu-proyecto.firebaseapp.com",
  "projectId": "tu-proyecto",
  "storageBucket": "…",
  "messagingSenderId": "…",
  "appId": "…"
}'></textarea>
  <button class="btn full" style="margin-top:14px" onclick="V._syncSaveCfg()">Guardar configuración</button>

  <div class="sect"><h2>Reglas de Firestore</h2></div>
  <div class="note">Cópialas en Firestore → Reglas. Tus datos van cifrados con tu clave, y el código del espacio es secreto.</div>
  <textarea id="sy-rules" rows="9" readonly style="font-family:monospace;font-size:.75rem">${esc(V._firestoreRules())}</textarea>
  <button class="menu-item" onclick="V._copy(V._firestoreRules(),'Reglas copiadas')">${I.copy} Copiar reglas</button>`;
  App.render(html);
};

V._firestoreRules = function(){
  return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada espacio se identifica con un código secreto y aleatorio.
    // El contenido va cifrado con la clave del dueño (AES-GCM).
    match /workspaces/{code} {
      allow read: if true;
      allow write: if request.resource.data.ct is string
                   && request.resource.data.ct.size() < 900000;
    }
  }
}`;
};

V._syncSaveCfg = function(){
  const raw = document.getElementById('sy-cfg').value.trim();
  if (!raw) return toast('Pega la configuración de Firebase', true);
  let cfg;
  try {
    // Acepta tanto JSON puro como "const firebaseConfig = {…};"
    const m = raw.match(/\{[\s\S]*\}/);
    cfg = JSON.parse(m ? m[0] : raw);
  } catch(e){
    // Intento con comillas simples / claves sin comillas (formato JS)
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      // eslint-disable-next-line no-new-func
      cfg = m ? (new Function('return (' + m[0] + ')'))() : null;
    } catch(e2){ cfg = null; }
  }
  if (!cfg || !cfg.projectId || !cfg.apiKey) {
    return toast('No se pudo leer la configuración. Revisa que esté completa.', true);
  }
  Sync.saveConfig(cfg);
  toast('Configuración guardada');
  App.refresh();
};

/* ---- Paso 2: crear o unirse ---- */
V._syncHome = function(){
  const html = `
  ${headHTML({ title: 'Compartir', sub: 'Crea un espacio o únete a uno', back: 'menu' })}
  <div class="note">Un <b>espacio compartido</b> guarda tus datos en la nube. Quien tenga el
    <b>código</b> y la <b>clave</b> puede verlos y editarlos. Sin la clave, no se pueden leer.</div>

  <button class="menu-item" onclick="V._syncCreateForm()">${I.cloud} Crear espacio compartido <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="V._syncJoinForm()">${I.users} Unirme a un espacio <span class="chev">${I.chev}</span></button>

  <div class="sect"><h2>Configuración</h2></div>
  <button class="menu-item" onclick="V._syncEditCfg()">${I.key} Cambiar configuración de Firebase <span class="chev">${I.chev}</span></button>`;
  App.render(html);
};

V._syncEditCfg = async function(){
  if (!(await confirmar('¿Volver a pegar la configuración de Firebase?', { ok: 'Continuar' }))) return;
  localStorage.removeItem(Sync.CFG_KEY);
  Sync.cfg = null;
  App.refresh();
};

V._syncCreateForm = function(){
  Modal.open(`
    <div class="modal-head"><h2>Crear espacio</h2>
      <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
    <div class="note" style="margin-top:0">Elige una clave. La necesitarás (junto con el código)
      para dar acceso a otras personas. <b>Si la olvidas, no se pueden recuperar los datos del espacio.</b></div>
    <label>Clave del espacio *</label>
    <div style="display:flex;gap:8px">
      <input id="sy-clave" type="password" placeholder="Mínimo 6 caracteres">
      <button class="icon-btn" style="width:46px;height:46px;flex-shrink:0" onclick="const i=document.getElementById('sy-clave');i.type=i.type==='password'?'text':'password'">${I.eye}</button>
    </div>
    <label>Repite la clave *</label>
    <input id="sy-clave2" type="password" placeholder="Repite la clave">
    <div class="modal-actions">
      <button class="btn" onclick="V._syncDoCreate()">Crear y subir mis datos</button>
    </div>`);
};

V._syncDoCreate = async function(){
  const c1 = document.getElementById('sy-clave').value;
  const c2 = document.getElementById('sy-clave2').value;
  if (!c1 || c1.length < 6) return toast('La clave debe tener al menos 6 caracteres', true);
  if (c1 !== c2) return toast('Las claves no coinciden', true);
  toast('Creando espacio…');
  try {
    await Sync.create(c1);
    Modal.close();
    toast('Espacio creado');
    App.refresh();
  } catch(e){
    console.error(e);
    toast(e.message || 'No se pudo crear el espacio', true);
  }
};

V._syncJoinForm = function(){
  Modal.open(`
    <div class="modal-head"><h2>Unirme a un espacio</h2>
      <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
    <div class="note" style="margin-top:0"><b>Atención:</b> al unirte, los datos del espacio
      reemplazarán los que tienes ahora en este dispositivo.</div>
    <label>Código del espacio *</label>
    <input id="sy-code" autocapitalize="characters" placeholder="Ej: ABCD-EFGH-JKLM" oninput="this.value=this.value.toUpperCase()">
    <label>Clave *</label>
    <div style="display:flex;gap:8px">
      <input id="sy-jclave" type="password" placeholder="Clave del espacio">
      <button class="icon-btn" style="width:46px;height:46px;flex-shrink:0" onclick="const i=document.getElementById('sy-jclave');i.type=i.type==='password'?'text':'password'">${I.eye}</button>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="V._syncDoJoin()">Unirme</button>
    </div>`);
};

V._syncDoJoin = async function(){
  const code = document.getElementById('sy-code').value;
  const clave = document.getElementById('sy-jclave').value;
  if (!normalizeCode(code)) return toast('Escribe el código del espacio', true);
  if (!clave) return toast('Escribe la clave', true);
  toast('Conectando…');
  try {
    await Sync.join(code, clave);
    Modal.close();
    toast('¡Conectado al espacio!');
    App.refresh();
  } catch(e){
    console.error(e);
    toast(e.message || 'No se pudo unir al espacio', true);
  }
};

/* ---- Paso 3: estado del espacio ---- */
V._syncStatus = function(){
  const st = Sync.statusLabel();
  const code = displayCode(Sync.state.workspaceId);
  const activo = Sync.isActive();
  const html = `
  ${headHTML({ title: 'Compartir', sub: 'Espacio compartido', back: 'menu' })}

  <div class="card">
    <div class="card-row" style="align-items:center">
      <span style="color:var(--muted)">Estado</span>
      <span class="chip ${st.cls}">${st.txt}</span>
    </div>
  </div>

  <div class="sect"><h2>Datos para invitar</h2></div>
  <div class="note">Comparte el código y la clave <b>solo</b> con las personas que quieras que
    tengan acceso. Con ambos, podrán ver y editar estos datos desde su teléfono.</div>

  <label>Código del espacio</label>
  <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
    <b class="mono" style="font-size:1.05rem;letter-spacing:1px">${esc(code)}</b>
    <button class="btn sm ghost" onclick="V._copy('${esc(Sync.state.workspaceId)}','Código copiado')">${I.copy} Copiar</button>
  </div>

  <label>Clave</label>
  <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
    <span id="sy-clave-show" class="mono">••••••••</span>
    <div style="display:flex;gap:6px">
      <button class="btn sm ghost" onclick="V._toggleClave()">${I.eye} Ver</button>
      <button class="btn sm ghost" onclick="V._copy(Sync.clave||'','Clave copiada')">${I.copy}</button>
    </div>
  </div>

  <button class="menu-item" style="margin-top:14px" onclick="V._syncShareInvite()">${I.msg} Enviar invitación por WhatsApp <span class="chev">${I.chev}</span></button>

  <div class="sect"><h2>Conexión</h2></div>
  ${activo
    ? `<button class="menu-item" onclick="Sync.disconnect()">${I.refresh} Pausar sincronización <span class="chev">${I.chev}</span></button>`
    : `<button class="menu-item" onclick="Sync.reconnect()">${I.cloud} Reanudar sincronización <span class="chev">${I.chev}</span></button>`}
  <button class="menu-item" onclick="V._syncLeave()" style="color:var(--red)">${I.logout} Salir del espacio en este teléfono <span class="chev">${I.chev}</span></button>`;
  App.render(html);
};

V._toggleClave = function(){
  const el = document.getElementById('sy-clave-show');
  if (!el) return;
  el.textContent = el.textContent === '••••••••' ? (Sync.clave || '') : '••••••••';
};

V._syncShareInvite = function(){
  const code = displayCode(Sync.state.workspaceId);
  const msg = `Te comparto el acceso a mis datos de StreamGest.\n\n`
    + `1) Abre la app: ${location.origin + location.pathname}\n`
    + `2) Ve a Menú → Compartir → "Unirme a un espacio"\n`
    + `3) Código: ${code}\n`
    + `4) Clave: ${Sync.clave || ''}`;
  window.open(waLink('', msg), '_blank');
};

V._syncLeave = async function(){
  if (!(await confirmar('Este teléfono dejará de sincronizar con el espacio. Los datos actuales se quedan guardados aquí. ¿Continuar?', { danger: true, ok: 'Salir' }))) return;
  Sync.leave();
  toast('Saliste del espacio');
  App.refresh();
};

/* Pequeño indicador junto a la opción del menú */
V._syncBadge = function(){
  Sync.loadLocal();
  if (Sync.isActive()) return `<span class="chip green" style="margin-right:8px">Activo</span>`;
  return '';
};

/* ---- Copiar al portapapeles ---- */
V._copy = function(text, okMsg){
  const done = () => toast(okMsg || 'Copiado');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => V._copyFallback(text, done));
  } else {
    V._copyFallback(text, done);
  }
};
V._copyFallback = function(text, done){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e){ toast('No se pudo copiar', true); }
  ta.remove();
};
