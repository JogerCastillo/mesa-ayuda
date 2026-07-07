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
