const express = require('express');
const db = require('../db');
const { ErrorHttp, asincrono } = require('../middleware/errors');
const { idParam, DEPARTAMENTOS, TIPOS_CONTRATO, MODALIDADES, NIVELES } = require('../middleware/validar');
const { sesionOpcional, requiereSesion, requiereRol } = require('../middleware/auth');

const router = express.Router();
const POR_PAGINA = 10;

router.get('/catalogos', (req, res) => {
  res.json({ departamentos: DEPARTAMENTOS, tipos: TIPOS_CONTRATO, modalidades: MODALIDADES, niveles: NIVELES });
});

// Cifras de la página de inicio
router.get('/resumen', asincrono(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*) FROM empresas WHERE verificacion = 'verificada')::int AS empresas,
      (SELECT count(*) FROM usuarios WHERE rol = 'candidato' AND estado = 'activo')::int AS candidatos,
      (SELECT count(*) FROM ofertas WHERE estado = 'activa' AND fecha_cierre >= current_date)::int AS ofertas,
      (SELECT count(*) FROM postulaciones)::int AS postulaciones`);
  res.json(rows[0]);
}));

// Búsqueda de ofertas con filtros
router.get('/ofertas', asincrono(async (req, res) => {
  const { q, departamento, tipo, modalidad, experiencia, salario_min } = req.query;
  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const cond = [`o.estado = 'activa'`, 'o.fecha_cierre >= current_date'];
  const params = [];
  const agregar = (sql, valor) => { params.push(valor); cond.push(sql.replace('?', `$${params.length}`)); };

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    cond.push(`(o.titulo ILIKE $${params.length} OR o.descripcion ILIKE $${params.length} OR e.razon_social ILIKE $${params.length})`);
  }
  if (departamento) agregar('o.departamento = ?', departamento);
  if (tipo) agregar('o.tipo_contrato = ?', tipo);
  if (modalidad) agregar('o.modalidad = ?', modalidad);
  if (experiencia) agregar('o.nivel_experiencia = ?', experiencia);
  if (salario_min && Number(salario_min) > 0) agregar('(o.mostrar_salario AND o.salario_max >= ?)', Number(salario_min));

  const where = cond.join(' AND ');
  const total = (await db.query(
    `SELECT count(*)::int AS n FROM ofertas o JOIN empresas e ON e.id = o.empresa_id WHERE ${where}`, params)).rows[0].n;
  params.push(POR_PAGINA, (pagina - 1) * POR_PAGINA);
  const { rows } = await db.query(
    `SELECT o.id, o.titulo, o.departamento, o.tipo_contrato, o.modalidad, o.nivel_experiencia, o.creado_en,
            CASE WHEN o.mostrar_salario THEN o.salario_min END AS salario_min,
            CASE WHEN o.mostrar_salario THEN o.salario_max END AS salario_max,
            e.razon_social AS empresa
       FROM ofertas o JOIN empresas e ON e.id = o.empresa_id
      WHERE ${where} ORDER BY o.creado_en DESC, o.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ datos: rows, total, pagina, paginas: Math.max(Math.ceil(total / POR_PAGINA), 1) });
}));

// Detalle de una oferta
router.get('/ofertas/:id', sesionOpcional, asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query(
    `SELECT o.*, e.razon_social AS empresa, e.sector, e.sitio_web, e.descripcion AS empresa_descripcion,
            e.departamento AS empresa_departamento, e.usuario_id AS propietario_id, u.correo AS contacto_correo, u.telefono AS contacto_telefono
       FROM ofertas o JOIN empresas e ON e.id = o.empresa_id JOIN usuarios u ON u.id = e.usuario_id
      WHERE o.id = $1`, [id]);
  const o = rows[0];
  if (!o) throw new ErrorHttp(404, 'La oferta no existe');

  const esDueno = req.usuario && req.usuario.id === o.propietario_id;
  const esAdmin = req.usuario && req.usuario.rol === 'admin';
  const visible = o.estado === 'activa' && new Date(o.fecha_cierre) >= new Date(new Date().toDateString());
  if (!visible && !esDueno && !esAdmin) throw new ErrorHttp(404, 'La oferta no está disponible');

  if (!o.mostrar_salario) { o.salario_min = null; o.salario_max = null; }
  delete o.propietario_id;
  o.ya_postulado = false;
  if (req.usuario && req.usuario.rol === 'candidato') {
    const p = await db.query(`SELECT estado FROM postulaciones WHERE oferta_id = $1 AND candidato_id = $2`, [id, req.usuario.id]);
    o.ya_postulado = !!p.rows[0] && p.rows[0].estado !== 'retirada';
    o.estado_postulacion = p.rows[0] ? p.rows[0].estado : null;
  }
  res.json(o);
}));

// Aplicar a una oferta
router.post('/ofertas/:id/postular', requiereSesion, requiereRol('candidato'), asincrono(async (req, res) => {
  const id = idParam(req.params.id);
  const mensaje = typeof req.body.mensaje === 'string' ? req.body.mensaje.trim().slice(0, 1000) : null;
  const o = (await db.query(`SELECT estado, fecha_cierre FROM ofertas WHERE id = $1`, [id])).rows[0];
  if (!o) throw new ErrorHttp(404, 'La oferta no existe');
  if (o.estado !== 'activa' || new Date(o.fecha_cierre) < new Date(new Date().toDateString())) {
    throw new ErrorHttp(409, 'Esta oferta ya no recibe postulaciones');
  }
  const previa = (await db.query(`SELECT id, estado FROM postulaciones WHERE oferta_id = $1 AND candidato_id = $2`, [id, req.usuario.id])).rows[0];
  if (previa && previa.estado !== 'retirada') throw new ErrorHttp(409, 'Ya se postuló a esta oferta');
  let fila;
  if (previa) {
    fila = (await db.query(`UPDATE postulaciones SET estado = 'enviada', mensaje = $1, actualizado_en = now() WHERE id = $2 RETURNING *`, [mensaje, previa.id])).rows[0];
  } else {
    fila = (await db.query(`INSERT INTO postulaciones (oferta_id, candidato_id, mensaje) VALUES ($1,$2,$3) RETURNING *`, [id, req.usuario.id, mensaje])).rows[0];
  }
  res.status(201).json(fila);
}));

module.exports = router;
