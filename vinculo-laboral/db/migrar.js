// Aplica las migraciones de db/migraciones sin borrar datos.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

async function main() {
  const carpeta = path.join(__dirname, 'migraciones');
  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    await db.query(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    console.log('Aplicada:', archivo);
  }
  await db.pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
