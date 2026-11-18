// Utilidades compartidas por todas las páginas de Vínculo Laboral

const Sesion = {
  token: () => localStorage.getItem('vl_token'),
  usuario: () => JSON.parse(localStorage.getItem('vl_usuario') || 'null'),
  guardar(token, usuario) {
    localStorage.setItem('vl_token', token);
    localStorage.setItem('vl_usuario', JSON.stringify(usuario));
  },
  cerrar() {
    localStorage.removeItem('vl_token');
    localStorage.removeItem('vl_usuario');
  },
};

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (Sesion.token()) cabeceras.Authorization = 'Bearer ' + Sesion.token();
  const resp = await fetch('/api' + ruta, { method: metodo, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (resp.status === 204) return null;
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401 && Sesion.token() && !ruta.startsWith('/auth/login')) {
      Sesion.cerrar();
      location.href = '/ingreso.html?expirada=1';
    }
    const err = new Error(datos.error || 'No se pudo completar la solicitud');
    err.detalles = datos.detalles;
    err.estado = resp.status;
    throw err;
  }
  return datos;
}

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-SV', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-SV', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const dinero = (n) => '$' + Number(n).toLocaleString('es-SV', { maximumFractionDigits: 0 });
const salario = (min, max) => {
  if (min == null && max == null) return 'Salario no indicado';
  if (min != null && max != null) return `${dinero(min)} a ${dinero(max)} al mes`;
  return `${dinero(min ?? max)} al mes`;
};

const ESTADOS = {
  enviada: ['Enviada', ''], en_revision: ['En revisión', 'aviso'], aceptada: ['Aceptada', 'ok'], rechazada: ['Rechazada', 'no'], retirada: ['Retirada', ''],
  activa: ['Activa', 'ok'], inactiva: ['Inactiva', ''], cancelada: ['Cancelada', 'no'], pendiente: ['Pendiente de aprobación', 'aviso'],
  verificada: ['Verificada', 'ok'], activo: ['Activo', 'ok'], suspendido: ['Suspendido', 'no'],
};
const etiqueta = (estado) => {
  const [texto, clase] = ESTADOS[estado] || [estado, ''];
  return `<span class="etiqueta ${clase}">${esc(texto)}</span>`;
};

function mensaje(contenedor, tipo, texto) {
  const caja = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
  caja.innerHTML = texto ? `<div class="alerta ${tipo}" role="alert">${esc(texto)}</div>` : '';
  if (texto) caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Muestra el error general y los errores por campo que devuelve la API
function mostrarError(form, err, caja = '#mensaje') {
  form.querySelectorAll('.error-campo').forEach((e) => e.remove());
  mensaje(caja, 'error', err.message);
  Object.entries(err.detalles || {}).forEach(([campo, texto]) => {
    const input = form.elements[campo];
    if (!input) return;
    const aviso = document.createElement('span');
    aviso.className = 'error-campo';
    aviso.textContent = texto;
    input.closest('.campo').appendChild(aviso);
  });
}

function datosForm(form) {
  const datos = {};
  new FormData(form).forEach((v, k) => { datos[k] = typeof v === 'string' ? v.trim() : v; });
  form.querySelectorAll('input[type=checkbox]').forEach((c) => { datos[c.name] = c.checked; });
  return datos;
}

function llenarSelect(select, lista, vacio) {
  select.innerHTML = (vacio ? `<option value="">${esc(vacio)}</option>` : '') + lista.map((x) => `<option>${esc(x)}</option>`).join('');
}

let catalogosCache;
async function catalogos() {
  if (!catalogosCache) catalogosCache = await api('/publico/catalogos');
  return catalogosCache;
}

const RUTAS_ROL = { candidato: '/candidato/panel.html', empresa: '/empresa/panel.html', admin: '/admin/panel.html' };

const MENUS = {
  publico: [['/empleos.html', 'Buscar empleo', 'empleos'], ['/recursos.html', 'Recursos', 'recursos'], ['/registro.html?tipo=empresa', 'Para empresas', 'empresas']],
  candidato: [['/candidato/panel.html', 'Mi panel', 'panel'], ['/empleos.html', 'Buscar empleo', 'empleos'], ['/candidato/postulaciones.html', 'Mis postulaciones', 'postulaciones'], ['/recursos.html', 'Recursos', 'recursos'], ['/candidato/perfil.html', 'Mi perfil', 'perfil']],
  empresa: [['/empresa/panel.html', 'Panel', 'panel'], ['/empresa/ofertas.html', 'Mis ofertas', 'ofertas'], ['/empresa/perfil.html', 'Datos de la empresa', 'perfil']],
  admin: [['/admin/panel.html', 'Administración', 'panel'], ['/empleos.html', 'Ver portal', 'empleos']],
};

// Dibuja cabecera y pie, y valida que la persona tenga el rol que la página exige
function montar({ rol = null, activo = '' } = {}) {
  const u = Sesion.usuario();
  if (rol && (!u || !Sesion.token())) {
    location.href = '/ingreso.html?volver=' + encodeURIComponent(location.pathname + location.search);
    return false;
  }
  if (rol && u.rol !== rol) {
    location.href = RUTAS_ROL[u.rol] || '/';
    return false;
  }
  const menu = (MENUS[u ? u.rol : 'publico'] || MENUS.publico)
    .map(([href, texto, clave]) => `<a href="${href}" class="${clave === activo ? 'activo' : ''}">${texto}</a>`).join('');
  const sesion = u
    ? `<span class="suave">${esc(u.nombre)}</span><a href="#" id="salir">Cerrar sesión</a>`
    : `<a href="/ingreso.html">Ingresar</a><a class="boton chico" href="/registro.html">Crear cuenta</a>`;
  document.getElementById('cabecera').className = 'cabecera';
  document.getElementById('cabecera').innerHTML =
    `<div class="contenedor"><a class="logo" href="/">Vínculo <em>Laboral</em></a><nav class="menu" aria-label="Principal">${menu}</nav><div class="sesion">${sesion}</div></div>`;
  document.getElementById('pie').className = 'pie';
  document.getElementById('pie').innerHTML =
    `<div class="contenedor">Vínculo Laboral · Proyecto de segundo período, Facultad de Ingeniería y Arquitectura, UNICAES.</div>`;
  const salir = document.getElementById('salir');
  if (salir) salir.addEventListener('click', (e) => { e.preventDefault(); Sesion.cerrar(); location.href = '/'; });
  return true;
}

function tarjetaOferta(o) {
  return `<div class="item-oferta"><span class="num"></span>
    <div><h3><a href="/empleo.html?id=${o.id}">${esc(o.titulo)}</a></h3>
      <div class="suave">${esc(o.empresa)} · ${esc(o.departamento)}</div>
      <div class="pequeno suave">${esc(salario(o.salario_min, o.salario_max))}</div></div>
    <div style="text-align:right"><span class="etiqueta">${esc(o.tipo_contrato)}</span>
      <div class="pequeno suave" style="margin-top:6px">${esc(o.modalidad)} · ${fecha(o.creado_en)}</div></div></div>`;
}

// Sube un archivo como cuerpo binario (currículum o foto)
async function subirArchivo(ruta, archivo, tipoMime) {
  const resp = await fetch('/api' + ruta, {
    method: 'PUT',
    headers: { 'Content-Type': tipoMime || archivo.type || 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(archivo.name || 'archivo'), Authorization: 'Bearer ' + Sesion.token() },
    body: archivo,
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(datos.error || 'No se pudo subir el archivo');
  return datos;
}

// Descarga un archivo protegido por sesión y devuelve { blob, nombre }
async function bajarArchivo(ruta) {
  const resp = await fetch('/api' + ruta, { headers: { Authorization: 'Bearer ' + Sesion.token() } });
  if (!resp.ok) {
    const datos = await resp.json().catch(() => ({}));
    throw new Error(datos.error || 'No se pudo obtener el archivo');
  }
  const cab = resp.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(cab);
  return { blob: await resp.blob(), nombre: m ? decodeURIComponent(m[1]) : 'archivo' };
}

async function guardarComo(ruta) {
  const { blob, nombre } = await bajarArchivo(ruta);
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

const tamanoLegible = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

// Cuadros de diálogo propios, en lugar de confirm() y prompt() del navegador.
// confirmar() devuelve true o false; pedirTexto() devuelve el texto o null si se cancela.
function dialogo({ titulo, texto, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false, campo = null }) {
  return new Promise((resolver) => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = `<form method="dialog" class="modal-caja">
      <h3 id="modal-titulo">${esc(titulo)}</h3>
      ${texto ? `<p class="modal-texto">${esc(texto)}</p>` : ''}
      ${campo ? `<div class="campo"><label for="modal-campo">${esc(campo.etiqueta)}</label><textarea id="modal-campo" maxlength="300" rows="3"></textarea><span class="error-campo" id="modal-error" hidden>${esc(campo.error || 'Este dato es obligatorio')}</span></div>` : ''}
      <div class="modal-acciones">
        <button type="button" class="boton sec" data-accion="cancelar">${esc(cancelar)}</button>
        <button type="submit" class="boton ${peligro ? 'rojo' : ''}" data-accion="aceptar">${esc(aceptar)}</button>
      </div></form>`;
    d.setAttribute('aria-labelledby', 'modal-titulo');
    document.body.appendChild(d);
    let resultado = campo ? null : false;
    const cerrar = () => d.close();
    d.querySelector('[data-accion=cancelar]').addEventListener('click', cerrar);
    d.querySelector('form').addEventListener('submit', (e) => {
      if (campo) {
        const v = d.querySelector('#modal-campo').value.trim();
        if (!v) { e.preventDefault(); d.querySelector('#modal-error').hidden = false; d.querySelector('#modal-campo').focus(); return; }
        resultado = v;
      } else resultado = true;
    });
    // clic fuera de la caja = cancelar
    d.addEventListener('click', (e) => { if (e.target === d) cerrar(); });
    d.addEventListener('close', () => { d.remove(); resolver(resultado); });
    d.showModal();
    (campo ? d.querySelector('#modal-campo') : d.querySelector('[data-accion=cancelar]')).focus();
  });
}
const confirmar = (titulo, texto, opciones = {}) => dialogo({ titulo, texto, ...opciones });
const pedirTexto = (titulo, etiqueta, opciones = {}) => dialogo({ titulo, campo: { etiqueta }, aceptar: 'Enviar', ...opciones });
