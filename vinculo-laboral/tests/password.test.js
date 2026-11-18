// Pruebas del cambio de contraseña. Usan la misma base de datos de pruebas que api.test.js.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://vinculo:vinculo123@localhost:5432/vinculo_laboral_test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { crearEsquema, cargarDatos } = require('../db/init');

const CLAVE = 'Clave12345';
const NUEVA = 'otraClave987';
const con = (token) => ({ Authorization: 'Bearer ' + token });

let token;

before(async () => {
  await crearEsquema();
  await cargarDatos();
  const r = await request(app).post('/api/auth/login').send({ correo: 'daniela.ortiz@correo.sv', password: CLAVE });
  token = r.body.token;
});
after(async () => { await db.pool.end(); });

describe('Cambiar contraseña', () => {
  it('PF-43 Cambia la contraseña con la actual correcta y la anterior deja de servir', async () => {
    const r = await request(app).put('/api/auth/password').set(con(token)).send({ actual: CLAVE, nueva: NUEVA });
    assert.equal(r.status, 200);
    const vieja = await request(app).post('/api/auth/login').send({ correo: 'daniela.ortiz@correo.sv', password: CLAVE });
    assert.equal(vieja.status, 401);
    const nueva = await request(app).post('/api/auth/login').send({ correo: 'daniela.ortiz@correo.sv', password: NUEVA });
    assert.equal(nueva.status, 200);
    token = nueva.body.token;
  });
  it('PF-44 Rechaza el cambio si la contraseña actual es incorrecta', async () => {
    const r = await request(app).put('/api/auth/password').set(con(token)).send({ actual: 'equivocada1', nueva: 'unaClaveNueva1' });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalles.actual);
  });
  it('PF-45 Valida que la nueva tenga 8 caracteres y sea distinta de la actual', async () => {
    const corta = await request(app).put('/api/auth/password').set(con(token)).send({ actual: NUEVA, nueva: '123' });
    assert.equal(corta.status, 400);
    assert.ok(corta.body.detalles.nueva);
    const igual = await request(app).put('/api/auth/password').set(con(token)).send({ actual: NUEVA, nueva: NUEVA });
    assert.equal(igual.status, 400);
    assert.ok(igual.body.detalles.nueva);
  });
  it('PF-46 Exige haber iniciado sesión', async () => {
    const r = await request(app).put('/api/auth/password').send({ actual: NUEVA, nueva: 'unaClaveNueva1' });
    assert.equal(r.status, 401);
  });
});
