/* ============ Capa de datos (localStorage) ============ */
"use strict";

const DB_KEY = 'sg_data_v1';

let DB = null;

function dbDefault(){
  return {
    clientes: [],         // {id, nombre, numero, notas, fecha}
    plataformas: [],      // {id, nombre, precioUsd, activo}
    metodos: [],          // {id, nombre, requiereTasa, activo}
    cuentas: [],          // {id, correo, clave, plataformaIds:[], estado, fecha}
    registros: [],        // {id, clienteId, fecha, planes:[{plataformaId,nombre,dias,vence,precio}], pagos:[{metodoId,nombre,monto,tasa,usd}], totalUsd, esperadoUsd, saldo}
    recargas: [],         // {id, cuentaId, fecha, pagos:[...], totalUsd, dias, vence}
    templates: {
      porVencer: 'Hola {nombre}, te recordamos que tu plan de {plan} vence {cuando}. Escríbenos para renovarlo y no perder el servicio.',
      hoy: 'Hola {nombre}, tu plan de {plan} vence HOY. Renueva ahora para mantener tu servicio activo.',
      renovado: 'Hola {nombre}, tu plan de {plan} fue renovado con éxito. Vence el {fecha}. Gracias por tu compra.'
    },
    config: {
      usuario: '',           // nombre de quien usa la app (solo para dar la bienvenida)
      monedaVistaId: null,   // null = USD; si no, id de un método con tasa
      tasaVista: ''          // tasa usada solo para convertir la vista de Gestión
    }
  };
}

function dbSeed(data){
  const metodosIniciales = [
    { nombre: 'Bs',          requiereTasa: true },
    { nombre: 'COP',         requiereTasa: true },
    { nombre: 'USD',         requiereTasa: false },
    { nombre: 'Zelle',       requiereTasa: false },
    { nombre: 'Bancolombia', requiereTasa: true },
    { nombre: 'USDT',        requiereTasa: false }
  ];
  metodosIniciales.forEach(m => data.metodos.push({ id: uid(), nombre: m.nombre, requiereTasa: m.requiereTasa, modoTasa: 'dividir', activo: true }));
}

/* Migraciones para datos guardados con versiones anteriores */
function dbMigrate(){
  if (!DB.config) DB.config = { usuario: '', monedaVistaId: null, tasaVista: '' };
  if (DB.config.usuario == null) DB.config.usuario = '';
  DB.metodos.forEach(m => { if (!m.modoTasa) m.modoTasa = 'dividir'; });
}

function dbLoad(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { DB = JSON.parse(raw); dbMigrate(); return; }
  } catch(e){ console.error('Error cargando datos', e); }
  DB = dbDefault();
  dbSeed(DB);
  dbSave();
}

function dbSave(){
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
}

/* ============ Conversión de moneda ============ */

/* Convierte un monto en la moneda del método a USD, según el modo de tasa */
function convToUsd(monto, tasa, met){
  monto = Number(monto) || 0;
  if (!met || !met.requiereTasa) return monto;
  tasa = Number(tasa) || 0;
  if (tasa <= 0) return 0;
  return met.modoTasa === 'multiplicar' ? monto * tasa : monto / tasa;
}

/* Convierte un valor en USD a la moneda de vista configurada en Gestión.
   Devuelve null si la vista está en USD o la tasa no es válida. */
function usdToVista(usd){
  const cfg = DB.config || {};
  if (!cfg.monedaVistaId) return null;
  const met = getMetodo(cfg.monedaVistaId);
  const tasa = Number(cfg.tasaVista) || 0;
  if (!met || tasa <= 0) return null;
  // Inversa del modo del método: si local→USD divide, USD→local multiplica
  return met.modoTasa === 'multiplicar' ? usd / tasa : usd * tasa;
}

/* Formatea un valor USD en la moneda de vista elegida */
function fmtVista(usd){
  const v = usdToVista(usd);
  if (v == null) return fmtUSD(usd);
  const met = getMetodo(DB.config.monedaVistaId);
  return fmtNum(v) + ' ' + met.nombre;
}

/* Etiqueta de la tasa según el modo del método */
function tasaLabel(met){
  return met.modoTasa === 'multiplicar'
    ? 'Tasa (USD por 1 ' + met.nombre + ')'
    : 'Tasa (' + met.nombre + ' por 1 USD)';
}

/* ---- Accesores básicos ---- */
function getCliente(id){ return DB.clientes.find(c => c.id === id); }
function getPlataforma(id){ return DB.plataformas.find(p => p.id === id); }
function getMetodo(id){ return DB.metodos.find(m => m.id === id); }
function getCuenta(id){ return DB.cuentas.find(c => c.id === id); }

/* ============ Cálculos derivados ============ */

/* Planes de un cliente: agrupa todos los planes pagados por plataforma
   y toma el vencimiento más reciente de cada una. */
function clientePlanes(clienteId){
  const regs = DB.registros.filter(r => r.clienteId === clienteId);
  const porPlat = {};
  regs.forEach(r => {
    (r.planes || []).forEach(p => {
      const k = p.plataformaId;
      if (!porPlat[k] || p.vence > porPlat[k].vence) {
        porPlat[k] = { plataformaId: k, nombre: p.nombre, vence: p.vence, precio: p.precio, dias: p.dias };
      }
    });
  });
  return Object.values(porPlat).sort((a,b) => a.vence < b.vence ? -1 : 1);
}

/* Saldo acumulado del cliente: pagado - esperado (negativo = debe) */
function clienteSaldo(clienteId){
  return DB.registros
    .filter(r => r.clienteId === clienteId)
    .reduce((s, r) => s + (Number(r.saldo) || 0), 0);
}

/* Estado general del cliente */
function clienteEstado(clienteId){
  const planes = clientePlanes(clienteId);
  const saldo = clienteSaldo(clienteId);
  if (!planes.length) return { label: 'Sin planes', cls: 'gray' };
  const algunoVencido = planes.some(p => daysLeft(p.vence) < 0);
  if (algunoVencido) return { label: 'Vencido', cls: 'red' };
  if (saldo < -0.009) return { label: 'Debe ' + fmtUSD(Math.abs(saldo)), cls: 'red' };
  const proximo = planes.some(p => daysLeft(p.vence) <= 1);
  if (proximo) return { label: 'Por vencer', cls: 'amber' };
  return { label: 'Al día', cls: 'green' };
}

/* ---- Totales financieros ---- */
function totalIngresos(){ return DB.registros.reduce((s, r) => s + (Number(r.totalUsd) || 0), 0); }
function totalEgresos(){ return DB.recargas.reduce((s, r) => s + (Number(r.totalUsd) || 0), 0); }

/* Cartera: acumulado por método en su moneda original (ingresos - egresos) */
function cartera(){
  const map = {};
  const add = (pagos, sign) => {
    (pagos || []).forEach(p => {
      const k = p.metodoId;
      if (!map[k]) map[k] = { nombre: p.nombre, monto: 0, usd: 0 };
      map[k].monto += sign * (Number(p.monto) || 0);
      map[k].usd   += sign * (Number(p.usd) || 0);
    });
  };
  DB.registros.forEach(r => add(r.pagos, 1));
  DB.recargas.forEach(r => add(r.pagos, -1));
  return Object.values(map).filter(m => Math.abs(m.monto) > 0.001 || Math.abs(m.usd) > 0.001);
}

/* Ranking de plataformas vendidas. periodo: 'mes' | '30' | 'todo' */
function rankingPlataformas(periodo){
  let desde = null;
  const hoy = new Date(todayISO() + 'T00:00:00');
  if (periodo === 'mes') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (periodo === '30'){ desde = new Date(hoy); desde.setDate(desde.getDate() - 30); }
  const map = {};
  DB.registros.forEach(r => {
    if (desde && new Date(r.fecha.slice(0,10) + 'T00:00:00') < desde) return;
    (r.planes || []).forEach(p => {
      const k = p.plataformaId;
      if (!map[k]) map[k] = { nombre: p.nombre, ventas: 0, usd: 0 };
      map[k].ventas++;
      map[k].usd += Number(p.precio) || 0;
    });
  });
  return Object.values(map).sort((a,b) => b.usd - a.usd);
}

/* ============ Alertas ============ */
/* Devuelve {clientesVencidos, clientesPorVencer, recargasPorVencer} */
function calcAlertas(){
  const cliVencidos = [];
  const cliPorVencer = [];
  DB.clientes.forEach(c => {
    clientePlanes(c.id).forEach(p => {
      const d = daysLeft(p.vence);
      if (d < 0) cliVencidos.push({ cliente: c, plan: p, dias: d });
      else if (d <= 1) cliPorVencer.push({ cliente: c, plan: p, dias: d });
    });
  });
  const recPorVencer = [];
  DB.cuentas.forEach(ct => {
    const recs = DB.recargas.filter(r => r.cuentaId === ct.id);
    if (!recs.length) return;
    const ultima = recs.reduce((a,b) => a.vence > b.vence ? a : b);
    const d = daysLeft(ultima.vence);
    if (d <= 5) recPorVencer.push({ cuenta: ct, recarga: ultima, dias: d });
  });
  cliVencidos.sort((a,b) => a.dias - b.dias);
  cliPorVencer.sort((a,b) => a.dias - b.dias);
  recPorVencer.sort((a,b) => a.dias - b.dias);
  return { cliVencidos, cliPorVencer, recPorVencer };
}

function alertCount(){
  const a = calcAlertas();
  return a.cliVencidos.length + a.cliPorVencer.length + a.recPorVencer.length;
}

/* ---- Notificaciones locales (mejor esfuerzo, al abrir la app) ---- */
function checkNotifications(){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = 'sg_notified';
  let done = {};
  try { done = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e){}
  const hoy = todayISO();
  if (done.date !== hoy) done = { date: hoy, keys: [] };
  const send = (k, title, body) => {
    if (done.keys.includes(k)) return;
    try { new Notification(title, { body, icon: 'icon.svg' }); done.keys.push(k); } catch(e){}
  };
  const a = calcAlertas();
  a.cliPorVencer.forEach(x => send('c' + x.cliente.id + x.plan.plataformaId,
    'Cliente por vencer',
    x.cliente.nombre + ' — ' + x.plan.nombre + ' ' + (x.dias === 0 ? 'vence HOY' : 'vence mañana')));
  a.cliVencidos.filter(x => x.dias >= -1).forEach(x => send('v' + x.cliente.id + x.plan.plataformaId,
    'Cliente vencido',
    x.cliente.nombre + ' — ' + x.plan.nombre + ' ya venció'));
  a.recPorVencer.forEach(x => send('r' + x.cuenta.id,
    'Recarga por vencer',
    'Cuenta ' + x.cuenta.correo + ' — ' + (x.dias <= 0 ? 'vence HOY' : x.dias + ' día(s) restante(s)')));
  localStorage.setItem(key, JSON.stringify(done));
}
