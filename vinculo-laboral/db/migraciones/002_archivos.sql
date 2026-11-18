-- Currículum (PDF) y foto de perfil de los candidatos. Se puede ejecutar varias veces: npm run db:migrar
CREATE TABLE IF NOT EXISTS candidato_archivos (
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(4) NOT NULL CHECK (tipo IN ('cv', 'foto')),
  nombre VARCHAR(120) NOT NULL,
  mime VARCHAR(40) NOT NULL,
  datos BYTEA NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, tipo)
);
