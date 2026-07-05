/* ============ Vistas principales: Inicio, Clientes, Registro, Alertas ============ */
"use strict";

const V = {};

/* =================================================================
   INICIO / GESTIÓN
================================================================= */
V._rankPeriodo = 'mes';

V.dashboard = function(){
  const ing = totalIngresos();
  const egr = totalEgresos();
  const bal = ing - egr;
  const cart = cartera();
  const rank = rankingPlataformas(V._rankPeriodo);
  const maxUsd = rank.length ? Math.max(...rank.map(r => r.usd), 0.01) : 1;
  const nAlertas = alertCount();

  const cfg = DB.config;
  const monedas = DB.metodos.filter(m => m.requiereTasa && (m.activo || m.id === cfg.monedaVistaId));
  const metVista = cfg.monedaVistaId ? getMetodo(cfg.monedaVistaId) : null;
  const vistaActiva = usdToVista(1) != null;

  let html = `
  <div class="page-head">
    <div>
      <h1>Gestión</h1>
      <div class="sub">Hola, ${esc(Auth.current.usuario)} · ${fmtDate(todayISO())}</div>
    </div>
  </div>

  <div class="card" style="padding:12px">
    <div style="display:flex;gap:8px;align-items:flex-end">
      <div style="flex:1">
        <label style="margin-top:0">Ver montos en</label>
        <select onchange="V._setMonedaVista(this.value)">
          <option value="">USD (dólares)</option>
          ${monedas.map(m => `<option value="${m.id}" ${cfg.monedaVistaId===m.id?'selected':''}>${esc(m.nombre)}</option>`).join('')}
        </select>
      </div>
      ${metVista ? `
      <div style="flex:1">
        <label style="margin-top:0">${esc(tasaLabel(metVista))}</label>
        <input type="number" step="any" min="0" inputmode="decimal" value="${esc(cfg.tasaVista)}"
          placeholder="Tasa del día" onchange="DB.config.tasaVista=this.value;dbSave();App.nav('dashboard')">
      </div>` : ''}
    </div>
    ${metVista && !vistaActiva ? '<div style="font-size:.78rem;color:var(--amber);margin-top:8px">Ingresa la tasa del día para ver los montos en ' + esc(metVista.nombre) + '.</div>' : ''}
  </div>

  <div class="grid3">
    <div class="kpi"><div class="lbl">Ingresos</div><div class="val mono" ${vistaActiva ? 'style="font-size:.95rem"' : ''}>${fmtVista(ing)}</div></div>
    <div class="kpi"><div class="lbl">Egresos</div><div class="val mono" ${vistaActiva ? 'style="font-size:.95rem"' : ''}>${fmtVista(egr)}</div></div>
    <div class="kpi ${bal >= 0 ? 'green' : 'red'}"><div class="lbl">Balance</div><div class="val mono" ${vistaActiva ? 'style="font-size:.95rem"' : ''}>${fmtVista(bal)}</div></div>
  </div>

  <div class="grid2" style="margin-top:10px">
    <button class="kpi" style="text-align:left" onclick="App.nav('clientes')">
      <div class="lbl">Clientes</div><div class="val">${DB.clientes.length}</div>
    </button>
    <button class="kpi ${nAlertas ? 'red' : ''}" style="text-align:left" onclick="App.nav('alertas')">
      <div class="lbl">Alertas</div><div class="val">${nAlertas}</div>
    </button>
  </div>

  <div class="sect"><h2>Cartera por moneda</h2></div>
  <div class="card">`;

  if (!cart.length) {
    html += `<div class="empty" style="padding:18px">${I.wallet}<p>Aún no hay movimientos registrados</p></div>`;
  } else {
    cart.forEach(m => {
      html += `
      <div class="card-row" style="padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${esc(m.nombre)}</span>
        <span style="text-align:right">
          <span class="mono" style="font-weight:700">${fmtNum(m.monto)}</span>
          <span class="mono" style="color:var(--muted);font-size:.78rem;display:block">≈ ${fmtVista(m.usd)}</span>
        </span>
      </div>`;
    });
    const totalCart = cart.reduce((s,m) => s + m.usd, 0);
    html += `<div class="card-row" style="padding-top:10px"><span style="font-weight:750">Total equivalente</span><span class="mono" style="font-weight:750">${fmtVista(totalCart)}</span></div>`;
  }
  html += `</div>

  <div class="sect"><h2>Planes más vendidos</h2></div>
  <div class="seg">
    <button class="${V._rankPeriodo==='mes'?'active':''}" onclick="V._rankPeriodo='mes';App.nav('dashboard')">Mes actual</button>
    <button class="${V._rankPeriodo==='30'?'active':''}" onclick="V._rankPeriodo='30';App.nav('dashboard')">Últimos 30 días</button>
    <button class="${V._rankPeriodo==='todo'?'active':''}" onclick="V._rankPeriodo='todo';App.nav('dashboard')">Histórico</button>
  </div>
  <div class="card">`;

  if (!rank.length) {
    html += `<div class="empty" style="padding:18px">${I.chart}<p>Sin ventas en este período</p></div>`;
  } else {
    rank.forEach(r => {
      html += `
      <div class="rank-row">
        <div class="rr-top">
          <span class="n">${esc(r.nombre)}</span>
          <span class="v mono">${r.ventas} venta${r.ventas!==1?'s':''} · ${fmtVista(r.usd)}</span>
        </div>
        <div class="bar"><div style="width:${Math.round(r.usd / maxUsd * 100)}%"></div></div>
      </div>`;
    });
  }
  html += `</div>`;
  App.render(html);
};

V._setMonedaVista = function(id){
  DB.config.monedaVistaId = id || null;
  dbSave();
  App.nav('dashboard');
};

/* =================================================================
   CLIENTES (vista consolidada por cliente — módulo "Cuentas")
================================================================= */
V._cliSearch = '';
V._cliExpanded = null;
V._cliHist = null;

V.clientes = function(){
  const q = V._cliSearch.toLowerCase();
  const lista = DB.clientes
    .filter(c => !q || c.nombre.toLowerCase().includes(q) || String(c.numero).includes(q))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));

  let html = `
  <div class="page-head">
    <div><h1>Clientes</h1><div class="sub">${DB.clientes.length} registrados</div></div>
    <div class="head-actions">
      <button class="btn sm" onclick="ClienteForm.open()">${I.plus} Nuevo</button>
    </div>
  </div>
  <div class="search-wrap">${I.search}
    <input type="search" placeholder="Buscar por nombre o teléfono" value="${esc(V._cliSearch)}"
      oninput="V._cliSearch=this.value;V._renderCliList()">
  </div>
  <div id="cli-list"></div>`;
  App.render(html);
  V._renderCliList();
};

V._renderCliList = function(){
  const q = V._cliSearch.toLowerCase();
  const lista = DB.clientes
    .filter(c => !q || c.nombre.toLowerCase().includes(q) || String(c.numero).includes(q))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));

  let html = '';
  if (!lista.length) {
    html = `<div class="empty">${I.users}<p>${DB.clientes.length ? 'Sin resultados para la búsqueda' : 'Aún no tienes clientes. Toca "Nuevo" para agregar el primero.'}</p></div>`;
  }
  lista.forEach(c => {
    const planes = clientePlanes(c.id);
    const estado = clienteEstado(c.id);
    const activos = planes.filter(p => daysLeft(p.vence) >= 0);
    const proximo = planes.length ? planes[0] : null;
    const expanded = V._cliExpanded === c.id;

    html += `
    <div class="card ${expanded ? '' : 'pressable'}" ${expanded ? '' : `onclick="V._toggleCli('${c.id}')"`}>
      <div class="card-row" ${expanded ? `onclick="V._toggleCli('${c.id}')"` : ''}>
        <div class="avatar">${esc(initials(c.nombre))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.nombre)}</div>
          <div style="font-size:.78rem;color:var(--muted)">
            ${activos.length} plan${activos.length!==1?'es':''} activo${activos.length!==1?'s':''}${proximo ? ' · próx. venc. ' + daysText(daysLeft(proximo.vence)).toLowerCase() : ''}
          </div>
        </div>
        <span class="chip ${estado.cls}">${estado.label}</span>
      </div>`;

    if (expanded) {
      const saldo = clienteSaldo(c.id);
      html += `<div class="expand">`;
      if (!planes.length) {
        html += `<p style="color:var(--muted);font-size:.85rem;padding:6px 0">Sin planes registrados. Registra un pago para empezar.</p>`;
      }
      planes.forEach(p => {
        const d = daysLeft(p.vence);
        html += `
        <div class="plan-row">
          <div>
            <div class="pname">${esc(p.nombre)}</div>
            <div class="pmeta">${fmtUSD(p.precio)} · vence ${fmtDate(p.vence)}</div>
          </div>
          <span class="days-pill ${daysPillClass(d)}">${daysText(d)}</span>
        </div>`;
      });
      if (Math.abs(saldo) > 0.009) {
        html += `<div class="note" style="color:${saldo < 0 ? 'var(--red)' : 'var(--green)'}">
          ${saldo < 0 ? 'Debe ' + fmtUSD(Math.abs(saldo)) : 'Saldo a favor de ' + fmtUSD(saldo)}
        </div>`;
      }
      html += `
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn sm wa-btn" onclick="event.stopPropagation();WaMsg.open('${c.id}')">${I.wa} WhatsApp</button>
        <button class="btn sm ghost" onclick="event.stopPropagation();V._cliHist=V._cliHist==='${c.id}'?null:'${c.id}';V._renderCliList()">Historial</button>
        <button class="btn sm ghost" onclick="event.stopPropagation();ClienteForm.open('${c.id}')">${I.edit} Editar</button>
      </div>`;

      if (V._cliHist === c.id) {
        const regs = DB.registros.filter(r => r.clienteId === c.id).sort((a,b) => b.fecha.localeCompare(a.fecha));
        html += `<div style="margin-top:12px">`;
        if (!regs.length) html += `<p style="color:var(--muted);font-size:.83rem">Sin pagos registrados.</p>`;
        regs.forEach(r => {
          html += `
          <div class="sub-card" style="margin-bottom:8px">
            <div class="card-row">
              <span style="font-size:.83rem;font-weight:650">${fmtDate(r.fecha)}</span>
              <span class="mono" style="font-weight:700">${fmtUSD(r.totalUsd)}</span>
            </div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
              ${(r.planes||[]).map(p => esc(p.nombre) + ' (' + p.dias + 'd)').join(' · ')}
            </div>
            <div style="font-size:.78rem;color:var(--muted)">
              ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtNum(p.monto)).join(' · ')}
              ${Math.abs(r.saldo) > 0.009 ? ' · <span style="color:' + (r.saldo < 0 ? 'var(--red)' : 'var(--green)') + '">' + (r.saldo < 0 ? 'quedó debiendo ' + fmtUSD(Math.abs(r.saldo)) : 'a favor ' + fmtUSD(r.saldo)) + '</span>' : ''}
            </div>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  });
  document.getElementById('cli-list').innerHTML = html;
};

V._toggleCli = function(id){
  V._cliExpanded = V._cliExpanded === id ? null : id;
  V._cliHist = null;
  V._renderCliList();
};

/* ---- Formulario de cliente ---- */
const ClienteForm = {
  editId: null,
  onSaved: null,

  open(id, onSaved){
    ClienteForm.editId = id || null;
    ClienteForm.onSaved = onSaved || null;
    const c = id ? getCliente(id) : {};
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="cf-nombre" value="${esc(c.nombre||'')}" placeholder="Nombre del cliente">
      <label>Teléfono (WhatsApp) *</label>
      <input id="cf-numero" type="tel" value="${esc(c.numero||'')}" placeholder="Ej: 584121234567">
      <label>Notas</label>
      <textarea id="cf-notas" rows="2" placeholder="Observaciones (opcional)">${esc(c.notas||'')}</textarea>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="ClienteForm.remove()">${I.trash} Eliminar</button>` : ''}
        <button class="btn" onclick="ClienteForm.save()">Guardar</button>
      </div>`);
  },

  save(){
    const nombre = document.getElementById('cf-nombre').value.trim();
    const numero = document.getElementById('cf-numero').value.trim();
    const notas = document.getElementById('cf-notas').value.trim();
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!numero) return toast('El teléfono es obligatorio', true);
    let saved;
    if (ClienteForm.editId) {
      const c = getCliente(ClienteForm.editId);
      c.nombre = nombre; c.numero = numero; c.notas = notas;
      saved = c;
    } else {
      saved = { id: uid(), nombre, numero, notas, fecha: todayISO() };
      DB.clientes.push(saved);
    }
    dbSave();
    Modal.close();
    toast('Cliente guardado');
    if (ClienteForm.onSaved) ClienteForm.onSaved(saved);
    else App.refresh();
  },

  remove(){
    const id = ClienteForm.editId;
    const tiene = DB.registros.some(r => r.clienteId === id);
    if (!confirm(tiene ? 'Este cliente tiene pagos registrados. ¿Eliminar de todas formas? Se borrará también su historial.' : '¿Eliminar este cliente?')) return;
    DB.registros = DB.registros.filter(r => r.clienteId !== id);
    DB.clientes = DB.clientes.filter(c => c.id !== id);
    dbSave();
    Modal.close();
    V._cliExpanded = null;
    toast('Cliente eliminado');
    App.refresh();
  }
};

/* ---- Mensajes de WhatsApp ---- */
const WaMsg = {
  open(clienteId){
    const c = getCliente(clienteId);
    const planes = clientePlanes(clienteId);
    let opciones = '';
    planes.forEach((p, i) => {
      opciones += `<option value="${i}">${esc(p.nombre)} — vence ${fmtDate(p.vence)}</option>`;
    });
    Modal.open(`
      <div class="modal-head"><h2>WhatsApp a ${esc(c.nombre)}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      ${planes.length ? `<label>Plan</label><select id="wa-plan">${opciones}</select>` : ''}
      <label>Tipo de mensaje</label>
      <select id="wa-tipo">
        <option value="porVencer">Aviso: vence pronto</option>
        <option value="hoy">Aviso: vence hoy</option>
        <option value="renovado">Renovación exitosa</option>
        <option value="libre">Mensaje en blanco</option>
      </select>
      <div class="modal-actions">
        <button class="btn wa-btn" onclick="WaMsg.send('${clienteId}')">${I.wa} Abrir WhatsApp</button>
      </div>`);
  },
  send(clienteId){
    const c = getCliente(clienteId);
    const planes = clientePlanes(clienteId);
    const tipo = document.getElementById('wa-tipo').value;
    let texto = '';
    if (tipo !== 'libre') {
      const sel = document.getElementById('wa-plan');
      const p = planes[sel ? Number(sel.value) : 0] || { nombre: 'su plan', vence: todayISO() };
      const d = daysLeft(p.vence);
      texto = fillTemplate(DB.templates[tipo], {
        nombre: c.nombre,
        plan: p.nombre,
        fecha: fmtDate(p.vence),
        dias: Math.max(d, 0),
        cuando: d === 0 ? 'hoy' : (d === 1 ? 'mañana' : 'el ' + fmtDate(p.vence))
      });
    }
    window.open(waLink(c.numero, texto), '_blank');
    Modal.close();
  }
};

/* =================================================================
   REGISTRO DE PAGO (pestaña central)
================================================================= */
const RegForm = {
  clienteId: '',
  fecha: '',
  planes: [],   // {plataformaId, dias}
  pagos: [],    // {metodoId, monto, tasa}

  reset(){
    RegForm.clienteId = '';
    RegForm.fecha = todayISO();
    RegForm.planes = [{ plataformaId: '', dias: 30 }];
    RegForm.pagos = [{ metodoId: '', monto: '', tasa: '' }];
  }
};

V.registro = function(){
  if (!RegForm.fecha) RegForm.reset();
  const plats = DB.plataformas.filter(p => p.activo);
  const mets = DB.metodos.filter(m => m.activo);

  let html = `
  <div class="page-head">
    <div><h1>Registrar pago</h1><div class="sub">Venta a cliente</div></div>
  </div>`;

  if (!plats.length) {
    html += `<div class="card"><div class="empty" style="padding:20px">${I.tv}
      <p>Primero crea tus planes en el catálogo de plataformas.</p>
      <button class="btn sm" style="margin-top:12px" onclick="App.nav('plataformas')">Ir a Plataformas</button>
    </div></div>`;
    return App.render(html);
  }

  const clientesOpts = DB.clientes.slice().sort((a,b) => a.nombre.localeCompare(b.nombre))
    .map(c => `<option value="${c.id}" ${RegForm.clienteId===c.id?'selected':''}>${esc(c.nombre)}</option>`).join('');

  html += `
  <label>Cliente *</label>
  <div style="display:flex;gap:8px">
    <select id="rf-cliente" onchange="RegForm.clienteId=this.value">
      <option value="">Seleccionar cliente…</option>${clientesOpts}
    </select>
    <button class="icon-btn" style="width:46px;height:46px;flex-shrink:0" title="Nuevo cliente"
      onclick="ClienteForm.open(null, (c)=>{RegForm.clienteId=c.id;App.nav('registro')})">${I.plus}</button>
  </div>

  <label>Fecha de pago</label>
  <input type="date" id="rf-fecha" value="${RegForm.fecha}" onchange="RegForm.fecha=this.value;V._regCalc()">

  <div class="sect"><h2>Planes pagados</h2></div>`;

  RegForm.planes.forEach((pl, i) => {
    const plat = getPlataforma(pl.plataformaId);
    const platsOpts = plats.map(p => `<option value="${p.id}" ${pl.plataformaId===p.id?'selected':''}>${esc(p.nombre)} — ${fmtUSD(p.precioUsd)}</option>`).join('');
    html += `
    <div class="sub-card">
      ${RegForm.planes.length > 1 ? `<button class="remove" onclick="RegForm.planes.splice(${i},1);App.nav('registro')">${I.x}</button>` : ''}
      <label>Plataforma / plan</label>
      <select onchange="RegForm.planes[${i}].plataformaId=this.value;App.nav('registro')">
        <option value="">Seleccionar…</option>${platsOpts}
      </select>
      <label>Duración (días)</label>
      <input type="number" min="1" inputmode="numeric" value="${pl.dias}"
        oninput="RegForm.planes[${i}].dias=Number(this.value)||0;V._regCalc()">
      <div style="font-size:.78rem;color:var(--muted);margin-top:7px" id="rf-vence-${i}"></div>
    </div>`;
  });

  html += `
  <button class="add-row" onclick="RegForm.planes.push({plataformaId:'',dias:30});App.nav('registro')">${I.plus} Agregar plataforma</button>

  <div class="sect"><h2>Pagos recibidos</h2></div>`;

  RegForm.pagos.forEach((pg, i) => {
    const met = getMetodo(pg.metodoId);
    const metsOpts = mets.map(m => `<option value="${m.id}" ${pg.metodoId===m.id?'selected':''}>${esc(m.nombre)}</option>`).join('');
    html += `
    <div class="sub-card">
      ${RegForm.pagos.length > 1 ? `<button class="remove" onclick="RegForm.pagos.splice(${i},1);App.nav('registro')">${I.x}</button>` : ''}
      <label>Método de pago</label>
      <select onchange="RegForm.pagos[${i}].metodoId=this.value;App.nav('registro')">
        <option value="">Seleccionar…</option>${metsOpts}
      </select>
      <label>Monto${met ? ' en ' + esc(met.nombre) : ''}</label>
      <input type="number" step="any" min="0" inputmode="decimal" value="${pg.monto}"
        oninput="RegForm.pagos[${i}].monto=this.value;V._regCalc()" placeholder="0.00">
      ${met && met.requiereTasa ? `
      <label>${esc(tasaLabel(met))}</label>
      <input type="number" step="any" min="0" inputmode="decimal" value="${pg.tasa}"
        oninput="RegForm.pagos[${i}].tasa=this.value;V._regCalc()" placeholder="Ej: 45.50">
      <div style="font-size:.72rem;color:var(--muted);margin-top:4px">Cálculo: monto ${met.modoTasa === 'multiplicar' ? '×' : '÷'} tasa = USD</div>` : ''}
      <div style="font-size:.78rem;color:var(--accent);margin-top:7px;font-weight:650" id="rf-usd-${i}"></div>
    </div>`;
  });

  html += `
  <button class="add-row" onclick="RegForm.pagos.push({metodoId:'',monto:'',tasa:''});App.nav('registro')">${I.plus} Agregar pago</button>

  <div class="summary" id="rf-summary"></div>
  <div class="spacer"></div>
  <button class="btn full" style="margin-top:12px" onclick="V._regSave()">Guardar registro</button>`;

  App.render(html);
  V._regCalc();
};

/* Cálculo en vivo del formulario de registro */
V._regCalc = function(){
  let esperado = 0;
  RegForm.planes.forEach((pl, i) => {
    const plat = getPlataforma(pl.plataformaId);
    if (plat) esperado += Number(plat.precioUsd) || 0;
    const el = document.getElementById('rf-vence-' + i);
    if (el) el.textContent = (plat && pl.dias > 0)
      ? 'Vence el ' + fmtDate(addDays(RegForm.fecha, pl.dias))
      : '';
  });
  let pagado = 0;
  RegForm.pagos.forEach((pg, i) => {
    const met = getMetodo(pg.metodoId);
    const monto = Number(pg.monto) || 0;
    const usd = met ? convToUsd(monto, pg.tasa, met) : 0;
    pagado += usd;
    const el = document.getElementById('rf-usd-' + i);
    if (el) el.textContent = met && monto ? '= ' + fmtUSD(usd) + ' USD' : '';
  });
  const saldo = pagado - esperado;
  const sum = document.getElementById('rf-summary');
  if (sum) sum.innerHTML = `
    <div class="row"><span class="muted">Total esperado</span><span class="mono">${fmtUSD(esperado)}</span></div>
    <div class="row"><span class="muted">Total pagado</span><span class="mono">${fmtUSD(pagado)}</span></div>
    <div class="row total"><span>Saldo</span>
      <span class="mono" style="color:${Math.abs(saldo) < 0.009 ? 'var(--green)' : (saldo < 0 ? 'var(--red)' : 'var(--amber)')}">
        ${Math.abs(saldo) < 0.009 ? 'Pago exacto' : (saldo < 0 ? 'Debe ' + fmtUSD(Math.abs(saldo)) : 'A favor ' + fmtUSD(saldo))}
      </span></div>`;
};

V._regSave = function(){
  if (!RegForm.clienteId) return toast('Selecciona un cliente', true);
  const planes = [];
  for (const pl of RegForm.planes) {
    const plat = getPlataforma(pl.plataformaId);
    if (!plat) return toast('Selecciona la plataforma de cada plan', true);
    if (!pl.dias || pl.dias < 1) return toast('La duración debe ser al menos 1 día', true);
    planes.push({
      plataformaId: plat.id, nombre: plat.nombre,
      dias: pl.dias, vence: addDays(RegForm.fecha, pl.dias),
      precio: Number(plat.precioUsd) || 0
    });
  }
  const pagos = [];
  for (const pg of RegForm.pagos) {
    const met = getMetodo(pg.metodoId);
    if (!met) return toast('Selecciona el método de cada pago', true);
    const monto = Number(pg.monto) || 0;
    if (monto <= 0) return toast('Ingresa el monto de cada pago', true);
    let tasa = 1, usd = monto;
    if (met.requiereTasa) {
      tasa = Number(pg.tasa) || 0;
      if (tasa <= 0) return toast('Ingresa la tasa para ' + met.nombre, true);
      usd = convToUsd(monto, tasa, met);
    }
    pagos.push({ metodoId: met.id, nombre: met.nombre, monto, tasa, usd });
  }
  const totalUsd = pagos.reduce((s,p) => s + p.usd, 0);
  const esperadoUsd = planes.reduce((s,p) => s + p.precio, 0);
  DB.registros.push({
    id: uid(), clienteId: RegForm.clienteId, fecha: RegForm.fecha,
    planes, pagos,
    totalUsd: Math.round(totalUsd * 100) / 100,
    esperadoUsd: Math.round(esperadoUsd * 100) / 100,
    saldo: Math.round((totalUsd - esperadoUsd) * 100) / 100
  });
  dbSave();
  const cliId = RegForm.clienteId;
  RegForm.reset();
  toast('Pago registrado');
  V._cliExpanded = cliId;
  App.nav('clientes');
};

/* =================================================================
   ALERTAS
================================================================= */
V.alertas = function(){
  const a = calcAlertas();
  const permiso = ('Notification' in window) ? Notification.permission : 'unsupported';

  let html = `
  <div class="page-head">
    <div><h1>Alertas</h1><div class="sub">${alertCount()} pendiente${alertCount()!==1?'s':''}</div></div>
  </div>`;

  if (permiso === 'default') {
    html += `
    <div class="card">
      <div class="card-row">
        <div style="flex:1">
          <div style="font-weight:650;font-size:.9rem">Notificaciones push</div>
          <div style="font-size:.78rem;color:var(--muted)">Activa las notificaciones para recibir avisos de vencimiento en tu celular.</div>
        </div>
        <button class="btn sm" onclick="Notification.requestPermission().then(()=>App.nav('alertas'))">Activar</button>
      </div>
    </div>`;
  }

  const itemCliente = (x, tipo) => {
    const d = x.dias;
    return `
    <div class="list-item">
      <div class="avatar">${esc(initials(x.cliente.nombre))}</div>
      <div class="body">
        <div class="title">${esc(x.cliente.nombre)}</div>
        <div class="meta">${esc(x.plan.nombre)} · ${daysText(d).toLowerCase()}</div>
      </div>
      <button class="icon-btn" style="color:#1faa53" onclick="WaMsg.open('${x.cliente.id}')">${I.wa}</button>
    </div>`;
  };

  html += `<div class="sect"><h2>Clientes vencidos</h2><span class="cnt">${a.cliVencidos.length}</span></div>`;
  html += a.cliVencidos.length
    ? a.cliVencidos.map(x => itemCliente(x, 'venc')).join('')
    : `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Ninguno</p></div>`;

  html += `<div class="sect"><h2>Clientes por vencer</h2><span class="cnt">${a.cliPorVencer.length}</span></div>`;
  html += a.cliPorVencer.length
    ? a.cliPorVencer.map(x => itemCliente(x, 'prox')).join('')
    : `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Ninguno</p></div>`;

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
    : `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Ninguna</p></div>`;

  App.render(html);
};
