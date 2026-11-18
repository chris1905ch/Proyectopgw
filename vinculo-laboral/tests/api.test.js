// Pruebas funcionales y de integración de la API.
// Usan una base de datos aparte (vinculo_laboral_test) que se recrea en cada ejecución.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://vinculo:vinculo123@localhost:5432/vinculo_laboral_test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { crearEsquema, cargarDatos } = require('../db/init');

const CLAVE = 'Clave12345';
const manana = () => { const f = new Date(); f.setDate(f.getDate() + 1); return f.toISOString().slice(0, 10); };
const enDias = (n) => { const f = new Date(); f.setDate(f.getDate() + n); return f.toISOString().slice(0, 10); };

async function entrar(correo, password = CLAVE) {
  const r = await request(app).post('/api/auth/login').send({ correo, password });
  assert.equal(r.status, 200, 'no se pudo iniciar sesión con ' + correo);
  return r.body.token;
}
const con = (token) => ({ Authorization: 'Bearer ' + token });

const ofertaValida = (extra = {}) => ({
  titulo: 'Analista de datos', descripcion: 'Preparar reportes semanales.', requisitos: 'Excel avanzado.',
  departamento: 'San Salvador', tipo_contrato: 'Permanente', modalidad: 'Híbrido', nivel_experiencia: '1 a 3 años',
  salario_min: 700, salario_max: 900, fecha_cierre: enDias(30), ...extra,
});

let admin, empresa, clinica, textiles, daniela, mauricio;

before(async () => {
  await crearEsquema();
  await cargarDatos();
  admin = await entrar('admin@vinculolaboral.sv');
  empresa = await entrar('rrhh@distcuscatlan.sv');
  clinica = await entrar('talento@clinicasantalucia.sv');
  textiles = await entrar('empleo@textilesdelnorte.sv');
  daniela = await entrar('daniela.ortiz@correo.sv');
  mauricio = await entrar('mauricio.flores@correo.sv');
});
after(async () => { await db.pool.end(); });

describe('Landing page', () => {
  it('PF-01 Muestra las cifras generales del portal', async () => {
    const r = await request(app).get('/api/publico/resumen');
    assert.equal(r.status, 200);
    assert.equal(r.body.empresas, 2);
    assert.equal(r.body.ofertas, 4);
  });
  it('PF-02 Sirve la página de inicio y las páginas de cada módulo', async () => {
    for (const ruta of ['/', '/empleos.html', '/ingreso.html', '/registro.html', '/candidato/panel.html', '/empresa/panel.html', '/admin/panel.html']) {
      const r = await request(app).get(ruta);
      assert.equal(r.status, 200, ruta);
      assert.match(r.headers['content-type'], /html/);
    }
  });
});

describe('Crear usuario', () => {
  it('PF-03 Registra un candidato con datos válidos', async () => {
    const r = await request(app).post('/api/auth/registro/candidato').send(
      { nombre: 'Sofía', apellidos: 'Reyes', correo: 'sofia.reyes@correo.sv', password: 'unaClave123', telefono: '71234567', ubicacion: 'Sonsonate' });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.rol, 'candidato');
    assert.ok(r.body.token);
  });
  it('PF-04 Rechaza un correo ya registrado', async () => {
    const r = await request(app).post('/api/auth/registro/candidato').send(
      { nombre: 'Otra', apellidos: 'Persona', correo: 'SOFIA.REYES@correo.sv', password: 'unaClave123' });
    assert.equal(r.status, 409);
  });
  it('PF-05 Valida correo, contraseña y teléfono', async () => {
    const r = await request(app).post('/api/auth/registro/candidato').send(
      { nombre: 'Ana', apellidos: 'López', correo: 'no-es-correo', password: '123', telefono: '12' });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.correo && r.body.detalles.password && r.body.detalles.telefono);
  });
});

describe('Crear empresa', () => {
  const datos = {
    nombre: 'Luis', apellidos: 'Pineda', correo: 'luis@ferreteriaelsol.sv', password: 'unaClave123', telefono: '2222-3333',
    razon_social: 'Ferretería El Sol', nit: '0614-150490-102-5', sector: 'Comercio', departamento: 'La Libertad',
  };
  it('PF-06 Registra una empresa en estado pendiente de verificación', async () => {
    const r = await request(app).post('/api/auth/registro/empresa').send(datos);
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.rol, 'empresa');
    const yo = await request(app).get('/api/auth/yo').set(con(r.body.token));
    assert.equal(yo.body.empresa.verificacion, 'pendiente');
  });
  it('PF-07 Rechaza un NIT con formato incorrecto', async () => {
    const r = await request(app).post('/api/auth/registro/empresa').send({ ...datos, correo: 'otro@correo.sv', nit: '123' });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.nit);
  });
  it('PF-08 Rechaza un NIT que ya pertenece a otra empresa y no deja usuarios a medias', async () => {
    const r = await request(app).post('/api/auth/registro/empresa').send({ ...datos, correo: 'nuevo@correo.sv' });
    assert.equal(r.status, 409);
    const huerfano = await db.query(`SELECT 1 FROM usuarios WHERE correo = 'nuevo@correo.sv'`);
    assert.equal(huerfano.rowCount, 0);
  });
});

describe('Inicio de sesión', () => {
  it('PF-09 Entra con credenciales correctas y rechaza las incorrectas', async () => {
    const bien = await request(app).post('/api/auth/login').send({ correo: 'daniela.ortiz@correo.sv', password: CLAVE });
    assert.equal(bien.status, 200);
    const mal = await request(app).post('/api/auth/login').send({ correo: 'daniela.ortiz@correo.sv', password: 'incorrecta1' });
    assert.equal(mal.status, 401);
  });
  it('PF-10 Bloquea la cuenta después de 5 intentos fallidos', async () => {
    await request(app).post('/api/auth/registro/candidato').send({ nombre: 'Prueba', apellidos: 'Bloqueo', correo: 'bloqueo@correo.sv', password: 'unaClave123' });
    let ultimo;
    for (let i = 0; i < 5; i++) ultimo = await request(app).post('/api/auth/login').send({ correo: 'bloqueo@correo.sv', password: 'mala-clave' });
    assert.equal(ultimo.status, 401);
    const bloqueada = await request(app).post('/api/auth/login').send({ correo: 'bloqueo@correo.sv', password: 'unaClave123' });
    assert.equal(bloqueada.status, 429);
  });
  it('PF-11 Protege las rutas privadas y separa los permisos por rol', async () => {
    assert.equal((await request(app).get('/api/candidato/dashboard')).status, 401);
    assert.equal((await request(app).get('/api/empresa/ofertas').set(con(daniela))).status, 403);
    assert.equal((await request(app).get('/api/admin/resumen').set(con(empresa))).status, 403);
    assert.equal((await request(app).get('/api/candidato/dashboard').set(con(empresa))).status, 403);
  });
});

describe('Empresa crea oferta de empleo', () => {
  it('PF-12 Publica una oferta y queda activa si la empresa está verificada', async () => {
    const r = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida());
    assert.equal(r.status, 201);
    assert.equal(r.body.estado, 'activa');
  });
  it('PF-13 Valida salarios, fechas y campos obligatorios', async () => {
    const a = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida({ salario_min: 900, salario_max: 700 }));
    assert.equal(a.status, 400);
    assert.ok(a.body.detalles.salario_max);
    const b = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida({ fecha_cierre: enDias(120) }));
    assert.ok(b.body.detalles.fecha_cierre);
    const c = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send({ titulo: '' });
    assert.equal(c.status, 400);
    assert.ok(c.body.detalles.titulo && c.body.detalles.descripcion);
  });
  it('PF-14 Una empresa sin verificar crea ofertas pendientes que no aparecen en la búsqueda', async () => {
    const r = await request(app).post('/api/empresa/ofertas').set(con(textiles)).send(ofertaValida({ titulo: 'Operario de corte' }));
    assert.equal(r.body.estado, 'pendiente');
    const lista = await request(app).get('/api/publico/ofertas?q=Operario');
    assert.equal(lista.body.total, 0);
  });
});

describe('Usuario busca empleos y ve el detalle', () => {
  it('PF-15 Busca por palabra clave y aplica filtros', async () => {
    const q = await request(app).get('/api/publico/ofertas?q=soporte');
    assert.equal(q.body.total, 1);
    const f = await request(app).get('/api/publico/ofertas?departamento=Santa Ana');
    assert.ok(f.body.datos.every((o) => o.departamento === 'Santa Ana'));
    const s = await request(app).get('/api/publico/ofertas?salario_min=650');
    assert.ok(s.body.datos.every((o) => Number(o.salario_max) >= 650));
    const vacio = await request(app).get('/api/publico/ofertas?q=astronauta');
    assert.equal(vacio.body.total, 0);
  });
  it('PF-16 Pagina los resultados de diez en diez', async () => {
    for (let i = 0; i < 12; i++) await request(app).post('/api/empresa/ofertas').set(con(clinica)).send(ofertaValida({ titulo: 'Enfermería turno ' + i }));
    const p1 = await request(app).get('/api/publico/ofertas?q=Enfermería');
    assert.equal(p1.body.datos.length, 10);
    assert.equal(p1.body.paginas, 2);
    const p2 = await request(app).get('/api/publico/ofertas?q=Enfermería&pagina=2');
    assert.equal(p2.body.datos.length, 2);
  });
  it('PF-17 Muestra el detalle completo y oculta el salario cuando la empresa lo pide', async () => {
    const r = await request(app).get('/api/publico/ofertas/1');
    assert.equal(r.status, 200);
    assert.equal(r.body.empresa, 'Distribuidora Cuscatlán S.A. de C.V.');
    assert.ok(r.body.requisitos);
    const nueva = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida({ titulo: 'Cajero', mostrar_salario: false }));
    const d = await request(app).get('/api/publico/ofertas/' + nueva.body.id);
    assert.equal(d.body.salario_min, null);
  });
  it('PF-18 Responde 404 para ofertas inexistentes o que no están publicadas', async () => {
    assert.equal((await request(app).get('/api/publico/ofertas/99999')).status, 404);
    assert.equal((await request(app).get('/api/publico/ofertas/5')).status, 404);
    assert.equal((await request(app).get('/api/publico/ofertas/abc')).status, 400);
  });
});

describe('Usuario aplica a empleo', () => {
  it('PF-19 El candidato se postula una sola vez por oferta', async () => {
    const r = await request(app).post('/api/publico/ofertas/1/postular').set(con(daniela)).send({ mensaje: 'Estoy interesada en la plaza.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.estado, 'enviada');
    const repetida = await request(app).post('/api/publico/ofertas/1/postular').set(con(daniela)).send({});
    assert.equal(repetida.status, 409);
  });
  it('PF-20 Solo un candidato con sesión puede postularse', async () => {
    assert.equal((await request(app).post('/api/publico/ofertas/1/postular').send({})).status, 401);
    assert.equal((await request(app).post('/api/publico/ofertas/1/postular').set(con(empresa)).send({})).status, 403);
  });
  it('PF-21 No permite postularse a una oferta que no está activa', async () => {
    const r = await request(app).post('/api/publico/ofertas/5/postular').set(con(mauricio)).send({});
    assert.equal(r.status, 409);
  });
  it('PF-22 El candidato puede retirar su postulación y volver a enviarla', async () => {
    await request(app).post('/api/publico/ofertas/2/postular').set(con(mauricio)).send({});
    const lista = await request(app).get('/api/candidato/postulaciones').set(con(mauricio));
    const id = lista.body[0].id;
    const retirada = await request(app).patch(`/api/candidato/postulaciones/${id}/retirar`).set(con(mauricio));
    assert.equal(retirada.body.estado, 'retirada');
    const otra = await request(app).post('/api/publico/ofertas/2/postular').set(con(mauricio)).send({});
    assert.equal(otra.status, 201);
  });
});

describe('Empresa ve aplicantes y los acepta o deniega', () => {
  it('PF-23 Lista los aplicantes de su oferta', async () => {
    const r = await request(app).get('/api/empresa/ofertas/1/postulaciones').set(con(empresa));
    assert.equal(r.status, 200);
    assert.equal(r.body.postulaciones.length, 1);
    assert.equal(r.body.postulaciones[0].nombre, 'Daniela');
  });
  it('PF-24 No puede ver aplicantes de la oferta de otra empresa', async () => {
    const r = await request(app).get('/api/empresa/ofertas/3/postulaciones').set(con(empresa));
    assert.equal(r.status, 404);
  });
  it('PF-25 Acepta y deniega aplicantes, y rechaza estados inválidos', async () => {
    const lista = await request(app).get('/api/empresa/ofertas/1/postulaciones').set(con(empresa));
    const id = lista.body.postulaciones[0].id;
    const ok = await request(app).patch('/api/empresa/postulaciones/' + id).set(con(empresa)).send({ estado: 'aceptada' });
    assert.equal(ok.body.estado, 'aceptada');
    const no = await request(app).patch('/api/empresa/postulaciones/' + id).set(con(empresa)).send({ estado: 'rechazada' });
    assert.equal(no.body.estado, 'rechazada');
    assert.equal((await request(app).patch('/api/empresa/postulaciones/' + id).set(con(empresa)).send({ estado: 'otro' })).status, 400);
    assert.equal((await request(app).patch('/api/empresa/postulaciones/' + id).set(con(clinica)).send({ estado: 'aceptada' })).status, 404);
  });
});

describe('Empresa inactiva, cancela o elimina ofertas', () => {
  let id;
  before(async () => {
    const r = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida({ titulo: 'Supervisor de bodega' }));
    id = r.body.id;
  });
  it('PF-26 Al inactivar una oferta deja de aparecer y de recibir postulaciones; se puede reactivar', async () => {
    await request(app).patch(`/api/empresa/ofertas/${id}/estado`).set(con(empresa)).send({ estado: 'inactiva' });
    assert.equal((await request(app).get('/api/publico/ofertas?q=Supervisor')).body.total, 0);
    assert.equal((await request(app).post(`/api/publico/ofertas/${id}/postular`).set(con(daniela)).send({})).status, 409);
    await request(app).patch(`/api/empresa/ofertas/${id}/estado`).set(con(empresa)).send({ estado: 'activa' });
    assert.equal((await request(app).get('/api/publico/ofertas?q=Supervisor')).body.total, 1);
  });
  it('PF-27 Una oferta cancelada no se puede reabrir ni editar', async () => {
    await request(app).patch(`/api/empresa/ofertas/${id}/estado`).set(con(empresa)).send({ estado: 'cancelada' });
    assert.equal((await request(app).patch(`/api/empresa/ofertas/${id}/estado`).set(con(empresa)).send({ estado: 'activa' })).status, 409);
    assert.equal((await request(app).put(`/api/empresa/ofertas/${id}`).set(con(empresa)).send(ofertaValida())).status, 409);
  });
  it('PF-28 Elimina una oferta junto con sus postulaciones', async () => {
    const nueva = await request(app).post('/api/empresa/ofertas').set(con(empresa)).send(ofertaValida({ titulo: 'Mensajero' }));
    await request(app).post(`/api/publico/ofertas/${nueva.body.id}/postular`).set(con(daniela)).send({});
    const del = await request(app).delete('/api/empresa/ofertas/' + nueva.body.id).set(con(empresa));
    assert.equal(del.status, 204);
    const restos = await db.query('SELECT 1 FROM postulaciones WHERE oferta_id = $1', [nueva.body.id]);
    assert.equal(restos.rowCount, 0);
    assert.equal((await request(app).delete('/api/empresa/ofertas/' + nueva.body.id).set(con(empresa))).status, 404);
  });
  it('PF-29 Edita los datos de una oferta propia', async () => {
    const r = await request(app).put('/api/empresa/ofertas/1').set(con(empresa)).send(ofertaValida({ titulo: 'Auxiliar contable senior' }));
    assert.equal(r.status, 200);
    assert.equal(r.body.titulo, 'Auxiliar contable senior');
  });
});

describe('Dashboards', () => {
  it('PF-30 Dashboard de empresas con ofertas y postulaciones', async () => {
    const r = await request(app).get('/api/empresa/dashboard').set(con(empresa));
    assert.equal(r.status, 200);
    assert.equal(r.body.verificacion, 'verificada');
    assert.ok(r.body.ofertasPorEstado.activa >= 1);
    assert.equal(r.body.postulacionesPorEstado.rechazada, 1);
    assert.ok(Array.isArray(r.body.porOferta));
  });
  it('PF-31 Dashboard de usuarios con postulaciones y perfil', async () => {
    const r = await request(app).get('/api/candidato/dashboard').set(con(daniela));
    assert.equal(r.status, 200);
    assert.ok(r.body.total >= 2);
    assert.equal(r.body.completitud, 100);
    const incompleto = await request(app).get('/api/candidato/dashboard').set(con(mauricio));
    assert.ok(incompleto.body.completitud < 100);
  });
  it('PF-32 El candidato actualiza su perfil', async () => {
    const r = await request(app).put('/api/candidato/perfil').set(con(mauricio))
      .send({ nombre: 'Mauricio', apellidos: 'Flores', telefono: '7000-9999', ubicacion: 'La Paz', resumen: 'Técnico en electricidad.' });
    assert.equal(r.status, 200);
    assert.equal((await request(app).get('/api/candidato/dashboard').set(con(mauricio))).body.completitud, 100);
  });
});

describe('Panel administrativo', () => {
  it('PF-33 Muestra el resumen del sistema y lista usuarios con filtros', async () => {
    const r = await request(app).get('/api/admin/resumen').set(con(admin));
    assert.equal(r.status, 200);
    assert.ok(r.body.empresas >= 3);
    const u = await request(app).get('/api/admin/usuarios?rol=candidato').set(con(admin));
    assert.ok(u.body.length >= 2 && u.body.every((x) => x.rol === 'candidato'));
  });
  it('PF-34 Suspende y reactiva a un usuario', async () => {
    const lista = await request(app).get('/api/admin/usuarios?q=mauricio').set(con(admin));
    const id = lista.body[0].id;
    await request(app).patch(`/api/admin/usuarios/${id}/estado`).set(con(admin)).send({ estado: 'suspendido' });
    const bloqueado = await request(app).post('/api/auth/login').send({ correo: 'mauricio.flores@correo.sv', password: CLAVE });
    assert.equal(bloqueado.status, 403);
    await request(app).patch(`/api/admin/usuarios/${id}/estado`).set(con(admin)).send({ estado: 'activo' });
    assert.equal((await request(app).post('/api/auth/login').send({ correo: 'mauricio.flores@correo.sv', password: CLAVE })).status, 200);
  });
  it('PF-35 No permite suspender a un administrador ni la propia cuenta', async () => {
    const r = await request(app).patch('/api/admin/usuarios/1/estado').set(con(admin)).send({ estado: 'suspendido' });
    assert.equal(r.status, 409);
  });
  it('PF-36 Verifica una empresa y activa sus ofertas pendientes', async () => {
    const empresas = await request(app).get('/api/admin/empresas?verificacion=pendiente').set(con(admin));
    const t = empresas.body.find((e) => e.razon_social.startsWith('Textiles'));
    const r = await request(app).patch(`/api/admin/empresas/${t.id}/verificacion`).set(con(admin)).send({ verificacion: 'verificada' });
    assert.equal(r.body.verificacion, 'verificada');
    assert.equal((await request(app).get('/api/publico/ofertas?q=Operario')).body.total, 1);
    assert.equal((await request(app).get('/api/publico/ofertas/5')).status, 200);
  });
  it('PF-37 Rechazar una empresa exige indicar el motivo', async () => {
    const ferreteria = (await request(app).get('/api/admin/empresas').set(con(admin))).body.find((e) => e.razon_social.startsWith('Ferretería'));
    assert.equal((await request(app).patch(`/api/admin/empresas/${ferreteria.id}/verificacion`).set(con(admin)).send({ verificacion: 'rechazada' })).status, 400);
    const r = await request(app).patch(`/api/admin/empresas/${ferreteria.id}/verificacion`).set(con(admin)).send({ verificacion: 'rechazada', motivo: 'El NIT no coincide con la razón social' });
    assert.equal(r.status, 200);
  });
  it('PF-38 El administrador da de baja una oferta', async () => {
    const r = await request(app).patch('/api/admin/ofertas/4/estado').set(con(admin)).send({ estado: 'inactiva' });
    assert.equal(r.body.estado, 'inactiva');
    assert.equal((await request(app).get('/api/publico/ofertas?q=Recepcionista')).body.total, 0);
  });
});

describe('Pruebas de integración', () => {
  it('PI-01 Recorrido completo: empresa nueva, verificación, oferta, postulación y decisión', async () => {
    const reg = await request(app).post('/api/auth/registro/empresa').send({
      nombre: 'Carmen', apellidos: 'Villalta', correo: 'carmen@lacteoslaesperanza.sv', password: 'unaClave123',
      razon_social: 'Lácteos La Esperanza', nit: '0210-020215-101-9', sector: 'Alimentos', departamento: 'Sonsonate' });
    const tokenEmpresa = reg.body.token;
    const oferta = await request(app).post('/api/empresa/ofertas').set(con(tokenEmpresa)).send(ofertaValida({ titulo: 'Ayudante de planta', departamento: 'Sonsonate' }));
    assert.equal(oferta.body.estado, 'pendiente');

    const emp = (await request(app).get('/api/admin/empresas?verificacion=pendiente').set(con(admin))).body.find((e) => e.razon_social.startsWith('Lácteos'));
    await request(app).patch(`/api/admin/empresas/${emp.id}/verificacion`).set(con(admin)).send({ verificacion: 'verificada' });

    const busqueda = await request(app).get('/api/publico/ofertas?q=Ayudante');
    assert.equal(busqueda.body.total, 1);

    const nuevo = await request(app).post('/api/auth/registro/candidato').send({ nombre: 'Iván', apellidos: 'Cruz', correo: 'ivan.cruz@correo.sv', password: 'unaClave123' });
    const post = await request(app).post(`/api/publico/ofertas/${oferta.body.id}/postular`).set(con(nuevo.body.token)).send({ mensaje: 'Disponible de inmediato.' });
    assert.equal(post.status, 201);

    const vistos = await request(app).get(`/api/empresa/ofertas/${oferta.body.id}/postulaciones`).set(con(tokenEmpresa));
    assert.equal(vistos.body.postulaciones[0].correo, 'ivan.cruz@correo.sv');
    await request(app).patch('/api/empresa/postulaciones/' + vistos.body.postulaciones[0].id).set(con(tokenEmpresa)).send({ estado: 'aceptada' });

    const dash = await request(app).get('/api/candidato/dashboard').set(con(nuevo.body.token));
    assert.equal(dash.body.porEstado.aceptada, 1);
    const dashEmpresa = await request(app).get('/api/empresa/dashboard').set(con(tokenEmpresa));
    assert.equal(dashEmpresa.body.postulacionesPorEstado.aceptada, 1);
  });
  it('PI-02 Al eliminar una oferta desaparece de las postulaciones del candidato y de los conteos', async () => {
    const o = await request(app).post('/api/empresa/ofertas').set(con(clinica)).send(ofertaValida({ titulo: 'Camillero' }));
    await request(app).post(`/api/publico/ofertas/${o.body.id}/postular`).set(con(daniela)).send({});
    const antes = (await request(app).get('/api/candidato/postulaciones').set(con(daniela))).body.length;
    await request(app).delete('/api/empresa/ofertas/' + o.body.id).set(con(clinica));
    const despues = (await request(app).get('/api/candidato/postulaciones').set(con(daniela))).body.length;
    assert.equal(despues, antes - 1);
  });
  it('PI-03 Cancelar una oferta conserva a sus aplicantes pero cierra nuevas postulaciones', async () => {
    const o = await request(app).post('/api/empresa/ofertas').set(con(clinica)).send(ofertaValida({ titulo: 'Auxiliar de laboratorio' }));
    await request(app).post(`/api/publico/ofertas/${o.body.id}/postular`).set(con(daniela)).send({});
    await request(app).patch(`/api/empresa/ofertas/${o.body.id}/estado`).set(con(clinica)).send({ estado: 'cancelada' });
    const aplicantes = await request(app).get(`/api/empresa/ofertas/${o.body.id}/postulaciones`).set(con(clinica));
    assert.equal(aplicantes.body.postulaciones.length, 1);
    assert.equal((await request(app).post(`/api/publico/ofertas/${o.body.id}/postular`).set(con(mauricio)).send({})).status, 409);
  });
  it('PI-04 Un usuario suspendido conserva su historial y el resumen administrativo lo refleja', async () => {
    const antes = (await request(app).get('/api/admin/resumen').set(con(admin))).body.suspendidos;
    const u = (await request(app).get('/api/admin/usuarios?q=daniela').set(con(admin))).body[0];
    await request(app).patch(`/api/admin/usuarios/${u.id}/estado`).set(con(admin)).send({ estado: 'suspendido' });
    const despues = (await request(app).get('/api/admin/resumen').set(con(admin))).body.suspendidos;
    assert.equal(despues, antes + 1);
    const historial = await db.query('SELECT count(*)::int AS n FROM postulaciones WHERE candidato_id = $1', [u.id]);
    assert.ok(historial.rows[0].n >= 1);
    await request(app).patch(`/api/admin/usuarios/${u.id}/estado`).set(con(admin)).send({ estado: 'activo' });
  });
});

describe('Exportar usuarios a CSV', () => {
  it('PF-39 El administrador descarga la lista de usuarios en CSV', async () => {
    const r = await request(app).get('/api/admin/usuarios/exportar').set(con(admin));
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/csv/);
    assert.match(r.headers['content-disposition'], /usuarios\.csv/);
    const lineas = r.text.replace(/^\ufeff/, '').trim().split('\r\n');
    assert.equal(lineas[0], 'id,nombre,apellidos,correo,rol,estado,creado_en');
    assert.ok(lineas.length > 5);
    assert.ok(r.text.includes('admin@vinculolaboral.sv'));
  });
  it('PF-40 La exportación respeta los filtros del listado', async () => {
    const r = await request(app).get('/api/admin/usuarios/exportar?rol=empresa').set(con(admin));
    assert.ok(r.text.includes('rrhh@distcuscatlan.sv'));
    assert.ok(!r.text.includes('daniela.ortiz@correo.sv'));
  });
  it('PF-41 Solo el administrador puede exportar', async () => {
    assert.equal((await request(app).get('/api/admin/usuarios/exportar')).status, 401);
    assert.equal((await request(app).get('/api/admin/usuarios/exportar').set(con(empresa))).status, 403);
  });
  it('PF-42 Escapa comas y comillas, y neutraliza fórmulas', async () => {
    await request(app).post('/api/auth/registro/candidato').send(
      { nombre: 'Ana "La" Pérez, Jr', apellidos: '=SUMA(1+1)', correo: 'csv.prueba@correo.sv', password: 'unaClave123' });
    const r = await request(app).get('/api/admin/usuarios/exportar?q=csv.prueba').set(con(admin));
    const fila = r.text.replace(/^\ufeff/, '').trim().split('\r\n')[1];
    assert.ok(fila.includes('"Ana ""La"" Pérez, Jr"'));
    assert.ok(fila.includes("'=SUMA(1+1)"));
  });
});

// ---- Línea de tiempo, tiempo de respuesta y "¿Qué me falta?" ----
// Usan una empresa propia, creada aquí, para no depender de los datos de las demás pruebas.
describe('Historial, tiempo de respuesta y coincidencia', () => {
  let tokenEmpresa, empresaId, ofertaId;
  const candidatos = [];

  const nuevoCandidato = async (n) => {
    const r = await request(app).post('/api/auth/registro/candidato').send(
      { nombre: 'Prueba' + n, apellidos: 'Historial', correo: `historial${n}@correo.sv`, password: 'unaClave123' });
    return r.body.token;
  };
  const postular = (token) => request(app).post(`/api/publico/ofertas/${ofertaId}/postular`).set(con(token)).send({});
  const misPostulaciones = async (token) => (await request(app).get('/api/candidato/postulaciones').set(con(token))).body;
  const idPostulacion = async (token) => (await misPostulaciones(token))[0].id;
  const decidir = (id, estado) => request(app).patch('/api/empresa/postulaciones/' + id).set(con(tokenEmpresa)).send({ estado });
  const estadosDe = (p) => p.historial.map((h) => h.estado);

  before(async () => {
    const reg = await request(app).post('/api/auth/registro/empresa').send({
      nombre: 'Rosa', apellidos: 'Cañas', correo: 'rosa@imprentaelfaro.sv', password: 'unaClave123',
      razon_social: 'Imprenta El Faro', nit: '0614-010101-101-1', sector: 'Servicios', departamento: 'San Miguel' });
    tokenEmpresa = reg.body.token;
    empresaId = (await request(app).get('/api/auth/yo').set(con(tokenEmpresa))).body.empresa.id;
    await request(app).patch(`/api/admin/empresas/${empresaId}/verificacion`).set(con(admin)).send({ verificacion: 'verificada' });
    ofertaId = (await request(app).post('/api/empresa/ofertas').set(con(tokenEmpresa)).send(ofertaValida({ titulo: 'Operario de imprenta' }))).body.id;
    for (let i = 1; i <= 4; i++) candidatos.push(await nuevoCandidato(i));
  });

  it('PF-43 Cada cambio de estado queda en el historial, en orden', async () => {
    assert.equal((await postular(candidatos[0])).status, 201);
    const id = await idPostulacion(candidatos[0]);
    assert.deepEqual(estadosDe((await misPostulaciones(candidatos[0]))[0]), ['enviada']);
    await decidir(id, 'en_revision');
    await decidir(id, 'aceptada');
    const p = (await misPostulaciones(candidatos[0]))[0];
    assert.deepEqual(estadosDe(p), ['enviada', 'en_revision', 'aceptada']);
    assert.ok(p.historial.every((h) => h.fecha));
  });
  it('PF-44 Repetir el mismo estado no duplica el registro', async () => {
    const id = await idPostulacion(candidatos[0]);
    const r = await decidir(id, 'aceptada');
    assert.equal(r.status, 200);
    assert.equal(estadosDe((await misPostulaciones(candidatos[0]))[0]).length, 3);
  });
  it('PF-45 Retirar y volver a postularse queda en el historial', async () => {
    await postular(candidatos[1]);
    const id = await idPostulacion(candidatos[1]);
    await request(app).patch(`/api/candidato/postulaciones/${id}/retirar`).set(con(candidatos[1]));
    await postular(candidatos[1]);
    assert.deepEqual(estadosDe((await misPostulaciones(candidatos[1]))[0]), ['enviada', 'retirada', 'enviada']);
  });
  it('PF-46 Con pocas postulaciones no se muestra el tiempo de respuesta', async () => {
    const r = await request(app).get('/api/publico/ofertas/' + ofertaId);
    assert.equal(r.body.respuesta_empresa.suficiente, false);
  });
  it('PF-47 Calcula el promedio de días y el porcentaje de postulaciones respondidas', async () => {
    await postular(candidatos[2]);
    await postular(candidatos[3]);
    const retirada = await idPostulacion(candidatos[3]);
    await request(app).patch(`/api/candidato/postulaciones/${retirada}/retirar`).set(con(candidatos[3]));
    // Candidato 0 (aceptada) respondió a los 2 días, candidato 2 a los 4, el 1 no ha tenido respuesta
    // y el 3 retiró sin respuesta (no cuenta, la empresa no tuvo oportunidad de contestar)
    const ajustar = async (token, diasEnvio, diasRespuesta) => {
      const id = await idPostulacion(token);
      await db.query(`UPDATE postulacion_historial SET creado_en = now() - make_interval(days => $1::int) WHERE postulacion_id = $2 AND estado = 'enviada'`, [diasEnvio, id]);
      await db.query(`UPDATE postulaciones SET creado_en = now() - make_interval(days => $1::int) WHERE id = $2`, [diasEnvio, id]);
      if (diasRespuesta !== null) {
        await db.query(`UPDATE postulacion_historial SET creado_en = now() - make_interval(days => $1::int) WHERE postulacion_id = $2 AND estado IN ('en_revision','aceptada','rechazada')`, [diasRespuesta, id]);
      }
    };
    await ajustar(candidatos[0], 10, 8);
    const id2 = await idPostulacion(candidatos[2]);
    await decidir(id2, 'rechazada');
    await ajustar(candidatos[2], 10, 6);

    const r = await request(app).get('/api/publico/ofertas/' + ofertaId);
    assert.deepEqual(r.body.respuesta_empresa, { suficiente: true, total: 3, respondidas: 2, porcentaje: 67, dias_promedio: 3 });
  });
  it('PF-48 El tiempo de respuesta es público y también aparece sin sesión', async () => {
    const r = await request(app).get('/api/publico/ofertas/1');
    assert.equal(r.status, 200);
    assert.ok('suficiente' in r.body.respuesta_empresa);
  });

  describe('¿Qué me falta para esta oferta?', () => {
    let oferta;
    before(async () => {
      oferta = (await request(app).post('/api/empresa/ofertas').set(con(tokenEmpresa)).send(
        ofertaValida({ titulo: 'Asistente administrativo', requisitos: 'Manejo de Excel intermedio.\nLicencia de conducir liviana.' }))).body.id;
    });
    const consultar = (token) => request(app).get(`/api/candidato/ofertas/${oferta}/coincidencia`).set(con(token));

    it('PF-49 Indica qué requisitos faltan y sugiere el artículo de Recursos', async () => {
      const r = await consultar(candidatos[0]);
      assert.equal(r.status, 200);
      assert.equal(r.body.total, 2);
      assert.equal(r.body.cumplidos, 0);
      assert.equal(r.body.perfil_vacio, true);
      const excel = r.body.requisitos.find((x) => /Excel/.test(x.texto));
      assert.equal(excel.articulo.id, 'habilidades-digitales');
    });
    it('PF-50 Las habilidades del perfil cuentan como coincidencia', async () => {
      const perfil = { nombre: 'Prueba1', apellidos: 'Historial', habilidades: 'Excel, Word' };
      assert.equal((await request(app).put('/api/candidato/perfil').set(con(candidatos[0])).send(perfil)).status, 200);
      const r = await consultar(candidatos[0]);
      assert.equal(r.body.cumplidos, 1);
      assert.equal(r.body.requisitos.find((x) => /Excel/.test(x.texto)).cumple, true);
    });
    it('PF-51 Solo los candidatos con sesión pueden consultarlo y la oferta debe estar disponible', async () => {
      assert.equal((await request(app).get(`/api/candidato/ofertas/${oferta}/coincidencia`)).status, 401);
      assert.equal((await consultar(tokenEmpresa)).status, 403);
      assert.equal((await request(app).get('/api/candidato/ofertas/99999/coincidencia').set(con(candidatos[0]))).status, 404);
    });
  });
});

describe('Currículum y foto de perfil', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const subir = (ruta, token, cuerpo, tipo) => request(app).put(ruta).set(con(token)).set('Content-Type', tipo).set('X-Nombre-Archivo', encodeURIComponent('Mi currículum.pdf')).send(cuerpo);

  it('PF-57 El candidato sube su currículum en PDF y lo vuelve a descargar igual', async () => {
    const r = await subir('/api/candidato/cv', daniela, pdf, 'application/pdf');
    assert.equal(r.status, 200);
    assert.equal(r.body.nombre, 'Mi currículum.pdf');
    const d = await request(app).get('/api/candidato/cv').set(con(daniela)).buffer(true).parse((res, cb) => { const t = []; res.on('data', (c) => t.push(c)); res.on('end', () => cb(null, Buffer.concat(t))); });
    assert.equal(d.status, 200);
    assert.match(d.headers['content-type'], /pdf/);
    assert.deepEqual(d.body, pdf);
    const info = await request(app).get('/api/candidato/archivos').set(con(daniela));
    assert.equal(info.body.cv.nombre, 'Mi currículum.pdf');
    assert.equal(info.body.foto, null);
  });
  it('PF-58 Rechaza un currículum que no es PDF aunque diga serlo', async () => {
    const r = await subir('/api/candidato/cv', daniela, Buffer.from('MZ esto es un ejecutable'), 'application/pdf');
    assert.equal(r.status, 400);
    assert.match(r.body.error, /PDF/);
    assert.equal((await subir('/api/candidato/cv', daniela, png, 'image/png')).status, 400);
  });
  it('PF-59 Rechaza archivos demasiado grandes', async () => {
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024 + 10)]);
    assert.equal((await subir('/api/candidato/cv', daniela, grande, 'application/pdf')).status, 413);
  });
  it('PF-60 Sube y elimina la foto de perfil, y solo acepta imágenes', async () => {
    assert.equal((await subir('/api/candidato/foto', daniela, png, 'image/png')).status, 200);
    assert.equal((await request(app).get('/api/candidato/foto').set(con(daniela))).status, 200);
    assert.equal((await subir('/api/candidato/foto', daniela, pdf, 'application/pdf')).status, 400);
    assert.equal((await request(app).delete('/api/candidato/foto').set(con(daniela))).status, 204);
    assert.equal((await request(app).get('/api/candidato/foto').set(con(daniela))).status, 404);
  });
  it('PF-61 Los archivos exigen sesión de candidato', async () => {
    assert.equal((await request(app).put('/api/candidato/cv').set('Content-Type', 'application/pdf').send(pdf)).status, 401);
    assert.equal((await subir('/api/candidato/cv', empresa, pdf, 'application/pdf')).status, 403);
  });
  it('PF-62 La empresa descarga el currículum solo de quienes se postularon a sus ofertas', async () => {
    const aplicantes = await request(app).get('/api/empresa/ofertas/3/postulaciones').set(con(clinica));
    assert.equal(aplicantes.status, 200);
    const p = aplicantes.body.postulaciones[0];
    assert.equal(p.tiene_cv, true);
    assert.equal((await request(app).get(`/api/empresa/postulaciones/${p.id}/cv`).set(con(clinica))).status, 200);
    assert.equal((await request(app).get(`/api/empresa/postulaciones/${p.id}/cv`).set(con(empresa))).status, 404);
    assert.equal((await request(app).get(`/api/empresa/postulaciones/${p.id}/foto`).set(con(clinica))).status, 404);
  });
});
