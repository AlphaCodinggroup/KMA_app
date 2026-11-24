# 06 — Finalizar y enviar una auditoría (online)

El envío **siempre** pasa por el outbox, haya red o no. El auditor termina el flow, la auditoría queda encolada y el
`SyncService` la envía enseguida si hay conexión. Variante sin red: [07](./07-envio-offline-y-reconexion.md).

## 6.1 Finalizar: guardar y encolar

```mermaid
sequenceDiagram
  actor A as Auditor
  participant UI as EndView / FlowRunnerScreen
  participant HK as useFlowRunner.onFinish
  participant UC as finalizeSubmission
  participant SR as sqliteSubmissionRepo
  participant OB as sqliteOutboxRepo
  participant TG as triggerOutboxSync
  participant SY as SyncService
  participant T as Toast

  A->>UI: Save audit
  UI->>HK: onFinish()
  HK->>UC: finalizeSubmission({submissionId, answers, ...})
  UC->>SR: saveDraft({id: submissionId, draft final})
  UC->>T: toast "Processing" (título)
  UC->>OB: enqueue(AUDIT_SUBMISSION, {submissionId}, filePaths, userId)
  UC->>SR: markStatus(submissionId, 'queued')
  UC->>TG: triggerOutboxSync()
  TG->>SY: queue()
  UC-->>HK: true
  HK->>UI: router.replace("/(app)/selector")
```

## 6.2 Envío (SyncService → API → S3)

```mermaid
sequenceDiagram
  participant SY as SyncService
  participant OB as sqliteOutboxRepo
  participant D as Dispatcher
  participant SU as submitAuditOnlineFromSnapshot
  participant SR as sqliteSubmissionRepo
  participant H as Http
  participant API as API
  participant U as expoFileUploader
  participant S3 as S3
  participant FS as File system
  participant T as Toast

  SY->>SY: usuario logueado y online?
  SY->>OB: nextBatch(limit, now, userId) → pending con backoff vencido
  OB-->>SY: items AUDIT_SUBMISSION
  loop cada item
    SY->>D: dispatch(item)
    D->>SR: getById(submissionId)
    D->>SU: submitAuditOnlineFromSnapshot(snapshot)
    SU->>SU: collectLocalPhotos → nombre estable stepId_fieldId_photoId.ext
    SU->>H: POST /uploads { files:[{name, step_id}] }
    H->>API: presign (sin reintento automático)
    API-->>H: { audit_id, urls:[{file_name, upload_url, file_url}] }
    SU->>SU: ¿todas las fotos tienen URL? (si falta una → 'retry', no se sube nada)
    par hasta 3 fotos en paralelo
      SU->>U: upload(upload_url, localUri, contentType)
      U->>S3: PUT binario (streaming nativo)
      S3-->>U: 200
    end
    SU->>SU: buildAnswersForApi (solo s3:// o https://, error si queda un file://)
    SU->>H: POST /audits { id: audit_id, flow_id, project_id, facility_id, answers, flow_version }
    H->>API: create (sin reintento automático)
    API-->>H: 2xx
    SU->>T: toast "Audit created"
    SU-->>D: 'success'
    D->>FS: borra fotos locales + directorio kma/photos/<submissionId>
    D->>SR: delete(submissionId)
    D-->>SY: 'success'
    SY->>OB: markSuccess(item.id) → DELETE del outbox
  end
```

Puntos clave:

- El `POST /uploads` y el `POST /audits` **no** se reintentan en el interceptor: si hay un timeout, el outbox
  reentrega; así no se crean dos auditorías por un reintento a ciegas.
- Una auditoría **nunca** se envía incompleta: si falta la URL de una foto o queda una foto local sin subir, el
  resultado es `retry`.
- La limpieza local ocurre solo después del 2xx del `POST /audits`.
- Los errores y reintentos están en [08](./08-reintentos-fallos-y-retry.md).
