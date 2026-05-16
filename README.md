# Mesa de Ayuda (Tickets de Soporte)

Aplicación web profesional para gestionar tickets internos de soporte, con autenticación por roles, filtros operativos y métricas de seguimiento.

## Capacidades clave
- Inicio de sesión con JWT y control de permisos por rol (`admin`, `agente`).
- Gestión de tickets con creación, edición, asignación, cambio de estado y eliminación (solo admin).
- Filtros por texto, estado, prioridad y tickets propios.
- KPI operativos: total, abiertos, en progreso, resueltos y prioridad alta.
- Persistencia en JSON para despliegues ligeros sin dependencia de base de datos externa.

## Stack
- Frontend: HTML, CSS, JavaScript.
- Backend: Node.js + Express.
- Seguridad: JWT + `bcryptjs`.
- Validación: Zod.

## Estructura
```text
mesa_ayuda/
  index.html
  css/styles.css
  js/app.js
  backend/
    src/server.js
    src/store.js
    scripts/smoke-test.js
    data/tickets.json
    .env.example
    package.json
```

## Configuración de entorno (backend)
Crear `backend/.env` a partir de `backend/.env.example`.

Variables clave:
- `PORT`
- `JWT_SECRET`
- `BCRYPT_ROUNDS`
- `CREATE_DEV_USERS`
- `ADMIN_PASSWORD`
- `AGENTE1_PASSWORD`
- `AGENTE2_PASSWORD`

## Ejecución local
```bash
cd backend
npm install
npm start
```

Luego abrir `index.html` en el navegador.

## Pruebas
```bash
cd backend
npm test
```

## Endpoints principales
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users/agents`
- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `DELETE /api/tickets/:id`
- `GET /api/dashboard/kpis`

## Despliegue
Antes de desplegar, seguir la [Checklist de despliegue](DEPLOYMENT_CHECKLIST.md) y las recomendaciones de [Security Setup](SECURITY_SETUP.md).

Ruta recomendada:
- Frontend en Netlify.
- Backend en un host compatible con Node.js.
- `CORS_ORIGIN` configurado con el dominio del frontend.
- `JWT_SECRET` y demás secretos cargados como variables de entorno.

## Seguridad
- `JWT_SECRET` obligatorio (no hay fallback inseguro).
- Contraseñas de usuarios de desarrollo definidas solo por variables de entorno.
- No subir `backend/.env` al repositorio.
