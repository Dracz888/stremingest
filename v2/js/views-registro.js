/* ============ Registro de pagos (pestaña central) + edición de registros ============ */
"use strict";

const RegForm = {
  clienteId: '',
  fecha: '',
  nota: '',
  items: {},    // suscripcionId -> {sel, dias}
  pagos: [],    // {metodoId, monto, conv, convMonedaId, tasa, tasaOp}

  nuevoPago(){
    return { metodoId: '', monto: '', conv: false, convMonedaId: '', tasa: '', tasaOp: 'mult' };
  },

  reset(){
    RegForm.clienteId = '';
    RegForm.fecha = todayISO();
    RegForm.nota = '';
    RegForm.items = {};
    RegForm.pagos = [RegForm.nuevoPago()];
  },

  setCliente(id){
    if (!RegForm.fecha) RegForm.reset();
    RegForm.clienteId = id;
    RegForm.items = {};
    if (!RegForm.pagos.length) RegForm.pagos = [RegForm.nuevoPago()];
    clienteSuscripciones(id).forEach(s => { RegForm.items[s.id] = { sel: true, dias: 30 }; });
    App.nav('registro');
  },

  toggleConv(i, checked){
    const pg = RegForm.pagos[i];
    if (!pg) return;
    pg.conv = checked;
    if (checked && !pg.convMonedaId) {
      const met = getMetodo(pg.metodoId);
      const subs = clienteSuscripciones(RegForm.clienteId);
      const esperadas = subs.filter(s => { const it = RegForm.items[s.id]; return it && it.sel; }).map(s => s.monedaId);
      pg.convMonedaId = esperadas.find(mid => mid && (!met || mid !== met.monedaId))
        || (DB.monedas.find(m => m.activo && (!met || m.id !== met.monedaId)) || {}).id || '';
    }
    App.nav('registro');
  }
};

/* Monto efectivo de un pago para el saldo (aplica tasa si corresponde) */
V._pagoEfectivo = function(pg){
  const met = getMetodo(pg.metodoId);
  if (!met) return null;
  const monto = Number(pg.monto) || 0;
  const tasa = Number(pg.tasa) || 0;
  if (pg.conv && pg.convMonedaId && tasa > 0) {
    return { monedaId: pg.convMonedaId, monto: round2(pg.tasaOp === 'div' ? monto / tasa : monto * tasa) };
  }
  return { monedaId: met.monedaId, monto };
};

/* Convierte los pagos de un formulario en registros de pago validados.
   Devuelve {pagos} o {error}. Compartido por RegForm y RegEdit. */
function construirPagos(formPagos){
  const pagos = [];
  for (const pg of formPagos) {
    const met = getMetodo(pg.metodoId);
    if (!met) return { error: 'Selecciona el método de cada pago' };
    const monto = Number(pg.monto) || 0;
    if (monto <= 0) return { error: 'Ingresa el monto de cada pago' };
    const pago = { metodoId: met.id, nombre: met.nombre, monedaId: met.monedaId, monto };
    if (pg.conv) {
      if (!pg.convMonedaId) return { error: 'Selecciona la moneda destino de la conversión' };
      const tasa = Number(pg.tasa) || 0;
      if (tasa <= 0) return { error: 'Ingresa la tasa de cambio' };
      pago.tasa = tasa;
      pago.tasaOp = pg.tasaOp === 'div' ? 'div' : 'mult';
      pago.convMonedaId = pg.convMonedaId;
      pago.convMonto = round2(pago.tasaOp === 'div' ? monto / tasa : monto * tasa);
    }
    pagos.push(pago);
  }
  return { pagos };
}

/* Lo que suma cada pago al saldo: el monto convertido si llevó tasa */
function pagosAPagado(pagos){
  return sumarPorMoneda(pagos.map(p => p.convMonedaId
    ? { monedaId: p.convMonedaId, monto: p.convMonto }
    : { monedaId: p.monedaId, monto: p.monto }));
}

/* HTML de un bloque de pago (compartido por RegForm y RegEdit) */
function pagoFormHTML(pg, i, owner, calcFn){
  const mets = DB.metodos.filter(m => m.activo || m.id === pg.metodoId);
  const met = getMetodo(pg.metodoId);
  const metsOpts = mets.map(m => `<option value="${m.id}" ${pg.metodoId===m.id?'selected':''}>${esc(m.nombre)} (${esc(monedaCodigo(m.monedaId))})</option>`).join('');
  let convHtml = '';
  if (met) {
    const monedasConv = DB.monedas.filter(m => (m.activo || m.id === pg.convMonedaId) && m.id !== met.monedaId);
    const monedasOpts = monedasConv.map(m => `<option value="${m.id}" ${pg.convMonedaId===m.id?'selected':''}>${esc(m.codigo)} — ${esc(m.nombre)}</option>`).join('');
    convHtml = `
    <label style="display:flex;align-items:center;gap:9px;margin-top:14px;font-size:.85rem;color:var(--text);font-weight:500">
      <input type="checkbox" ${pg.conv?'checked':''} onchange="${owner}.toggleConv(${i},this.checked)">
      El pago es en otra moneda (aplicar tasa)
    </label>`;
    if (pg.conv) {
      convHtml += `
      <label>Convertir a</label>
      <select onchange="${owner}.pagos[${i}].convMonedaId=this.value;${calcFn}">
        <option value="">Seleccionar moneda…</option>${monedasOpts}
      </select>
      <label>Tasa de cambio</label>
      <input type="number" step="any" min="0" inputmode="decimal" value="${pg.tasa}" placeholder="Ej: 36.5"
        oninput="${owner}.pagos[${i}].tasa=this.value;${calcFn}">
      <div class="seg" style="margin-top:10px">
        <button class="${pg.tasaOp!=='div'?'active':''}" onclick="${owner}.pagos[${i}].tasaOp='mult';${owner}.rerender()">× Multiplicar</button>
        <button class="${pg.tasaOp==='div'?'active':''}" onclick="${owner}.pagos[${i}].tasaOp='div';${owner}.rerender()">÷ Dividir</button>
      </div>
      <div id="conv-prev-${i}" style="font-size:.78rem;color:var(--accent);margin-top:6px;font-weight:600"></div>`;
    }
  }
  return `
  <div class="sub-card">
    ${owner === 'RegForm' ? (RegForm.pagos.length > 1 ? `<button class="remove" onclick="RegForm.pagos.splice(${i},1);RegForm.rerender()">${I.x}</button>` : '')
                          : (RegEdit.pagos.length > 1 ? `<button class="remove" onclick="RegEdit.pagos.splice(${i},1);RegEdit.render()">${I.x}</button>` : '')}
    <label>Método de pago</label>
    <select onchange="${owner}.pagos[${i}].metodoId=this.value;${owner}.rerender()">
      <option value="">Seleccionar…</option>${metsOpts}
    </select>
    <label>Monto${met ? ' en ' + esc(monedaCodigo(met.monedaId)) : ''}</label>
    <input type="number" step="any" min="0" inputmode="decimal" value="${pg.monto}"
      oninput="${owner}.pagos[${i}].monto=this.value;${calcFn}" placeholder="0.00">
    ${convHtml}
  </div>`;
}

RegForm.rerender = function(){ App.nav('registro'); };

const DIAS_RAPIDOS = [7, 15, 30, 60, 90];

V.registro = function(){
  if (!RegForm.fecha) RegForm.reset();

  let html = `
  <div class="page-head">
    <div><h1>Registrar pago</h1><div class="sub">Renovación de planes del cliente</div></div>
  </div>`;

  if (!DB.clientes.length) {
    html += `<div class="card"><div class="empty" style="padding:20px">${I.users}
      <p>Primero registra un cliente con las cuentas y planes que usa.</p>
      <button class="btn sm" style="margin-top:12px" onclick="ClienteForm.open(null,(c)=>{RegForm.setCliente(c.id)})">Nuevo cliente</button>
    </div></div>`;
    return App.render(html);
  }

  const clientesOpts = DB.clientes.slice().sort((a,b) => a.nombre.localeCompare(b.nombre))
    .map(c => `<option value="${c.id}" ${RegForm.clienteId===c.id?'selected':''}>${esc(c.nombre)}</option>`).join('');

  html += `
  <label>Cliente *</label>
  <div style="display:flex;gap:8px">
    <select id="rf-cliente" onchange="RegForm.setCliente(this.value)">
      <option value="">Seleccionar cliente…</option>${clientesOpts}
    </select>
    <button class="icon-btn" style="width:46px;height:46px;flex-shrink:0" title="Nuevo cliente"
      onclick="ClienteForm.open(null, (c)=>{RegForm.setCliente(c.id)})">${I.plus}</button>
  </div>

  <label>Fecha de pago</label>
  <input type="date" id="rf-fecha" value="${RegForm.fecha}" onchange="RegForm.fecha=this.value;App.nav('registro')">`;

  if (RegForm.clienteId) {
    const subs = clienteSuscripciones(RegForm.clienteId);
    html += `<div class="sect"><h2>Planes a renovar</h2></div>`;
    if (!subs.length) {
      html += `<div class="card"><div class="empty" style="padding:18px">${I.tv}
        <p>Este cliente no tiene planes registrados.</p>
        <button class="btn sm" style="margin-top:12px" onclick="ClienteForm.open('${RegForm.clienteId}')">Asignar planes</button>
      </div></div>`;
    }
    subs.forEach(s => {
      const it = RegForm.items[s.id] || (RegForm.items[s.id] = { sel: false, dias: 30 });
      const nuevoVence = it.dias > 0 ? addDays((s.vence && s.vence >= RegForm.fecha) ? s.vence : RegForm.fecha, it.dias) : null;
      html += `
      <div class="sub-card" style="${it.sel ? '' : 'opacity:.6'}">
        <label style="display:flex;align-items:center;gap:9px;margin-top:0;font-size:.92rem;color:var(--text);font-weight:600">
          <input type="checkbox" ${it.sel?'checked':''} onchange="RegForm.items['${s.id}'].sel=this.checked;App.nav('registro')">
          ${esc(s.nombre)} <span style="color:var(--muted);font-weight:500">· ${fmtMoneda(s.precio, s.monedaId)}</span>
        </label>
        <div style="font-size:.75rem;color:var(--muted);margin-top:4px">
          ${s.cuentaCorreo ? esc(s.cuentaCorreo) + ' · ' : ''}${s.vence ? 'vence ' + fmtDate(s.vence) + ' (' + daysText(daysLeft(s.vence)).toLowerCase() + ')' : 'sin activar'}
        </div>
        ${it.sel ? `
        <label>Días a añadir</label>
        <input type="number" min="1" inputmode="numeric" value="${it.dias}"
          oninput="RegForm.items['${s.id}'].dias=Number(this.value)||0;V._regCalc()">
        <div class="day-chips">
          ${DIAS_RAPIDOS.map(d => `<button class="${it.dias===d?'active':''}" onclick="RegForm.items['${s.id}'].dias=${d};App.nav('registro')">${d}d</button>`).join('')}
        </div>
        <div style="font-size:.78rem;color:var(--accent);margin-top:6px;font-weight:600">${nuevoVence ? 'Nuevo vencimiento: ' + fmtDate(nuevoVence) : ''}</div>` : ''}
      </div>`;
    });

    html += `<div class="sect"><h2>Pago recibido</h2></div>`;
    RegForm.pagos.forEach((pg, i) => {
      html += pagoFormHTML(pg, i, 'RegForm', 'V._regCalc()');
    });

    html += `
    <button class="add-row" onclick="RegForm.pagos.push(RegForm.nuevoPago());App.nav('registro')">${I.plus} Agregar pago</button>
    <label>Nota (opcional)</label>
    <input value="${esc(RegForm.nota)}" placeholder="Ej: pagó por adelantado" oninput="RegForm.nota=this.value">
    <div class="summary" id="rf-summary"></div>
    <div class="spacer"></div>
    <button class="btn full" style="margin-top:12px" onclick="V._regSave()">Guardar registro</button>`;
  }

  App.render(html);
  V._regCalc();
};

/* Cálculo en vivo del formulario de registro */
V._regCalc = function(){
  if (!RegForm.clienteId) return;
  const subs = clienteSuscripciones(RegForm.clienteId);
  const esperadoItems = [];
  subs.forEach(s => {
    const it = RegForm.items[s.id];
    if (it && it.sel) esperadoItems.push({ monedaId: s.monedaId, monto: s.precio });
  });
  const esperado = sumarPorMoneda(esperadoItems);
  const pagado = sumarPorMoneda(RegForm.pagos.map(pg => V._pagoEfectivo(pg)).filter(x => x && x.monedaId));
  const saldo = restarMapas(pagado, esperado);

  RegForm.pagos.forEach((pg, i) => {
    const el = document.getElementById('conv-prev-' + i);
    if (!el) return;
    const met = getMetodo(pg.metodoId);
    const ef = V._pagoEfectivo(pg);
    el.textContent = (met && ef && pg.conv && pg.convMonedaId && Number(pg.tasa) > 0)
      ? fmtMoneda(Number(pg.monto) || 0, met.monedaId) + ' equivale a ' + fmtMoneda(ef.monto, ef.monedaId)
      : 'Ingresa la tasa y la moneda destino para ver la conversión.';
  });

  const sum = document.getElementById('rf-summary');
  if (!sum) return;
  const saldoLimpio = limpiarMapa(saldo);
  let saldoTxt;
  if (!Object.keys(saldoLimpio).length) {
    saldoTxt = '<span style="color:var(--green)">Pago exacto</span>';
  } else {
    saldoTxt = Object.keys(saldoLimpio).sort((a,b)=>monedaCodigo(a).localeCompare(monedaCodigo(b))).map(k => {
      const v = saldoLimpio[k];
      return `<span style="color:${v < 0 ? 'var(--red)' : 'var(--amber)'}">${v < 0 ? 'Debe ' : 'A favor '}${fmtMoneda(Math.abs(v), k)}</span>`;
    }).join(' · ');
  }
  sum.innerHTML = `
    <div class="row"><span class="muted">Total esperado</span><span class="mono">${fmtMapa(esperado, {zeroText:'—'})}</span></div>
    <div class="row"><span class="muted">Total pagado</span><span class="mono">${fmtMapa(pagado, {zeroText:'—'})}</span></div>
    <div class="row total"><span>Saldo</span><span class="mono">${saldoTxt}</span></div>`;
};

V._regSave = function(){
  if (!RegForm.clienteId) return toast('Selecciona un cliente', true);
  const cli = getCliente(RegForm.clienteId);
  const subs = clienteSuscripciones(RegForm.clienteId);

  const items = [];
  const updates = [];
  for (const s of subs) {
    const it = RegForm.items[s.id];
    if (!it || !it.sel) continue;
    if (!it.dias || it.dias < 1) return toast('Los días a añadir deben ser al menos 1', true);
    const base = (s.vence && s.vence >= RegForm.fecha) ? s.vence : RegForm.fecha;
    const nuevoVence = addDays(base, it.dias);
    items.push({
      suscripcionId: s.id, plataformaId: s.plataformaId, nombre: s.nombre,
      monedaId: s.monedaId, precio: s.precio, dias: it.dias, vence: nuevoVence
    });
    updates.push({ id: s.id, vence: nuevoVence });
  }
  if (!items.length) return toast('Selecciona al menos un plan a renovar', true);

  const res = construirPagos(RegForm.pagos);
  if (res.error) return toast(res.error, true);
  const pagos = res.pagos;

  const esperado = sumarPorMoneda(items.map(i => ({ monedaId: i.monedaId, monto: i.precio })));
  const pagado = pagosAPagado(pagos);
  const saldo = restarMapas(pagado, esperado);

  updates.forEach(u => {
    const s = (cli.suscripciones || []).find(x => x.id === u.id);
    if (s) s.vence = u.vence;
  });

  DB.registros.push({
    id: uid(), clienteId: RegForm.clienteId, fecha: RegForm.fecha,
    nota: (RegForm.nota || '').trim(),
    items, pagos, esperado, pagado, saldo
  });
  dbSave();
  const cliId = RegForm.clienteId;
  RegForm.reset();
  toast('Pago registrado');
  V._cliExpanded = cliId;
  App.nav('clientes');
};

/* =================================================================
   EDICIÓN DE UN REGISTRO DE PAGO
   Permite corregir fecha, nota y pagos (método, monto, tasa).
   Los planes renovados y los vencimientos no se modifican.
================================================================= */
const RegEdit = {
  id: null,
  fecha: '', nota: '',
  pagos: [],

  open(id){
    const r = DB.registros.find(x => x.id === id);
    if (!r) return toast('Registro no encontrado', true);
    RegEdit.id = id;
    RegEdit.fecha = r.fecha;
    RegEdit.nota = r.nota || '';
    RegEdit.pagos = (r.pagos || []).map(p => ({
      metodoId: p.metodoId, monto: String(p.monto),
      conv: p.convMonedaId != null, convMonedaId: p.convMonedaId || '',
      tasa: p.tasa != null ? String(p.tasa) : '', tasaOp: p.tasaOp || 'mult'
    }));
    if (!RegEdit.pagos.length) RegEdit.pagos = [RegForm.nuevoPago()];
    RegEdit.render();
  },

  toggleConv(i, checked){
    const pg = RegEdit.pagos[i];
    if (!pg) return;
    pg.conv = checked;
    RegEdit.render();
  },

  rerender(){ RegEdit.render(); },

  render(){
    const r = DB.registros.find(x => x.id === RegEdit.id);
    if (!r) return;
    const cli = getCliente(r.clienteId);
    let pagosHtml = '';
    RegEdit.pagos.forEach((pg, i) => {
      pagosHtml += pagoFormHTML(pg, i, 'RegEdit', 'RegEdit.calc()');
    });
    Modal.open(`
      <div class="modal-head"><h2>Editar pago</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <div class="note" style="margin-top:0">Pago de <b>${esc(cli ? cli.nombre : '(cliente eliminado)')}</b> ·
        planes: ${(r.items||[]).map(p => esc(p.nombre) + ' (+' + p.dias + 'd)').join(', ') || '—'}.<br>
        Al editar se recalculan el total pagado y el saldo. <b>Los vencimientos no cambian.</b></div>
      <label>Fecha</label>
      <input type="date" value="${RegEdit.fecha}" onchange="RegEdit.fecha=this.value">
      <div class="sect"><h2>Pagos</h2></div>
      ${pagosHtml}
      <button class="add-row" onclick="RegEdit.pagos.push(RegForm.nuevoPago());RegEdit.render()">${I.plus} Agregar pago</button>
      <label>Nota (opcional)</label>
      <input value="${esc(RegEdit.nota)}" placeholder="Ej: corrigió el monto" oninput="RegEdit.nota=this.value">
      <div class="summary" id="re-summary"></div>
      <div class="modal-actions">
        <button class="btn" onclick="RegEdit.save()">Guardar cambios</button>
      </div>`);
    RegEdit.calc();
  },

  calc(){
    const r = DB.registros.find(x => x.id === RegEdit.id);
    if (!r) return;
    const pagado = sumarPorMoneda(RegEdit.pagos.map(pg => V._pagoEfectivo(pg)).filter(x => x && x.monedaId));
    const saldo = limpiarMapa(restarMapas(pagado, r.esperado || {}));
    RegEdit.pagos.forEach((pg, i) => {
      const el = document.getElementById('conv-prev-' + i);
      if (!el) return;
      const met = getMetodo(pg.metodoId);
      const ef = V._pagoEfectivo(pg);
      el.textContent = (met && ef && pg.conv && pg.convMonedaId && Number(pg.tasa) > 0)
        ? fmtMoneda(Number(pg.monto) || 0, met.monedaId) + ' equivale a ' + fmtMoneda(ef.monto, ef.monedaId)
        : 'Ingresa la tasa y la moneda destino para ver la conversión.';
    });
    const s = document.getElementById('re-summary');
    if (!s) return;
    let saldoTxt;
    if (!Object.keys(saldo).length) saldoTxt = '<span style="color:var(--green)">Pago exacto</span>';
    else saldoTxt = Object.keys(saldo).map(k => {
      const v = saldo[k];
      return `<span style="color:${v < 0 ? 'var(--red)' : 'var(--amber)'}">${v < 0 ? 'Debe ' : 'A favor '}${fmtMoneda(Math.abs(v), k)}</span>`;
    }).join(' · ');
    s.innerHTML = `
      <div class="row"><span class="muted">Total esperado</span><span class="mono">${fmtMapa(r.esperado || {}, {zeroText:'—'})}</span></div>
      <div class="row"><span class="muted">Total pagado</span><span class="mono">${fmtMapa(pagado, {zeroText:'—'})}</span></div>
      <div class="row total"><span>Saldo</span><span class="mono">${saldoTxt}</span></div>`;
  },

  save(){
    const r = DB.registros.find(x => x.id === RegEdit.id);
    if (!r) return toast('Registro no encontrado', true);
    const res = construirPagos(RegEdit.pagos);
    if (res.error) return toast(res.error, true);
    r.fecha = RegEdit.fecha;
    r.nota = (RegEdit.nota || '').trim();
    r.pagos = res.pagos;
    r.pagado = pagosAPagado(res.pagos);
    r.saldo = restarMapas(r.pagado, r.esperado || {});
    dbSave(); Modal.close(); toast('Pago actualizado');
    App.refresh();
  }
};

/* ---- Eliminar registros de pagos y recargas ---- */
V._delRegistro = async function(id){
  const r = DB.registros.find(x => x.id === id);
  if (!r) return;
  const ok = await confirmar('¿Eliminar este registro de pago? Se ajustarán los ingresos y la cartera. Los vencimientos de los planes no se modifican.', { danger: true, ok: 'Eliminar' });
  if (!ok) return;
  DB.registros = DB.registros.filter(x => x.id !== id);
  dbSave();
  toast('Registro eliminado');
  App.refresh();
};

V._delRecarga = async function(id){
  const r = DB.recargas.find(x => x.id === id);
  if (!r) return;
  const ok = await confirmar('¿Eliminar esta recarga? Se ajustarán los egresos y la cartera.', { danger: true, ok: 'Eliminar' });
  if (!ok) return;
  DB.recargas = DB.recargas.filter(x => x.id !== id);
  dbSave();
  toast('Recarga eliminada');
  App.refresh();
};
