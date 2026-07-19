/* ============ Clientes: lista con filtros, ficha, formulario y WhatsApp ============ */
"use strict";

V._cliSearch = '';
V._cliFiltro = 'todos';   // todos | vencido | porvencer | debe | aldia | sinplanes
V._cliOrden = 'nombre';   // nombre | vence | reciente
V._cliExpanded = null;
V._cliHist = null;

/* Predicados de filtro (independientes entre sí) */
V._cliPasaFiltro = function(c, filtro){
  const subs = clienteSuscripciones(c.id);
  const aviso = Number(DB.config.avisoCliente) || 7;
  switch (filtro) {
    case 'vencido':   return subs.some(s => s.vence && daysLeft(s.vence) < 0);
    case 'porvencer': return subs.some(s => s.vence && daysLeft(s.vence) >= 0 && daysLeft(s.vence) <= aviso);
    case 'debe': {
      const saldo = clienteSaldo(c.id);
      return Object.keys(saldo).some(k => saldo[k] < -0.009);
    }
    case 'aldia':     return clienteEstado(c.id).key === 'aldia';
    case 'sinplanes': return !subs.length;
    default:          return true;
  }
};

V.clientes = function(){
  const filtros = [
    { k: 'todos',     l: 'Todos' },
    { k: 'vencido',   l: 'Vencidos' },
    { k: 'porvencer', l: 'Por vencer' },
    { k: 'debe',      l: 'Con deuda' },
    { k: 'aldia',     l: 'Al día' },
    { k: 'sinplanes', l: 'Sin planes' }
  ];
  const counts = {};
  filtros.forEach(f => { counts[f.k] = DB.clientes.filter(c => V._cliPasaFiltro(c, f.k)).length; });

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
  <div class="filter-row">
    ${filtros.map(f => `
      <button class="filter-chip ${V._cliFiltro===f.k?'active':''}" onclick="V._cliFiltro='${f.k}';App.nav('clientes')">
        ${f.l}${f.k !== 'todos' && counts[f.k] ? ` <span class="cnt">${counts[f.k]}</span>` : ''}
      </button>`).join('')}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
    <select style="width:auto;padding:6px 32px 6px 10px;font-size:.8rem;border-radius:9px" onchange="V._cliOrden=this.value;V._renderCliList()">
      <option value="nombre" ${V._cliOrden==='nombre'?'selected':''}>Orden: nombre</option>
      <option value="vence" ${V._cliOrden==='vence'?'selected':''}>Orden: vencimiento</option>
      <option value="reciente" ${V._cliOrden==='reciente'?'selected':''}>Orden: recientes</option>
    </select>
  </div>
  <div id="cli-list"></div>`;
  App.render(html);
  V._renderCliList();
};

V._renderCliList = function(){
  const q = V._cliSearch.toLowerCase();
  let lista = DB.clientes
    .filter(c => !q || c.nombre.toLowerCase().includes(q) || String(c.numero).includes(q))
    .filter(c => V._cliPasaFiltro(c, V._cliFiltro));

  if (V._cliOrden === 'vence') {
    const proxVence = (c) => {
      const conVence = clienteSuscripciones(c.id).filter(s => s.vence);
      return conVence.length ? conVence[0].vence : '9999';
    };
    lista = lista.slice().sort((a,b) => proxVence(a).localeCompare(proxVence(b)));
  } else if (V._cliOrden === 'reciente') {
    lista = lista.slice().sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||'')));
  } else {
    lista = lista.slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  }

  let html = '';
  if (!lista.length) {
    html = `<div class="empty">${I.users}<p>${DB.clientes.length ? 'Sin resultados con esta búsqueda o filtro.' : 'Aún no tienes clientes. Toca "Nuevo" para agregar el primero.'}</p></div>`;
  }
  lista.forEach(c => {
    const subs = clienteSuscripciones(c.id);
    const estado = clienteEstado(c.id);
    const proximo = subs.find(p => p.vence);
    const expanded = V._cliExpanded === c.id;

    html += `
    <div class="card ${expanded ? '' : 'pressable'}" ${expanded ? '' : `onclick="V._toggleCli('${c.id}')"`}>
      <div class="card-row" ${expanded ? `onclick="V._toggleCli('${c.id}')"` : ''}>
        <div class="avatar">${esc(initials(c.nombre))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.nombre)}</div>
          <div style="font-size:.78rem;color:var(--muted)">
            ${subs.length} plan${subs.length!==1?'es':''}${proximo ? ' · próx. venc. ' + daysText(daysLeft(proximo.vence)).toLowerCase() : ''}
          </div>
        </div>
        <span class="chip ${estado.cls}">${estado.label}</span>
      </div>`;

    if (expanded) {
      const saldo = clienteSaldo(c.id);
      html += `<div class="expand">`;
      html += `<div style="font-size:.8rem;color:var(--muted);margin-bottom:6px">📱 ${esc(c.numero)}${c.notas ? ' · 📝 ' + esc(c.notas) : ''}</div>`;
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
        <button class="btn sm" onclick="event.stopPropagation();RegForm.setCliente('${c.id}')">${I.refresh} Renovar</button>
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
              <span style="font-size:.83rem;font-weight:700">${fmtDate(r.fecha)}</span>
              <span style="display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-weight:700">${fmtMapa(r.pagado, {zeroText:'—'})}</span>
                <button class="icon-btn xs" title="Editar pago" onclick="event.stopPropagation();RegEdit.open('${r.id}')">${I.edit}</button>
                <button class="icon-btn xs" style="color:var(--red)" title="Eliminar registro"
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
            ${r.nota ? `<div style="font-size:.78rem;color:var(--muted);margin-top:2px">📝 ${esc(r.nota)}</div>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  });
  const el = document.getElementById('cli-list');
  if (el) el.innerHTML = html;
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
  bloques: [],   // [{cuentaId, plataformaIds:[]}] — un bloque por cuenta que usa

  open(id, onSaved){
    ClienteForm.editId = id || null;
    ClienteForm.onSaved = onSaved || null;
    const c = id ? getCliente(id) : {};
    ClienteForm.nombre = c.nombre || '';
    ClienteForm.numero = c.numero || '';
    ClienteForm.notas = c.notas || '';
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
    // reconstruir suscripciones preservando el vencimiento de las existentes
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

  async remove(){
    const id = ClienteForm.editId;
    const tiene = DB.registros.some(r => r.clienteId === id);
    const ok = await confirmar(tiene
      ? 'Este cliente tiene pagos registrados. Se borrará también su historial. ¿Eliminar de todas formas?'
      : '¿Eliminar este cliente?', { danger: true, ok: 'Eliminar' });
    if (!ok) return;
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
        <button class="btn ghost" style="flex:0 0 auto" title="Copiar mensaje" onclick="WaMsg.copy('${clienteId}')">${I.copy}</button>
        <button class="btn wa-btn" onclick="WaMsg.send('${clienteId}')">${I.wa} Abrir WhatsApp</button>
      </div>`);
  },

  buildText(clienteId){
    const c = getCliente(clienteId);
    const planes = clienteSuscripciones(clienteId);
    const tipo = document.getElementById('wa-tipo').value;
    if (tipo === 'libre') return '';
    const sel = document.getElementById('wa-plan');
    const p = planes[sel ? Number(sel.value) : 0] || { nombre: 'su plan', vence: todayISO() };
    const venceF = p.vence || todayISO();
    const d = daysLeft(venceF);
    let tpl = DB.templates[tipo];
    if (tipo.startsWith('c:')) {
      const custom = DB.plantillas.find(t => t.id === tipo.slice(2));
      tpl = custom ? custom.texto : '';
    }
    return fillTemplate(tpl, {
      nombre: c.nombre,
      plan: p.nombre,
      fecha: fmtDate(venceF),
      dias: Math.max(d, 0),
      cuando: d === 0 ? 'hoy' : (d === 1 ? 'mañana' : 'el ' + fmtDate(venceF))
    });
  },

  send(clienteId){
    const c = getCliente(clienteId);
    const texto = WaMsg.buildText(clienteId);
    window.open(waLink(c.numero, texto), '_blank');
    Modal.close();
  },

  copy(clienteId){
    const texto = WaMsg.buildText(clienteId);
    if (!texto) return toast('El mensaje en blanco no tiene texto', true);
    V._copy(texto, 'Mensaje copiado');
  }
};
