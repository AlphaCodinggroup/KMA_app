# 02 — Bootstrap y disparadores de sincronización

## 2.1 Arranque (`bootstrapApp`)

```mermaid
sequenceDiagram
  participant R as RootLayout
  participant B as bootstrapApp
  participant N as Network watcher
  participant DB as SQLite (db.ts)
  participant S as Session
  participant P as migratePhotos
  participant SY as SyncService
  participant BG as Background task
  participant CS as catalog-sync

  R->>B: bootstrapApp() (una sola vez)
  B->>N: initNetworkWatcher()
  B->>DB: initDatabase() → aplica migraciones pendientes
  B->>S: initSession() (rehidrata tokens)
  B->>B: claimOrphanRows() (user_id = usuario actual)
  B->>P: migrateCachedPhotos() (Caches → documentDirectory)
  B->>SY: new SyncService(outbox, dispatcher, getUserId, isOnline, onFailed)
  B->>B: registerOutboxSyncTrigger(queue)
  B->>B: suscribe AppState, NetInfo, eventos de sesión
  B->>BG: registerBackgroundSync(runOnce) — 30 min
  alt hay refreshToken persistido
    B->>SY: queue()
    B->>CS: syncAllCatalogs()
    B->>CS: coldSyncAllFlows()
  else sin sesión
    Note over B: triggers inactivos (no-op)
  end
  B-->>R: listo → se renderizan las rutas
```

Funciona igual offline: la app abre con los datos locales; los triggers de red lo recuperan después.

## 2.2 Disparadores durante el uso

```mermaid
sequenceDiagram
  participant AS as AppState
  participant NI as NetInfo
  participant SE as Session (eventos)
  participant UC as flow-runner (tras encolar)
  participant BG as Background task (iOS)
  participant U as Botón Retry
  participant SY as SyncService
  participant CS as Catálogos / Flows

  AS->>SY: "active" → queue() (respeta el backoff)
  AS->>CS: syncAllCatalogs + coldSyncAllFlows
  NI->>SY: red recuperada → queue({resetBackoff:true})
  NI->>CS: syncAllCatalogs + coldSyncAllFlows
  SE->>SY: login / refresh → queue({resetBackoff:true})
  SE->>CS: syncAllCatalogs + coldSyncAllFlows
  UC->>SY: triggerOutboxSync() → queue()
  BG->>SY: runOnce() (~30 min, iOS decide)
  U->>SY: requeue (attempts 0, sin backoff) + queue()
```

Todos los triggers son **no-op sin refresh token**. `queue()` coalesce: si ya hay una corrida, marca que debe
repetirse al terminar. `syncAllCatalogs` tiene cooldown de 60 s y `coldSyncAllFlows` comparte una promesa en vuelo.
El foreground no resetea el backoff para no consumir intentos en cada apertura de la app.
