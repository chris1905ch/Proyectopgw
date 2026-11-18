-- Migración para bases de datos que ya existen (no borra datos).
-- Se puede ejecutar varias veces: npm run db:migrar

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS habilidades TEXT;

CREATE TABLE IF NOT EXISTS postulacion_historial (
  id SERIAL PRIMARY KEY,
  postulacion_id INT NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
  estado VARCHAR(12) NOT NULL CHECK (estado IN ('enviada', 'en_revision', 'aceptada', 'rechazada', 'retirada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historial_postulacion ON postulacion_historial(postulacion_id, creado_en);

-- Reconstruye lo que se pueda de las postulaciones anteriores:
-- 1) el envío, con la fecha de creación
INSERT INTO postulacion_historial (postulacion_id, estado, creado_en)
SELECT p.id, 'enviada', p.creado_en
  FROM postulaciones p
 WHERE NOT EXISTS (SELECT 1 FROM postulacion_historial h WHERE h.postulacion_id = p.id);

-- 2) el estado actual, con la fecha de la última actualización
--    (solo si la postulación tiene únicamente la fila de envío; los pasos intermedios no se guardaban)
INSERT INTO postulacion_historial (postulacion_id, estado, creado_en)
SELECT p.id, p.estado, p.actualizado_en
  FROM postulaciones p
 WHERE p.estado <> 'enviada'
   AND (SELECT count(*) FROM postulacion_historial h WHERE h.postulacion_id = p.id) = 1;
