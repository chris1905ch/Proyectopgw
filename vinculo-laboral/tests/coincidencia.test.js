// Pruebas de la comparación "¿Qué me falta para esta oferta?". No usan base de datos.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluar, dividirRequisitos } = require('../src/coincidencia');

const perfil = {
  resumen: 'Estudiante de Ingeniería en Desarrollo de Software con experiencia en soporte técnico.',
  habilidades: 'Soporte técnico, atención a usuarios, instalación de Windows',
  ubicacion: 'Santa Ana',
};

describe('Coincidencia de requisitos con el perfil', () => {
  it('CO-01 Separa los requisitos por punto, punto y coma y salto de línea', () => {
    assert.deepEqual(dividirRequisitos('Bachillerato. Licencia liviana; Excel\n- Buen trato'),
      ['Bachillerato', 'Licencia liviana', 'Excel', 'Buen trato']);
  });
  it('CO-02 Marca lo que coincide, ignorando acentos y mayúsculas', () => {
    const r = evaluar('Técnico o estudiante de Ingeniería en Sistemas.', { resumen: 'TECNICO, estudiante de ingenieria' });
    assert.equal(r.total, 1);
    assert.equal(r.requisitos[0].cumple, true);
  });
  it('CO-03 Lo que falta se marca y se sugiere un artículo de Recursos cuando hay uno sobre el tema', () => {
    const r = evaluar('Manejo de Excel intermedio.', perfil);
    assert.equal(r.requisitos[0].cumple, false);
    assert.equal(r.requisitos[0].articulo.id, 'habilidades-digitales');
    assert.equal(r.cumplidos, 0);
  });
  it('CO-04 Si no hay artículo para el tema, no se inventa uno', () => {
    const r = evaluar('Licencia de conducir liviana.', perfil);
    assert.equal(r.requisitos[0].cumple, false);
    assert.equal(r.requisitos[0].articulo, null);
  });
  it('CO-05 Las habilidades escritas en el perfil cuentan como coincidencia', () => {
    const r = evaluar('Manejo de Excel intermedio.', { ...perfil, habilidades: 'Excel, Word' });
    assert.equal(r.requisitos[0].cumple, true);
    assert.equal(r.consejo, null);
  });
  it('CO-06 Cuenta cuántos requisitos se cumplen y avisa cuando el perfil está vacío', () => {
    const r = evaluar('Estudiante de Ingeniería en Sistemas. Conocimientos de redes.', perfil);
    assert.equal(r.total, 2);
    assert.equal(r.cumplidos, 1);
    assert.ok(r.consejo);
    assert.equal(evaluar('Excel avanzado.', { resumen: null, habilidades: null }).perfil_vacio, true);
  });
});
