// Crea las tablas y, con --seed, carga datos de demostración.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function crearEsquema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
}

const dias = (n) => {
  const f = new Date();
  f.setDate(f.getDate() + n);
  return f.toISOString().slice(0, 10);
};

async function cargarDatos() {
  const hash = await bcrypt.hash('Clave12345', 10);
  const usuario = async (nombre, apellidos, correo, rol, telefono, ubicacion, resumen, habilidades = null) =>
    (await db.query(
      `INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, telefono, ubicacion, resumen, habilidades)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [nombre, apellidos, correo, hash, rol, telefono, ubicacion, resumen, habilidades])).rows[0].id;

  await usuario('Administración', 'Vínculo Laboral', 'admin@vinculolaboral.sv', 'admin', null, null, null);

  const empresas = [
    ['Marta', 'Quintanilla', 'rrhh@distcuscatlan.sv', 'Distribuidora Cuscatlán S.A. de C.V.', '06141203891011', 'Comercio', 'Santa Ana', 'distcuscatlan.sv', 'Distribución de productos de consumo masivo en la zona occidental.', 'verificada'],
    ['Ricardo', 'Alvarado', 'talento@clinicasantalucia.sv', 'Clínica Santa Lucía', '02101504771023', 'Salud', 'San Salvador', 'clinicasantalucia.sv', 'Clínica privada con consulta externa y laboratorio.', 'verificada'],
    ['Elena', 'Mejía', 'empleo@textilesdelnorte.sv', 'Textiles del Norte S.A.', '05121106881014', 'Manufactura', 'Chalatenango', null, 'Confección de prendas para exportación.', 'pendiente'],
  ];
  const ids = [];
  for (const e of empresas) {
    const uid = await usuario(e[0], e[1], e[2], 'empresa', '2440-0000', null, null);
    const r = await db.query(
      `INSERT INTO empresas (usuario_id, razon_social, nit, sector, departamento, sitio_web, descripcion, verificacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [uid, e[3], e[4], e[5], e[6], e[7], e[8], e[9]]);
    ids.push(r.rows[0].id);
  }

  const oferta = (e, t, d, r, b, dep, tc, mod, niv, smin, smax, estado, cierre) =>
    db.query(
      `INSERT INTO ofertas (empresa_id, titulo, descripcion, requisitos, beneficios, departamento, tipo_contrato, modalidad,
                            nivel_experiencia, salario_min, salario_max, estado, fecha_cierre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [ids[e], t, d, r, b, dep, tc, mod, niv, smin, smax, estado, cierre]);

  await oferta(0, 'Auxiliar contable', 'Registro de operaciones diarias, conciliaciones bancarias y apoyo en el cierre mensual.', 'Estudiante de último año o egresado de Contaduría Pública. Manejo de Excel intermedio.', 'Prestaciones de ley, seguro médico y capacitación.', 'Santa Ana', 'Permanente', 'Presencial', '1 a 3 años', 520, 600, 'activa', dias(40));
  await oferta(0, 'Vendedor de ruta', 'Atención de clientes en ruta asignada, toma de pedidos y cobro.', 'Licencia de conducir liviana. Bachillerato.', 'Comisiones y combustible.', 'Santa Ana', 'Permanente', 'Presencial', 'Sin experiencia', 450, 700, 'activa', dias(30));
  await oferta(1, 'Técnico de soporte informático', 'Mantenimiento de equipos, atención a usuarios internos y administración de impresoras.', 'Técnico o estudiante de Ingeniería en Sistemas. Conocimientos de redes básicas.', 'Seguro médico y horario fijo.', 'San Salvador', 'Permanente', 'Presencial', '1 a 3 años', 600, 750, 'activa', dias(35));
  await oferta(1, 'Recepcionista', 'Atención al paciente, manejo de agenda y facturación.', 'Bachillerato. Buena presentación y trato al público.', 'Prestaciones de ley.', 'San Salvador', 'Temporal', 'Presencial', 'Sin experiencia', 400, 450, 'activa', dias(20));
  await oferta(2, 'Auxiliar de bodega', 'Recepción y despacho de materia prima.', 'Bachillerato. Disponibilidad de horario.', null, 'Chalatenango', 'Por obra', 'Presencial', 'Sin experiencia', 400, 450, 'pendiente', dias(45));

  const c1 = await usuario('Daniela', 'Ortiz', 'daniela.ortiz@correo.sv', 'candidato', '7000-1122', 'Santa Ana', 'Estudiante de Ingeniería en Desarrollo de Software con experiencia en soporte técnico.', 'Soporte técnico, atención a usuarios, instalación de Windows');
  await usuario('Mauricio', 'Flores', 'mauricio.flores@correo.sv', 'candidato', null, 'San Salvador', null);
  const o1 = (await db.query(`SELECT id FROM ofertas WHERE titulo = 'Técnico de soporte informático'`)).rows[0].id;
  const p1 = (await db.query(`INSERT INTO postulaciones (oferta_id, candidato_id, mensaje) VALUES ($1,$2,$3) RETURNING id`, [o1, c1, 'Me interesa la plaza; cuento con disponibilidad inmediata.'])).rows[0].id;
  await db.query(`INSERT INTO postulacion_historial (postulacion_id, estado) VALUES ($1, 'enviada')`, [p1]);
}

// Datos extra solo para probar a mano: postulaciones con fechas pasadas para que se vean el tiempo de respuesta
// de las empresas y las líneas de tiempo. No se cargan en las pruebas automáticas.
async function cargarDemoExtra() {
  const hash = await bcrypt.hash('Clave12345', 10);
  const candidato = async (nombre, apellidos, correo, ubicacion) =>
    (await db.query(
      `INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, ubicacion) VALUES ($1,$2,$3,$4,'candidato',$5) RETURNING id`,
      [nombre, apellidos, correo, hash, ubicacion])).rows[0].id;
  const oferta = async (titulo) => (await db.query('SELECT id FROM ofertas WHERE titulo = $1', [titulo])).rows[0].id;
  const daniela = (await db.query(`SELECT id FROM usuarios WHERE correo = 'daniela.ortiz@correo.sv'`)).rows[0].id;

  // pasos: [estado, días atrás]; la postulación toma el primero como fecha de envío y el último como estado actual
  const postulacion = async (ofertaId, candidatoId, pasos) => {
    const ago = (d) => new Date(Date.now() - d * 86400000);
    const ultimo = pasos[pasos.length - 1];
    const id = (await db.query(
      `INSERT INTO postulaciones (oferta_id, candidato_id, estado, creado_en, actualizado_en) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [ofertaId, candidatoId, ultimo[0], ago(pasos[0][1]), ago(ultimo[1])])).rows[0].id;
    for (const [estado, dias] of pasos) {
      await db.query('INSERT INTO postulacion_historial (postulacion_id, estado, creado_en) VALUES ($1,$2,$3)', [id, estado, ago(dias)]);
    }
  };

  const soporte = await oferta('Técnico de soporte informático');
  const recepcion = await oferta('Recepcionista');
  const ruta = await oferta('Vendedor de ruta');

  const karla = await candidato('Karla', 'Menjívar', 'karla.menjivar@correo.sv', 'San Salvador');
  const luis = await candidato('Luis', 'Henríquez', 'luis.henriquez@correo.sv', 'La Libertad');
  const sofia = await candidato('Sofía', 'Ayala', 'sofia.ayala@correo.sv', 'San Salvador');
  const hugo = await candidato('Hugo', 'Cardoza', 'hugo.cardoza@correo.sv', 'Cuscatlán');

  // Clínica Santa Lucía: responde a 3 de 5, en 2 días en promedio (2, 3 y 1)
  await postulacion(soporte, karla, [['enviada', 10], ['en_revision', 8], ['aceptada', 5]]);
  await postulacion(soporte, luis, [['enviada', 9], ['rechazada', 6]]);
  await postulacion(recepcion, sofia, [['enviada', 12], ['en_revision', 11]]);
  await postulacion(recepcion, hugo, [['enviada', 7]]);

  // Distribuidora Cuscatlán: Daniela tiene un recorrido completo
  await postulacion(ruta, daniela, [['enviada', 6], ['en_revision', 4], ['aceptada', 1]]);
}

async function main() {
  await crearEsquema();
  console.log('Tablas creadas.');
  if (process.argv.includes('--seed')) {
    await cargarDatos();
    await cargarDemoExtra();
    console.log('Datos de demostración cargados.');
    console.log('Administrador: admin@vinculolaboral.sv  /  Clave12345');
    console.log('Empresa:       rrhh@distcuscatlan.sv  /  Clave12345');
    console.log('Candidato:     daniela.ortiz@correo.sv  /  Clave12345');
  }
  await db.pool.end();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { crearEsquema, cargarDatos, cargarDemoExtra };
