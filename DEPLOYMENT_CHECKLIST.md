# Checklist de despliegue — mesa_ayuda

Pasos recomendados antes y durante el despliegue:

1) Preparación del repositorio
- Confirmar `.gitignore` incluye `backend/.env` y cualquier archivo de credenciales.
- Actualizar `backend/.env.example` con placeholders claros.

2) Configurar CI (GitHub Actions)
- Crear los secrets en GitHub: `JWT_SECRET`, `ADMIN_PASSWORD`, `AGENTE1_PASSWORD`, `AGENTE2_PASSWORD`.
- Añadir secret `NODE_ENV=production` si se requiere.
- Verificar que el workflow ejecuta `npm test` y el `smoke-test`.

3) Despliegue del backend
- Usar un host compatible con Node.js y persistencia local mínima.
- Crear el servicio con variables de entorno: `JWT_SECRET`, `BCRYPT_ROUNDS`, `CREATE_DEV_USERS=false`.
- Si el frontend se publica en otro dominio, definir `CORS_ORIGIN` con el origen exacto permitido.
- Establecer health check a `/api/health`.
- Verificar que el host permita mantener el proceso activo o gestionar arranque bajo demanda.

4) Despliegue del frontend
- Usar Netlify para servir el frontend estático.
- Publicar la raíz del proyecto como sitio estático y mantener `index.html` como entrada.
- Apuntar la app a la API real con `window.__MESA_AYUDA_API_BASE_URL__`, `window.API_BASE_URL` o el meta tag `api-base-url`.
- Habilitar HTTPS y dominio personalizado si aplica.

5) Validación post-despliegue
- Ejecutar el `smoke-test` (CI) contra el entorno desplegado o manualmente.
- Probar login y acceder a rutas protegidas con token.
- Revisar logs de backend para errores y latencia.

6) Tareas opcionales
- Habilitar monitoreo y alertas (UptimeRobot, Healthchecks, Sentry).
- Crear backup regular de datos/almacenamiento si aplica.
