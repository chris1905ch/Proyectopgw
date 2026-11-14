// Error con código HTTP para respuestas controladas
class ErrorHttp extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

// Envuelve controladores async para que los errores lleguen al manejador central
const asincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function noEncontrado(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

function manejador(err, req, res, next) {
  if (err instanceof ErrorHttp) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { ErrorHttp, asincrono, noEncontrado, manejador };
