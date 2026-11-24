# Arquitectura general — KMA Mobile

App de auditorías de campo **offline-first** (React Native 0.79 + Expo SDK 53, Expo Router, nueva arquitectura).
Un auditor elige proyecto y facility, completa un *flow* (secuencia de pasos definida por backend), saca fotos y
envía la auditoría. Todo funciona sin red: lo que no se puede enviar queda en una cola local y se sincroniza solo.

Documentos relacionados: [UML](./UML.md) · [DTE](./DTE.md) · [Casos de uso](./CASOS-DE-USO.md) · [Diagramas de secuencia](./secuencias/README.md).

---

## 1. Stack

| Capa técnica | Tecnología |
|---|---|
| UI / navegación | React Native 0.79, Expo Router (rutas por archivos en `app/`) |
| Formularios | react-hook-form + Zod (`zodResolver`) |
| Persistencia estructurada | `expo-sqlite` (singleton, WAL, migraciones propias) |
| Secretos | `expo-secure-store` (tokens de sesión, con chunking) |
| Archivos | `expo-file-system` (fotos en `documentDirectory`, imágenes de flows cacheadas) |
| Cámara / imágenes | `expo-image-picker`, `expo-image-manipulator` (HEIC → JPEG) |
| Red | Axios (`src/core/http/http.ts`) + `FileSystem.uploadAsync` para binarios a S3 |
| Auth | AWS Cognito (llamadas directas a `cognito-idp`), IdToken como Bearer |
| Conectividad | `@react-native-community/netinfo` |
| Segundo plano | `expo-background-task` + `expo-task-manager` (tarea `kma.sync.task`, 30 min) |
| Validación | Zod (DTOs de API, steps de flow, `Env`) |

## 2. Capas (Feature-Sliced + puertos y adaptadores)

```
app/            Rutas Expo Router: (auth)/login, (app)/{projects,facilities,selector,profile,flow/[flowId]}
src/entities/   Modelos de dominio, puertos (ports.ts), DTOs de API (api/), mappers (lib/)
src/features/   Slices verticales: auth, projects, facility, selector, flow-runner, dynamic-form,
                question, camera, failed-audits, profile
src/processes/  Orquestación de la app: bootstrap, sync, catalog-sync, auth-guard
src/core/       Infraestructura: http/ (Axios, uploader), repos/ (adaptadores SQLite y SecureStore)
src/shared/     config (Env), session, storage (SQLite), validation, workers, lib, ui
```

Dirección de dependencias: `entities` ← `features` ← `processes` ← `app`. `core` y `shared` se pueden usar desde
cualquier capa.

Reglas (de `CLAUDE.md`):

- `entities/` no importa React Native ni axios (solo tipos y funciones puras).
- Los imports entre capas usan alias (`@app`, `@entities`, `@features`, `@processes`, `@core`, `@shared`).
- Una feature se importa desde otra solo por su `index.ts`.
- Nada de UI llama a axios directamente: todo pasa por `src/core/http/http.ts`, que es dueño de autenticación,
  refresh y reintentos.

### Estructura de un slice

```
features/<slice>/
  application/   usecases.ts (lógica sin React) + useXxx.ts (hooks)
  data/          *.repo.http.ts / *.repo.offline.ts  → implementan los puertos de entities/
  lib/           helpers puros
  ui/            componentes + styles/
  index.ts       barrel público
```

### Puertos y adaptadores

Los puertos viven en `entities/*/ports.ts` (`FlowRepo`, `ProjectRepo`, `FacilityRepo`, `SubmissionRepo`,
`UserSessionRepo`). Cada puerto tiene adaptadores intercambiables:

| Puerto | Adaptador HTTP | Adaptador local | Composición |
|---|---|---|---|
| `FlowRepo` | `HttpFlowRepo` | `sqliteFlowRepo` | `OfflineFirstFlowRepo` (HTTP + cache, fallback a SQLite) |
| `ProjectRepo` | `HttpProjectRepo` | `sqliteProjectRepo` | `project.repo.offline` |
| `FacilityRepo` | `HttpFacilityRepo` | `sqliteFacilityRepo` | `facility.repo.offline` |
| `SubmissionRepo` | — | `sqliteSubmissionRepo` | solo local |
| `UserSessionRepo` | — | `user.secure-store.repo` | SecureStore |

Patrón *offline-first* de lectura: con red se pide a la API y se guarda en SQLite (best-effort); sin red, o si la
API falla, se responde desde SQLite. Las pantallas nunca saben de dónde vinieron los datos.

## 3. Almacenamiento local

| Dónde | Qué guarda | Notas |
|---|---|---|
| SQLite `kma.db` | catálogo (`projects`, `facilities`, `flows`, `flow_steps`), trabajo del usuario (`submissions`, `outbox`) | migraciones en `shared/storage/migrations.ts` (hoy hasta `id: 4`); solo se agregan, nunca se editan |
| SecureStore | `idToken`, `accessToken`, `refreshToken`, `expiresAt` | nunca en SQLite; valores largos se parten en chunks |
| `documentDirectory/kma/photos/<submissionId>/` | fotos de la auditoría en curso | no las purga iOS; se borran al enviar o al descartar el draft |
| `documentDirectory/flow-images/` | imágenes de los steps (precargadas) | permiten ver los flows sin red |

El detalle de tablas y relaciones está en [UML → modelo de datos](./UML.md#4-modelo-de-datos-sqlite).

## 4. Arranque (`bootstrapApp`)

`app/_layout.tsx` llama a `bootstrapApp()` una sola vez y renderiza las rutas cuando termina. Orden:

1. `initNetworkWatcher()` — mantiene el último estado de conectividad.
2. `initDatabase()` — abre SQLite y aplica migraciones pendientes en una transacción.
3. `initSession()` — rehidrata tokens desde SecureStore a memoria.
4. `claimOrphanRows()` — asigna al usuario actual las filas sin `user_id` (datos creados por versiones anteriores de la app).
5. `migrateCachedPhotos()` — pasa las fotos de `Library/Caches` a `documentDirectory`.
6. Construye `SyncService` (outbox + dispatcher + `isOnline` + `onFailed`).
7. Suscribe los **triggers** (ver §6) y registra la tarea de background.
8. Disparo inicial de sync de outbox y catálogos, solo si hay refresh token persistido.

`AuthGuard` (`processes/auth-guard`) envuelve las rutas `(app)`: sin `refreshToken` redirige a `/(auth)/login`.

## 5. Sesión y HTTP

- **Login:** `loginUseCase` contra Cognito → `saveSession` (SecureStore + memoria) → evento `login`.
- **Token válido:** `getValidToken()` devuelve el IdToken en memoria si no vence (con margen); si venció, hace
  **refresh single-flight** (`REFRESH_TOKEN_AUTH`). El refresh token no rota.
- **Interceptor de Axios (`http.ts`):**
  - inyecta `Authorization: Bearer <IdToken>`;
  - ante `401` intenta un refresh una vez y reintenta la request;
  - si Cognito rechaza el refresh token (`NotAuthorized`) se limpia la sesión y se muestra un toast **una vez**;
  - si el refresh falla por red/timeout **no** se desloguea: el error es recuperable;
  - reintenta con backoff solo `429`, `5xx`, timeouts y errores de red; **nunca** otros `4xx`;
  - no reintenta `POST /uploads` ni `POST /audits` (la reentrega es responsabilidad del outbox, para no duplicar).
- **Subida a S3:** `expoFileUploader` (`core/http/fileUploader.ts`) hace `PUT` binario por streaming nativo
  (`uploadAsync`, sesión BACKGROUND en iOS). Reintenta `429`/`5xx`/red; un `403` (URL vencida) no se reintenta.
- Sin Authorization en las URLs presignadas.

## 6. Sincronización

### Outbox

Las auditorías terminadas se guardan en `submissions` y se encolan en la tabla `outbox` con
`type = AUDIT_SUBMISSION` y payload `{ submissionId }`. El **dispatcher** (en `bootstrap`) mapea cada tipo a un
manejador que devuelve:

| Resultado | Efecto |
|---|---|
| `success` / `drop` | el item se borra del outbox |
| `retry` | suma un intento y agenda `next_attempt_at` con backoff |
| `fail` | item `failed` (se conserva); la submission queda `failed` con su error |
| `defer` | se posterga sin sumar intentos (tipo que esta versión no conoce) |

Un `drop` solo se usa cuando no hay datos que enviar. Cualquier rechazo del backend deja la auditoría `failed` y
visible; **nunca se borra una auditoría local por un error**.

### `SyncService`

- `queue()` coalesce corridas concurrentes; `queue({ resetBackoff: true })` limpia el backoff persistido.
- Drena lotes (`SYNC_BATCH_SIZE`) hasta vaciar lo que está listo; filtra por `status = 'pending'`,
  `user_id` del usuario logueado y `next_attempt_at` vencido.
- **No despacha sin red** (los intentos offline no cuentan).
- Backoff exponencial persistido en SQLite: base 60 s, tope 30 min, hasta 15 intentos, con jitter. Un solo timer
  apunta al próximo vencimiento.
- Sin usuario (o con otro usuario) no drena: los items esperan a su dueño.

### Triggers

| Disparador | Acción |
|---|---|
| App vuelve a foreground | `queue()` + sync de catálogos + sync de flows |
| Red recuperada (NetInfo) | `queue({ resetBackoff })` + catálogos + flows |
| Login / refresh de sesión | `queue({ resetBackoff })` + catálogos + flows |
| `triggerOutboxSync()` tras encolar | `queue()` |
| Tarea de background (30 min) | `SyncService.runOnce()` |
| Botón *Retry* de fallidas | `requeue` (intentos y backoff en cero) + `queue()` |

Todos son no-op sin refresh token persistido. iOS decide cuándo corre la tarea de background: es un respaldo, no
una garantía (no corre tras *force quit* ni con *Background App Refresh* desactivado).

### Sync de catálogos (`processes/catalog-sync`)

Proyectos (paginado por cursor) → flows (catálogo + steps + precarga de imágenes) → facilities por proyecto.
Cooldown de 60 s y una promesa compartida para evitar corridas concurrentes. Los flows se validan **uno por uno**:
un flow inválido se descarta y conserva su última versión cacheada. Los steps de un flow no se reescriben si
`version`, `updatedAt` y cantidad de steps no cambiaron.

## 7. Flows y formularios

Un flow es una lista de steps (`Question`, `Select`, `Form`, `End`) con reglas de navegación (`yesNext`,
`noNext`, condicionales, `checkPreviousNos`). `features/flow-runner` los ejecuta:

- `useFlowRunner` mantiene las respuestas y los pasos visibles; al avanzar poda las respuestas de ramas
  abandonadas y **persiste el draft** (una auditoría = una fila de `submissions`, con id estable por corrida).
- Si existe un draft del mismo flow/facility/usuario, ofrece **reanudar** (`replayPath` reconstruye el camino).
- Los steps tipo `Form` se renderizan con `features/dynamic-form` (campos `text`, `number`, `photo`).
- Las fotos pasan por `features/camera` (`persistPhoto`): HEIC → JPEG y copia a `documentDirectory`.
- Al terminar, `finalizeSubmission` convierte el draft en `queued` y lo encola; el envío real lo hace el
  `SyncService`.

## 8. Estados

**Submission** (`submissions.status`): `draft` → `queued` → (borrada al enviar) · `failed` ↔ `queued` (Retry) ·
`legacy` (filas previas a la migración 4, no se muestran ni se borran).

**Outbox item** (`outbox.status`): `pending` → (borrado al enviar) · `failed` ↔ `pending` (requeue).

Diagramas de transición de estados en [DTE](./DTE.md).

## 9. Configuración

`Env` (frozen, validado con Zod) es la única fuente de configuración en runtime; se valida también en build en
`app.config.ts`. Variables: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_COGNITO_CLIENT_ID` (obligatorias),
`EXPO_PUBLIC_COGNITO_BASE_URL`, `EXPO_PUBLIC_COGNITO_REGION`, `EXPO_PUBLIC_RETRY_MAX_ATTEMPTS`,
`EXPO_PUBLIC_RETRY_BASE_DELAY_MS`, `EXPO_PUBLIC_SYNC_BATCH_SIZE`. Los builds de EAS embeben su propio bloque `env`
por perfil en `eas.json`. La versión de la app está duplicada en `package.json` y `app.config.ts`.

## 10. Decisiones de diseño relevantes

1. **SQLite como fuente de verdad del trabajo pendiente.** Backoff, intentos y estado sobreviven a matar la app.
2. **Nunca perder una auditoría.** Los fallos quedan visibles y reintentables; no hay borrado silencioso.
3. **Datos por usuario.** Submissions y outbox llevan `user_id`; un usuario nuevo no drena la cola del anterior.
4. **Fotos fuera de la caché.** `documentDirectory` evita que iOS las purgue con poco espacio.
5. **Sin librerías de estado globales.** El estado vive en SQLite, refs y emitters propios con
   `useSyncExternalStore`.
6. **La app tolera backend heterogéneo.** Un flow inválido no invalida el catálogo; un tipo de outbox desconocido
   se posterga en vez de perderse.
