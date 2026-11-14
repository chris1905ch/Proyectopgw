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

## Pruebas

Las pruebas usan una base de datos distinta, para no borrar los datos de trabajo:

```sql
CREATE DATABASE vinculo_laboral_test;
```

Si el usuario o la contraseña no son los del archivo `.env.example`, se define `TEST_DATABASE_URL` antes de ejecutar:

```bash
npm test
```

## Estructura

```
db/             esquema SQL y script de carga inicial
src/
  app.js        configuración de Express
  server.js     arranque del servidor
  db.js         conexión a PostgreSQL
  middleware/   sesión, validaciones y manejo de errores
  routes/       auth, publico, candidato, empresa y admin
public/         páginas, estilos y scripts del cliente
tests/          pruebas funcionales y de integración
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
| `GET /api/publico/ofertas/:id` | Detalle de una oferta |
| `POST /api/publico/ofertas/:id/postular` | Aplicar a una oferta |
| `GET /api/candidato/dashboard` | Dashboard del candidato |
| `GET /api/candidato/postulaciones` | Postulaciones del candidato |
| `GET /api/empresa/dashboard` | Dashboard de la empresa |
| `POST /api/empresa/ofertas` | Crear oferta |
| `PATCH /api/empresa/ofertas/:id/estado` | Activar, inactivar o cancelar |
| `DELETE /api/empresa/ofertas/:id` | Eliminar oferta |
| `GET /api/empresa/ofertas/:id/postulaciones` | Aplicantes de una oferta |
| `PATCH /api/empresa/postulaciones/:id` | Aceptar o rechazar un aplicante |
| `GET /api/admin/resumen` | Resumen del sistema |
| `PATCH /api/admin/empresas/:id/verificacion` | Verificar o rechazar una empresa |
| `PATCH /api/admin/usuarios/:id/estado` | Suspender o reactivar una cuenta |
