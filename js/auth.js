/* ============ Autenticación ============ */
"use strict";

const SESSION_KEY = 'sg_session';
const SALT = 'sg#2026';

const Auth = {
  current: null,

  init(){
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.userId) {
        const u = DB.users.find(x => x.id === s.userId && x.activo);
        if (u) { Auth.current = u; return true; }
      }
    } catch(e){}
    return false;
  },

  async login(usuario, clave){
    const hash = await sha256(SALT + clave);
    const u = DB.users.find(x => x.usuario.toLowerCase() === usuario.toLowerCase().trim());
    if (!u) return 'Usuario no encontrado';
    if (!u.activo) return 'Usuario desactivado';
    if (u.hash !== hash) return 'Contraseña incorrecta';
    Auth.current = u;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, ts: Date.now() }));
    return null;
  },

  logout(){
    Auth.current = null;
    localStorage.removeItem(SESSION_KEY);
    App.boot();
  },

  async createUser(usuario, clave, creadoPor){
    usuario = usuario.trim();
    if (!usuario || !clave) return 'Usuario y contraseña son obligatorios';
    if (clave.length < 4) return 'La contraseña debe tener al menos 4 caracteres';
    if (DB.users.some(x => x.usuario.toLowerCase() === usuario.toLowerCase())) return 'Ese usuario ya existe';
    const hash = await sha256(SALT + clave);
    DB.users.push({ id: uid(), usuario, hash, activo: true, creadoPor: creadoPor || null, fecha: todayISO() });
    dbSave();
    return null;
  },

  async changePassword(userId, nuevaClave){
    if (!nuevaClave || nuevaClave.length < 4) return 'La contraseña debe tener al menos 4 caracteres';
    const u = DB.users.find(x => x.id === userId);
    if (!u) return 'Usuario no encontrado';
    u.hash = await sha256(SALT + nuevaClave);
    dbSave();
    return null;
  }
};
