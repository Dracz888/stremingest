/* ============ Menú, catálogos, cuentas, recargas, respaldo y ajustes ============ */
"use strict";

/* =================================================================
   MENÚ (organizado por secciones)
================================================================= */
V.menu = function(){
  const html = `
  <div class="page-head">
    <div><h1>Menú</h1><div class="sub">Hola, ${esc(DB.config.usuario)}</div></div>
  </div>

  <div class="menu-sect">Catálogo</div>
  <button class="menu-item" onclick="App.nav('plataformas')">${I.tv} Plataformas y planes <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('monedas')">${I.wallet} Monedas <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('metodos')">${I.card} Métodos de pago <span class="chev">${I.chev}</span></button>

  <div class="menu-sect">Operación</div>
  <button class="menu-item" onclick="App.nav('cuentas')">${I.key} Cuentas propias <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('recargas')">${I.refresh} Recargas (egresos) <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('movimientos')">${I.chart} Ingresos y egresos <span class="chev">${I.chev}</span></button>

  <div class="menu-sect">Comunicación</div>
  <button class="menu-item" onclick="App.nav('plantillas')">${I.msg} Plantillas de WhatsApp <span class="chev">${I.chev}</span></button>

  <div class="menu-sect">Sistema</div>
  <button class="menu-item" onclick="App.nav('sync')">${I.cloud} Compartir / Sincronizar ${V._syncBadge()}<span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('respaldo')">${I.download} Respaldo de datos <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('ajustes')">${I.gear} Ajustes <span class="chev">${I.chev}</span></button>`;
  App.render(html);
};

/* =================================================================
   AJUSTES
================================================================= */
V.ajustes = function(){
  const tema = Theme.get();
  const permiso = ('Notification' in window) ? Notification.permission : 'unsupported';
  const html = `
  ${headHTML({ title: 'Ajustes', sub: 'Personaliza la app', back: 'menu' })}

  <div class="sect"><h2>Perfil</h2></div>
  <label>Tu nombre</label>
  <div style="display:flex;gap:8px">
    <input id="aj-nombre" autocapitalize="words" value="${esc(DB.config.usuario)}">
    <button class="btn" style="flex-shrink:0" onclick="V._ajGuardarNombre()">Guardar</button>
  </div>

  <div class="sect"><h2>Apariencia</h2></div>
  <div class="theme-seg">
    <button class="${tema==='light'?'active':''}" onclick="Theme.set('light');App.refresh()">${I.sun} Claro</button>
    <button class="${tema==='auto'?'active':''}" onclick="Theme.set('auto');App.refresh()">${I.auto} Automático</button>
    <button class="${tema==='dark'?'active':''}" onclick="Theme.set('dark');App.refresh()">${I.moon} Oscuro</button>
  </div>

  <div class="sect"><h2>Avisos de vencimiento</h2></div>
  <label>Avisar de clientes con cuántos días de anticipación</label>
  <input id="aj-aviso-cli" type="number" min="1" max="30" inputmode="numeric" value="${Number(DB.config.avisoCliente)||7}">
  <label>Avisar de recargas con cuántos días de anticipación</label>
  <input id="aj-aviso-rec" type="number" min="1" max="30" inputmode="numeric" value="${Number(DB.config.avisoRecarga)||5}">
  <button class="btn full" style="margin-top:14px" onclick="V._ajGuardarAvisos()">Guardar avisos</button>

  <div class="sect"><h2>Notificaciones</h2></div>
  ${permiso === 'granted'
    ? `<div class="note" style="color:var(--green)">✓ Notificaciones activadas en este dispositivo.</div>`
    : permiso === 'denied'
    ? `<div class="note warn">Las notificaciones están bloqueadas. Actívalas desde la configuración del navegador.</div>`
    : permiso === 'unsupported'
    ? `<div class="note">Este navegador no soporta notificaciones.</div>`
    : `<button class="menu-item" onclick="Notification.requestPermission().then(()=>App.refresh())">${I.bell} Activar notificaciones <span class="chev">${I.chev}</span></button>`}

  <div class="sect"><h2>Acerca de</h2></div>
  <div class="card" style="font-size:.83rem;color:var(--muted)">
    <b style="color:var(--text)">StreamGest 2.0</b><br>
    Gestión de reventa de cuentas de streaming: clientes, planes multimoneda, pagos, recargas y alertas.
    Tus datos se guardan en este dispositivo; usa Respaldo o Compartir para no perderlos.
  </div>`;
  App.render(html);
};

V._ajGuardarNombre = function(){
  const nombre = document.getElementById('aj-nombre').value.trim();
  if (!nombre) return toast('Escribe tu nombre', true);
  DB.config.usuario = nombre;
  dbSave(); toast('Nombre actualizado');
};

V._ajGuardarAvisos = function(){
  const cli = Number(document.getElementById('aj-aviso-cli').value);
  const rec = Number(document.getElementById('aj-aviso-rec').value);
  if (!(cli >= 1) || !(rec >= 1)) return toast('Los días deben ser al menos 1', true);
  DB.config.avisoCliente = Math.min(cli, 30);
  DB.config.avisoRecarga = Math.min(rec, 30);
  dbSave(); toast('Avisos guardados');
  App.renderTabbar();
};

/* =================================================================
   MONEDAS
================================================================= */
V.monedas = function(){
  let html = `
  ${headHTML({ title: 'Monedas', sub: 'Monedas en las que cobras', back: 'menu',
    actions: `<button class="btn sm" onclick="MonedaForm.open()">${I.plus} Nueva</button>` })}
  <div class="note">Cada plan se cobra en una moneda, y cada método de pago pertenece a una moneda. Los montos se registran y se muestran en su moneda, sin convertir a otra.</div>`;
  if (!DB.monedas.length) html += `<div class="empty">${I.wallet}<p>Crea las monedas que usas, por ejemplo USD, COP o Bs.</p></div>`;
  DB.monedas.forEach(m => {
    const nPlanes = DB.plataformas.filter(p => p.monedaId === m.id).length;
    const nMetodos = DB.metodos.filter(x => x.monedaId === m.id).length;
    html += `
    <button class="list-item" onclick="MonedaForm.open('${m.id}')">
      <div class="body">
        <div class="title">${esc(m.codigo)} · <span style="color:var(--muted);font-weight:500">${esc(m.nombre)}</span></div>
        <div class="meta">${nPlanes} plan${nPlanes!==1?'es':''} · ${nMetodos} método${nMetodos!==1?'s':''}</div>
      </div>
      ${m.activo ? '<span class="chip green">Activa</span>' : '<span class="chip gray">Inactiva</span>'}
    </button>`;
  });
  App.render(html);
};

const MonedaForm = {
  editId: null,
  open(id){
    MonedaForm.editId = id || null;
    const m = id ? getMoneda(id) : { activo: true };
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar moneda' : 'Nueva moneda'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Código *</label>
      <input id="mo-codigo" value="${esc(m.codigo||'')}" placeholder="Ej: USD, COP, Bs" maxlength="6">
      <label>Nombre</label>
      <input id="mo-nombre" value="${esc(m.nombre||'')}" placeholder="Ej: Pesos colombianos">
      <label style="display:flex;align-items:center;gap:9px;margin-top:16px">
        <input type="checkbox" id="mo-activo" ${m.activo ? 'checked' : ''}> Moneda activa
      </label>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="MonedaForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="MonedaForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const codigo = document.getElementById('mo-codigo').value.trim();
    const nombre = document.getElementById('mo-nombre').value.trim();
    const activo = document.getElementById('mo-activo').checked;
    if (!codigo) return toast('El código es obligatorio', true);
    if (MonedaForm.editId) {
      const m = getMoneda(MonedaForm.editId);
      m.codigo = codigo; m.nombre = nombre || codigo; m.activo = activo;
    } else {
      DB.monedas.push({ id: uid(), codigo, nombre: nombre || codigo, activo });
    }
    dbSave(); Modal.close(); toast('Moneda guardada'); App.refresh();
  },
  async remove(){
    const id = MonedaForm.editId;
    const usada = DB.plataformas.some(p => p.monedaId === id) || DB.metodos.some(m => m.monedaId === id);
    if (usada) {
      if (!(await confirmar('Esta moneda la usan planes o métodos. Se recomienda desactivarla en vez de borrarla. ¿Desactivar ahora?', { ok: 'Desactivar' }))) return;
      getMoneda(id).activo = false;
      dbSave(); Modal.close(); toast('Moneda desactivada'); return App.refresh();
    }
    if (!(await confirmar('¿Eliminar esta moneda?', { danger: true, ok: 'Eliminar' }))) return;
    DB.monedas = DB.monedas.filter(m => m.id !== id);
    dbSave(); Modal.close(); toast('Moneda eliminada'); App.refresh();
  }
};

/* =================================================================
   PLATAFORMAS / PLANES
================================================================= */
V.plataformas = function(){
  const lista = DB.plataformas.slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  let html = headHTML({ title: 'Plataformas', sub: 'Catálogo de planes que vendes', back: 'menu',
    actions: `<button class="btn sm" onclick="PlatForm.open()">${I.plus} Nuevo</button>` });
  if (!DB.monedas.filter(m => m.activo).length) {
    html += `<div class="card"><div class="empty" style="padding:20px">${I.wallet}
      <p>Primero crea al menos una moneda (USD, COP…) para poder ponerle precio a tus planes.</p>
      <button class="btn sm" style="margin-top:12px" onclick="App.nav('monedas')">Ir a Monedas</button>
    </div></div>`;
    return App.render(html);
  }
  if (!lista.length) html += `<div class="empty">${I.tv}<p>Crea tu primer plan, por ejemplo "Netflix 1 Pantalla".</p></div>`;
  lista.forEach(p => {
    const ventas = DB.clientes.filter(c => (c.suscripciones||[]).some(s => s.plataformaId === p.id)).length;
    html += `
    <button class="list-item" onclick="PlatForm.open('${p.id}')">
      <div class="body">
        <div class="title">${esc(p.nombre)}</div>
        <div class="meta mono">${fmtMoneda(p.precio, p.monedaId)}${ventas ? ` · ${ventas} cliente${ventas!==1?'s':''}` : ''}</div>
      </div>
      ${p.activo ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>'}
    </button>`;
  });
  App.render(html);
};

const PlatForm = {
  editId: null,
  open(id){
    PlatForm.editId = id || null;
    const p = id ? getPlataforma(id) : { activo: true };
    const monedas = DB.monedas.filter(m => m.activo || m.id === p.monedaId);
    const monedasOpts = monedas.map(m => `<option value="${m.id}" ${p.monedaId===m.id?'selected':''}>${esc(m.codigo)} — ${esc(m.nombre)}</option>`).join('');
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar plan' : 'Nuevo plan'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="pf-nombre" value="${esc(p.nombre||'')}" placeholder='Ej: "Netflix 2 Pantallas"'>
      <label>Moneda de cobro *</label>
      <select id="pf-moneda">${monedasOpts}</select>
      <label>Precio de venta *</label>
      <input id="pf-precio" type="number" step="any" min="0" inputmode="decimal" value="${p.precio != null ? p.precio : ''}" placeholder="0.00">
      <label style="display:flex;align-items:center;gap:9px;margin-top:16px">
        <input type="checkbox" id="pf-activo" ${p.activo ? 'checked' : ''}> Plan activo (visible al registrar pagos)
      </label>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="PlatForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="PlatForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const nombre = document.getElementById('pf-nombre').value.trim();
    const monedaId = document.getElementById('pf-moneda').value;
    const precio = Number(document.getElementById('pf-precio').value);
    const activo = document.getElementById('pf-activo').checked;
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!monedaId) return toast('Selecciona la moneda de cobro', true);
    if (!(precio >= 0)) return toast('Ingresa el precio', true);
    if (PlatForm.editId) {
      const p = getPlataforma(PlatForm.editId);
      p.nombre = nombre; p.monedaId = monedaId; p.precio = precio; p.activo = activo;
    } else {
      DB.plataformas.push({ id: uid(), nombre, monedaId, precio, activo });
    }
    dbSave(); Modal.close(); toast('Plan guardado'); App.refresh();
  },
  async remove(){
    const id = PlatForm.editId;
    const usado = DB.registros.some(r => (r.items||[]).some(p => p.plataformaId === id))
               || DB.clientes.some(c => (c.suscripciones||[]).some(s => s.plataformaId === id));
    if (usado) {
      if (!(await confirmar('Este plan ya está en uso (pagos o clientes). Se recomienda desactivarlo en vez de borrarlo. ¿Desactivar ahora?', { ok: 'Desactivar' }))) return;
      getPlataforma(id).activo = false;
      dbSave(); Modal.close(); toast('Plan desactivado'); return App.refresh();
    }
    if (!(await confirmar('¿Eliminar este plan?', { danger: true, ok: 'Eliminar' }))) return;
    DB.plataformas = DB.plataformas.filter(p => p.id !== id);
    dbSave(); Modal.close(); toast('Plan eliminado'); App.refresh();
  }
};

/* =================================================================
   MÉTODOS DE PAGO
================================================================= */
V.metodos = function(){
  let html = `
  ${headHTML({ title: 'Métodos de pago', sub: 'Formas de cobro y su moneda', back: 'menu',
    actions: `<button class="btn sm" onclick="MetForm.open()">${I.plus} Nuevo</button>` })}
  <div class="note">Cada método pertenece a una moneda (ej: Bancolombia y Nequi son COP). En la cartera se agrupan por moneda.</div>`;
  DB.metodos.forEach(m => {
    html += `
    <button class="list-item" onclick="MetForm.open('${m.id}')">
      <div class="body">
        <div class="title">${esc(m.nombre)}</div>
        <div class="meta">Moneda: ${esc(monedaCodigo(m.monedaId))}</div>
      </div>
      ${m.activo ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>'}
    </button>`;
  });
  App.render(html);
};

const MetForm = {
  editId: null,
  open(id){
    MetForm.editId = id || null;
    const m = id ? getMetodo(id) : { activo: true };
    const monedas = DB.monedas.filter(x => x.activo || x.id === m.monedaId);
    const monedasOpts = monedas.map(x => `<option value="${x.id}" ${m.monedaId===x.id?'selected':''}>${esc(x.codigo)} — ${esc(x.nombre)}</option>`).join('');
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar método' : 'Nuevo método'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="mf-nombre" value="${esc(m.nombre||'')}" placeholder='Ej: "Bancolombia"'>
      <label>Moneda *</label>
      <select id="mf-moneda">
        <option value="">Seleccionar…</option>${monedasOpts}
      </select>
      <label style="display:flex;align-items:center;gap:9px;margin-top:16px">
        <input type="checkbox" id="mf-activo" ${m.activo ? 'checked' : ''}> Método activo
      </label>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="MetForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="MetForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const nombre = document.getElementById('mf-nombre').value.trim();
    const monedaId = document.getElementById('mf-moneda').value;
    const activo = document.getElementById('mf-activo').checked;
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!monedaId) return toast('Selecciona la moneda del método', true);
    if (MetForm.editId) {
      const m = getMetodo(MetForm.editId);
      m.nombre = nombre; m.monedaId = monedaId; m.activo = activo;
    } else {
      DB.metodos.push({ id: uid(), nombre, monedaId, activo });
    }
    dbSave(); Modal.close(); toast('Método guardado'); App.refresh();
  },
  async remove(){
    const id = MetForm.editId;
    const usado = DB.registros.some(r => (r.pagos||[]).some(p => p.metodoId === id))
               || DB.recargas.some(r => (r.pagos||[]).some(p => p.metodoId === id));
    if (usado) {
      if (!(await confirmar('Este método ya fue usado en pagos. Para no romper el histórico se desactivará en vez de borrarse. ¿Desactivar?', { ok: 'Desactivar' }))) return;
      getMetodo(id).activo = false;
      dbSave(); Modal.close(); toast('Método desactivado'); return App.refresh();
    }
    if (!(await confirmar('¿Eliminar este método?', { danger: true, ok: 'Eliminar' }))) return;
    DB.metodos = DB.metodos.filter(m => m.id !== id);
    dbSave(); Modal.close(); toast('Método eliminado'); App.refresh();
  }
};

/* =================================================================
   CUENTAS PROPIAS
================================================================= */
V.cuentas = function(){
  let html = headHTML({ title: 'Cuentas propias', sub: 'Tus cuentas reales de streaming', back: 'menu',
    actions: `<button class="btn sm" onclick="CtaForm.open()">${I.plus} Nueva</button>` });
  if (!DB.cuentas.length) html += `<div class="empty">${I.key}<p>Registra las cuentas de streaming que usas para dar servicio.</p></div>`;
  DB.cuentas.forEach(c => {
    const plats = (c.plataformaIds||[]).map(id => getPlataforma(id)).filter(Boolean);
    const recs = DB.recargas.filter(r => r.cuentaId === c.id);
    const ultima = recs.length ? recs.reduce((a,b) => a.vence > b.vence ? a : b) : null;
    const d = ultima ? daysLeft(ultima.vence) : null;
    const nCli = cuentaClientes(c.id);
    const estadoChip = c.estado === 'activa' ? '<span class="chip green">Activa</span>'
      : c.estado === 'vencida' ? '<span class="chip red">Vencida</span>'
      : '<span class="chip amber">Suspendida</span>';
    html += `
    <div class="card pressable" onclick="CtaForm.open('${c.id}')">
      <div class="card-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.correo)}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${plats.length ? plats.map(p => esc(p.nombre)).join(' · ') : 'Sin plataformas asociadas'}${nCli ? ' · ' + nCli + ' cliente' + (nCli!==1?'s':'') : ''}
          </div>
          ${ultima ? `<div style="font-size:.78rem;margin-top:4px;color:${d < 0 ? 'var(--red)' : d <= 5 ? 'var(--amber)' : 'var(--muted)'}">Recarga: ${daysText(d).toLowerCase()} (${fmtDate(ultima.vence)})</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">
          ${estadoChip}
          <button class="btn sm ghost" onclick="event.stopPropagation();RecForm.open('${c.id}')">Recargar</button>
        </div>
      </div>
    </div>`;
  });
  App.render(html);
};

const CtaForm = {
  editId: null,
  open(id){
    CtaForm.editId = id || null;
    const c = id ? getCuenta(id) : { estado: 'activa', plataformaIds: [] };
    const plats = DB.plataformas.filter(p => p.activo || (c.plataformaIds||[]).includes(p.id));
    const checks = plats.map(p => `
      <label style="display:flex;align-items:center;gap:9px;margin-top:9px;font-size:.88rem;color:var(--text);font-weight:500">
        <input type="checkbox" class="ctf-plat" value="${p.id}" ${(c.plataformaIds||[]).includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)} <span style="color:var(--muted)">· ${fmtMoneda(p.precio, p.monedaId)}</span>
      </label>`).join('');
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Correo (login) *</label>
      <input id="ctf-correo" type="email" value="${esc(c.correo||'')}" placeholder="cuenta@ejemplo.com">
      <label>Contraseña</label>
      <div style="display:flex;gap:8px">
        <input id="ctf-clave" type="password" value="${esc(c.clave||'')}" placeholder="Contraseña de la cuenta">
        <button class="icon-btn" style="width:46px;height:46px;flex-shrink:0" onclick="const i=document.getElementById('ctf-clave');i.type=i.type==='password'?'text':'password'">${I.eye}</button>
      </div>
      <label>Estado</label>
      <select id="ctf-estado">
        <option value="activa" ${c.estado==='activa'?'selected':''}>Activa</option>
        <option value="vencida" ${c.estado==='vencida'?'selected':''}>Vencida</option>
        <option value="suspendida" ${c.estado==='suspendida'?'selected':''}>Suspendida</option>
      </select>
      <label>Planes que ofrece esta cuenta</label>
      ${checks || '<p style="font-size:.83rem;color:var(--muted)">Primero crea planes en el catálogo de plataformas.</p>'}
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="CtaForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="CtaForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const correo = document.getElementById('ctf-correo').value.trim();
    if (!correo) return toast('El correo es obligatorio', true);
    const clave = document.getElementById('ctf-clave').value;
    const estado = document.getElementById('ctf-estado').value;
    const plataformaIds = Array.from(document.querySelectorAll('.ctf-plat:checked')).map(x => x.value);
    if (CtaForm.editId) {
      const c = getCuenta(CtaForm.editId);
      c.correo = correo; c.clave = clave; c.estado = estado; c.plataformaIds = plataformaIds;
    } else {
      DB.cuentas.push({ id: uid(), correo, clave, estado, plataformaIds, fecha: todayISO() });
    }
    dbSave(); Modal.close(); toast('Cuenta guardada'); App.refresh();
  },
  async remove(){
    const id = CtaForm.editId;
    const usada = DB.clientes.some(c => (c.suscripciones||[]).some(s => s.cuentaId === id));
    const msg = usada
      ? 'Hay clientes que usan esta cuenta. Si la eliminas, sus planes quedarán sin cuenta asociada y se borrará su historial de recargas. ¿Continuar?'
      : '¿Eliminar esta cuenta? También se borrará su historial de recargas.';
    if (!(await confirmar(msg, { danger: true, ok: 'Eliminar' }))) return;
    DB.recargas = DB.recargas.filter(r => r.cuentaId !== id);
    DB.cuentas = DB.cuentas.filter(c => c.id !== id);
    DB.clientes.forEach(c => (c.suscripciones||[]).forEach(s => { if (s.cuentaId === id) s.cuentaId = null; }));
    dbSave(); Modal.close(); toast('Cuenta eliminada'); App.refresh();
  }
};

/* =================================================================
   MOVIMIENTOS: ingresos (pagos) y egresos (recargas)
================================================================= */
V._movTipo = 'todos';
V._movAnio = '';
V._movMes = '';

V.movimientos = function(){
  const tipo = V._movTipo, anio = V._movAnio, mes = V._movMes;

  const ingresos = DB.registros.filter(r => enPeriodo(r.fecha, anio, mes));
  const egresos = DB.recargas.filter(r => enPeriodo(r.fecha, anio, mes));

  const movs = [];
  if (tipo !== 'egresos') ingresos.forEach(r => movs.push({ tipo: 'ing', fecha: r.fecha, r }));
  if (tipo !== 'ingresos') egresos.forEach(r => movs.push({ tipo: 'egr', fecha: r.fecha, r }));
  movs.sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)));

  const totIng = acumularMapas(ingresos.map(r => r.pagado || {}));
  const totEgr = acumularMapas(egresos.map(r => r.total || {}));
  const balance = limpiarMapa(restarMapas(totIng, totEgr));

  let html = `
  ${headHTML({ title: 'Ingresos y egresos', sub: 'Registro completo de pagos y recargas', back: 'menu',
    actions: `<button class="icon-btn" title="Exportar CSV" onclick="V._movCSV()">${I.file}</button>` })}

  <div class="seg">
    <button class="${tipo==='todos'?'active':''}" onclick="V._movTipo='todos';App.nav('movimientos')">Todos</button>
    <button class="${tipo==='ingresos'?'active':''}" onclick="V._movTipo='ingresos';App.nav('movimientos')">Ingresos</button>
    <button class="${tipo==='egresos'?'active':''}" onclick="V._movTipo='egresos';App.nav('movimientos')">Egresos</button>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <select style="margin:0" onchange="V._movMes=this.value;App.nav('movimientos')">
      <option value="">Todos los meses</option>
      ${V._MESES.map((m,i) => { const v = String(i+1).padStart(2,'0'); return `<option value="${v}" ${mes===v?'selected':''}>${m}</option>`; }).join('')}
    </select>
    <select style="margin:0" onchange="V._movAnio=this.value;App.nav('movimientos')">
      <option value="">Todos los años</option>
      ${aniosConMovimientos().map(y => `<option value="${y}" ${anio===y?'selected':''}>${y}</option>`).join('')}
    </select>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Ingresos</span><span class="mono" style="color:var(--green);font-weight:700">${fmtMapa(totIng, {zeroText:'—'})}</span></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Egresos</span><span class="mono" style="color:var(--red);font-weight:700">${fmtMapa(totEgr, {zeroText:'—'})}</span></div>
    <div class="card-row" style="padding:6px 0;border-top:1px solid var(--border)"><span style="font-weight:800">Balance</span><span class="mono" style="font-weight:800">${fmtMapa(balance, {zeroText:'—'})}</span></div>
  </div>`;

  if (!movs.length) {
    html += `<div class="empty">${I.chart}<p>Sin movimientos${anio || mes ? ' en el período seleccionado' : ''}.</p></div>`;
  }
  movs.forEach(m => {
    const r = m.r;
    if (m.tipo === 'ing') {
      const cli = getCliente(r.clienteId);
      html += `
      <div class="card" style="padding:12px 14px;margin-bottom:9px">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="chip green" style="margin-right:6px">Ingreso</span>${esc(cli ? cli.nombre : '(cliente eliminado)')}</div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
              ${fmtDate(r.fecha)} · ${(r.items||[]).map(p => esc(p.nombre) + ' (+' + p.dias + 'd)').join(' · ') || 'Sin planes'}
            </div>
            <div style="font-size:.78rem;color:var(--muted)">
              ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtMoneda(p.monto, p.monedaId) + (p.convMonto != null ? ' (= ' + fmtMoneda(p.convMonto, p.convMonedaId) + ')' : '')).join(' · ')}
            </div>
            ${r.nota ? `<div style="font-size:.78rem;color:var(--muted)">📝 ${esc(r.nota)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="mono" style="font-weight:800;color:var(--green)">+${fmtMapa(r.pagado, {sep:'<br>+', zeroText:'—'})}</span>
            <div style="display:flex;gap:4px">
              <button class="icon-btn xs" title="Editar" onclick="RegEdit.open('${r.id}')">${I.edit}</button>
              <button class="icon-btn xs" style="color:var(--red)" title="Eliminar" onclick="V._delRegistro('${r.id}')">${I.trash}</button>
            </div>
          </div>
        </div>
      </div>`;
    } else {
      const cta = getCuenta(r.cuentaId);
      html += `
      <div class="card" style="padding:12px 14px;margin-bottom:9px">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="chip red" style="margin-right:6px">Egreso</span>${esc(cta ? cta.correo : '(cuenta eliminada)')}</div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
              ${fmtDate(r.fecha)} · Recarga ${r.dias} días · ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtMoneda(p.monto, p.monedaId)).join(' · ')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="mono" style="font-weight:800;color:var(--red)">-${fmtMapa(r.total, {sep:'<br>-', zeroText:'—'})}</span>
            <div style="display:flex;gap:4px">
              <button class="icon-btn xs" title="Editar" onclick="RecForm.edit('${r.id}')">${I.edit}</button>
              <button class="icon-btn xs" style="color:var(--red)" title="Eliminar" onclick="V._delRecarga('${r.id}')">${I.trash}</button>
            </div>
          </div>
        </div>
      </div>`;
    }
  });

  App.render(html);
};

/* Exportar movimientos (con los filtros actuales) a CSV para Excel */
V._movCSV = function(){
  const anio = V._movAnio, mes = V._movMes, tipo = V._movTipo;
  const rows = [['Fecha','Tipo','Cliente / Cuenta','Detalle','Método','Moneda','Monto']];
  if (tipo !== 'egresos') {
    DB.registros.filter(r => enPeriodo(r.fecha, anio, mes)).forEach(r => {
      const cli = getCliente(r.clienteId);
      const detalle = (r.items||[]).map(p => p.nombre + ' (+' + p.dias + 'd)').join(', ');
      (r.pagos||[]).forEach(p => {
        rows.push([r.fecha, 'Ingreso', cli ? cli.nombre : '(eliminado)', detalle, p.nombre, monedaCodigo(p.monedaId), p.monto]);
      });
    });
  }
  if (tipo !== 'ingresos') {
    DB.recargas.filter(r => enPeriodo(r.fecha, anio, mes)).forEach(r => {
      const cta = getCuenta(r.cuentaId);
      (r.pagos||[]).forEach(p => {
        rows.push([r.fecha, 'Egreso', cta ? cta.correo : '(eliminada)', 'Recarga ' + r.dias + ' días', p.nombre, monedaCodigo(p.monedaId), -p.monto]);
      });
    });
  }
  rows.sort((a,b) => (a === rows[0]) ? -1 : String(b[0]).localeCompare(String(a[0])));
  downloadCSV('streamgest-movimientos-' + todayISO() + '.csv', rows);
  toast('CSV exportado');
};

/* =================================================================
   RECARGAS (egresos)
================================================================= */
V.recargas = function(){
  const lista = DB.recargas.slice().sort((a,b) => b.fecha.localeCompare(a.fecha));
  let html = headHTML({ title: 'Recargas', sub: 'Egresos por renovar tus cuentas', back: 'menu',
    actions: `<button class="btn sm" onclick="RecForm.open()">${I.plus} Nueva</button>` });
  if (!lista.length) html += `<div class="empty">${I.refresh}<p>Registra aquí cada vez que recargas o renuevas una de tus cuentas.</p></div>`;
  lista.forEach(r => {
    const cta = getCuenta(r.cuentaId);
    const d = daysLeft(r.vence);
    html += `
    <div class="card">
      <div class="card-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cta ? cta.correo : '(cuenta eliminada)')}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${fmtDate(r.fecha)} · ${r.dias} días · ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtMoneda(p.monto, p.monedaId)).join(' · ')}
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono" style="font-weight:800;color:var(--red)">-${fmtMapa(r.total, {sep:'<br>-'})}</div>
          <span class="days-pill ${daysPillClass(d)}" style="margin-top:5px;display:inline-block">${daysText(d)}</span>
          <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px">
            <button class="icon-btn xs" title="Repetir recarga" onclick="RecForm.repetir('${r.id}')">${I.repeat}</button>
            <button class="icon-btn xs" title="Editar recarga" onclick="RecForm.edit('${r.id}')">${I.edit}</button>
            <button class="icon-btn xs" style="color:var(--red)" title="Eliminar recarga" onclick="V._delRecarga('${r.id}')">${I.trash}</button>
          </div>
        </div>
      </div>
    </div>`;
  });
  App.render(html);
};

const RecForm = {
  editId: '', cuentaId: '', fecha: '', dias: 30,
  pagos: [],

  open(cuentaId){
    RecForm.editId = '';
    RecForm.cuentaId = cuentaId || '';
    RecForm.fecha = todayISO();
    RecForm.dias = 30;
    RecForm.pagos = [{ metodoId: '', monto: '' }];
    if (!DB.cuentas.length) { toast('Primero crea una cuenta propia', true); return App.nav('cuentas'); }
    RecForm.render();
  },

  /* Editar una recarga existente: cambiar cuenta, fecha, días y montos */
  edit(id){
    const r = DB.recargas.find(x => x.id === id);
    if (!r) return toast('Recarga no encontrada', true);
    RecForm.editId = r.id;
    RecForm.cuentaId = r.cuentaId;
    RecForm.fecha = r.fecha;
    RecForm.dias = r.dias;
    RecForm.pagos = (r.pagos || []).map(p => ({ metodoId: p.metodoId, monto: String(p.monto) }));
    if (!RecForm.pagos.length) RecForm.pagos = [{ metodoId: '', monto: '' }];
    RecForm.render();
  },

  /* Repetir: crea una nueva recarga con los mismos datos, fechada hoy */
  repetir(id){
    const r = DB.recargas.find(x => x.id === id);
    if (!r) return toast('Recarga no encontrada', true);
    RecForm.editId = '';
    RecForm.cuentaId = r.cuentaId;
    RecForm.fecha = todayISO();
    RecForm.dias = r.dias;
    RecForm.pagos = (r.pagos || []).map(p => ({ metodoId: p.metodoId, monto: String(p.monto) }));
    if (!RecForm.pagos.length) RecForm.pagos = [{ metodoId: '', monto: '' }];
    RecForm.render();
  },

  render(){
    const mets = DB.metodos.filter(m => m.activo);
    const ctasOpts = DB.cuentas.map(c => `<option value="${c.id}" ${RecForm.cuentaId===c.id?'selected':''}>${esc(c.correo)}</option>`).join('');
    let pagosHtml = '';
    RecForm.pagos.forEach((pg, i) => {
      const met = getMetodo(pg.metodoId);
      const metsOpts = mets.concat(met && !mets.includes(met) ? [met] : [])
        .map(m => `<option value="${m.id}" ${pg.metodoId===m.id?'selected':''}>${esc(m.nombre)} (${esc(monedaCodigo(m.monedaId))})</option>`).join('');
      pagosHtml += `
      <div class="sub-card">
        ${RecForm.pagos.length > 1 ? `<button class="remove" onclick="RecForm.pagos.splice(${i},1);RecForm.render()">${I.x}</button>` : ''}
        <label>Método de pago</label>
        <select onchange="RecForm.pagos[${i}].metodoId=this.value;RecForm.render()">
          <option value="">Seleccionar…</option>${metsOpts}
        </select>
        <label>Monto${met ? ' en ' + esc(monedaCodigo(met.monedaId)) : ''}</label>
        <input type="number" step="any" min="0" inputmode="decimal" value="${pg.monto}"
          oninput="RecForm.pagos[${i}].monto=this.value;RecForm.calc()" placeholder="0.00">
      </div>`;
    });

    Modal.open(`
      <div class="modal-head"><h2>${RecForm.editId ? 'Editar recarga' : 'Nueva recarga'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Cuenta *</label>
      <select id="rec-cuenta" onchange="RecForm.cuentaId=this.value">
        <option value="">Seleccionar cuenta…</option>${ctasOpts}
      </select>
      <label>Fecha</label>
      <input type="date" value="${RecForm.fecha}" onchange="RecForm.fecha=this.value;RecForm.calc()">
      <label>Duración de la recarga (días)</label>
      <input type="number" min="1" inputmode="numeric" value="${RecForm.dias}"
        oninput="RecForm.dias=Number(this.value)||0;RecForm.calc()">
      <div class="day-chips">
        ${[7,15,30,60,90].map(d => `<button class="${RecForm.dias===d?'active':''}" onclick="RecForm.dias=${d};RecForm.render()">${d}d</button>`).join('')}
      </div>
      <div style="font-size:.78rem;color:var(--muted);margin-top:7px" id="rec-vence"></div>
      <div class="sect"><h2>Pagos</h2></div>
      ${pagosHtml}
      <button class="add-row" onclick="RecForm.pagos.push({metodoId:'',monto:''});RecForm.render()">${I.plus} Agregar pago</button>
      <div class="summary" id="rec-summary"></div>
      <div class="modal-actions">
        <button class="btn" onclick="RecForm.save()">${RecForm.editId ? 'Guardar cambios' : 'Guardar recarga'}</button>
      </div>`);
    RecForm.calc();
  },

  calc(){
    const total = sumarPorMoneda(RecForm.pagos.map(pg => {
      const met = getMetodo(pg.metodoId);
      return { monedaId: met ? met.monedaId : '', monto: pg.monto };
    }).filter(x => x.monedaId));
    const v = document.getElementById('rec-vence');
    if (v) v.textContent = RecForm.dias > 0 ? 'Vence el ' + fmtDate(addDays(RecForm.fecha, RecForm.dias)) : '';
    const s = document.getElementById('rec-summary');
    if (s) s.innerHTML = `<div class="row total"><span>Total egreso</span><span class="mono" style="color:var(--red)">${fmtMapa(total, {zeroText: fmtMoneda(0,null)})}</span></div>`;
  },

  save(){
    if (!RecForm.cuentaId) return toast('Selecciona la cuenta', true);
    if (!RecForm.dias || RecForm.dias < 1) return toast('La duración debe ser al menos 1 día', true);
    const pagos = [];
    for (const pg of RecForm.pagos) {
      const met = getMetodo(pg.metodoId);
      if (!met) return toast('Selecciona el método de cada pago', true);
      const monto = Number(pg.monto) || 0;
      if (monto <= 0) return toast('Ingresa el monto de cada pago', true);
      pagos.push({ metodoId: met.id, nombre: met.nombre, monedaId: met.monedaId, monto });
    }
    const datos = {
      cuentaId: RecForm.cuentaId, fecha: RecForm.fecha,
      pagos, total: sumarPorMoneda(pagos),
      dias: RecForm.dias, vence: addDays(RecForm.fecha, RecForm.dias)
    };
    if (RecForm.editId) {
      const r = DB.recargas.find(x => x.id === RecForm.editId);
      if (!r) return toast('Recarga no encontrada', true);
      Object.assign(r, datos);
    } else {
      DB.recargas.push({ id: uid(), ...datos });
    }
    const cta = getCuenta(RecForm.cuentaId);
    if (cta) cta.estado = 'activa';
    dbSave(); Modal.close(); toast(RecForm.editId ? 'Recarga actualizada' : 'Recarga registrada');
    RecForm.editId = '';
    App.nav('recargas');
  }
};

/* =================================================================
   PLANTILLAS DE WHATSAPP
================================================================= */
V.plantillas = function(){
  const t = DB.templates;
  let html = `
  ${headHTML({ title: 'Plantillas', sub: 'Mensajes de WhatsApp', back: 'menu',
    actions: `<button class="btn sm" onclick="TplForm.open()">${I.plus} Nueva</button>` })}
  <div class="note">Variables disponibles: {nombre}, {plan}, {fecha}, {dias}, {cuando}</div>
  <div class="sect"><h2>Mensajes automáticos</h2></div>
  <label>Vence pronto (1 día antes)</label>
  <textarea id="tp-porVencer" rows="3">${esc(t.porVencer)}</textarea>
  <label>Vence hoy</label>
  <textarea id="tp-hoy" rows="3">${esc(t.hoy)}</textarea>
  <label>Renovación exitosa</label>
  <textarea id="tp-renovado" rows="3">${esc(t.renovado)}</textarea>
  <button class="btn full" style="margin-top:18px" onclick="V._savePlantillas()">Guardar plantillas</button>

  <div class="sect"><h2>Mis plantillas</h2><span class="cnt">${DB.plantillas.length}</span></div>`;
  if (!DB.plantillas.length) {
    html += `<div class="card"><p style="color:var(--muted);font-size:.85rem;text-align:center;padding:6px">Crea tus propias plantillas con el botón "Nueva". Aparecerán al enviar WhatsApp a un cliente.</p></div>`;
  }
  DB.plantillas.forEach(p => {
    html += `
    <button class="list-item" onclick="TplForm.open('${p.id}')">
      <div class="body">
        <div class="title">${esc(p.nombre)}</div>
        <div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.texto)}</div>
      </div>
      <span class="chev">${I.chev}</span>
    </button>`;
  });
  App.render(html);
};

V._savePlantillas = function(){
  DB.templates.porVencer = document.getElementById('tp-porVencer').value;
  DB.templates.hoy = document.getElementById('tp-hoy').value;
  DB.templates.renovado = document.getElementById('tp-renovado').value;
  dbSave(); toast('Plantillas guardadas');
};

const TplForm = {
  editId: null,
  open(id){
    TplForm.editId = id || null;
    const p = id ? DB.plantillas.find(x => x.id === id) : {};
    if (id && !p) return;
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="tf-nombre" value="${esc(p.nombre||'')}" placeholder='Ej: "Promoción del mes"'>
      <label>Mensaje *</label>
      <textarea id="tf-texto" rows="4" placeholder="Hola {nombre}, ...">${esc(p.texto||'')}</textarea>
      <div class="note" style="margin-top:10px">Puedes usar {nombre}, {plan}, {fecha}, {dias} y {cuando}; se reemplazan con los datos del cliente al enviar.</div>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="TplForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="TplForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const nombre = document.getElementById('tf-nombre').value.trim();
    const texto = document.getElementById('tf-texto').value.trim();
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!texto) return toast('Escribe el mensaje de la plantilla', true);
    if (TplForm.editId) {
      const p = DB.plantillas.find(x => x.id === TplForm.editId);
      p.nombre = nombre; p.texto = texto;
    } else {
      DB.plantillas.push({ id: uid(), nombre, texto });
    }
    dbSave(); Modal.close(); toast('Plantilla guardada'); App.refresh();
  },
  async remove(){
    if (!(await confirmar('¿Eliminar esta plantilla?', { danger: true, ok: 'Eliminar' }))) return;
    DB.plantillas = DB.plantillas.filter(x => x.id !== TplForm.editId);
    dbSave(); Modal.close(); toast('Plantilla eliminada'); App.refresh();
  }
};

/* =================================================================
   RESPALDO
================================================================= */
V.respaldo = function(){
  const ult = DB.config.ultimoRespaldo;
  const html = `
  ${headHTML({ title: 'Respaldo', sub: 'Exportar e importar tus datos', back: 'menu' })}
  <div class="note">Los datos se guardan en este dispositivo. Exporta un respaldo con frecuencia para no perder información si cambias de teléfono o borras el navegador.</div>
  ${ult ? `<div class="note" style="color:var(--green)">Último respaldo: ${fmtDate(ult)}</div>`
        : `<div class="note warn">Aún no has exportado ningún respaldo.</div>`}
  <button class="menu-item" onclick="V._exportar()">${I.download} Exportar respaldo (.json)</button>
  <button class="menu-item" onclick="document.getElementById('imp-file').click()">${I.upload} Importar respaldo</button>
  <input type="file" id="imp-file" accept=".json,application/json" class="hidden" onchange="V._importar(this)">

  <div class="sect"><h2>Exportar a Excel (CSV)</h2></div>
  <button class="menu-item" onclick="V._cliCSV()">${I.file} Lista de clientes (.csv)</button>
  <button class="menu-item" onclick="V._movCSV()">${I.file} Movimientos (.csv)</button>

  <div class="sect"><h2>Resumen</h2></div>
  <div class="card">
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Clientes</span><b>${DB.clientes.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Registros de pago</span><b>${DB.registros.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Recargas</span><b>${DB.recargas.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Cuentas propias</span><b>${DB.cuentas.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Planes en catálogo</span><b>${DB.plataformas.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Monedas</span><b>${DB.monedas.length}</b></div>
  </div>`;
  App.render(html);
};

V._exportar = function(){
  downloadFile('streamgest-respaldo-' + todayISO() + '.json', JSON.stringify(DB, null, 2));
  DB.config.ultimoRespaldo = todayISO();
  dbSave();
  toast('Respaldo exportado');
  App.refresh();
};

V._importar = function(input){
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.clientes) || !Array.isArray(data.metodos)) throw new Error('formato');
      if (!(await confirmar('Esto reemplazará TODOS los datos actuales por los del respaldo. ¿Continuar?', { danger: true, ok: 'Reemplazar' }))) return;
      DB = data;
      dbMigrate();
      dbSave();
      toast('Respaldo importado');
      App.boot();
    } catch(e) {
      toast('El archivo no es un respaldo válido', true);
    }
  };
  reader.readAsText(file);
  input.value = '';
};

/* Exportar lista de clientes a CSV */
V._cliCSV = function(){
  const rows = [['Nombre','Teléfono','Notas','Planes','Próximo vencimiento','Estado','Saldo']];
  DB.clientes.slice().sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
    const subs = clienteSuscripciones(c.id);
    const proximo = subs.find(s => s.vence);
    const estado = clienteEstado(c.id);
    const saldo = clienteSaldo(c.id);
    rows.push([
      c.nombre, c.numero, c.notas || '',
      subs.map(s => s.nombre).join(', '),
      proximo ? proximo.vence : '',
      estado.label,
      fmtMapa(saldo, { zeroText: '0' })
    ]);
  });
  downloadCSV('streamgest-clientes-' + todayISO() + '.csv', rows);
  toast('CSV exportado');
};
