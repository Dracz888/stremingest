/* ============ Vista de Inicio: resumen, gráfico, balance, cartera, ranking ============ */
"use strict";

const V = {};

V._MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

V._rankPeriodo = 'mes';
V._dashAnio = '';
V._dashMes = '';
V._chartMonedaId = null;

/* Gráfico SVG de barras: ingresos vs egresos por mes */
V._chartSVG = function(serie){
  const W = 320, H = 150, padB = 18, padT = 14;
  const max = Math.max(1, ...serie.map(m => Math.max(m.ing, m.egr)));
  const n = serie.length || 1;
  const slot = W / n;
  const bw = Math.min(16, slot * 0.28);
  let bars = '', labels = '';
  serie.forEach((m, i) => {
    const cx = slot * i + slot / 2;
    const hIng = (m.ing / max) * (H - padB - padT);
    const hEgr = (m.egr / max) * (H - padB - padT);
    bars += `<rect x="${(cx - bw - 1.5).toFixed(1)}" y="${(H - padB - Math.max(hIng, m.ing > 0 ? 2 : 0)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hIng, m.ing > 0 ? 2 : 0).toFixed(1)}" rx="3" fill="var(--green)"/>`;
    bars += `<rect x="${(cx + 1.5).toFixed(1)}" y="${(H - padB - Math.max(hEgr, m.egr > 0 ? 2 : 0)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hEgr, m.egr > 0 ? 2 : 0).toFixed(1)}" rx="3" fill="var(--red)"/>`;
    if (m.ing > 0) labels += `<text x="${(cx - 1.5 - bw/2).toFixed(1)}" y="${(H - padB - Math.max(hIng,2) - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="var(--muted)">${fmtCompact(m.ing)}</text>`;
    if (m.egr > 0) labels += `<text x="${(cx + 1.5 + bw/2).toFixed(1)}" y="${(H - padB - Math.max(hEgr,2) - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="var(--muted)">${fmtCompact(m.egr)}</text>`;
    labels += `<text x="${cx.toFixed(1)}" y="${H - 5}" font-size="8.5" font-weight="700" text-anchor="middle" fill="var(--muted)">${esc(m.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y egresos por mes">
    <line x1="0" y1="${H - padB}" x2="${W}" y2="${H - padB}" stroke="var(--border)" stroke-width="1"/>
    ${bars}${labels}
  </svg>`;
};

V.dashboard = function(){
  const anio = V._dashAnio, mes = V._dashMes;
  const ing = totalIngresos(anio, mes);
  const egr = totalEgresos(anio, mes);
  const bal = balanceGeneral(anio, mes);
  const cart = cartera();
  const rank = rankingPlataformas(V._rankPeriodo);
  const maxVenta = rank.length ? Math.max(...rank.map(r => r.ventas), 1) : 1;
  const nAlertas = alertCount();
  const porCobrar = totalPorCobrar();
  const proximas = proximasRenovaciones(Number(DB.config.avisoCliente) || 7);
  const syncActivo = (typeof Sync !== 'undefined') && Sync.isActive && (Sync.loadLocal(), Sync.isActive());

  // monedas con algún movimiento (para el balance filtrado)
  const monIds = Array.from(new Set([...Object.keys(ing), ...Object.keys(egr)]))
    .filter(k => Math.abs(ing[k]||0) > 0.009 || Math.abs(egr[k]||0) > 0.009)
    .sort((a,b) => monedaCodigo(a).localeCompare(monedaCodigo(b)));

  // moneda del gráfico
  const monMov = monedasConMovimiento();
  if (!V._chartMonedaId || !monMov.includes(V._chartMonedaId)) V._chartMonedaId = monMov[0] || null;

  let html = `
  <div class="page-head">
    <div>
      <h1>${esc(saludoHora())}, ${esc(DB.config.usuario)}</h1>
      <div class="sub">${fmtDate(todayISO())}${syncActivo ? ' · <span style="color:var(--green)">● sincronizado</span>' : ''}</div>
    </div>
    <button class="icon-btn" aria-label="Ajustes" onclick="App.nav('ajustes')">${I.gear}</button>
  </div>

  <div class="grid2">
    <button class="kpi" onclick="App.nav('clientes')">
      <div class="lbl">${I.users} Clientes</div><div class="val">${DB.clientes.length}</div>
    </button>
    <button class="kpi ${nAlertas ? 'red' : 'green'}" onclick="App.nav('alertas')">
      <div class="lbl">${I.bell} Alertas</div><div class="val">${nAlertas}</div>
    </button>
    <button class="kpi ${Object.keys(porCobrar).length ? 'amber' : ''}" onclick="V._cliFiltro='debe';App.nav('clientes')">
      <div class="lbl">${I.wallet} Por cobrar</div>
      <div class="val" style="font-size:${Object.keys(porCobrar).length > 1 ? '.92rem' : '1.15rem'}">${fmtMapa(porCobrar, {zeroText:'0'})}</div>
    </button>
    <button class="kpi accent" onclick="App.nav('alertas')">
      <div class="lbl">${I.calendar} Renovaciones</div><div class="val">${proximas.length}</div>
    </button>
  </div>`;

  /* ---- Gráfico mensual ---- */
  if (monMov.length) {
    const serie = serieMensual(V._chartMonedaId, 6);
    html += `
    <div class="sect"><h2>Últimos 6 meses</h2></div>
    ${monMov.length > 1 ? `
    <div class="filter-row">
      ${monMov.map(k => `<button class="filter-chip ${V._chartMonedaId===k?'active':''}" onclick="V._chartMonedaId='${k}';App.nav('dashboard')">${esc(monedaCodigo(k))}</button>`).join('')}
    </div>` : ''}
    <div class="card chart-card">
      ${V._chartSVG(serie)}
      <div class="chart-legend">
        <span><span class="dot" style="background:var(--green)"></span>Ingresos</span>
        <span><span class="dot" style="background:var(--red)"></span>Egresos</span>
      </div>
    </div>`;
  }

  /* ---- Balance por moneda ---- */
  html += `
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
          <span style="font-weight:800;font-size:1rem">${esc(monedaCodigo(k))}</span>
          <span class="mono" style="font-weight:800;color:${b >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoneda(b, k)}</span>
        </div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:3px">
          Ingresos <span class="mono" style="color:var(--green)">${fmtMoneda(i, k)}</span>
          · Egresos <span class="mono" style="color:var(--red)">${fmtMoneda(e, k)}</span>
        </div>
      </div>`;
    });
  }

  /* ---- Próximas renovaciones ---- */
  if (proximas.length) {
    html += `<div class="sect"><h2>Próximas renovaciones</h2><span class="cnt">${proximas.length}</span></div>`;
    proximas.slice(0, 5).forEach(x => {
      html += `
      <button class="list-item" onclick="V._cliExpanded='${x.cliente.id}';V._cliFiltro='todos';App.nav('clientes')">
        <div class="avatar">${esc(initials(x.cliente.nombre))}</div>
        <div class="body">
          <div class="title">${esc(x.cliente.nombre)}</div>
          <div class="meta">${esc(x.plan.nombre)} · ${fmtDateShort(x.plan.vence)}</div>
        </div>
        <span class="days-pill ${daysPillClass(x.dias)}">${daysText(x.dias)}</span>
      </button>`;
    });
    if (proximas.length > 5) {
      html += `<button class="btn sm ghost full" onclick="App.nav('alertas')">Ver todas (${proximas.length})</button>`;
    }
  }

  /* ---- Cartera por moneda ---- */
  html += `<div class="sect"><h2>Cartera por moneda</h2></div>`;
  if (!cart.length) {
    html += `<div class="card"><div class="empty" style="padding:18px">${I.wallet}<p>Aún no hay movimientos en tus métodos de pago</p></div></div>`;
  } else {
    const porMon = {};
    cart.forEach(m => { (porMon[m.monedaId] = porMon[m.monedaId] || []).push(m); });
    Object.keys(porMon).sort((a,b) => monedaCodigo(a).localeCompare(monedaCodigo(b))).forEach(k => {
      const metodos = porMon[k];
      const subtotal = metodos.reduce((s,m) => s + m.monto, 0);
      html += `<div class="card">`;
      metodos.forEach(m => {
        html += `
        <div class="card-row" style="padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:650">${esc(m.nombre)}</span>
          <span class="mono" style="font-weight:700">${fmtMoneda(m.monto, k)}</span>
        </div>`;
      });
      html += `<div class="card-row" style="padding-top:10px"><span style="font-weight:800">Total ${esc(monedaCodigo(k))}</span><span class="mono" style="font-weight:800">${fmtMoneda(subtotal, k)}</span></div></div>`;
    });
  }

  /* ---- Ranking ---- */
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
