# Diagramas de secuencia

Flujos funcionales más importantes de KMA Mobile, **online y offline**. Cada archivo cubre un flujo y, cuando
cambia el comportamiento sin red, incluye ambas variantes. Contexto: [ARQUITECTURA](../ARQUITECTURA.md) y
[UML](../UML.md).

| # | Archivo | Flujo | Online | Offline |
|---|---|---|:-:|:-:|
| 01 | [01-login-y-sesion.md](./01-login-y-sesion.md) | Login, sesión persistida, refresh de token, logout | ✅ | ✅ (sesión persistida) |
| 02 | [02-bootstrap-y-triggers.md](./02-bootstrap-y-triggers.md) | Arranque de la app y disparadores de sync | ✅ | ✅ |
| 03 | [03-sync-de-catalogos.md](./03-sync-de-catalogos.md) | Proyectos, facilities y flows: sync y lectura offline-first | ✅ | ✅ |
| 04 | [04-ejecucion-de-flow-y-draft.md](./04-ejecucion-de-flow-y-draft.md) | Responder un flow, guardar draft, reanudar | ✅ | ✅ |
| 05 | [05-captura-de-fotos.md](./05-captura-de-fotos.md) | Foto desde cámara/galería hasta `documentDirectory` | ✅ | ✅ |
| 06 | [06-envio-de-auditoria-online.md](./06-envio-de-auditoria-online.md) | Finalizar y enviar: presign → S3 → `POST /audits` | ✅ | — |
| 07 | [07-envio-offline-y-reconexion.md](./07-envio-offline-y-reconexion.md) | Auditoría terminada sin red y envío al reconectar | — | ✅ |
| 08 | [08-reintentos-fallos-y-retry.md](./08-reintentos-fallos-y-retry.md) | Backoff, `failed`, banner y *Retry* manual | ✅ | ✅ |
| 09 | [09-cambio-de-usuario-y-logout-con-pendientes.md](./09-cambio-de-usuario-y-logout-con-pendientes.md) | Pendientes por usuario y cierre de sesión | ✅ | ✅ |

## Participantes frecuentes

| Alias | Qué es |
|---|---|
| UI / Pantalla | Componentes de `features/*/ui` y rutas de `app/` |
| Hook | `useXxx` en `features/*/application` |
| UseCase | `usecases.ts` (lógica sin React) |
| Http | `src/core/http/http.ts` (Axios + interceptores) |
| Session | `src/shared/session/session.ts` |
| SQLite | `kma.db` vía los `sqlite*Repo` |
| SyncService | `src/processes/sync/SyncService.ts` |
| Dispatcher | `createOutboxDispatcher` en `processes/bootstrap` |
| API | Backend KMA |
| Cognito | AWS Cognito (`cognito-idp`) |
| S3 | Destino de las URLs presignadas |

Los diagramas están en Mermaid y se ven directamente en GitHub.
