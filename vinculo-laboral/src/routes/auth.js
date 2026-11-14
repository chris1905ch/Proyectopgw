const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ErrorHttp, asincrono } = require('../middleware/errors');
const { Validador, DEPARTAMENTOS } = require('../middleware/validar');
const { firmar, requiereSesion } = require('../middleware/auth');

const router = express.Router();
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

const publico = (u) => ({ id: u.id, nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, rol: u.rol });

// Crear usuario (candidato)
router.post('/registro/candidato', asincrono(async (req, res) => {
  const v = new Validador(req.body);
  const nombre = v.requerido('nombre', 'El nombre', { max: 80 });
  const apellidos = v.requerido('apellidos', 'Los apellidos', { max: 80 });
  const correo = v.correo();
  const password = v.password();
  const telefono = v.telefono();
  const ubicacion = req.body.ubicacion ? v.uno('ubicacion', 'El departamento', DEPARTAMENTOS) : null;
  v.listo();

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, telefono, ubicacion)
     VALUES ($1,$2,$3,$4,'candidato',$5,$6) RETURNING *`,
    [nombre, apellidos, correo, hash, telefono, ubicacion]);
  res.status(201).json({ token: firmar(rows[0]), usuario: publico(rows[0]) });
}));

// Crear empresa: crea la cuenta de acceso y el registro de la empresa en una sola transacción
router.post('/registro/empresa', asincrono(async (req, res) => {
  const v = new Validador(req.body);
  const nombre = v.requerido('nombre', 'El nombre del contacto', { max: 80 });
  const apellidos = v.requerido('apellidos', 'Los apellidos del contacto', { max: 80 });
  const correo = v.correo();
  const password = v.password();
  const telefono = v.telefono();
  const razon = v.requerido('razon_social', 'La razón social', { max: 120 });
  const nit = v.nit();
  const sector = v.requerido('sector', 'El sector', { max: 60 });
  const departamento = v.uno('departamento', 'El departamento', DEPARTAMENTOS);
  const web = v.opcional('sitio_web', 'El sitio web', { max: 120 });
  const descripcion = v.opcional('descripcion', 'La descripción', { max: 2000 });
  v.listo();

  const hash = await bcrypt.hash(password, 10);
  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    const u = await cliente.query(
      `INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, telefono)
       VALUES ($1,$2,$3,$4,'empresa',$5) RETURNING *`, [nombre, apellidos, correo, hash, telefono]);
    await cliente.query(
      `INSERT INTO empresas (usuario_id, razon_social, nit, sector, departamento, sitio_web, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [u.rows[0].id, razon, nit, sector, departamento, web, descripcion]);
    await cliente.query('COMMIT');
    res.status(201).json({ token: firmar(u.rows[0]), usuario: publico(u.rows[0]) });
  } catch (e) {
    await cliente.query('ROLLBACK');
    if (e.code === '23505') {
      const campo = /nit/.test(e.constraint || '') ? 'El NIT' : 'El correo';
      throw new ErrorHttp(409, `${campo} ya está registrado`);
    }
    throw e;
  } finally {
    cliente.release();
  }
}));

router.post('/login', asincrono(async (req, res) => {
  const v = new Validador(req.body);
  const correo = v.correo();
  v.listo();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const { rows } = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
  const u = rows[0];
  const invalido = new ErrorHttp(401, 'Correo o contraseña incorrectos');
  if (!u) throw invalido;

  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
    throw new ErrorHttp(429, `Cuenta bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${MINUTOS_BLOQUEO} minutos`);
  }
  const correcto = await bcrypt.compare(password, u.password_hash);
  if (!correcto) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await db.query(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = now() + interval '${MINUTOS_BLOQUEO} minutes' WHERE id = $1`, [u.id]);
    } else {
      await db.query('UPDATE usuarios SET intentos_fallidos = $1 WHERE id = $2', [intentos, u.id]);
    }
    throw invalido;
  }
  if (u.estado === 'suspendido') throw new ErrorHttp(403, 'Su cuenta está suspendida. Comuníquese con administración');
  await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [u.id]);
  res.json({ token: firmar(u), usuario: publico(u) });
}));

router.get('/yo', requiereSesion, asincrono(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0]) throw new ErrorHttp(401, 'La sesión ya no es válida');
  const u = rows[0];
  const salida = { ...publico(u), telefono: u.telefono, ubicacion: u.ubicacion };
  if (u.rol === 'empresa') {
    const e = await db.query('SELECT id, razon_social, verificacion FROM empresas WHERE usuario_id = $1', [u.id]);
    salida.empresa = e.rows[0] || null;
  }
  res.json(salida);
}));

module.exports = router;
