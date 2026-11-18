// Operaciones sobre postulaciones que dejan registro en postulacion_historial.
// Cada función hace el cambio y la fila del historial en una sola sentencia, así nunca quedan desacompañados.
const db = require('./db');

// Cuántas postulaciones se necesitan para mostrar el tiempo de respuesta de una empresa
const MUESTRA_MINIMA = 3;

async function crear(ofertaId, candidatoId, mensaje) {
  const { rows } = await db.query(
    `WITH nueva AS (
       INSERT INTO postulaciones (oferta_id, candidato_id, mensaje) VALUES ($1, $2, $3) RETURNING *
     ), huella AS (
       INSERT INTO postulacion_historial (postulacion_id, estado) SELECT id, estado FROM nueva
     )
     SELECT * FROM nueva`, [ofertaId, candidatoId, mensaje]);
  return rows[0];
}

// El candidato vuelve a postularse después de haber retirado la postulación
async function reenviar(id, mensaje) {
  const { rows } = await db.query(
    `WITH cambio AS (
       UPDATE postulaciones SET estado = 'enviada', mensaje = $1, actualizado_en = now() WHERE id = $2 RETURNING *
     ), huella AS (
       INSERT INTO postulacion_historial (postulacion_id, estado) SELECT id, estado FROM cambio
     )
     SELECT * FROM cambio`, [mensaje, id]);
  return rows[0];
}

async function cambiarEstado(id, estado) {
  const { rows } = await db.query(
    `WITH cambio AS (
       UPDATE postulaciones SET estado = $1, actualizado_en = now() WHERE id = $2 RETURNING *
     ), huella AS (
       INSERT INTO postulacion_historial (postulacion_id, estado) SELECT id, estado FROM cambio
     )
     SELECT * FROM cambio`, [estado, id]);
  return rows[0];
}

// Cuánto tarda una empresa en dar su primera respuesta (revisar, aceptar o rechazar) y a cuántas responde.
// Una postulación retirada sin respuesta no cuenta: la empresa no tuvo oportunidad de contestar.
async function tiempoRespuesta(empresaId) {
  const { rows } = await db.query(
    `WITH base AS (
       SELECT p.estado, p.creado_en,
              (SELECT min(h.creado_en) FROM postulacion_historial h
                WHERE h.postulacion_id = p.id AND h.estado IN ('en_revision', 'aceptada', 'rechazada')) AS primera_respuesta
         FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id
        WHERE o.empresa_id = $1
     )
     SELECT count(*) FILTER (WHERE primera_respuesta IS NOT NULL OR estado <> 'retirada')::int AS total,
            count(primera_respuesta)::int AS respondidas,
            round(avg(extract(epoch FROM (primera_respuesta - creado_en)) / 86400)::numeric, 1)::float8 AS dias_promedio
       FROM base`, [empresaId]);
  const { total, respondidas, dias_promedio } = rows[0];
  if (total < MUESTRA_MINIMA) return { suficiente: false, total };
  return {
    suficiente: true,
    total,
    respondidas,
    porcentaje: Math.round((respondidas / total) * 100),
    dias_promedio: respondidas ? dias_promedio : null,
  };
}

module.exports = { crear, reenviar, cambiarEstado, tiempoRespuesta, MUESTRA_MINIMA };
