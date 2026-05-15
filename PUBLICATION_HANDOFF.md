# Handoff de publicación — Mesa de Ayuda

Este documento resume el orden recomendado para publicar el proyecto de forma limpia y profesional.

## 1) Inicializar Git

Si el directorio aún no tiene repositorio, ejecutar desde la carpeta raíz del proyecto:

```powershell
Set-Location 'c:\Users\casti\Documentos\Empresas\portafolio\mesa_ayuda'
git init
git branch -M main
```

## 2) Revisar cambios antes del commit

```powershell
git status --short
```

## 3) Crear el primer commit

```powershell
git add .
git commit -m "chore: prepare mesa_ayuda for publication"
```

## 4) Conectar el remoto

Reemplazar la URL por el repositorio real:

```powershell
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

## 5) Configurar secretos y despliegue

Antes de publicar la aplicación:

- Crear los Secrets requeridos en GitHub Actions.
- Configurar `JWT_SECRET` en el proveedor de backend.
- Mantener `CREATE_DEV_USERS=false` en staging y producción.
- Verificar que `backend/.env` no se suba.
- Confirmar que el smoke test sigue pasando.

## 6) Orden de publicación

1. Subir el repositorio a GitHub.
2. Verificar el workflow de CI.
3. Desplegar backend.
4. Desplegar frontend.
5. Probar login, listado, creación y actualización de tickets.

## 7) Criterio de listo

El proyecto está listo cuando:

- No quedan archivos privados dentro del repositorio.
- La documentación pública es clara y profesional.
- El commit inicial está limpio.
- CI pasa sin secretos embebidos.
- El frontend y el backend responden correctamente en producción.
