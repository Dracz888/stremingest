/* ============ Vistas principales: Inicio, Clientes, Registro, Alertas ============ */
"use strict";

const V = {};

/* =================================================================
   INICIO / GESTIÓN
================================================================= */
V._rankPeriodo = 'mes';
V._dashAnio = '';   // '' = todos los años
V._dashMes = '';    // '' = todos los meses, '01'..'12'

V._MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

V.dashboard = function(){
  const anio = V._dashAnio, mes = V._dashMes;
  const ing = totalIngresos(anio, mes);
  const egr = totalEgresos(anio, mes);
  const bal = balanceGeneral(anio, mes);
  const cart = cartera();
  const rank = rankingPlataformas(V._rankPeriodo);
  const maxVenta = rank.length ? Math.max(...rank.map(r => r.ventas), 1) : 1;
  const nAlertas = alertCount();

  // monedas con algún movimiento (ingreso o egreso)
  const monIds = Array.from(new Set([...Object.keys(ing), ...Object.keys(egr)]))
    .filter(k => Math.abs(ing[k]||0) > 0.009 || Math.abs(egr[k]||0) > 0.009)
    .sort((a,b) => monedaCodigo(a).localeCompare(monedaCodigo(b)));

  let html = `
  <div class="page-head">
    <div>
      <h1>Gestión</h1>
      <div class="sub">Hola, ${esc(DB.config.usuario)} · ${fmtDate(todayISO())}</div>
    </div>
  </div>

  <div class="grid2">
    <button class="kpi" style="text-align:left" onclick="App.nav('clientes')">
      <div class="lbl">Clientes</div><div class="val">${DB.clientes.length}</div>
    </button>
    <button class="kpi ${nAlertas ? 'red' : ''}" style="text-align:left" onclick="App.nav('alertas')">
      <div class="lbl">Alertas</div><div class="val">${nAlertas}</div>
    </button>
  </div>

  <div class="sect"><h2>Balance por moneda</h2></div>
  <div style="display:flex;gap:8px;margin-bottom:10px">
    <select style="margin:0" onchange="V._dashMes=this.value;App.nav('dashboard')">
      <option value="">Todos los meses</option>
      ${V._MESES.map((m,i) => { const v = String(i+1).padStart(2,'0'); return `<option value="${v}" ${mes===v?'selected':''}>${m}</option>`; }).join('')}
    </select>
    <select style="margin:0" onchange="V._dashAnio=this.value;App.nav('dashboard')">
      <option value="">Todos los años</option>
      ${aniosConMovimientos().map(y => `<option value="${y}" ${anio===y?'selected':''}>${y}</option>`).join('')}
    </select>
  </div>`;

  if (!monIds.length) {
    html += `<div class="card"><div class="empty" style="padding:18px">${I.wallet}<p>${anio || mes ? 'Sin movimientos en el período seleccionado' : 'Aún no hay movimientos registrados'}</p></div></div>`;
  } else {
    monIds.forEach(k => {
      const i = ing[k] || 0, e = egr[k] || 0, b = bal[k] || 0;
      html += `
      <div class="card" style="padding:12px 14px;margin-bottom:9px">
        <div class="card-row">
          <span style="font-weight:750;font-size:1rem">${esc(monedaCodigo(k))}</span>
          <span class="mono" style="font-weight:750;color:${b >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoneda(b, k)}</span>
        </div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
          Ingresos <span class="mono" style="color:var(--green)">${fmtMoneda(i, k)}</span>
          · Egresos <span class="mono" style="color:var(--red)">${fmtMoneda(e, k)}</span>
        </div>
      </div>`;
    });
  }

  html += `<div class="sect"><h2>Cartera por moneda</h2></div>`;

  if (!cart.length) {
    html += `<div class="card"><div class="empty" style="padding:18px">${I.wallet}<p>Aún no hay movimientos en tus métodos de pago</p></div></div>`;
  } else {
    // agrupar métodos por moneda
    const porMon = {};
    cart.forEach(m => { (porMon[m.monedaId] = porMon[m.monedaId] || []).push(m); });
    Object.keys(porMon).sort((a,b) => monedaCodigo(a).localeCompare(monedaCodigo(b))).forEach(k => {
      const metodos = porMon[k];
      const subtotal = metodos.reduce((s,m) => s + m.monto, 0);
      html += `<div class="card">`;
      metodos.forEach(m => {
        html += `
        <div class="card-row" style="padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600">${esc(m.nombre)}</span>
          <span class="mono" style="font-weight:700">${fmtMoneda(m.monto, k)}</span>
        </div>`;
      });
      html += `<div class="card-row" style="padding-top:10px"><span style="font-weight:750">Total ${esc(monedaCodigo(k))}</span><span class="mono" style="font-weight:750">${fmtMoneda(subtotal, k)}</span></div></div>`;
    });
  }

  html += `
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
          <span class="v mono">${r.ventas} venta${r.ventas!==1?'s':''} · ${fmtMoneda(r.monto, r.monedaId)}</span>
        </div>
        <div class="bar"><div style="width:${Math.round(r.ventas / maxVenta * 100)}%"></div></div>
      </div>`;
    });
  }
  html += `</div>`;
  App.render(html);
};

/* =================================================================
   CLIENTES (vista consolidada por cliente)
================================================================= */
V._cliSearch = '';
V._cliExpanded = null;
V._cliHist = null;

V.clientes = function(){
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
    const subs = clienteSuscripciones(c.id);
    const estado = clienteEstado(c.id);
    const activos = subs.filter(p => p.vence && daysLeft(p.vence) >= 0);
    const proximo = subs.find(p => p.vence);
    const expanded = V._cliExpanded === c.id;

    html += `
    <div class="card ${expanded ? '' : 'pressable'}" ${expanded ? '' : `onclick="V._toggleCli('${c.id}')"`}>
      <div class="card-row" ${expanded ? `onclick="V._toggleCli('${c.id}')"` : ''}>
        <div class="avatar">${esc(initials(c.nombre))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.nombre)}</div>
          <div style="font-size:.78rem;color:var(--muted)">
            ${subs.length} plan${subs.length!==1?'es':''}${proximo ? ' · próx. venc. ' + daysText(daysLeft(proximo.vence)).toLowerCase() : ''}
          </div>
        </div>
        <span class="chip ${estado.cls}">${estado.label}</span>
      </div>`;

    if (expanded) {
      const saldo = clienteSaldo(c.id);
      html += `<div class="expand">`;
      if (!subs.length) {
        html += `<p style="color:var(--muted);font-size:.85rem;padding:6px 0">Sin planes. Edita el cliente para asignarle las cuentas y planes que usa.</p>`;
      }
      subs.forEach(p => {
        const d = p.vence ? daysLeft(p.vence) : null;
        html += `
        <div class="plan-row">
          <div>
            <div class="pname">${esc(p.nombre)}</div>
            <div class="pmeta">${fmtMoneda(p.precio, p.monedaId)}${p.cuentaCorreo ? ' · ' + esc(p.cuentaCorreo) : ''}${p.vence ? ' · vence ' + fmtDate(p.vence) : ''}</div>
          </div>
          ${p.vence ? `<span class="days-pill ${daysPillClass(d)}">${daysText(d)}</span>` : '<span class="chip amber">Sin activar</span>'}
        </div>`;
      });
      const debe = {}; const favor = {};
      Object.keys(saldo).forEach(k => { if (saldo[k] < 0) debe[k] = -saldo[k]; else favor[k] = saldo[k]; });
      if (Object.keys(debe).length) html += `<div class="note" style="color:var(--red)">Debe ${fmtMapa(debe)}</div>`;
      if (Object.keys(favor).length) html += `<div class="note" style="color:var(--green)">Saldo a favor: ${fmtMapa(favor)}</div>`;
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
          const saldoR = limpiarMapa(r.saldo || {});
          const saldoTxt = Object.keys(saldoR).map(k => {
            const v = saldoR[k];
            return `<span style="color:${v < 0 ? 'var(--red)' : 'var(--green)'}">${v < 0 ? 'debió ' : 'a favor '}${fmtMoneda(Math.abs(v), k)}</span>`;
          }).join(' · ');
          html += `
          <div class="sub-card" style="margin-bottom:8px">
            <div class="card-row">
              <span style="font-size:.83rem;font-weight:650">${fmtDate(r.fecha)}</span>
              <span style="display:flex;align-items:center;gap:8px">
                <span class="mono" style="font-weight:700">${fmtMapa(r.pagado, {zeroText:'—'})}</span>
                <button class="icon-btn" style="width:30px;height:30px;color:var(--red)" title="Eliminar registro"
                  onclick="event.stopPropagation();V._delRegistro('${r.id}')">${I.trash}</button>
              </span>
            </div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
              ${(r.items||[]).map(p => esc(p.nombre) + ' (+' + p.dias + 'd)').join(' · ') || 'Sin planes'}
            </div>
            <div style="font-size:.78rem;color:var(--muted)">
              ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtMoneda(p.monto, p.monedaId) + (p.convMonto != null ? ' (= ' + fmtMoneda(p.convMonto, p.convMonedaId) + ')' : '')).join(' · ')}
              ${saldoTxt ? ' · ' + saldoTxt : ''}
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

/* ---- Formulario de cliente (datos + cuentas/planes que usa) ---- */
const ClienteForm = {
  editId: null,
  onSaved: null,
  nombre: '', numero: '', notas: '',
  bloques: [],   // [{cuentaId, plataformaIds:[]}]  — un bloque por cuenta que usa el cliente

  open(id, onSaved){
    ClienteForm.editId = id || null;
    ClienteForm.onSaved = onSaved || null;
    const c = id ? getCliente(id) : {};
    ClienteForm.nombre = c.nombre || '';
    ClienteForm.numero = c.numero || '';
    ClienteForm.notas = c.notas || '';
    // Reconstruir bloques desde las suscripciones actuales, agrupadas por cuenta
    const byCta = {};
    (c.suscripciones || []).forEach(s => {
      const k = s.cuentaId || '';
      (byCta[k] = byCta[k] || []).push(s.plataformaId);
    });
    ClienteForm.bloques = Object.keys(byCta).map(k => ({ cuentaId: k, plataformaIds: byCta[k] }));
    if (!ClienteForm.bloques.length) ClienteForm.bloques = [];
    ClienteForm.render();
  },

  render(){
    const id = ClienteForm.editId;
    let bloquesHtml = '';
    ClienteForm.bloques.forEach((b, i) => {
      const ctasOpts = DB.cuentas.map(ct => `<option value="${ct.id}" ${b.cuentaId===ct.id?'selected':''}>${esc(ct.correo)}</option>`).join('');
      const cta = getCuenta(b.cuentaId);
      let plansHtml = '';
      if (cta) {
        const plats = (cta.plataformaIds || []).map(pid => getPlataforma(pid)).filter(p => p && (p.activo || b.plataformaIds.includes(p.id)));
        if (!plats.length) {
          plansHtml = `<p style="font-size:.8rem;color:var(--muted);margin-top:8px">Esta cuenta no tiene planes activos. Agrégalos en Cuentas propias.</p>`;
        } else {
          plansHtml = plats.map(p => `
            <label style="display:flex;align-items:center;gap:9px;margin-top:9px;font-size:.88rem;color:var(--text);font-weight:500">
              <input type="checkbox" class="cf-plan-${i}" value="${p.id}" ${b.plataformaIds.includes(p.id)?'checked':''}
                onchange="ClienteForm.togglePlan(${i},'${p.id}',this.checked)">
              ${esc(p.nombre)} <span style="color:var(--muted)">· ${fmtMoneda(p.precio, p.monedaId)}</span>
            </label>`).join('');
        }
      } else if (b.cuentaId === '' && b.plataformaIds.length) {
        // bloque migrado sin cuenta asignada
        plansHtml = `<p style="font-size:.8rem;color:var(--amber);margin-top:8px">${b.plataformaIds.length} plan(es) sin cuenta asignada. Elige una cuenta arriba.</p>`;
      } else {
        plansHtml = `<p style="font-size:.8rem;color:var(--muted);margin-top:8px">Elige una cuenta para ver sus planes.</p>`;
      }
      bloquesHtml += `
      <div class="sub-card">
        <button class="remove" onclick="ClienteForm.bloques.splice(${i},1);ClienteForm.render()">${I.x}</button>
        <label>Cuenta que usa</label>
        <select onchange="ClienteForm.bloques[${i}].cuentaId=this.value;ClienteForm.render()">
          <option value="">Seleccionar cuenta…</option>${ctasOpts}
        </select>
        ${cta || b.plataformaIds.length ? `<label>Planes que usa de esta cuenta</label>${plansHtml}` : plansHtml}
      </div>`;
    });

    const sinCuentas = !DB.cuentas.length;

    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="cf-nombre" value="${esc(ClienteForm.nombre)}" placeholder="Nombre del cliente"
        oninput="ClienteForm.nombre=this.value">
      <label>Teléfono (WhatsApp) *</label>
      <input id="cf-numero" type="tel" value="${esc(ClienteForm.numero)}" placeholder="Ej: 584121234567"
        oninput="ClienteForm.numero=this.value">
      <label>Notas</label>
      <textarea id="cf-notas" rows="2" placeholder="Observaciones (opcional)" oninput="ClienteForm.notas=this.value">${esc(ClienteForm.notas)}</textarea>

      <div class="sect"><h2>Cuentas y planes que usa</h2></div>
      ${sinCuentas ? `<div class="note">Primero crea cuentas propias (Menú → Cuentas) para poder asignarle planes al cliente.</div>` : ''}
      ${bloquesHtml || `<p style="font-size:.83rem;color:var(--muted);margin-bottom:10px">Aún no le has asignado planes. Agrega una cuenta para empezar.</p>`}
      ${!sinCuentas ? `<button class="add-row" onclick="ClienteForm.bloques.push({cuentaId:'',plataformaIds:[]});ClienteForm.render()">${I.plus} Agregar cuenta</button>` : ''}

      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="ClienteForm.remove()">${I.trash} Eliminar</button>` : ''}
        <button class="btn" onclick="ClienteForm.save()">Guardar</button>
      </div>`);
  },

  togglePlan(i, platId, checked){
    const b = ClienteForm.bloques[i];
    if (!b) return;
    if (checked) { if (!b.plataformaIds.includes(platId)) b.plataformaIds.push(platId); }
    else b.plataformaIds = b.plataformaIds.filter(x => x !== platId);
  },

  save(){
    const nombre = (ClienteForm.nombre || '').trim();
    const numero = (ClienteForm.numero || '').trim();
    const notas = (ClienteForm.notas || '').trim();
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!numero) return toast('El teléfono es obligatorio', true);

    const c = ClienteForm.editId ? getCliente(ClienteForm.editId) : null;
    const previas = (c && c.suscripciones) || [];
    // reconstruir suscripciones preservando vence de las que ya existían
    const nuevas = [];
    ClienteForm.bloques.forEach(b => {
      const cuentaId = b.cuentaId || null;
      b.plataformaIds.forEach(platId => {
        const prev = previas.find(s => (s.cuentaId||null) === cuentaId && s.plataformaId === platId)
                  || previas.find(s => s.plataformaId === platId && !nuevas.some(n => n.plataformaId === platId && (n.cuentaId||null) === (s.cuentaId||null)));
        nuevas.push({
          id: prev ? prev.id : uid(),
          cuentaId, plataformaId: platId,
          vence: prev ? (prev.vence || null) : null,
          fecha: prev ? (prev.fecha || todayISO()) : todayISO()
        });
      });
    });

    let saved;
    if (c) {
      c.nombre = nombre; c.numero = numero; c.notas = notas; c.suscripciones = nuevas;
      saved = c;
    } else {
      saved = { id: uid(), nombre, numero, notas, fecha: todayISO(), suscripciones: nuevas };
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
    const planes = clienteSuscripciones(clienteId);
    let opciones = '';
    planes.forEach((p, i) => {
      opciones += `<option value="${i}">${esc(p.nombre)}${p.vence ? ' — vence ' + fmtDate(p.vence) : ''}</option>`;
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
        ${DB.plantillas.map(t => `<option value="c:${t.id}">${esc(t.nombre)}</option>`).join('')}
        <option value="libre">Mensaje en blanco</option>
      </select>
      <div class="modal-actions">
        <button class="btn wa-btn" onclick="WaMsg.send('${clienteId}')">${I.wa} Abrir WhatsApp</button>
      </div>`);
  },
  send(clienteId){
    const c = getCliente(clienteId);
    const planes = clienteSuscripciones(clienteId);
    const tipo = document.getElementById('wa-tipo').value;
    let texto = '';
    if (tipo !== 'libre') {
      const sel = document.getElementById('wa-plan');
      const p = planes[sel ? Number(sel.value) : 0] || { nombre: 'su plan', vence: todayISO() };
      const venceF = p.vence || todayISO();
      const d = daysLeft(venceF);
      let tpl = DB.templates[tipo];
      if (tipo.startsWith('c:')) {
        const custom = DB.plantillas.find(t => t.id === tipo.slice(2));
        tpl = custom ? custom.texto : '';
      }
      texto = fillTemplate(tpl, {
        nombre: c.nombre,
        plan: p.nombre,
        fecha: fmtDate(venceF),
        dias: Math.max(d, 0),
        cuando: d === 0 ? 'hoy' : (d === 1 ? 'mañana' : 'el ' + fmtDate(venceF))
      });
    }
    window.open(waLink(c.numero, texto), '_blank');
    Modal.close();
  }
};

/* =================================================================
   REGISTRO DE PAGO (pestaña central)
   Se paga contra los planes que el cliente YA tiene registrados:
   se elige a cuáles se les añaden días y cuánto se pagó.
================================================================= */
const RegForm = {
  clienteId: '',
  fecha: '',
  items: {},    // suscripcionId -> {sel, dias}
  pagos: [],    // {metodoId, monto, conv, convMonedaId, tasa, tasaOp}

  nuevoPago(){
    return { metodoId: '', monto: '', conv: false, convMonedaId: '', tasa: '', tasaOp: 'mult' };
  },

  reset(){
    RegForm.clienteId = '';
    RegForm.fecha = todayISO();
    RegForm.items = {};
    RegForm.pagos = [RegForm.nuevoPago()];
  },

  setCliente(id){
    RegForm.clienteId = id;
    RegForm.items = {};
    clienteSuscripciones(id).forEach(s => { RegForm.items[s.id] = { sel: true, dias: 30 }; });
    App.nav('registro');
  },

  /* Activa/desactiva la conversión por tasa de un pago, proponiendo
     como destino la moneda de los planes seleccionados */
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

/* Monto efectivo de un pago para el saldo: si tiene tasa, se convierte
   a la moneda destino (multiplicando o dividiendo según se eligió) */
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

V.registro = function(){
  if (!RegForm.fecha) RegForm.reset();
  const mets = DB.metodos.filter(m => m.activo);

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
        <div style="font-size:.78rem;color:var(--accent);margin-top:6px;font-weight:600">${nuevoVence ? 'Nuevo vencimiento: ' + fmtDate(nuevoVence) : ''}</div>` : ''}
      </div>`;
    });

    html += `<div class="sect"><h2>Pago recibido</h2></div>`;
    RegForm.pagos.forEach((pg, i) => {
      const met = getMetodo(pg.metodoId);
      const metsOpts = mets.map(m => `<option value="${m.id}" ${pg.metodoId===m.id?'selected':''}>${esc(m.nombre)} (${esc(monedaCodigo(m.monedaId))})</option>`).join('');
      let convHtml = '';
      if (met) {
        const monedasConv = DB.monedas.filter(m => (m.activo || m.id === pg.convMonedaId) && m.id !== met.monedaId);
        const monedasOpts = monedasConv.map(m => `<option value="${m.id}" ${pg.convMonedaId===m.id?'selected':''}>${esc(m.codigo)} — ${esc(m.nombre)}</option>`).join('');
        convHtml = `
        <label style="display:flex;align-items:center;gap:9px;margin-top:14px;font-size:.85rem;color:var(--text);font-weight:500">
          <input type="checkbox" ${pg.conv?'checked':''} onchange="RegForm.toggleConv(${i},this.checked)">
          El pago es en otra moneda (aplicar tasa)
        </label>`;
        if (pg.conv) {
          convHtml += `
          <label>Convertir a</label>
          <select onchange="RegForm.pagos[${i}].convMonedaId=this.value;V._regCalc()">
            <option value="">Seleccionar moneda…</option>${monedasOpts}
          </select>
          <label>Tasa de cambio</label>
          <div style="display:flex;gap:8px">
            <input type="number" step="any" min="0" inputmode="decimal" value="${pg.tasa}" placeholder="Ej: 36.5"
              oninput="RegForm.pagos[${i}].tasa=this.value;V._regCalc()">
          </div>
          <div class="seg" style="margin-top:10px">
            <button class="${pg.tasaOp!=='div'?'active':''}" onclick="RegForm.pagos[${i}].tasaOp='mult';App.nav('registro')">× Multiplicar</button>
            <button class="${pg.tasaOp==='div'?'active':''}" onclick="RegForm.pagos[${i}].tasaOp='div';App.nav('registro')">÷ Dividir</button>
          </div>
          <div id="rf-conv-${i}" style="font-size:.78rem;color:var(--accent);margin-top:6px;font-weight:600"></div>`;
        }
      }
      html += `
      <div class="sub-card">
        ${RegForm.pagos.length > 1 ? `<button class="remove" onclick="RegForm.pagos.splice(${i},1);App.nav('registro')">${I.x}</button>` : ''}
        <label>Método de pago</label>
        <select onchange="RegForm.pagos[${i}].metodoId=this.value;App.nav('registro')">
          <option value="">Seleccionar…</option>${metsOpts}
        </select>
        <label>Monto${met ? ' en ' + esc(monedaCodigo(met.monedaId)) : ''}</label>
        <input type="number" step="any" min="0" inputmode="decimal" value="${pg.monto}"
          oninput="RegForm.pagos[${i}].monto=this.value;V._regCalc()" placeholder="0.00">
        ${convHtml}
      </div>`;
    });

    html += `
    <button class="add-row" onclick="RegForm.pagos.push(RegForm.nuevoPago());App.nav('registro')">${I.plus} Agregar pago</button>
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

  // vista previa de cada conversión con tasa
  RegForm.pagos.forEach((pg, i) => {
    const el = document.getElementById('rf-conv-' + i);
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

  // items seleccionados
  const items = [];
  const updates = [];  // {suscripcionId, nuevoVence}
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

  const pagos = [];
  for (const pg of RegForm.pagos) {
    const met = getMetodo(pg.metodoId);
    if (!met) return toast('Selecciona el método de cada pago', true);
    const monto = Number(pg.monto) || 0;
    if (monto <= 0) return toast('Ingresa el monto de cada pago', true);
    const pago = { metodoId: met.id, nombre: met.nombre, monedaId: met.monedaId, monto };
    if (pg.conv) {
      if (!pg.convMonedaId) return toast('Selecciona la moneda destino de la conversión', true);
      const tasa = Number(pg.tasa) || 0;
      if (tasa <= 0) return toast('Ingresa la tasa de cambio', true);
      pago.tasa = tasa;
      pago.tasaOp = pg.tasaOp === 'div' ? 'div' : 'mult';
      pago.convMonedaId = pg.convMonedaId;
      pago.convMonto = round2(pago.tasaOp === 'div' ? monto / tasa : monto * tasa);
    }
    pagos.push(pago);
  }

  const esperado = sumarPorMoneda(items.map(i => ({ monedaId: i.monedaId, monto: i.precio })));
  // para el saldo cuenta el monto convertido (si el pago llevó tasa)
  const pagado = sumarPorMoneda(pagos.map(p => p.convMonedaId
    ? { monedaId: p.convMonedaId, monto: p.convMonto }
    : { monedaId: p.monedaId, monto: p.monto }));
  const saldo = restarMapas(pagado, esperado);

  // aplicar nuevos vencimientos a las suscripciones del cliente
  updates.forEach(u => {
    const s = (cli.suscripciones || []).find(x => x.id === u.id);
    if (s) s.vence = u.vence;
  });

  DB.registros.push({
    id: uid(), clienteId: RegForm.clienteId, fecha: RegForm.fecha,
    items, pagos, esperado, pagado, saldo
  });
  dbSave();
  const cliId = RegForm.clienteId;
  RegForm.reset();
  toast('Pago registrado');
  V._cliExpanded = cliId;
  App.nav('clientes');
};

/* ---- Eliminar registros de pagos y recargas ---- */
V._delRegistro = function(id){
  const r = DB.registros.find(x => x.id === id);
  if (!r) return;
  if (!confirm('¿Eliminar este registro de pago? Se ajustarán los ingresos y la cartera. Los vencimientos de los planes no se modifican.')) return;
  DB.registros = DB.registros.filter(x => x.id !== id);
  dbSave();
  toast('Registro eliminado');
  App.refresh();
};

V._delRecarga = function(id){
  const r = DB.recargas.find(x => x.id === id);
  if (!r) return;
  if (!confirm('¿Eliminar esta recarga? Se ajustarán los egresos y la cartera.')) return;
  DB.recargas = DB.recargas.filter(x => x.id !== id);
  dbSave();
  toast('Recarga eliminada');
  App.refresh();
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

  // texto de cuánto falta para el vencimiento
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
      <button class="icon-btn" style="color:#1faa53" onclick="WaMsg.open('${x.cliente.id}')">${I.wa}</button>
    </div>`;

  html += `<div class="sect"><h2>Clientes vencidos</h2><span class="cnt">${a.cliVencidos.length}</span></div>`;
  html += a.cliVencidos.length
    ? a.cliVencidos.map(itemCliente).join('')
    : `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Ninguno</p></div>`;

  html += `<div class="sect"><h2>Clientes por vencer</h2><span class="cnt">${a.cliPorVencer.length}</span></div>`;
  html += a.cliPorVencer.length
    ? a.cliPorVencer.map(itemCliente).join('')
    : `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Ninguno</p></div>`;

  html += `<div class="sect"><h2>Próximos vencimientos (7 días)</h2><span class="cnt">${a.cliProximos.length}</span></div>`;
  html += a.cliProximos.length
    ? a.cliProximos.map(itemCliente).join('')
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
