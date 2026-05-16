# Release Checklist — Mesa de Ayuda

Antes de publicar el repositorio, confirmar los siguientes puntos:

- No existen credenciales, contraseñas, claves o tokens en el código fuente ni en archivos de configuración.
- `backend/.env` está incluido en `.gitignore` y solo se mantiene `backend/.env.example` con placeholders claros.
- No hay comentarios o notas de desarrollo que revelen datos sensibles o instrucciones internas (`TODO`, `FIXME`, `DEMO`).
- Textos públicos (`README.md`, `index.html`, mensajes de UI) usan tono profesional y no mencionan credenciales ni prototipos.
- No hay archivos temporales ni de build en el repositorio (p. ej. `node_modules`, logs, `.tmp`). Verificar `.gitignore`.
- Valores de ejemplo inseguros fueron reemplazados por placeholders (p. ej. `JWT_SECRET=change-this-value`).
- Se agregó documentación de seguridad y despliegue: `SECURITY_SETUP.md` y `DEPLOYMENT_CHECKLIST.md`.
- Notas y archivos privados fueron movidos a un almacenamiento seguro fuera del repositorio (vault o carpeta privada).
- El `smoke-test` fue validado localmente y devuelve `Smoke test OK`.
- Variables de entorno necesarias para CI y despliegue están listadas en la documentación y deben configurarse como Secrets en el proveedor correspondiente.

Mantener este archivo en el repositorio público ayuda a que colaboradores y revisores entiendan los requisitos mínimos para publicar y operar el servicio de manera segura.
