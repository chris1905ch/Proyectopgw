const { ErrorHttp } = require('./errors');

const reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEPARTAMENTOS = ['Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán',
  'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután'];
const TIPOS_CONTRATO = ['Permanente', 'Temporal', 'Por obra', 'Pasantía'];
const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido'];
const NIVELES = ['Sin experiencia', '1 a 3 años', 'Más de 3 años'];

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// Cada regla agrega un mensaje por campo; al final lanza un solo error 400 con el detalle
class Validador {
  constructor(datos) {
    this.d = datos || {};
    this.errores = {};
  }
  requerido(campo, etiqueta, { max = 255, min = 1 } = {}) {
    const v = texto(this.d[campo]);
    if (v.length < min) this.errores[campo] = `${etiqueta} es obligatorio`;
    else if (v.length > max) this.errores[campo] = `${etiqueta} no puede superar ${max} caracteres`;
    return v;
  }
  opcional(campo, etiqueta, { max = 255 } = {}) {
    const v = texto(this.d[campo]);
    if (v.length > max) this.errores[campo] = `${etiqueta} no puede superar ${max} caracteres`;
    return v || null;
  }
  correo(campo = 'correo') {
    const v = texto(this.d[campo]).toLowerCase();
    if (!reCorreo.test(v)) this.errores[campo] = 'Ingrese un correo electrónico válido';
    return v;
  }
  password(campo = 'password') {
    const v = typeof this.d[campo] === 'string' ? this.d[campo] : '';
    if (v.length < 8) this.errores[campo] = 'La contraseña debe tener al menos 8 caracteres';
    return v;
  }
  telefono(campo = 'telefono') {
    const v = texto(this.d[campo]);
    if (!v) return null;
    if (!/^\d{4}-?\d{4}$/.test(v)) this.errores[campo] = 'El teléfono debe tener 8 dígitos (0000-0000)';
    return v.replace(/^(\d{4})-?(\d{4})$/, '$1-$2');
  }
  nit(campo = 'nit') {
    const v = texto(this.d[campo]).replace(/-/g, '');
    if (!/^\d{14}$/.test(v)) this.errores[campo] = 'El NIT debe tener 14 dígitos';
    return v;
  }
  uno(campo, etiqueta, lista) {
    const v = texto(this.d[campo]);
    if (!lista.includes(v)) this.errores[campo] = `${etiqueta} no es válido`;
    return v;
  }
  numeroOpcional(campo, etiqueta) {
    const crudo = this.d[campo];
    if (crudo === undefined || crudo === null || crudo === '') return null;
    const n = Number(crudo);
    if (!Number.isFinite(n) || n < 0) {
      this.errores[campo] = `${etiqueta} debe ser un número positivo`;
      return null;
    }
    return n;
  }
  falla(campo, mensaje) {
    this.errores[campo] = mensaje;
  }
  listo() {
    if (Object.keys(this.errores).length) {
      throw new ErrorHttp(400, 'Revise los datos ingresados', this.errores);
    }
  }
}

const idParam = (valor) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new ErrorHttp(400, 'Identificador no válido');
  return n;
};

module.exports = { Validador, idParam, DEPARTAMENTOS, TIPOS_CONTRATO, MODALIDADES, NIVELES };
