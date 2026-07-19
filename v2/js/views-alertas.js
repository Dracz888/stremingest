/* ============ Alertas: vencidos, por vencer y recargas ============ */
"use strict";

V.alertas = function(){
  const a = calcAlertas();
  const permiso = ('Notification' in window) ? Notification.permission : 'unsupported';

  let html = `
  <div class="page-head">
    <div><h1>Alertas</h1><div class="sub">${alertCount()} pendiente${alertCount()!==1?'s':''}</div></div>
    <button class="icon-btn" aria-label="Ajustes de avisos" onclick="App.nav('ajustes')">${I.gear}</button>
  </div>`;

  if (permiso === 'default') {
    html += `
    <div class="card">
      <div class="card-row">
        <div style="flex:1">
          <div style="font-weight:700;font-size:.9rem">Notificaciones push</div>
          <div style="font-size:.78rem;color:var(--muted)">Activa las notificaciones para recibir avisos de vencimiento en tu celular.</div>
        </div>
        <button class="btn sm" onclick="Notification.requestPermission().then(()=>App.nav('alertas'))">Activar</button>
      </div>
    </div>`;
  }

  const faltaTxt = (x) => {
    let t;
    if (x.dias < 0) t = daysText(x.dias).toLowerCase();
    else if (x.dias === 0) t = 'vence hoy';
    else if (x.dias === 1) t = 'falta 1 día (mañana)';
    else t = 'faltan ' + x.dias + ' días';
    return t + ' · ' + fmtDate(x.plan.vence);
  };

  const itemCliente = (x) => `
    <div class="list-item">
      <div class="avatar">${esc(initials(x.cliente.nombre))}</div>
      <div class="body">
        <div class="title">${esc(x.cliente.nombre)}</div>
        <div class="meta">${esc(x.plan.nombre)} · ${faltaTxt(x)}</div>
      </div>
      <button class="icon-btn" title="Renovar" onclick="RegForm.setCliente('${x.cliente.id}')">${I.refresh}</button>
      <button class="icon-btn" style="color:var(--wa)" title="WhatsApp" onclick="WaMsg.open('${x.cliente.id}')">${I.wa}</button>
    </div>`;

  const vacio = (txt) => `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">${txt}</p></div>`;

  html += `<div class="sect"><h2>Clientes vencidos</h2><span class="cnt">${a.cliVencidos.length}</span></div>`;
  html += a.cliVencidos.length ? a.cliVencidos.map(itemCliente).join('') : vacio('Ninguno 🎉');

  html += `<div class="sect"><h2>Clientes por vencer</h2><span class="cnt">${a.cliPorVencer.length}</span></div>`;
  html += a.cliPorVencer.length ? a.cliPorVencer.map(itemCliente).join('') : vacio('Ninguno');

  html += `<div class="sect"><h2>Próximos vencimientos (${a.avisoCli} días)</h2><span class="cnt">${a.cliProximos.length}</span></div>`;
  html += a.cliProximos.length ? a.cliProximos.map(itemCliente).join('') : vacio('Ninguno');

  html += `<div class="sect"><h2>Recargas por vencer</h2><span class="cnt">${a.recPorVencer.length}</span></div>`;
  html += a.recPorVencer.length
    ? a.recPorVencer.map(x => `
    <div class="list-item">
      <div class="avatar" style="color:var(--amber)">${I.refresh.replace('<svg','<svg width="18" height="18"')}</div>
      <div class="body">
        <div class="title">${esc(x.cuenta.correo)}</div>
        <div class="meta">Cuenta propia · ${daysText(x.dias).toLowerCase()}</div>
      </div>
      <button class="btn sm ghost" onclick="RecForm.open('${x.cuenta.id}')">Recargar</button>
    </div>`).join('')
    : vacio('Ninguna');

  App.render(html);
};
