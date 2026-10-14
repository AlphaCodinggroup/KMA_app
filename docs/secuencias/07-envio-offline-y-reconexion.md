# 07 — Auditoría terminada sin red y envío al reconectar

Completar y terminar una auditoría **no requiere conexión**: todo queda en SQLite y en `documentDirectory`.

## 7.1 Finalizar sin red

```mermaid
sequenceDiagram
  actor A as Auditor
  participant HK as useFlowRunner.onFinish
  participant UC as finalizeSubmission
  participant SR as sqliteSubmissionRepo
  participant OB as sqliteOutboxRepo
  participant SY as SyncService
  participant N as Network

  A->>HK: Save audit (modo avión)
  HK->>UC: finalizeSubmission(...)
  UC->>SR: saveDraft + markStatus('queued')
  UC->>OB: enqueue(AUDIT_SUBMISSION)
  UC->>SY: triggerOutboxSync() → queue()
  SY->>N: isOnline()?
  N-->>SY: false
  Note over SY: no despacha: no suma intentos ni backoff
  UC-->>HK: true
  HK-->>A: vuelve al Selector (la auditoría figura como pendiente)
```

## 7.2 Reconexión

```mermaid
sequenceDiagram
  participant NI as NetInfo
  participant B as Bootstrap (listeners)
  participant SY as SyncService
  participant OB as sqliteOutboxRepo
  participant D as Dispatcher
  participant API as API / S3
  participant CS as Catálogos

  NI->>B: isConnected && isInternetReachable
  B->>SY: queue({resetBackoff:true})
  B->>CS: syncAllCatalogs + coldSyncAllFlows
  SY->>OB: resetBackoff()
  loop hasta vaciar lo que está listo
    SY->>OB: nextBatch(batchSize, now, userId)
    OB-->>SY: pendientes (más viejos primero)
    SY->>D: dispatch(cada item)
    D->>API: presign → PUT fotos → POST /audits
    API-->>D: 2xx
    D-->>SY: 'success' → se borra el item
  end
```

Orden y garantías:

- Se procesan en orden de creación (`created_at ASC`).
- Con más de `SYNC_BATCH_SIZE` pendientes, la corrida sigue con lotes hasta vaciar la cola (no espera otro trigger).
- Si la app se cierra antes de reconectar, no se pierde nada: al reabrirla el bootstrap dispara `queue()` y el
  estado (`attempts`, `next_attempt_at`) sigue en SQLite.
- Si la app está en segundo plano, la tarea de background (~30 min, a criterio de iOS) puede hacer `runOnce()`.

## 7.3 Reapertura con auditorías pendientes

```mermaid
sequenceDiagram
  actor A as Auditor
  participant B as bootstrapApp
  participant DB as SQLite
  participant SY as SyncService

  A->>B: abre la app
  B->>DB: migraciones + claimOrphanRows + migrateCachedPhotos
  B->>SY: queue() (hay refreshToken)
  SY->>DB: nextBatch → items pending del usuario
  alt hay red
    SY->>SY: envía (flujo 06)
  else sin red
    Note over SY: espera el próximo trigger (red, foreground, background)
  end
```
