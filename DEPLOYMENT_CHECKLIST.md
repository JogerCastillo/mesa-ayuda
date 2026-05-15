# Checklist de despliegue — mesa_ayuda

Pasos recomendados antes y durante el despliegue:

1) Preparación del repositorio
- Confirmar `.gitignore` incluye `backend/.env` y cualquier archivo de credenciales.
- Actualizar `backend/.env.example` con placeholders claros.

2) Configurar CI (GitHub Actions)
- Crear los secrets en GitHub: `JWT_SECRET`, `ADMIN_PASSWORD`, `AGENTE1_PASSWORD`, `AGENTE2_PASSWORD`.
- Añadir secret `NODE_ENV=production` si se requiere.
- Verificar que el workflow ejecuta `npm test` y el `smoke-test`.

3) Despliegue del backend (opciones: Render, Railway, Heroku, VPS)
- Crear servicio con variables de entorno: `JWT_SECRET`, `BCRYPT_ROUNDS`, `CREATE_DEV_USERS=false`.
- Establecer health check a `/api/health` o similar.
- Configurar CORS solo para el dominio del frontend.

4) Despliegue del frontend (Netlify/Vercel)
- Build command: `npm run build` o subir estáticos según el proyecto.
- Establecer `API_BASE_URL` en variables de entorno de Netlify (o inyectar en build).
- Habilitar HTTPS y dominio personalizado si aplica.

5) Validación post-despliegue
- Ejecutar el `smoke-test` (CI) contra el entorno desplegado o manualmente.
- Probar login y acceder a rutas protegidas con token.
- Revisar logs de backend para errores y latencia.

6) Tareas opcionales
- Habilitar monitoreo y alertas (UptimeRobot, Healthchecks, Sentry).
- Crear backup regular de datos/almacenamiento si aplica.
