# 08 — Reintentos, auditorías fallidas y Retry manual

Regla central: **una auditoría nunca se borra por un error**. Se reintenta con backoff o queda `failed`, visible y
reintentable.

## 8.1 Clasificación del resultado de un envío

```mermaid
flowchart TD
  S["submitAuditOnlineFromSnapshot"] --> O{"¿hay red?"}
  O -- no --> R1["sin red: SyncService no despacha, no suma intento"]
  O -- sí --> E{"¿resultado?"}
  E -- "2xx" --> OK["success → limpiar fotos y submission, borrar item"]
  E -- "foto sin URL de presign / foto local sin subir" --> R2["retry"]
  E -- "sin respuesta: red, timeout" --> R3["retry"]
  E -- "429, 401, 403, 408, 5xx" --> R4["retry (recuperable)"]
  E -- "otro 4xx (p.ej. 400)" --> F["fail: submission.failed + last_error, item failed"]
  R2 --> BK
  R3 --> BK
  R4 --> BK["SyncService.handleRetry: attempts+1, backoff exponencial"]
  BK --> M{"¿attempts+1 ≥ 15?"}
  M -- no --> W["next_attempt_at = now + min(60s·2^n, 30min) + jitter"]
  M -- sí --> F2["failed (max_attempts)"]
```

El `S3 403` (URL presignada vencida) llega como `UploadError(403)`: se trata como recuperable y el reintento
vuelve a pedir el presign.

## 8.2 Reintento automático con backoff

```mermaid
sequenceDiagram
  participant SY as SyncService
  participant D as Dispatcher
  participant OB as sqliteOutboxRepo
  participant TM as Timer único

  SY->>D: dispatch(item)
  D-->>SY: 'retry' (o excepción)
  alt attempts + 1 < 15
    SY->>OB: markRetry(id, now + backoff, reason) → attempts+1
    SY->>TM: scheduleWake(delay) — un solo timer al próximo vencimiento
    Note over OB: next_attempt_at persiste en SQLite:<br/>sobrevive a matar la app
    TM-->>SY: queue() cuando vence
  else tope de intentos
    SY->>OB: markFailed(id, "máximo de intentos (15)")
    SY->>SY: onFailed → submission 'failed' (max_attempts) + notifica la UI
  end
```

Un item en backoff **no ocupa lugar en el lote**: una auditoría nueva se envía igual aunque haya otras fallando.

## 8.3 Fallo definitivo (4xx no recuperable)

```mermaid
sequenceDiagram
  participant SU as submitAuditOnlineFromSnapshot
  participant SR as sqliteSubmissionRepo
  participant D as Dispatcher
  participant SY as SyncService
  participant OB as sqliteOutboxRepo
  participant SG as failedAuditsSignal
  participant UI as Banner / Profile

  SU->>SR: markStatus(id, 'failed', {status, error, message})
  SU-->>D: 'fail'
  D-->>SY: 'fail'
  SY->>OB: markFailed(item.id) — la fila se conserva
  SY->>SG: onFailed → notifyFailedAuditsChanged()
  SG-->>UI: refresca la lista compartida
  UI-->>UI: "N audits could not be synced" + mensaje del backend
```

`message` sale del formato de error del backend (`{ error, message, code }`); si no lo respeta, se guarda
`HTTP <status>` + el body recortado.

## 8.4 Retry manual

```mermaid
sequenceDiagram
  actor A as Auditor
  participant UI as FailedAuditsBanner / Section
  participant HK as useFailedAudits
  participant UC as retryFailedAudit
  participant OB as sqliteOutboxRepo
  participant SR as sqliteSubmissionRepo
  participant SG as failedAuditsSignal
  participant SY as SyncService

  A->>UI: Retry (una) o Retry all
  UI->>HK: retry(id) / retryAll()
  HK->>UC: retryFailedAudit(submissionId)
  UC->>OB: requeueBySubmissionId(id) → pending, attempts 0, next_attempt_at NULL
  opt no existía fila en outbox
    UC->>OB: enqueue(AUDIT_SUBMISSION)
  end
  UC->>SR: markStatus(id, 'queued')
  UC->>SG: notifyFailedAuditsChanged()
  UC->>SY: triggerOutboxSync() → queue()
  SY->>SY: envía (flujo 06) — si hay red
  SG-->>UI: la auditoría sale del listado cuando se envía
```

Banner (Selector) y sección (Profile) comparten un mismo store: una sola consulta aunque ambos estén montados.
Sin auditorías fallidas la UI no muestra nada.
