const express = require('express');
const db = require('../db');
const { ErrorHttp, asincrono } = require('../middleware/errors');
const { Validador, idParam, DEPARTAMENTOS } = require('../middleware/validar');
const { requiereSesion, requiereRol } = require('../middleware/auth');
const postulaciones = require('../postulaciones');
const { evaluar } = require('../coincidencia');

const router = express.Router();
router.use(requiereSesion, requiereRol('candidato'));

router.get('/perfil', asincrono(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, nombre, apellidos, correo, telefono, ubicacion, resumen, habilidades FROM usuarios WHERE id = $1', [req.usuario.id]);
  res.json(rows[0]);
}));

router.put('/perfil', asincrono(async (req, res) => {
  const v = new Validador(req.body);
  const nombre = v.requerido('nombre', 'El nombre', { max: 80 });
  const apellidos = v.requerido('apellidos', 'Los apellidos', { max: 80 });
  const telefono = v.telefono();
  const ubicacion = req.body.ubicacion ? v.uno('ubicacion', 'El departamento', DEPARTAMENTOS) : null;
  const resumen = v.opcional('resumen', 'El resumen', { max: 1500 });
  const habilidades = v.opcional('habilidades', 'Las habilidades', { max: 1000 });
  v.listo();
  const { rows } = await db.query(
    `UPDATE usuarios SET nombre=$1, apellidos=$2, telefono=$3, ubicacion=$4, resumen=$5, habilidades=$6 WHERE id=$7
     RETURNING id, nombre, apellidos, correo, telefono, ubicacion, resumen, habilidades`,
    [nombre, apellidos, telefono, ubicacion, resumen, habilidades, req.usuario.id]);
  res.json(rows[0]);
}));

router.get('/postulaciones', asincrono(async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.id, p.estado, p.creado_en, p.actualizado_en, o.id AS oferta_id, o.titulo, o.estado AS estado_oferta,
            e.razon_social AS empresa, o.departamento,
            (SELECT coalesce(json_agg(json_build_object('estado', h.estado, 'fecha', h.creado_en) ORDER BY h.creado_en, h.id), '[]'::json)
               FROM postulacion_historial h WHERE h.postulacion_id = p.id) AS historial
       FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id JOIN empresas e ON e.id = o.empresa_id
      WHERE p.candidato_id = $1 ORDER BY p.creado_en DESC`, [req.usuario.id]);
  res.json(rows);
}));

router.patch('/postulaciones/:id/retirar', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const p = (await db.query('SELECT estado FROM postulaciones WHERE id = $1 AND candidato_id = $2', [id, req.usuario.id])).rows[0];
  if (!p) throw new ErrorHttp(404, 'La postulación no existe');
  if (!['enviada', 'en_revision'].includes(p.estado)) {
    throw new ErrorHttp(409, 'Solo se pueden retirar postulaciones que aún no tienen una decisión');
  }
  res.json(await postulaciones.cambiarEstado(id, 'retirada'));
}));

// ¿Qué me falta para esta oferta? Compara los requisitos con el perfil y sugiere artículos de Recursos
router.get('/ofertas/:id/coincidencia', asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const o = (await db.query(
    `SELECT requisitos FROM ofertas WHERE id = $1 AND estado = 'activa' AND fecha_cierre >= current_date`, [id])).rows[0];
  if (!o) throw new ErrorHttp(404, 'La oferta no está disponible');
  const perfil = (await db.query('SELECT resumen, habilidades, ubicacion FROM usuarios WHERE id = $1', [req.usuario.id])).rows[0];
  res.json(evaluar(o.requisitos, perfil));
}));

// Dashboard del usuario
router.get('/dashboard', asincrono(async (req, res) => {
  const uid = req.usuario.id;
  const conteo = await db.query(`SELECT estado, count(*)::int AS n FROM postulaciones WHERE candidato_id = $1 GROUP BY estado`, [uid]);
  const porEstado = { enviada: 0, en_revision: 0, aceptada: 0, rechazada: 0, retirada: 0 };
  conteo.rows.forEach((f) => { porEstado[f.estado] = f.n; });
  const total = Object.values(porEstado).reduce((a, b) => a + b, 0);

  const u = (await db.query('SELECT telefono, ubicacion, resumen FROM usuarios WHERE id = $1', [uid])).rows[0];
  const campos = [u.telefono, u.ubicacion, u.resumen];
  const completitud = Math.round(((1 + campos.filter(Boolean).length) / 4) * 100);

  const recientes = (await db.query(
    `SELECT p.id, p.estado, p.creado_en, o.id AS oferta_id, o.titulo, e.razon_social AS empresa
       FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id JOIN empresas e ON e.id = o.empresa_id
      WHERE p.candidato_id = $1 ORDER BY p.creado_en DESC LIMIT 5`, [uid])).rows;
  res.json({ total, porEstado, completitud, recientes });
}));

module.exports = router;
