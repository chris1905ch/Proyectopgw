const express = require('express');
const db = require('../db');
const { ErrorHttp, asincrono } = require('../middleware/errors');
const { idParam } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');

const router = express.Router();
router.use(requiereSesion, requiereRol('admin'));

router.get('/resumen', asincrono(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*) FROM usuarios WHERE rol = 'candidato')::int AS candidatos,
      (SELECT count(*) FROM usuarios WHERE estado = 'suspendido')::int AS suspendidos,
      (SELECT count(*) FROM empresas)::int AS empresas,
      (SELECT count(*) FROM empresas WHERE verificacion = 'pendiente')::int AS empresas_pendientes,
      (SELECT count(*) FROM ofertas)::int AS ofertas,
      (SELECT count(*) FROM ofertas WHERE estado = 'activa')::int AS ofertas_activas,
      (SELECT count(*) FROM ofertas WHERE estado = 'pendiente')::int AS ofertas_pendientes,
      (SELECT count(*) FROM postulaciones)::int AS postulaciones`);
  const porDepto = (await db.query(
    `SELECT departamento, count(*)::int AS n FROM ofertas GROUP BY departamento ORDER BY n DESC LIMIT 6`)).rows;
  const porEstado = (await db.query(`SELECT estado, count(*)::int AS n FROM postulaciones GROUP BY estado`)).rows;
  res.json({ ...rows[0], ofertasPorDepartamento: porDepto, postulacionesPorEstado: porEstado });
}));

// Busca usuarios con los filtros del panel (se usa en el listado y en la exportación)
async function buscarUsuarios({ q, rol, estado }, limite) {
  const cond = [];
  const params = [];
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    cond.push(`(nombre ILIKE $1 OR apellidos ILIKE $1 OR correo ILIKE $1)`);
  }
  if (rol) { params.push(rol); cond.push(`rol = $${params.length}`); }
  if (estado) { params.push(estado); cond.push(`estado = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT id, nombre, apellidos, correo, rol, estado, creado_en FROM usuarios
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY creado_en DESC LIMIT ${limite}`, params);
  return rows;
}

router.get('/usuarios', asincrono(async (req, res) => {
  res.json(await buscarUsuarios(req.query, 200));
}));

// Un valor de CSV se encierra entre comillas si trae comas, comillas o saltos de línea.
// Si empieza con =, +, - o @ se le antepone un apóstrofo para que Excel no lo trate como fórmula.
function celdaCsv(valor) {
  let t = valor instanceof Date ? valor.toISOString() : String(valor ?? '');
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

router.get('/usuarios/exportar', asincrono(async (req, res) => {
  const usuarios = await buscarUsuarios(req.query, 5000);
  const columnas = ['id', 'nombre', 'apellidos', 'correo', 'rol', 'estado', 'creado_en'];
  const lineas = [columnas.join(',')];
  usuarios.forEach((u) => lineas.push(columnas.map((c) => celdaCsv(u[c])).join(',')));
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="usuarios.csv"',
  });
  // El carácter \ufeff al inicio permite que Excel lea bien las tildes
  res.send('\ufeff' + lineas.join('\r\n') + '\r\n');
}));

router.patch('/usuarios/:id/estado', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const estado = req.body.estado;
  if (!['activo', 'suspendido'].includes(estado)) throw new ErrorHttp(400, 'Estado no válido');
  if (id === req.usuario.id) throw new ErrorHttp(409, 'No puede cambiar el estado de su propia cuenta');
  const objetivo = (await db.query('SELECT rol FROM usuarios WHERE id = $1', [id])).rows[0];
  if (!objetivo) throw new ErrorHttp(404, 'El usuario no existe');
  if (objetivo.rol === 'admin') throw new ErrorHttp(403, 'No se puede suspender a otro administrador');
  const { rows } = await db.query('UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING id, nombre, apellidos, correo, rol, estado', [estado, id]);
  res.json(rows[0]);
}));

router.get('/empresas', asincrono(async (req, res) => {
  const { verificacion } = req.query;
  const params = [];
  let where = '';
  if (verificacion) { params.push(verificacion); where = 'WHERE e.verificacion = $1'; }
  const { rows } = await db.query(
    `SELECT e.id, e.razon_social, e.nit, e.sector, e.departamento, e.verificacion, e.motivo_rechazo, e.creado_en,
            u.nombre || ' ' || u.apellidos AS contacto, u.correo,
            (SELECT count(*)::int FROM ofertas o WHERE o.empresa_id = e.id) AS ofertas
       FROM empresas e JOIN usuarios u ON u.id = e.usuario_id ${where} ORDER BY e.creado_en DESC`, params);
  res.json(rows);
}));

// Verificar o rechazar una empresa. Al verificar, sus ofertas pendientes pasan a activas.
router.patch('/empresas/:id/verificacion', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const { verificacion } = req.body;
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!['verificada', 'rechazada'].includes(verificacion)) throw new ErrorHttp(400, 'Estado no válido');
  if (verificacion === 'rechazada' && !motivo) throw new ErrorHttp(400, 'Indique el motivo del rechazo');
  const { rows } = await db.query(
    'UPDATE empresas SET verificacion = $1, motivo_rechazo = $2 WHERE id = $3 RETURNING *',
    [verificacion, verificacion === 'rechazada' ? motivo : null, id]);
  if (!rows[0]) throw new ErrorHttp(404, 'La empresa no existe');
  if (verificacion === 'verificada') {
    await db.query(`UPDATE ofertas SET estado = 'activa' WHERE empresa_id = $1 AND estado = 'pendiente' AND fecha_cierre >= current_date`, [id]);
  }
  res.json(rows[0]);
}));

router.get('/ofertas', asincrono(async (req, res) => {
  const { estado } = req.query;
  const params = [];
  let where = '';
  if (estado) { params.push(estado); where = 'WHERE o.estado = $1'; }
  const { rows } = await db.query(
    `SELECT o.id, o.titulo, o.estado, o.departamento, o.fecha_cierre, o.creado_en, e.razon_social AS empresa,
            (SELECT count(*)::int FROM postulaciones p WHERE p.oferta_id = o.id) AS postulaciones
       FROM ofertas o JOIN empresas e ON e.id = o.empresa_id ${where} ORDER BY o.creado_en DESC LIMIT 200`, params);
  res.json(rows);
}));

router.patch('/ofertas/:id/estado', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const { estado } = req.body;
  if (!['activa', 'inactiva', 'cancelada'].includes(estado)) throw new ErrorHttp(400, 'Estado no válido');
  const { rows } = await db.query('UPDATE ofertas SET estado = $1 WHERE id = $2 RETURNING id, titulo, estado', [estado, id]);
  if (!rows[0]) throw new ErrorHttp(404, 'La oferta no existe');
  res.json(rows[0]);
}));

module.exports = router;
