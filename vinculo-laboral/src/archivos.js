const express = require('express');
const db = require('./db');
const { ErrorHttp } = require('./middleware/errors');

const LIMITES = { cv: 3 * 1024 * 1024, foto: 2 * 1024 * 1024 };

// El tipo real se decide por los primeros bytes del archivo, no por lo que diga el navegador
function detectar(buf) {
  if (buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

const PERMITIDOS = { cv: ['application/pdf'], foto: ['image/jpeg', 'image/png', 'image/webp'] };
const MENSAJES = { cv: 'El currículum debe ser un archivo PDF', foto: 'La foto debe ser una imagen JPG, PNG o WEBP' };
const NOMBRES = { cv: 'curriculum', foto: 'foto' };

// El archivo viaja como cuerpo binario de la solicitud (sin librerías extra); el nombre va en la cabecera X-Nombre-Archivo
const cuerpoBinario = (tipo) => express.raw({ type: () => true, limit: LIMITES[tipo] });

function nombreSeguro(req, tipo, mime) {
  let n = '';
  try { n = decodeURIComponent(req.headers['x-nombre-archivo'] || ''); } catch (e) { n = ''; }
  n = n.replace(/[\\/\r\n"]/g, '').trim().slice(0, 100);
  return n || NOMBRES[tipo] + (mime === 'application/pdf' ? '.pdf' : '.jpg');
}

async function guardar(req, res, tipo) {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) throw new ErrorHttp(400, 'No se recibió ningún archivo');
  const mime = detectar(buf);
  if (!mime || !PERMITIDOS[tipo].includes(mime)) throw new ErrorHttp(400, MENSAJES[tipo]);
  const nombre = nombreSeguro(req, tipo, mime);
  await db.query(
    `INSERT INTO candidato_archivos (usuario_id, tipo, nombre, mime, datos) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (usuario_id, tipo) DO UPDATE SET nombre = $3, mime = $4, datos = $5, actualizado_en = now()`,
    [req.usuario.id, tipo, nombre, mime, buf]);
  res.json({ nombre, tamano: buf.length });
}

async function enviar(res, usuarioId, tipo, { descargar = false } = {}) {
  const { rows } = await db.query('SELECT nombre, mime, datos FROM candidato_archivos WHERE usuario_id = $1 AND tipo = $2', [usuarioId, tipo]);
  if (!rows[0]) throw new ErrorHttp(404, tipo === 'cv' ? 'No hay currículum cargado' : 'No hay foto cargada');
  const a = rows[0];
  res.set({
    'Content-Type': a.mime,
    'Content-Length': a.datos.length,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.end(a.datos);
}

async function quitar(req, res, tipo) {
  await db.query('DELETE FROM candidato_archivos WHERE usuario_id = $1 AND tipo = $2', [req.usuario.id, tipo]);
  res.status(204).end();
}

async function info(usuarioId) {
  const { rows } = await db.query(
    'SELECT tipo, nombre, octet_length(datos)::int AS tamano, actualizado_en FROM candidato_archivos WHERE usuario_id = $1', [usuarioId]);
  const r = { cv: null, foto: null };
  rows.forEach((f) => { r[f.tipo] = { nombre: f.nombre, tamano: f.tamano, actualizado_en: f.actualizado_en }; });
  return r;
}

module.exports = { cuerpoBinario, guardar, enviar, quitar, info, detectar };
