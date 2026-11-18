# Vínculo Laboral

Portal de búsqueda de empleo para El Salvador. Proyecto de segundo período de la materia Desarrollo de Páginas Web Activas, Facultad de Ingeniería y Arquitectura, UNICAES.

La aplicación tiene tres tipos de usuario: el candidato, que busca y aplica a ofertas; la empresa, que publica ofertas y decide sobre los aplicantes; y el administrador, que verifica empresas y controla las cuentas.

## Tecnologías

- Node.js y Express para el servidor y la API
- PostgreSQL como base de datos (librería `pg`)
- bcryptjs y jsonwebtoken para contraseñas y sesiones
- HTML, CSS y JavaScript sin frameworks en el cliente
- `node:test` y supertest para las pruebas

## Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior

## Instalación

1. Crear la base de datos (desde pgAdmin o desde `psql`):

   ```sql
   CREATE DATABASE vinculo_laboral;
   ```

2. Copiar `.env.example` como `.env` y ajustar el usuario, la contraseña y el puerto de PostgreSQL en `DATABASE_URL`.

3. Instalar las dependencias y cargar las tablas con los datos de demostración:

   ```bash
   npm install
   npm run db:seed
   ```

   Para crear solo las tablas, sin datos, se usa `npm run db:init`. Ambos comandos borran y recrean las tablas.

   Si ya tiene una base de datos con datos y quiere conservarlos, use `npm run db:migrar`: agrega la tabla `postulacion_historial`, la columna `habilidades` y la tabla `candidato_archivos` (currículum y foto de perfil), y reconstruye el historial de las postulaciones existentes. Se puede ejecutar más de una vez.

4. Iniciar el servidor y abrir http://localhost:3000

   ```bash
   npm start
   ```

   Con `npm run dev` el servidor se reinicia al guardar cambios. También se puede iniciar con F5 desde Visual Studio Code.

## Usuarios de demostración

La contraseña de todos es `Clave12345`.

| Rol | Correo |
| --- | --- |
| Administrador | admin@vinculolaboral.sv |
| Empresa (verificada) | rrhh@distcuscatlan.sv |
| Empresa (verificada) | talento@clinicasantalucia.sv |
| Empresa (pendiente) | empleo@textilesdelnorte.sv |
| Candidato | daniela.ortiz@correo.sv |
| Candidato | mauricio.flores@correo.sv |

Con `npm run db:seed` también se crean otros candidatos y postulaciones con fechas pasadas, para ver el tiempo de respuesta de la Clínica Santa Lucía (2 días en promedio) y un recorrido completo en las postulaciones de Daniela.

## Pruebas

Las pruebas usan una base de datos distinta, para no borrar los datos de trabajo:

```sql
CREATE DATABASE vinculo_laboral_test;
```

Si el usuario o la contraseña no son los del archivo `.env.example`, se define `TEST_DATABASE_URL` antes de ejecutar:

```bash
npm test
```

## Seguimiento de postulaciones

- **Línea de tiempo.** Cada cambio de estado de una postulación (enviada, en revisión, aceptada, rechazada, retirada) se guarda en la tabla `postulacion_historial`. En *Mis postulaciones*, el botón «Ver recorrido» muestra los pasos con fecha y hora.
- **Tiempo de respuesta de la empresa.** El detalle de cada oferta indica en cuántos días responde en promedio la empresa y a qué porcentaje de postulaciones contesta. Se calcula con el historial: la respuesta es el primer cambio a en revisión, aceptada o rechazada. Las postulaciones retiradas sin respuesta no cuentan, y hasta que la empresa tenga 3 postulaciones se muestra un aviso de que aún no hay datos suficientes.
- **¿Qué me falta para esta oferta?** En el detalle de una oferta, el candidato ve qué requisitos aparecen en su perfil (resumen y habilidades) y cuáles no, con un artículo de Recursos cuando hay uno sobre el tema. La comparación es por palabras clave (`src/coincidencia.js`). Para ampliar las sugerencias, se agregan artículos en `public/js/articulos.js` con sus `temas`.

## Currículum, foto de perfil y cuadros de confirmación

- **Currículum.** En *Mi perfil*, el candidato sube su currículum en PDF (máximo 3 MB), lo descarga, lo reemplaza o lo elimina. En la lista de aplicantes de cada oferta, la empresa ve el botón «Descargar currículum» solo de quienes se postularon a sus ofertas.
- **Foto de perfil.** El candidato sube una foto JPG, PNG o WEBP; el navegador la recorta en cuadrado y la reduce a 400 px antes de enviarla (máximo 2 MB en el servidor). La empresa ve la foto junto al nombre de cada aplicante.
- **Almacenamiento.** Los archivos se guardan en PostgreSQL (tabla `candidato_archivos`, columna `BYTEA`), así que no dependen de carpetas del servidor. El tipo se comprueba por el contenido del archivo, no solo por la extensión.
- **Confirmaciones.** Las funciones `confirmar()` y `pedirTexto()` de `public/js/app.js` muestran un cuadro de diálogo propio (elemento `<dialog>`) en lugar de los `confirm()` y `prompt()` del navegador, que mostraban el aviso «localhost dice…».

## Otras páginas

Además de los módulos principales, el sitio incluye una página de recursos y consejos de carrera (`/recursos.html`) con artículos cortos filtrables por categoría, y un formulario para cambiar la contraseña en el perfil de candidatos y de empresas.

## Estructura

```
db/             esquema SQL, script de carga inicial y migraciones
src/
  app.js        configuración de Express
  server.js     arranque del servidor
  db.js         conexión a PostgreSQL
  postulaciones.js  cambios de estado con historial y tiempo de respuesta
  archivos.js       currículum y foto de perfil (validación y almacenamiento)
  coincidencia.js   comparación de requisitos con el perfil
  middleware/   sesión, validaciones y manejo de errores
  routes/       auth, publico, candidato, empresa y admin
public/         páginas, estilos y scripts del cliente
tests/          pruebas funcionales y de integración (api.test.js, password.test.js y coincidencia.test.js)
```

## Reglas principales

- El NIT tiene 14 dígitos y el teléfono 8 (0000-0000). La contraseña requiere al menos 8 caracteres.
- Después de 5 intentos fallidos de inicio de sesión la cuenta se bloquea por 15 minutos.
- Una empresa nueva queda pendiente de verificación. Sus ofertas se crean como pendientes y pasan a activas cuando administración la verifica.
- Una oferta dura 45 días por defecto y 90 como máximo. Cada empresa puede tener hasta 20 ofertas abiertas.
- Un candidato solo puede aplicar una vez a cada oferta. Puede retirar la postulación mientras no tenga una decisión.
- Una oferta puede inactivarse (y reactivarse), cancelarse (ya no se reabre) o eliminarse junto con sus postulaciones.

## Rutas de la API

| Ruta | Descripción |
| --- | --- |
| `POST /api/auth/registro/candidato` | Crear usuario |
| `POST /api/auth/registro/empresa` | Crear empresa |
| `POST /api/auth/login` | Iniciar sesión |
| `GET /api/publico/ofertas` | Buscar ofertas (filtros: q, departamento, tipo, modalidad, experiencia, salario_min, pagina) |
| `GET /api/publico/ofertas/:id` | Detalle de una oferta, con `respuesta_empresa` (días promedio y porcentaje de respuesta) |
| `POST /api/publico/ofertas/:id/postular` | Aplicar a una oferta |
| `GET /api/candidato/dashboard` | Dashboard del candidato |
| `GET /api/candidato/postulaciones` | Postulaciones del candidato, cada una con su `historial` de estados |
| `GET /api/candidato/ofertas/:id/coincidencia` | Requisitos de la oferta que coinciden o faltan según el perfil, con artículos sugeridos |
| `GET /api/empresa/dashboard` | Dashboard de la empresa |
| `POST /api/empresa/ofertas` | Crear oferta |
| `PATCH /api/empresa/ofertas/:id/estado` | Activar, inactivar o cancelar |
| `DELETE /api/empresa/ofertas/:id` | Eliminar oferta |
| `GET /api/empresa/ofertas/:id/postulaciones` | Aplicantes de una oferta |
| `PATCH /api/empresa/postulaciones/:id` | Aceptar o rechazar un aplicante |
| `GET /api/admin/resumen` | Resumen del sistema |
| `PATCH /api/admin/empresas/:id/verificacion` | Verificar o rechazar una empresa |
| `PATCH /api/admin/usuarios/:id/estado` | Suspender o reactivar una cuenta |
| `GET /api/admin/usuarios/exportar` | Descargar la lista de usuarios en CSV (acepta los filtros q, rol y estado) |
| `GET /api/candidato/archivos` | Datos del currículum y de la foto del candidato |
| `PUT /api/candidato/cv` | Subir o reemplazar el currículum (cuerpo binario PDF, cabecera `X-Nombre-Archivo`) |
| `GET /api/candidato/cv` | Descargar el currículum propio |
| `DELETE /api/candidato/cv` | Eliminar el currículum |
| `PUT /api/candidato/foto` | Subir o reemplazar la foto de perfil (JPG, PNG o WEBP) |
| `GET /api/candidato/foto` | Obtener la foto propia |
| `DELETE /api/candidato/foto` | Quitar la foto |
| `GET /api/empresa/postulaciones/:id/cv` | La empresa descarga el currículum de un aplicante de sus ofertas |
| `GET /api/empresa/postulaciones/:id/foto` | La empresa obtiene la foto de un aplicante de sus ofertas |
| `PUT /api/auth/password` | Cambiar la contraseña de la cuenta con sesión iniciada |
