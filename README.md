# Mesa de Ayuda (Tickets de Soporte)

[![CI](https://github.com/JogerCastillo/mesa-ayuda/actions/workflows/ci.yml/badge.svg)](https://github.com/JogerCastillo/mesa-ayuda/actions/workflows/ci.yml)

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
- `ADMIN_PASSWORD` (solo para bootstrap inicial si el archivo de usuarios aún no existe)
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

## CI/CD

Every push to `main` and every pull request targeting `main` triggers:

| Job | What it does |
|---|---|
| **Backend tests** | Runs 25 `node:test` cases for auth, RBAC, validation, tickets and KPIs on Node 20, followed by the smoke test. |
| **Frontend static checks** | Checks JavaScript syntax with `node --check` and verifies required HTML tags. |

The backend suite runs in about 2.5 seconds locally. Each test file uses a temporary `DATA_DIR`; CI also directs the smoke test to the runner's temporary directory. These checks do not provide frontend test coverage or a coverage report.

**Known limitations**:

- There are no automated frontend tests; the vanilla JavaScript UI still requires manual smoke testing.
- Rate-limiting behavior is not covered by tests; the limiter currently uses in-memory state.
- The client does not call `POST /api/auth/logout`; the server's JWT revocation blacklist is in memory and resets on restart.
- **UI/backend mismatch:** the UI offers a "Tomar" button for any unassigned ticket, but the backend only lets agents edit tickets they created or that are assigned to them. An agent therefore cannot claim an arbitrary unassigned ticket. The code does not document whether this restriction is intentional; the UI and backend behavior should be reconciled post-MVP.

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

### Ruta recomendada
- Frontend en Netlify (auto-despliegue desde Git, sin necesidad de build).
- Backend en Render (plan gratuito, Node.js + Express).
- `JWT_SECRET` y demás secretos cargados como variables de entorno en Render.
- No requiere configurar `CORS_ORIGIN`: el proxy de Netlify redirige `/api/*` al backend, por lo que todas las peticiones son al mismo origen.

### Proxy Netlify → Render
El archivo `netlify.toml` en la raíz configura la redirección:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://tu-api.onrender.com/api/:splat"
  status = 200
  force = true
```

## Seguridad
- `JWT_SECRET` obligatorio (no hay fallback inseguro).
- Las cuentas iniciales se crean desde variables de entorno la primera vez y luego quedan persistidas en `backend/data/users.json`.
- `backend/data/users.json` se genera en runtime y no debe subirse al repositorio.
- No subir `backend/.env` al repositorio.
