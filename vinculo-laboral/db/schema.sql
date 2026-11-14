-- Vínculo Laboral: esquema de base de datos (PostgreSQL)
DROP TABLE IF EXISTS postulaciones, ofertas, empresas, usuarios CASCADE;

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellidos VARCHAR(80) NOT NULL,
  correo VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol VARCHAR(12) NOT NULL CHECK (rol IN ('candidato', 'empresa', 'admin')),
  telefono VARCHAR(9),
  ubicacion VARCHAR(40),
  resumen TEXT,
  estado VARCHAR(12) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE empresas (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  razon_social VARCHAR(120) NOT NULL,
  nit VARCHAR(14) NOT NULL UNIQUE,
  sector VARCHAR(60) NOT NULL,
  departamento VARCHAR(40) NOT NULL,
  sitio_web VARCHAR(120),
  descripcion TEXT,
  verificacion VARCHAR(12) NOT NULL DEFAULT 'pendiente' CHECK (verificacion IN ('pendiente', 'verificada', 'rechazada')),
  motivo_rechazo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ofertas (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  requisitos TEXT NOT NULL,
  beneficios TEXT,
  departamento VARCHAR(40) NOT NULL,
  tipo_contrato VARCHAR(20) NOT NULL,
  modalidad VARCHAR(20) NOT NULL,
  nivel_experiencia VARCHAR(20) NOT NULL,
  salario_min NUMERIC(10,2),
  salario_max NUMERIC(10,2),
  mostrar_salario BOOLEAN NOT NULL DEFAULT TRUE,
  estado VARCHAR(12) NOT NULL DEFAULT 'activa' CHECK (estado IN ('pendiente', 'activa', 'inactiva', 'cancelada')),
  fecha_cierre DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ofertas_estado ON ofertas(estado, creado_en DESC);
CREATE INDEX idx_ofertas_empresa ON ofertas(empresa_id);

CREATE TABLE postulaciones (
  id SERIAL PRIMARY KEY,
  oferta_id INT NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  candidato_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensaje TEXT,
  estado VARCHAR(12) NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada', 'en_revision', 'aceptada', 'rechazada', 'retirada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, candidato_id)
);
CREATE INDEX idx_postulaciones_candidato ON postulaciones(candidato_id);
