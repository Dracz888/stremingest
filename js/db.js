/* ============ Capa de datos (localStorage) ============ */
"use strict";

const DB_KEY = 'sg_data_v1';

let DB = null;

function dbDefault(){
  return {
    monedas: [],          // {id, codigo, nombre, activo}
    clientes: [],         // {id, nombre, numero, notas, fecha, suscripciones:[{id, cuentaId, plataformaId, vence, fecha}]}
    plataformas: [],      // {id, nombre, monedaId, precio, activo}
    metodos: [],          // {id, nombre, monedaId, activo}
    cuentas: [],          // {id, correo, clave, plataformaIds:[], estado, fecha}
    registros: [],        // {id, clienteId, fecha, items:[{suscripcionId, plataformaId, nombre, monedaId, precio, dias, vence}], pagos:[{metodoId, nombre, monedaId, monto}], esperado:{monedaId:total}, pagado:{monedaId:total}, saldo:{monedaId:total}}
    recargas: [],         // {id, cuentaId, fecha, pagos:[{metodoId, nombre, monedaId, monto}], total:{monedaId:total}, dias, vence}
    templates: {
      porVencer: 'Hola {nombre}, te recordamos que tu plan de {plan} vence {cuando}. Escríbenos para renovarlo y no perder el servicio.',
      hoy: 'Hola {nombre}, tu plan de {plan} vence HOY. Renueva ahora para mantener tu servicio activo.',
      renovado: 'Hola {nombre}, tu plan de {plan} fue renovado con éxito. Vence el {fecha}. Gracias por tu compra.'
    },
    plantillas: [],       // plantillas personalizadas de WhatsApp: {id, nombre, texto}
    config: {
      usuario: ''            // nombre de quien usa la app (solo para dar la bienvenida)
    }
  };
}

function dbSeed(data){
  const monedasIniciales = [
    { codigo: 'USD', nombre: 'Dólares' },
    { codigo: 'COP', nombre: 'Pesos colombianos' },
    { codigo: 'Bs',  nombre: 'Bolívares' }
  ];
  monedasIniciales.forEach(m => data.monedas.push({ id: uid(), codigo: m.codigo, nombre: m.nombre, activo: true }));
  const byCod = cod => (data.monedas.find(m => m.codigo === cod) || {}).id || null;
  const metodosIniciales = [
    { nombre: 'Efectivo Bs',  moneda: 'Bs'  },
    { nombre: 'Pago Móvil',   moneda: 'Bs'  },
    { nombre: 'Efectivo COP', moneda: 'COP' },
    { nombre: 'Bancolombia',  moneda: 'COP' },
    { nombre: 'Nequi',        moneda: 'COP' },
    { nombre: 'Efectivo USD', moneda: 'USD' },
    { nombre: 'Zelle',        moneda: 'USD' },
    { nombre: 'USDT',         moneda: 'USD' }
  ];
  metodosIniciales.forEach(m => data.metodos.push({ id: uid(), nombre: m.nombre, monedaId: byCod(m.moneda), activo: true }));
}

/* Migraciones para datos guardados con versiones anteriores.
   La versión anterior manejaba todo normalizado a USD con tasas de cambio.
   El nuevo modelo maneja monedas nativas por plan y saldo por moneda. */
function dbMigrate(){
  if (!DB.config) DB.config = { usuario: '' };
  if (DB.config.usuario == null) DB.config.usuario = '';

  // Plantillas de WhatsApp: fijas + personalizadas
  const tplDefaults = dbDefault().templates;
  if (!DB.templates) DB.templates = {};
  Object.keys(tplDefaults).forEach(k => { if (DB.templates[k] == null) DB.templates[k] = tplDefaults[k]; });
  if (!Array.isArray(DB.plantillas)) DB.plantillas = [];

  // ---- 1. Catálogo de monedas ----
  if (!Array.isArray(DB.monedas)) DB.monedas = [];
  const ensureMoneda = (codigo, nombre) => {
    let m = DB.monedas.find(x => x.codigo.toLowerCase() === codigo.toLowerCase());
    if (!m) { m = { id: uid(), codigo, nombre: nombre || codigo, activo: true }; DB.monedas.push(m); }
    return m.id;
  };
  const usdId = ensureMoneda('USD', 'Dólares');

  // Deduce la moneda de un método antiguo por su nombre / si requería tasa
  const monedaDeMetodoLegacy = (met) => {
    const n = String(met.nombre || '').toLowerCase();
    if (/cop|bancolombia|nequi|colomb|peso/.test(n)) return ensureMoneda('COP', 'Pesos colombianos');
    if (/bs|bol[ií]var|pago m[óo]vil|ves/.test(n))   return ensureMoneda('Bs', 'Bolívares');
    if (/zelle|usdt|usd|d[óo]lar|paypal/.test(n))    return usdId;
    if (met.requiereTasa) return ensureMoneda(met.nombre, met.nombre); // moneda propia con el nombre del método
    return usdId;
  };

  // ---- 2. Métodos: pasan de {requiereTasa, modoTasa} a {monedaId} ----
  (DB.metodos || []).forEach(m => {
    if (!m.monedaId) m.monedaId = monedaDeMetodoLegacy(m);
    delete m.requiereTasa; delete m.modoTasa;
  });

  // ---- 3. Plataformas: precioUsd -> precio en USD ----
  (DB.plataformas || []).forEach(p => {
    if (!p.monedaId) p.monedaId = usdId;
    if (p.precio == null) p.precio = Number(p.precioUsd) || 0;
    delete p.precioUsd;
  });
  const getPrecio = id => { const p = (DB.plataformas||[]).find(x => x.id === id); return p ? { monedaId: p.monedaId, precio: Number(p.precio)||0, nombre: p.nombre } : null; };

  // ---- 4. Reconstruir suscripciones de cada cliente desde su historial ----
  (DB.clientes || []).forEach(c => {
    if (!Array.isArray(c.suscripciones)) {
      const porPlat = {};
      (DB.registros || []).filter(r => r.clienteId === c.id).forEach(r => {
        (r.planes || []).forEach(p => {
          const k = p.plataformaId;
          if (!porPlat[k] || (p.vence || '') > porPlat[k].vence) {
            porPlat[k] = { plataformaId: k, vence: p.vence || null };
          }
        });
      });
      c.suscripciones = Object.keys(porPlat).map(platId => {
        // si una sola cuenta ofrece esa plataforma, la vinculamos
        const ctas = (DB.cuentas || []).filter(ct => (ct.plataformaIds || []).includes(platId));
        return {
          id: uid(), plataformaId: platId,
          cuentaId: ctas.length === 1 ? ctas[0].id : null,
          vence: porPlat[platId].vence, fecha: c.fecha || todayISO()
        };
      });
    }
  });

  // ---- 5. Registros: de {planes, pagos(usd/tasa), totalUsd, esperadoUsd, saldo} a por-moneda ----
  (DB.registros || []).forEach(r => {
    if (r.items && r.saldo && typeof r.saldo === 'object') return; // ya migrado
    const cli = (DB.clientes || []).find(c => c.id === r.clienteId);
    const items = (r.planes || []).map(p => {
      const info = getPrecio(p.plataformaId) || { monedaId: usdId, precio: Number(p.precio) || 0 };
      const sus = cli && (cli.suscripciones || []).find(s => s.plataformaId === p.plataformaId);
      return {
        suscripcionId: sus ? sus.id : null,
        plataformaId: p.plataformaId, nombre: p.nombre,
        monedaId: info.monedaId, precio: info.precio,
        dias: p.dias, vence: p.vence
      };
    });
    const pagos = (r.pagos || []).map(pg => {
      const met = (DB.metodos || []).find(m => m.id === pg.metodoId);
      return { metodoId: pg.metodoId, nombre: pg.nombre, monedaId: met ? met.monedaId : usdId, monto: Number(pg.monto) || 0 };
    });
    r.items = items;
    r.esperado = sumarPorMoneda(items.map(i => ({ monedaId: i.monedaId, monto: i.precio })));
    r.pagado   = sumarPorMoneda(pagos);
    r.saldo    = restarMapas(r.pagado, r.esperado);
    delete r.planes; delete r.totalUsd; delete r.esperadoUsd;
  });

  // ---- 6. Recargas: pagos(usd/tasa) -> por-moneda ----
  (DB.recargas || []).forEach(r => {
    if (r.total && typeof r.total === 'object') return;
    const pagos = (r.pagos || []).map(pg => {
      const met = (DB.metodos || []).find(m => m.id === pg.metodoId);
      return { metodoId: pg.metodoId, nombre: pg.nombre, monedaId: met ? met.monedaId : usdId, monto: Number(pg.monto) || 0 };
    });
    r.pagos = pagos;
    r.total = sumarPorMoneda(pagos);
    delete r.totalUsd;
  });

  // limpiar config antigua de vista en USD
  if (DB.config) { delete DB.config.monedaVistaId; delete DB.config.tasaVista; }
}

function dbLoad(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { DB = JSON.parse(raw); dbMigrate(); dbSave(); return; }
  } catch(e){ console.error('Error cargando datos', e); }
  DB = dbDefault();
  dbSeed(DB);
  dbSave();
}

/* Guarda solo en este dispositivo (sin avisar a la sincronización) */
function dbSaveLocal(){
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
}

/* Guarda y, si hay un espacio compartido activo, programa la subida a la nube */
function dbSave(){
  dbSaveLocal();
  if (typeof Sync !== 'undefined' && Sync && typeof Sync.onLocalSave === 'function') {
    Sync.onLocalSave();
  }
}

/* ============ Utilidades de moneda ============ */

/* Suma una lista de {monedaId, monto} en un mapa {monedaId: total} */
function sumarPorMoneda(items){
  const map = {};
  (items || []).forEach(it => {
    const k = it.monedaId || '';
    map[k] = (map[k] || 0) + (Number(it.monto) || 0);
  });
  return map;
}

/* a - b, mapa por mapa (por moneda) */
function restarMapas(a, b){
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  keys.forEach(k => {
    const v = round2((a[k] || 0) - (b[k] || 0));
    out[k] = v;
  });
  return out;
}

/* Suma acumulada de varios mapas por moneda */
function acumularMapas(mapas){
  const out = {};
  (mapas || []).forEach(m => {
    Object.keys(m || {}).forEach(k => { out[k] = round2((out[k] || 0) + (Number(m[k]) || 0)); });
  });
  return out;
}

function round2(n){ return Math.round((Number(n) || 0) * 100) / 100; }

/* Descarta las entradas ~0 de un mapa por moneda */
function limpiarMapa(map){
  const out = {};
  Object.keys(map || {}).forEach(k => { if (Math.abs(map[k]) > 0.009) out[k] = map[k]; });
  return out;
}

/* ---- Accesores básicos ---- */
function getMoneda(id){ return DB.monedas.find(m => m.id === id); }
function getCliente(id){ return DB.clientes.find(c => c.id === id); }
function getPlataforma(id){ return DB.plataformas.find(p => p.id === id); }
function getMetodo(id){ return DB.metodos.find(m => m.id === id); }
function getCuenta(id){ return DB.cuentas.find(c => c.id === id); }

function monedaCodigo(id){ const m = getMoneda(id); return m ? m.codigo : '—'; }

/* Formatea un monto en su moneda: "$12.00" para USD, "45.000 COP" para el resto */
function fmtMoneda(monto, monedaId){
  const cod = monedaCodigo(monedaId);
  if (cod === 'USD') return '$' + (Number(monto)||0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  return fmtNum(monto) + ' ' + cod;
}

/* Formatea un mapa {monedaId: monto} como "45.000 COP · $10.00", omitiendo ceros */
function fmtMapa(map, opts){
  opts = opts || {};
  const entries = Object.keys(map || {})
    .filter(k => opts.keepZero || Math.abs(map[k]) > 0.009)
    .sort((a,b) => monedaCodigo(a).localeCompare(monedaCodigo(b)));
  if (!entries.length) return opts.zeroText || fmtMoneda(0, null);
  return entries.map(k => fmtMoneda(map[k], k)).join(opts.sep || ' · ');
}

/* ============ Cálculos derivados ============ */

/* Suscripciones (planes que usa) de un cliente, enriquecidas con datos del plan y la cuenta */
function clienteSuscripciones(clienteId){
  const c = getCliente(clienteId);
  if (!c) return [];
  return (c.suscripciones || []).map(s => {
    const plat = getPlataforma(s.plataformaId);
    const cta = getCuenta(s.cuentaId);
    return {
      id: s.id, cuentaId: s.cuentaId, plataformaId: s.plataformaId,
      nombre: plat ? plat.nombre : '(plan eliminado)',
      monedaId: plat ? plat.monedaId : null,
      precio: plat ? Number(plat.precio) || 0 : 0,
      vence: s.vence || null,
      cuentaCorreo: cta ? cta.correo : null
    };
  }).sort((a,b) => {
    if (!a.vence && !b.vence) return 0;
    if (!a.vence) return 1;
    if (!b.vence) return -1;
    return a.vence < b.vence ? -1 : 1;
  });
}

/* Precio total esperado (por moneda) de todas las suscripciones de un cliente */
function clienteEsperado(clienteId){
  const subs = clienteSuscripciones(clienteId);
  return sumarPorMoneda(subs.map(s => ({ monedaId: s.monedaId, monto: s.precio })));
}

/* Saldo acumulado del cliente por moneda: pagado - esperado (negativo = debe) */
function clienteSaldo(clienteId){
  const mapas = DB.registros.filter(r => r.clienteId === clienteId).map(r => r.saldo || {});
  return limpiarMapa(acumularMapas(mapas));
}

/* Estado general del cliente */
function clienteEstado(clienteId){
  const subs = clienteSuscripciones(clienteId);
  const saldo = clienteSaldo(clienteId);
  if (!subs.length) return { label: 'Sin planes', cls: 'gray' };
  const conVence = subs.filter(s => s.vence);
  const algunoVencido = conVence.some(s => daysLeft(s.vence) < 0);
  if (algunoVencido) return { label: 'Vencido', cls: 'red' };
  const debe = Object.keys(saldo).some(k => saldo[k] < -0.009);
  if (debe) {
    const deudas = {}; Object.keys(saldo).forEach(k => { if (saldo[k] < -0.009) deudas[k] = -saldo[k]; });
    return { label: 'Debe ' + fmtMapa(deudas), cls: 'red' };
  }
  if (subs.some(s => !s.vence)) return { label: 'Sin activar', cls: 'amber' };
  const proximo = conVence.some(s => daysLeft(s.vence) <= 1);
  if (proximo) return { label: 'Por vencer', cls: 'amber' };
  return { label: 'Al día', cls: 'green' };
}

/* ---- Totales financieros (por moneda) ---- */

/* ¿La fecha ISO cae en el año/mes indicados? ('' = sin filtro) */
function enPeriodo(fecha, anio, mes){
  const f = String(fecha || '').slice(0, 10);
  if (anio && f.slice(0, 4) !== String(anio)) return false;
  if (mes && f.slice(5, 7) !== String(mes)) return false;
  return true;
}

/* Años con movimientos (registros o recargas), del más reciente al más antiguo */
function aniosConMovimientos(){
  const set = new Set();
  DB.registros.forEach(r => { const y = String(r.fecha||'').slice(0,4); if (y) set.add(y); });
  DB.recargas.forEach(r => { const y = String(r.fecha||'').slice(0,4); if (y) set.add(y); });
  return Array.from(set).sort((a,b) => b.localeCompare(a));
}

function totalIngresos(anio, mes){
  return acumularMapas(DB.registros.filter(r => enPeriodo(r.fecha, anio, mes)).map(r => r.pagado || {}));
}
function totalEgresos(anio, mes){
  return acumularMapas(DB.recargas.filter(r => enPeriodo(r.fecha, anio, mes)).map(r => r.total || {}));
}
function balanceGeneral(anio, mes){ return restarMapas(totalIngresos(anio, mes), totalEgresos(anio, mes)); }

/* Cartera: acumulado por método en su moneda (ingresos - egresos) */
function cartera(){
  const map = {};
  const add = (pagos, sign) => {
    (pagos || []).forEach(p => {
      const k = p.metodoId;
      if (!map[k]) map[k] = { nombre: p.nombre, monedaId: p.monedaId, monto: 0 };
      map[k].monto += sign * (Number(p.monto) || 0);
    });
  };
  DB.registros.forEach(r => add(r.pagos, 1));
  DB.recargas.forEach(r => add(r.pagos, -1));
  return Object.values(map).filter(m => Math.abs(m.monto) > 0.009);
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
    (r.items || []).forEach(p => {
      const k = p.plataformaId;
      if (!map[k]) map[k] = { nombre: p.nombre, monedaId: p.monedaId, ventas: 0, monto: 0 };
      map[k].ventas++;
      map[k].monto += Number(p.precio) || 0;
    });
  });
  return Object.values(map).sort((a,b) => b.ventas - a.ventas);
}

/* ============ Alertas ============ */
/* Devuelve {cliVencidos, cliPorVencer, cliProximos, recPorVencer} */
function calcAlertas(){
  const cliVencidos = [];
  const cliPorVencer = [];
  const cliProximos = [];   // vencen en 2 a 7 días (informativo, no cuenta en el badge)
  DB.clientes.forEach(c => {
    clienteSuscripciones(c.id).forEach(s => {
      if (!s.vence) return;
      const d = daysLeft(s.vence);
      if (d < 0) cliVencidos.push({ cliente: c, plan: s, dias: d });
      else if (d <= 1) cliPorVencer.push({ cliente: c, plan: s, dias: d });
      else if (d <= 7) cliProximos.push({ cliente: c, plan: s, dias: d });
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
  cliProximos.sort((a,b) => a.dias - b.dias);
  recPorVencer.sort((a,b) => a.dias - b.dias);
  return { cliVencidos, cliPorVencer, cliProximos, recPorVencer };
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
