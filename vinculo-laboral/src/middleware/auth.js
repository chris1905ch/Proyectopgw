const jwt = require('jsonwebtoken');
const { ErrorHttp } = require('./errors');

const secreto = () => process.env.JWT_SECRET || 'secreto-de-desarrollo';

function firmar(usuario) {
  return jwt.sign({ id: usuario.id, rol: usuario.rol }, secreto(), { expiresIn: '8h' });
}

function leerToken(req) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(cabecera.slice(7), secreto());
  } catch (e) {
    return null;
  }
}

// Exige sesión iniciada
function requiereSesion(req, res, next) {
  const datos = leerToken(req);
  if (!datos) return next(new ErrorHttp(401, 'Debe iniciar sesión para continuar'));
  req.usuario = datos;
  next();
}

// Sesión opcional: rellena req.usuario si hay token válido
function sesionOpcional(req, res, next) {
  req.usuario = leerToken(req);
  next();
}

// Exige uno de los roles indicados
const requiereRol = (...roles) => (req, res, next) => {
  if (!req.usuario) return next(new ErrorHttp(401, 'Debe iniciar sesión para continuar'));
  if (!roles.includes(req.usuario.rol)) return next(new ErrorHttp(403, 'No tiene permiso para esta acción'));
  next();
};

module.exports = { firmar, requiereSesion, sesionOpcional, requiereRol };
