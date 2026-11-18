// "¿Qué me falta para esta oferta?": compara los requisitos de una oferta con el perfil del candidato.
// Es una comparación por palabras clave, simple y explicable; no pretende entender el texto.
const ARTICULOS = require('../public/js/articulos');

const UMBRAL = 0.5; // proporción de palabras clave del requisito que deben aparecer en el perfil

const PALABRAS_VACIAS = new Set(`de del la las el los un una unos unas y o u e en con para por a al que se su sus lo
  como mas menos sin ser tener tiene contar debe deber dispuesto buena bueno buenas buenos excelente muy otra otro
  tambien ademas cada todo toda`.split(/\s+/));

// Palabras que aparecen en casi todos los requisitos y no dicen qué se pide
const PALABRAS_GENERICAS = new Set(`conocimiento conocimientos manejo experiencia habilidad habilidades capacidad nivel
  intermedio intermedia avanzado avanzada basico basica basicos basicas minimo minima deseable indispensable
  requerido requerida persona ano anos ultimo ultima`.split(/\s+/));

const sinAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Raíz aproximada: con los primeros 5 caracteres "sistema" y "sistemas" coinciden
const raiz = (palabra) => { const p = sinAcentos(palabra.toLowerCase()); return p.length > 5 ? p.slice(0, 5) : p; };

const palabras = (texto) => String(texto || '').toLowerCase().split(/[^\p{L}\p{N}+#]+/u)
  .filter((p) => p.length >= 3 || /[+#]/.test(p));

// Cada línea, punto o punto y coma de los requisitos es un requisito distinto
function dividirRequisitos(texto) {
  return String(texto || '')
    .split(/\r?\n|;|(?<=[.!?])\s+/)
    .map((t) => t.replace(/^[\s\-•*·\d.)]+/, '').replace(/[.\s]+$/, '').trim())
    .filter((t) => t.length >= 3);
}

function palabrasClave(requisito) {
  const todas = palabras(requisito).filter((p) => !PALABRAS_VACIAS.has(sinAcentos(p)));
  const utiles = todas.filter((p) => !PALABRAS_GENERICAS.has(sinAcentos(p)));
  return utiles.length ? utiles : todas;
}

function sugerirArticulo(clave) {
  const raices = new Set(clave.map(raiz));
  const a = ARTICULOS.find((art) => (art.temas || []).some((t) => palabras(t).every((p) => raices.has(raiz(p)))));
  return a ? { id: a.id, titulo: a.titulo } : null;
}

function evaluar(textoRequisitos, perfil) {
  const textoPerfil = [perfil.resumen, perfil.habilidades, perfil.ubicacion].filter(Boolean).join(' ');
  const enPerfil = new Set(palabras(textoPerfil).map(raiz));

  const requisitos = dividirRequisitos(textoRequisitos).map((texto) => {
    const clave = palabrasClave(texto);
    if (!clave.length) return null;
    const halladas = clave.filter((p) => enPerfil.has(raiz(p)));
    const cumple = halladas.length / clave.length >= UMBRAL;
    return {
      texto,
      cumple,
      coincidencias: halladas,
      articulo: cumple ? null : sugerirArticulo(clave),
    };
  }).filter(Boolean);

  const cumplidos = requisitos.filter((r) => r.cumple).length;
  const faltan = requisitos.length - cumplidos;
  const guia = ARTICULOS.find((a) => a.id === 'resumen-profesional');
  return {
    total: requisitos.length,
    cumplidos,
    perfil_vacio: enPerfil.size === 0,
    // Si falta algo, puede que la persona lo tenga y no lo haya escrito: se le sugiere cómo redactar el resumen
    consejo: faltan && guia ? { id: guia.id, titulo: guia.titulo } : null,
    requisitos,
  };
}

module.exports = { evaluar, dividirRequisitos, palabrasClave, UMBRAL };
