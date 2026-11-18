const express = require('express');
const db = require('../db');
const { ErrorHttp, asincrono } = require('../middleware/errors');
const { Validador, idParam, DEPARTAMENTOS, TIPOS_CONTRATO, MODALIDADES, NIVELES } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const postulaciones = require('../postulaciones');

const router = express.Router();
router.use(requiereSesion, requiereRol('empresa'));

const MAX_ACTIVAS = 20;
const VIGENCIA_DEFECTO = 45;
const VIGENCIA_MAXIMA = 90;

// Carga la empresa asociada a la sesión
router.use(asincrono(async (req, res, next) => {
  const { rows } = await db.query('SELECT * FROM empresas WHERE usuario_id = $1', [req.usuario.id]);
  if (!rows[0]) throw new ErrorHttp(403, 'La cuenta no tiene una empresa asociada');
  req.empresa = rows[0];
  next();
}));

const sumarDias = (dias) => {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return f.toISOString().slice(0, 10);
};

function validarOferta(body) {
  const v = new Validador(body);
  const datos = {
    titulo: v.requerido('titulo', 'El título', { max: 80 }),
    descripcion: v.requerido('descripcion', 'La descripción', { max: 4000 }),
    requisitos: v.requerido('requisitos', 'Los requisitos', { max: 4000 }),
    beneficios: v.opcional('beneficios', 'Los beneficios', { max: 4000 }),
    departamento: v.uno('departamento', 'El departamento', DEPARTAMENTOS),
    tipo_contrato: v.uno('tipo_contrato', 'El tipo de contrato', TIPOS_CONTRATO),
    modalidad: v.uno('modalidad', 'La modalidad', MODALIDADES),
    nivel_experiencia: v.uno('nivel_experiencia', 'El nivel de experiencia', NIVELES),
    salario_min: v.numeroOpcional('salario_min', 'El salario mínimo'),
    salario_max: v.numeroOpcional('salario_max', 'El salario máximo'),
    mostrar_salario: body.mostrar_salario !== false,
  };
  if (datos.salario_min !== null && datos.salario_max !== null && datos.salario_max < datos.salario_min) {
    v.falla('salario_max', 'El salario máximo no puede ser menor que el mínimo');
  }
  let cierre = typeof body.fecha_cierre === 'string' && body.fecha_cierre ? body.fecha_cierre : sumarDias(VIGENCIA_DEFECTO);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cierre) || Number.isNaN(Date.parse(cierre))) {
    v.falla('fecha_cierre', 'La fecha de cierre no es válida');
  } else if (cierre < sumarDias(0)) {
    v.falla('fecha_cierre', 'La fecha de cierre debe ser hoy o posterior');
  } else if (cierre > sumarDias(VIGENCIA_MAXIMA)) {
    v.falla('fecha_cierre', `La vigencia máxima de una oferta es de ${VIGENCIA_MAXIMA} días`);
  }
  datos.fecha_cierre = cierre;
  v.listo();
  return datos;
}

async function ofertaPropia(req) {
  const id = idParam(req.params.id);
  const { rows } = await db.query('SELECT * FROM ofertas WHERE id = $1 AND empresa_id = $2', [id, req.empresa.id]);
  if (!rows[0]) throw new ErrorHttp(404, 'La oferta no existe');
  return rows[0];
}

router.get('/perfil', (req, res) => res.json(req.empresa));

router.put('/perfil', asincrono(async (req, res) => {
  const v = new Validador(req.body);
  const sector = v.requerido('sector', 'El sector', { max: 60 });
  const departamento = v.uno('departamento', 'El departamento', DEPARTAMENTOS);
  const web = v.opcional('sitio_web', 'El sitio web', { max: 120 });
  const descripcion = v.opcional('descripcion', 'La descripción', { max: 2000 });
  v.listo();
  const { rows } = await db.query(
    `UPDATE empresas SET sector=$1, departamento=$2, sitio_web=$3, descripcion=$4 WHERE id=$5 RETURNING *`,
    [sector, departamento, web, descripcion, req.empresa.id]);
  res.json(rows[0]);
}));

// Dashboard de empresas
router.get('/dashboard', asincrono(async (req, res) => {
  const eid = req.empresa.id;
  const ofertas = await db.query(`SELECT estado, count(*)::int AS n FROM ofertas WHERE empresa_id = $1 GROUP BY estado`, [eid]);
  const ofertasPorEstado = { pendiente: 0, activa: 0, inactiva: 0, cancelada: 0 };
  ofertas.rows.forEach((f) => { ofertasPorEstado[f.estado] = f.n; });

  const post = await db.query(
    `SELECT p.estado, count(*)::int AS n FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id
      WHERE o.empresa_id = $1 GROUP BY p.estado`, [eid]);
  const postulacionesPorEstado = { enviada: 0, en_revision: 0, aceptada: 0, rechazada: 0, retirada: 0 };
  post.rows.forEach((f) => { postulacionesPorEstado[f.estado] = f.n; });

  const porOferta = (await db.query(
    `SELECT o.id, o.titulo, o.estado, count(p.id)::int AS postulaciones
       FROM ofertas o LEFT JOIN postulaciones p ON p.oferta_id = o.id AND p.estado <> 'retirada'
      WHERE o.empresa_id = $1 GROUP BY o.id ORDER BY postulaciones DESC, o.creado_en DESC LIMIT 6`, [eid])).rows;

  res.json({ verificacion: req.empresa.verificacion, ofertasPorEstado, postulacionesPorEstado, porOferta });
}));

router.get('/ofertas', asincrono(async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.id, o.titulo, o.estado, o.departamento, o.tipo_contrato, o.fecha_cierre, o.creado_en,
            count(p.id) FILTER (WHERE p.estado <> 'retirada')::int AS postulaciones,
            count(p.id) FILTER (WHERE p.estado = 'enviada')::int AS sin_revisar
       FROM ofertas o LEFT JOIN postulaciones p ON p.oferta_id = o.id
      WHERE o.empresa_id = $1 GROUP BY o.id ORDER BY o.creado_en DESC`, [req.empresa.id]);
  res.json(rows);
}));

// Empresa crea oferta de empleo
router.post('/ofertas', asincrono(async (req, res) => {
  const d = validarOferta(req.body);
  const abiertas = (await db.query(
    `SELECT count(*)::int AS n FROM ofertas WHERE empresa_id = $1 AND estado IN ('activa','pendiente')`, [req.empresa.id])).rows[0].n;
  if (abiertas >= MAX_ACTIVAS) throw new ErrorHttp(409, `Alcanzó el máximo de ${MAX_ACTIVAS} ofertas abiertas`);
  // Una empresa sin verificar puede crear ofertas, pero quedan pendientes de aprobación
  const estado = req.empresa.verificacion === 'verificada' ? 'activa' : 'pendiente';
  const { rows } = await db.query(
    `INSERT INTO ofertas (empresa_id, titulo, descripcion, requisitos, beneficios, departamento, tipo_contrato, modalidad,
                          nivel_experiencia, salario_min, salario_max, mostrar_salario, estado, fecha_cierre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.empresa.id, d.titulo, d.descripcion, d.requisitos, d.beneficios, d.departamento, d.tipo_contrato, d.modalidad,
      d.nivel_experiencia, d.salario_min, d.salario_max, d.mostrar_salario, estado, d.fecha_cierre]);
  res.status(201).json(rows[0]);
}));

router.get('/ofertas/:id', asincrono(async (req, res) => res.json(await ofertaPropia(req))));

router.put('/ofertas/:id', asincrono(async (req, res) => {
  const actual = await ofertaPropia(req);
  if (actual.estado === 'cancelada') throw new ErrorHttp(409, 'Una oferta cancelada ya no se puede editar');
  const d = validarOferta(req.body);
  const { rows } = await db.query(
    `UPDATE ofertas SET titulo=$1, descripcion=$2, requisitos=$3, beneficios=$4, departamento=$5, tipo_contrato=$6,
            modalidad=$7, nivel_experiencia=$8, salario_min=$9, salario_max=$10, mostrar_salario=$11, fecha_cierre=$12
      WHERE id=$13 RETURNING *`,
    [d.titulo, d.descripcion, d.requisitos, d.beneficios, d.departamento, d.tipo_contrato, d.modalidad, d.nivel_experiencia,
      d.salario_min, d.salario_max, d.mostrar_salario, d.fecha_cierre, actual.id]);
  res.json(rows[0]);
}));

// Inactivar, reactivar o cancelar una oferta
router.patch('/ofertas/:id/estado', asincrono(async (req, res) => {
  const actual = await ofertaPropia(req);
  const nuevo = req.body.estado;
  if (!['activa', 'inactiva', 'cancelada'].includes(nuevo)) throw new ErrorHttp(400, 'Estado no válido');
  if (actual.estado === 'cancelada') throw new ErrorHttp(409, 'Una oferta cancelada no se puede reabrir');
  if (nuevo === 'activa') {
    if (req.empresa.verificacion !== 'verificada') throw new ErrorHttp(409, 'La empresa aún no ha sido verificada por administración');
    if (new Date(actual.fecha_cierre) < new Date(new Date().toDateString())) {
      throw new ErrorHttp(409, 'La fecha de cierre ya pasó. Edite la oferta para ampliar la vigencia');
    }
  }
  const { rows } = await db.query('UPDATE ofertas SET estado = $1 WHERE id = $2 RETURNING *', [nuevo, actual.id]);
  res.json(rows[0]);
}));

// Eliminar una oferta (también elimina sus postulaciones)
router.delete('/ofertas/:id', asincrono(async (req, res) => {
  const actual = await ofertaPropia(req);
  await db.query('DELETE FROM ofertas WHERE id = $1', [actual.id]);
  res.status(204).end();
}));

// Empresa ve aplicantes de una oferta
router.get('/ofertas/:id/postulaciones', asincrono(async (req, res) => {
  const oferta = await ofertaPropia(req);
  const { rows } = await db.query(
    `SELECT p.id, p.estado, p.mensaje, p.creado_en, u.nombre, u.apellidos, u.correo, u.telefono, u.ubicacion, u.resumen
       FROM postulaciones p JOIN usuarios u ON u.id = p.candidato_id
      WHERE p.oferta_id = $1 AND p.estado <> 'retirada' ORDER BY p.creado_en DESC`, [oferta.id]);
  res.json({ oferta: { id: oferta.id, titulo: oferta.titulo, estado: oferta.estado }, postulaciones: rows });
}));

// Empresa acepta o deniega a un aplicante
router.patch('/postulaciones/:id', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const nuevo = req.body.estado;
  if (!['en_revision', 'aceptada', 'rechazada'].includes(nuevo)) throw new ErrorHttp(400, 'Estado no válido');
  const p = (await db.query(
    `SELECT p.* FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id
      WHERE p.id = $1 AND o.empresa_id = $2`, [id, req.empresa.id])).rows[0];
  if (!p) throw new ErrorHttp(404, 'La postulación no existe');
  if (p.estado === 'retirada') throw new ErrorHttp(409, 'El candidato retiró esta postulación');
  if (p.estado === nuevo) return res.json(p); // sin cambio, no se registra en el historial
  res.json(await postulaciones.cambiarEstado(id, nuevo));
}));

module.exports = router;
