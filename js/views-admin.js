/* ============ Vistas de administración: Menú, catálogos, cuentas, recargas, accesos ============ */
"use strict";

/* =================================================================
   MENÚ
================================================================= */
V.menu = function(){
  const html = `
  <div class="page-head">
    <div><h1>Menú</h1><div class="sub">Sesión: ${esc(Auth.current.usuario)}</div></div>
  </div>

  <button class="menu-item" onclick="App.nav('plataformas')">${I.tv} Plataformas y planes <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('metodos')">${I.card} Métodos de pago <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('cuentas')">${I.key} Cuentas propias <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('recargas')">${I.refresh} Recargas (egresos) <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('accesos')">${I.users} Gestión de accesos <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('plantillas')">${I.msg} Plantillas de WhatsApp <span class="chev">${I.chev}</span></button>
  <button class="menu-item" onclick="App.nav('respaldo')">${I.download} Respaldo de datos <span class="chev">${I.chev}</span></button>
  <button class="menu-item danger" onclick="if(confirm('¿Cerrar sesión?'))Auth.logout()">${I.logout} Cerrar sesión</button>`;
  App.render(html);
};

/* =================================================================
   PLATAFORMAS / PLANES
================================================================= */
V.plataformas = function(){
  const lista = DB.plataformas.slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  let html = `
  <div class="page-head">
    <div><h1>Plataformas</h1><div class="sub">Catálogo de planes que vendes</div></div>
    <div class="head-actions"><button class="btn sm" onclick="PlatForm.open()">${I.plus} Nuevo</button></div>
  </div>`;
  if (!lista.length) html += `<div class="empty">${I.tv}<p>Crea tu primer plan, por ejemplo "Netflix 1 Pantalla".</p></div>`;
  lista.forEach(p => {
    html += `
    <div class="list-item" onclick="PlatForm.open('${p.id}')">
      <div class="body">
        <div class="title">${esc(p.nombre)}</div>
        <div class="meta mono">${fmtUSD(p.precioUsd)} USD</div>
      </div>
      ${p.activo ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>'}
    </div>`;
  });
  App.render(html);
};

const PlatForm = {
  editId: null,
  open(id){
    PlatForm.editId = id || null;
    const p = id ? getPlataforma(id) : { activo: true };
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar plan' : 'Nuevo plan'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="pf-nombre" value="${esc(p.nombre||'')}" placeholder='Ej: "Netflix 2 Pantallas"'>
      <label>Precio de venta (USD) *</label>
      <input id="pf-precio" type="number" step="any" min="0" inputmode="decimal" value="${p.precioUsd != null ? p.precioUsd : ''}" placeholder="0.00">
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
    const precio = Number(document.getElementById('pf-precio').value);
    const activo = document.getElementById('pf-activo').checked;
    if (!nombre) return toast('El nombre es obligatorio', true);
    if (!(precio >= 0)) return toast('Ingresa el precio en USD', true);
    if (PlatForm.editId) {
      const p = getPlataforma(PlatForm.editId);
      p.nombre = nombre; p.precioUsd = precio; p.activo = activo;
    } else {
      DB.plataformas.push({ id: uid(), nombre, precioUsd: precio, activo });
    }
    dbSave(); Modal.close(); toast('Plan guardado'); App.refresh();
  },
  remove(){
    const id = PlatForm.editId;
    const usado = DB.registros.some(r => (r.planes||[]).some(p => p.plataformaId === id));
    if (usado) {
      if (!confirm('Este plan ya fue usado en pagos. Se recomienda desactivarlo en vez de borrarlo. ¿Desactivar ahora?')) return;
      getPlataforma(id).activo = false;
      dbSave(); Modal.close(); toast('Plan desactivado'); return App.refresh();
    }
    if (!confirm('¿Eliminar este plan?')) return;
    DB.plataformas = DB.plataformas.filter(p => p.id !== id);
    dbSave(); Modal.close(); toast('Plan eliminado'); App.refresh();
  }
};

/* =================================================================
   MÉTODOS DE PAGO
================================================================= */
V.metodos = function(){
  let html = `
  <div class="page-head">
    <div><h1>Métodos de pago</h1><div class="sub">Monedas y formas de cobro</div></div>
    <div class="head-actions"><button class="btn sm" onclick="MetForm.open()">${I.plus} Nuevo</button></div>
  </div>
  <div class="note">Los métodos con tasa (Bs, COP…) piden la tasa del día al registrar; los demás cuentan 1 a 1 con el dólar.</div>`;
  DB.metodos.forEach(m => {
    html += `
    <div class="list-item" onclick="MetForm.open('${m.id}')">
      <div class="body">
        <div class="title">${esc(m.nombre)}</div>
        <div class="meta">${m.requiereTasa ? 'Requiere tasa de cambio' : 'Equivale 1:1 con USD'}</div>
      </div>
      ${m.activo ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>'}
    </div>`;
  });
  App.render(html);
};

const MetForm = {
  editId: null,
  open(id){
    MetForm.editId = id || null;
    const m = id ? getMetodo(id) : { activo: true, requiereTasa: false };
    Modal.open(`
      <div class="modal-head"><h2>${id ? 'Editar método' : 'Nuevo método'}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nombre *</label>
      <input id="mf-nombre" value="${esc(m.nombre||'')}" placeholder='Ej: "Pago Móvil"'>
      <label style="display:flex;align-items:center;gap:9px;margin-top:16px">
        <input type="checkbox" id="mf-tasa" ${m.requiereTasa ? 'checked' : ''}> Requiere tasa de cambio (moneda local)
      </label>
      <label style="display:flex;align-items:center;gap:9px;margin-top:12px">
        <input type="checkbox" id="mf-activo" ${m.activo ? 'checked' : ''}> Método activo
      </label>
      <div class="modal-actions">
        ${id ? `<button class="btn danger" onclick="MetForm.remove()">${I.trash}</button>` : ''}
        <button class="btn" onclick="MetForm.save()">Guardar</button>
      </div>`);
  },
  save(){
    const nombre = document.getElementById('mf-nombre').value.trim();
    if (!nombre) return toast('El nombre es obligatorio', true);
    const requiereTasa = document.getElementById('mf-tasa').checked;
    const activo = document.getElementById('mf-activo').checked;
    if (MetForm.editId) {
      const m = getMetodo(MetForm.editId);
      m.nombre = nombre; m.requiereTasa = requiereTasa; m.activo = activo;
    } else {
      DB.metodos.push({ id: uid(), nombre, requiereTasa, activo });
    }
    dbSave(); Modal.close(); toast('Método guardado'); App.refresh();
  },
  remove(){
    const id = MetForm.editId;
    const usado = DB.registros.some(r => (r.pagos||[]).some(p => p.metodoId === id))
               || DB.recargas.some(r => (r.pagos||[]).some(p => p.metodoId === id));
    if (usado) {
      if (!confirm('Este método ya fue usado en pagos. Para no romper el histórico se desactivará en vez de borrarse. ¿Desactivar?')) return;
      getMetodo(id).activo = false;
      dbSave(); Modal.close(); toast('Método desactivado'); return App.refresh();
    }
    if (!confirm('¿Eliminar este método?')) return;
    DB.metodos = DB.metodos.filter(m => m.id !== id);
    dbSave(); Modal.close(); toast('Método eliminado'); App.refresh();
  }
};

/* =================================================================
   CUENTAS PROPIAS (streaming del proveedor)
================================================================= */
V.cuentas = function(){
  let html = `
  <div class="page-head">
    <div><h1>Cuentas propias</h1><div class="sub">Tus cuentas reales de streaming</div></div>
    <div class="head-actions"><button class="btn sm" onclick="CtaForm.open()">${I.plus} Nueva</button></div>
  </div>`;
  if (!DB.cuentas.length) html += `<div class="empty">${I.key}<p>Registra las cuentas de streaming que usas para dar servicio.</p></div>`;
  DB.cuentas.forEach(c => {
    const plats = (c.plataformaIds||[]).map(id => getPlataforma(id)).filter(Boolean);
    const recs = DB.recargas.filter(r => r.cuentaId === c.id);
    const ultima = recs.length ? recs.reduce((a,b) => a.vence > b.vence ? a : b) : null;
    const d = ultima ? daysLeft(ultima.vence) : null;
    const estadoChip = c.estado === 'activa' ? '<span class="chip green">Activa</span>'
      : c.estado === 'vencida' ? '<span class="chip red">Vencida</span>'
      : '<span class="chip amber">Suspendida</span>';
    html += `
    <div class="card pressable" onclick="CtaForm.open('${c.id}')">
      <div class="card-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.correo)}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${plats.length ? plats.map(p => esc(p.nombre)).join(' · ') : 'Sin plataformas asociadas'}
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
        <input type="checkbox" class="ctf-plat" value="${p.id}" ${(c.plataformaIds||[]).includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)}
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
      <label>Plataformas que ofrece esta cuenta</label>
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
  remove(){
    const id = CtaForm.editId;
    if (!confirm('¿Eliminar esta cuenta? También se borrará su historial de recargas.')) return;
    DB.recargas = DB.recargas.filter(r => r.cuentaId !== id);
    DB.cuentas = DB.cuentas.filter(c => c.id !== id);
    dbSave(); Modal.close(); toast('Cuenta eliminada'); App.refresh();
  }
};

/* =================================================================
   RECARGAS (egresos)
================================================================= */
V.recargas = function(){
  const lista = DB.recargas.slice().sort((a,b) => b.fecha.localeCompare(a.fecha));
  let html = `
  <div class="page-head">
    <div><h1>Recargas</h1><div class="sub">Egresos por renovar tus cuentas</div></div>
    <div class="head-actions"><button class="btn sm" onclick="RecForm.open()">${I.plus} Nueva</button></div>
  </div>`;
  if (!lista.length) html += `<div class="empty">${I.refresh}<p>Registra aquí cada vez que recargas o renuevas una de tus cuentas.</p></div>`;
  lista.forEach(r => {
    const cta = getCuenta(r.cuentaId);
    const d = daysLeft(r.vence);
    html += `
    <div class="card">
      <div class="card-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cta ? cta.correo : '(cuenta eliminada)')}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${fmtDate(r.fecha)} · ${r.dias} días · ${(r.pagos||[]).map(p => esc(p.nombre) + ' ' + fmtNum(p.monto)).join(' · ')}
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono" style="font-weight:750;color:var(--red)">-${fmtUSD(r.totalUsd)}</div>
          <span class="days-pill ${daysPillClass(d)}" style="margin-top:5px;display:inline-block">${daysText(d)}</span>
        </div>
      </div>
    </div>`;
  });
  App.render(html);
};

const RecForm = {
  cuentaId: '', fecha: '', dias: 30,
  pagos: [],

  open(cuentaId){
    RecForm.cuentaId = cuentaId || '';
    RecForm.fecha = todayISO();
    RecForm.dias = 30;
    RecForm.pagos = [{ metodoId: '', monto: '', tasa: '' }];
    if (!DB.cuentas.length) { toast('Primero crea una cuenta propia', true); return App.nav('cuentas'); }
    RecForm.render();
  },

  render(){
    const mets = DB.metodos.filter(m => m.activo);
    const ctasOpts = DB.cuentas.map(c => `<option value="${c.id}" ${RecForm.cuentaId===c.id?'selected':''}>${esc(c.correo)}</option>`).join('');
    let pagosHtml = '';
    RecForm.pagos.forEach((pg, i) => {
      const met = getMetodo(pg.metodoId);
      const metsOpts = mets.map(m => `<option value="${m.id}" ${pg.metodoId===m.id?'selected':''}>${esc(m.nombre)}</option>`).join('');
      pagosHtml += `
      <div class="sub-card">
        ${RecForm.pagos.length > 1 ? `<button class="remove" onclick="RecForm.pagos.splice(${i},1);RecForm.render()">${I.x}</button>` : ''}
        <label>Método de pago</label>
        <select onchange="RecForm.pagos[${i}].metodoId=this.value;RecForm.render()">
          <option value="">Seleccionar…</option>${metsOpts}
        </select>
        <label>Monto${met ? ' en ' + esc(met.nombre) : ''}</label>
        <input type="number" step="any" min="0" inputmode="decimal" value="${pg.monto}"
          oninput="RecForm.pagos[${i}].monto=this.value;RecForm.calc()" placeholder="0.00">
        ${met && met.requiereTasa ? `
        <label>Tasa (${esc(met.nombre)} por 1 USD)</label>
        <input type="number" step="any" min="0" inputmode="decimal" value="${pg.tasa}"
          oninput="RecForm.pagos[${i}].tasa=this.value;RecForm.calc()" placeholder="Ej: 45.50">` : ''}
        <div style="font-size:.78rem;color:var(--accent);margin-top:7px;font-weight:650" id="rec-usd-${i}"></div>
      </div>`;
    });

    Modal.open(`
      <div class="modal-head"><h2>Nueva recarga</h2>
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
      <div style="font-size:.78rem;color:var(--muted);margin-top:7px" id="rec-vence"></div>
      <div class="sect"><h2>Pagos</h2></div>
      ${pagosHtml}
      <button class="add-row" onclick="RecForm.pagos.push({metodoId:'',monto:'',tasa:''});RecForm.render()">${I.plus} Agregar pago</button>
      <div class="summary" id="rec-summary"></div>
      <div class="modal-actions">
        <button class="btn" onclick="RecForm.save()">Guardar recarga</button>
      </div>`);
    RecForm.calc();
  },

  calc(){
    let total = 0;
    RecForm.pagos.forEach((pg, i) => {
      const met = getMetodo(pg.metodoId);
      const monto = Number(pg.monto) || 0;
      let usd = 0;
      if (met) usd = met.requiereTasa ? (Number(pg.tasa) > 0 ? monto / Number(pg.tasa) : 0) : monto;
      total += usd;
      const el = document.getElementById('rec-usd-' + i);
      if (el) el.textContent = met && monto ? '= ' + fmtUSD(usd) + ' USD' : '';
    });
    const v = document.getElementById('rec-vence');
    if (v) v.textContent = RecForm.dias > 0 ? 'Vence el ' + fmtDate(addDays(RecForm.fecha, RecForm.dias)) : '';
    const s = document.getElementById('rec-summary');
    if (s) s.innerHTML = `<div class="row total"><span>Total egreso</span><span class="mono" style="color:var(--red)">${fmtUSD(total)}</span></div>`;
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
      let tasa = 1, usd = monto;
      if (met.requiereTasa) {
        tasa = Number(pg.tasa) || 0;
        if (tasa <= 0) return toast('Ingresa la tasa para ' + met.nombre, true);
        usd = monto / tasa;
      }
      pagos.push({ metodoId: met.id, nombre: met.nombre, monto, tasa, usd });
    }
    const totalUsd = pagos.reduce((s,p) => s + p.usd, 0);
    DB.recargas.push({
      id: uid(), cuentaId: RecForm.cuentaId, fecha: RecForm.fecha,
      pagos, totalUsd: Math.round(totalUsd * 100) / 100,
      dias: RecForm.dias, vence: addDays(RecForm.fecha, RecForm.dias)
    });
    const cta = getCuenta(RecForm.cuentaId);
    if (cta) cta.estado = 'activa';
    dbSave(); Modal.close(); toast('Recarga registrada');
    App.nav('recargas');
  }
};

/* =================================================================
   GESTIÓN DE ACCESOS
================================================================= */
V.accesos = function(){
  let html = `
  <div class="page-head">
    <div><h1>Accesos</h1><div class="sub">Usuarios que pueden entrar a la app</div></div>
    <div class="head-actions"><button class="btn sm" onclick="UserForm.open()">${I.plus} Nuevo</button></div>
  </div>`;
  DB.users.forEach(u => {
    const esYo = u.id === Auth.current.id;
    html += `
    <div class="card">
      <div class="card-row">
        <div class="avatar">${esc(initials(u.usuario))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:650">${esc(u.usuario)} ${esYo ? '<span class="chip blue" style="margin-left:4px">Tú</span>' : ''}</div>
          <div style="font-size:.78rem;color:var(--muted)">Creado el ${fmtDate(u.fecha)}</div>
        </div>
        ${u.activo ? '<span class="chip green">Activo</span>' : '<span class="chip gray">Inactivo</span>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:11px">
        <button class="btn sm ghost" onclick="UserForm.changePass('${u.id}')">${I.key} Contraseña</button>
        ${!esYo ? `<button class="btn sm ${u.activo ? 'danger' : 'green'}" onclick="UserForm.toggle('${u.id}')">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}
        ${!esYo ? `<button class="btn sm danger" onclick="UserForm.remove('${u.id}')">${I.trash}</button>` : ''}
      </div>
    </div>`;
  });
  App.render(html);
};

const UserForm = {
  open(){
    Modal.open(`
      <div class="modal-head"><h2>Nuevo usuario</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Usuario *</label>
      <input id="uf-usuario" autocapitalize="none" placeholder="nombre de usuario">
      <label>Contraseña *</label>
      <input id="uf-clave" type="password" placeholder="mínimo 4 caracteres">
      <div class="modal-actions">
        <button class="btn" onclick="UserForm.save()">Crear usuario</button>
      </div>`);
  },
  async save(){
    const err = await Auth.createUser(
      document.getElementById('uf-usuario').value,
      document.getElementById('uf-clave').value,
      Auth.current.id
    );
    if (err) return toast(err, true);
    Modal.close(); toast('Usuario creado'); App.refresh();
  },
  changePass(id){
    const u = DB.users.find(x => x.id === id);
    Modal.open(`
      <div class="modal-head"><h2>Contraseña de ${esc(u.usuario)}</h2>
        <button class="icon-btn" onclick="Modal.close()">${I.x}</button></div>
      <label>Nueva contraseña *</label>
      <input id="uf-nueva" type="password" placeholder="mínimo 4 caracteres">
      <div class="modal-actions">
        <button class="btn" onclick="UserForm.savePass('${id}')">Cambiar</button>
      </div>`);
  },
  async savePass(id){
    const err = await Auth.changePassword(id, document.getElementById('uf-nueva').value);
    if (err) return toast(err, true);
    Modal.close(); toast('Contraseña actualizada');
  },
  toggle(id){
    const u = DB.users.find(x => x.id === id);
    u.activo = !u.activo;
    dbSave(); toast(u.activo ? 'Usuario activado' : 'Acceso revocado'); App.refresh();
  },
  remove(id){
    if (!confirm('¿Eliminar este usuario definitivamente?')) return;
    DB.users = DB.users.filter(x => x.id !== id);
    dbSave(); toast('Usuario eliminado'); App.refresh();
  }
};

/* =================================================================
   PLANTILLAS DE WHATSAPP
================================================================= */
V.plantillas = function(){
  const t = DB.templates;
  const html = `
  <div class="page-head">
    <div><h1>Plantillas</h1><div class="sub">Mensajes de WhatsApp</div></div>
  </div>
  <div class="note">Variables disponibles: {nombre}, {plan}, {fecha}, {dias}, {cuando}</div>
  <label>Vence pronto (1 día antes)</label>
  <textarea id="tp-porVencer" rows="3">${esc(t.porVencer)}</textarea>
  <label>Vence hoy</label>
  <textarea id="tp-hoy" rows="3">${esc(t.hoy)}</textarea>
  <label>Renovación exitosa</label>
  <textarea id="tp-renovado" rows="3">${esc(t.renovado)}</textarea>
  <button class="btn full" style="margin-top:18px" onclick="V._savePlantillas()">Guardar plantillas</button>`;
  App.render(html);
};

V._savePlantillas = function(){
  DB.templates.porVencer = document.getElementById('tp-porVencer').value;
  DB.templates.hoy = document.getElementById('tp-hoy').value;
  DB.templates.renovado = document.getElementById('tp-renovado').value;
  dbSave(); toast('Plantillas guardadas');
};

/* =================================================================
   RESPALDO
================================================================= */
V.respaldo = function(){
  const html = `
  <div class="page-head">
    <div><h1>Respaldo</h1><div class="sub">Exportar e importar tus datos</div></div>
  </div>
  <div class="note">Los datos se guardan en este dispositivo. Exporta un respaldo con frecuencia para no perder información si cambias de teléfono o borras el navegador.</div>
  <button class="menu-item" onclick="V._exportar()">${I.download} Exportar respaldo (.json)</button>
  <button class="menu-item" onclick="document.getElementById('imp-file').click()">${I.upload} Importar respaldo</button>
  <input type="file" id="imp-file" accept=".json,application/json" class="hidden" onchange="V._importar(this)">
  <div class="sect"><h2>Resumen</h2></div>
  <div class="card">
    <div class="card-row" style="padding:4px 0"><span class="muted" style="color:var(--muted)">Clientes</span><b>${DB.clientes.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Registros de pago</span><b>${DB.registros.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Recargas</span><b>${DB.recargas.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Cuentas propias</span><b>${DB.cuentas.length}</b></div>
    <div class="card-row" style="padding:4px 0"><span style="color:var(--muted)">Planes en catálogo</span><b>${DB.plataformas.length}</b></div>
  </div>`;
  App.render(html);
};

V._exportar = function(){
  downloadFile('streamgest-respaldo-' + todayISO() + '.json', JSON.stringify(DB, null, 2));
  toast('Respaldo exportado');
};

V._importar = function(input){
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.clientes) || !Array.isArray(data.users)) throw new Error('formato');
      if (!confirm('Esto reemplazará TODOS los datos actuales por los del respaldo. ¿Continuar?')) return;
      DB = data;
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
