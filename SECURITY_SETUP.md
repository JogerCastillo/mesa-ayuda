# Seguridad y configuración crítica

Resumen breve:
- Este documento enumera las variables de entorno, prácticas y comprobaciones mínimas necesarias antes de publicar `mesa_ayuda`.

Variables de entorno obligatorias (no subir a Git):
- `JWT_SECRET` — clave fuerte para firmar JWT (ej. 32+ caracteres aleatorios).
- `ADMIN_PASSWORD` — contraseña del administrador inicial usada solo para bootstrap si el archivo de usuarios aún no existe.
- `AGENTE1_PASSWORD`, `AGENTE2_PASSWORD` — cuentas opcionales para bootstrap inicial.
- `BCRYPT_ROUNDS` — opcional (por defecto 10).

Buenas prácticas:
- Nunca incluir valores reales en archivos del repositorio. Usar `.env` localmente y GitHub/host provider Secrets para CI y producción.
- Asegúrate de que `backend/.env` está en `.gitignore`.
- `backend/data/users.json` se genera automáticamente y debe mantenerse fuera de Git.
- Usar secretos rotativos y una política de renovación periódica.

Comprobaciones previas al despliegue:
- Verificar que `JWT_SECRET` existe en el entorno de producción.
- Verificar que las credenciales iniciales no estén presentes en el repo con `git grep`.
- Ejecutar el `smoke-test` en CI y confirmar `Smoke test OK`.
- Revisar CORS y restringir orígenes solo a dominios necesarios.

Incidentes y recuperación:
- Si un secreto se filtra: rotar `JWT_SECRET` y forzar re-login de usuarios. Invalidar tokens viejos cambiando la clave.
- Mantener copia de las notas de despliegue en un gestor de secretos (1Password, Bitwarden, Azure KeyVault).

Contacto para despliegue:
- Responsable: propietario del repositorio. Guardar las notas privadas fuera del repositorio principal.
