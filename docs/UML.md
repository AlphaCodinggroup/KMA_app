# UML — KMA Mobile

Diagramas en [Mermaid](https://mermaid.js.org/) (se renderizan en GitHub y en la mayoría de los editores de
Markdown). Contexto en [ARQUITECTURA.md](./ARQUITECTURA.md); flujos paso a paso en
[secuencias/](./secuencias/README.md).

Índice: 1. [Componentes y capas](#1-componentes-y-capas) · 2. [Dominio](#2-clases-de-dominio) ·
3. [Puertos y adaptadores](#3-puertos-y-adaptadores) · 4. [Modelo de datos](#4-modelo-de-datos-sqlite) ·
5. [Estados](./DTE.md) · 6. [Sync y outbox](#6-clases-de-sincronización) ·
7. [Navegación](#7-navegación-de-pantallas)

---

## 1. Componentes y capas

```mermaid
flowchart TB
  subgraph APP["app/ — Expo Router"]
    R1["(auth)/login"]
    R2["(app)/projects"]
    R3["(app)/facilities"]
    R4["(app)/selector"]
    R5["(app)/flow/[flowId]"]
    R6["(app)/profile"]
  end

  subgraph PROC["src/processes"]
    BOOT["bootstrap"]
    SYNC["sync (SyncService, outboxTrigger, failedAuditsSignal)"]
    CAT["catalog-sync"]
    GUARD["auth-guard"]
  end

  subgraph FEAT["src/features"]
    F_AUTH["auth"]
    F_PROJ["projects"]
    F_FAC["facility"]
    F_SEL["selector"]
    F_RUN["flow-runner"]
    F_FORM["dynamic-form"]
    F_Q["question"]
    F_CAM["camera"]
    F_FAIL["failed-audits"]
    F_PROF["profile"]
  end

  subgraph ENT["src/entities (dominio puro)"]
    E_FLOW["flow"]
    E_PROJ["project"]
    E_FAC["facility"]
    E_SUB["submission"]
    E_USER["user"]
  end

  subgraph CORE["src/core (infraestructura)"]
    HTTP["http/http.ts (Axios)"]
    UPL["http/fileUploader.ts"]
    REPOS["repos/ (SQLite, SecureStore)"]
  end

  subgraph SHARED["src/shared"]
    CFG["config/Env"]
    SES["session"]
    DB["storage (SQLite, migrations)"]
    WRK["workers/background"]
    UI["ui, lib, validation"]
  end

  subgraph EXT["Externos"]
    COG[("AWS Cognito")]
    API[("Backend KMA")]
    S3[("S3 (URLs presignadas)")]
    SQL[("SQLite kma.db")]
    SEC[("SecureStore")]
    FS[("File system")]
  end

  APP --> FEAT
  APP --> GUARD
  APP --> BOOT
  BOOT --> SYNC
  BOOT --> CAT
  PROC --> FEAT
  FEAT --> ENT
  FEAT --> CORE
  FEAT --> SHARED
  PROC --> CORE
  CORE --> ENT
  CORE --> SHARED
  HTTP --> API
  UPL --> S3
  F_AUTH --> COG
  REPOS --> SQL
  REPOS --> SEC
  F_CAM --> FS
  SES --> SEC
  DB --> SQL
```

Regla de lectura: una flecha significa "depende de". `entities` no depende de nadie (ni de React Native ni de
axios); `core` y `shared` son accesibles desde cualquier capa.

---

## 2. Clases de dominio

### 2.1 Flows y steps

```mermaid
classDiagram
  class Flow {
    +string flowId
    +string title
    +string description
    +string flowType
    +number version
    +boolean isActive
    +string createdAt
    +string updatedAt
    +Step[] steps
  }
  class FlowSummary {
    +string id
    +string title
    +string version
    +number stepsCount
    +string flowType
    +boolean isActive
  }
  class Step {
    <<union>>
    +string id
    +string type
    +string image
    +string[] images
  }
  class QuestionStep {
    +string text
    +string yesNext
    +string noNext
    +string barrierId
    +string[] checkPreviousNos
    +ConditionalNext[] conditionalYesNext
    +ConditionalNext[] conditionalNoNext
  }
  class SelectStep {
    +string title
    +string text
    +SelectOption[] options
  }
  class FormStep {
    +string title
    +string next
    +Field[] fields
    +map metadata
  }
  class EndStep
  class Field {
    +string id
    +string type
    +string label
    +string unit
    +string placeholder
  }
  class SelectOption {
    +string label
    +string next
    +string yesNext
    +string noNext
    +OptionCondition condition
  }
  class ConditionalNext {
    +StepCondition[] conditions
    +string next
    +boolean matchAny
  }

  Flow "1" *-- "many" Step
  Step <|-- QuestionStep
  Step <|-- SelectStep
  Step <|-- FormStep
  Step <|-- EndStep
  FormStep "1" *-- "many" Field
  SelectStep "1" *-- "many" SelectOption
  QuestionStep "1" *-- "many" ConditionalNext
  Flow ..> FlowSummary : se resume en
```

`Field.type` ∈ `text | number | photo | button`. `Step.type` ∈ `Question | Select | Form | End`.

### 2.2 Submissions (auditoría local)

```mermaid
classDiagram
  class SubmissionDraft {
    +string flowId
    +string title
    +number createdAt
    +answers: map por stepId
  }
  class SubmissionSnapshot {
    +string id
    +string projectId
    +string facilityId
    +string version
    +boolean synced
    +boolean hasFiles
    +SubmissionStatus status
    +string lastError
    +string userId
    +number updatedAt
  }
  class SubmissionAnswer {
    <<union>>
  }
  class QuestionAnswer {
    +type: Question
    +QuestionAnswerValue answer
    +string option
  }
  class FormAnswer {
    +type: Form
    +map values
  }
  class SubmissionStatus {
    <<enumeration>>
    draft
    queued
    failed
    legacy
  }

  SubmissionSnapshot --|> SubmissionDraft
  SubmissionDraft "1" *-- "many" SubmissionAnswer
  SubmissionAnswer <|-- QuestionAnswer
  SubmissionAnswer <|-- FormAnswer
  SubmissionSnapshot --> SubmissionStatus
```

Las fotos viven dentro de `FormAnswer.values.photos` (array de URIs `file://` locales; tras el envío se
reemplazan por las `file_url` de S3 en el payload que va a la API, no en SQLite).

### 2.3 Catálogo y sesión

```mermaid
classDiagram
  class Project {
    +string id
    +string code
    +string name
    +string description
    +ProjectStatus status
    +string[] userIds
    +string[] facilityIds
  }
  class Facility {
    +string id
    +string projectId
    +string name
    +string address
    +string city
    +GeoPoint geo
    +FacilityStatus status
    +string[] userIds
  }
  class SessionRecord {
    +string idToken
    +string accessToken
    +string refreshToken
    +number expiresAt
  }
  class SessionError {
    +code: NOT_FOUND, PERSISTENCE_FAILED, CORRUPTED_DATA o UNAUTHORIZED
  }

  Project "1" o-- "many" Facility
  SessionRecord ..> SessionError : lanza
```

---

## 3. Puertos y adaptadores

```mermaid
classDiagram
  class FlowRepo {
    <<interface>>
    +getAll(query) Flow[]
    +getById(id) Flow
    +getSummaries(query) FlowSummary[]
  }
  class ProjectRepo {
    <<interface>>
    +list(params) ProjectsPage
    +getById(id) Project
  }
  class FacilityRepo {
    <<interface>>
    +listByProject(projectId, params) FacilitiesPage
    +getById(projectId, facilityId) Facility
  }
  class SubmissionRepo {
    <<interface>>
    +saveDraft(input) id
    +getById(id) SubmissionSnapshot
    +findDraft(params) SubmissionSnapshot
    +listByStatus(status, userId) SubmissionSnapshot[]
    +markStatus(id, status, lastError)
    +markSynced(id)
    +delete(id)
  }
  class UserSessionRepo {
    <<interface>>
    +read() SessionRecord
    +save(record)
    +clear()
  }

  class HttpFlowRepo {
    +fetchCatalog(query) FlowCatalogResult
  }
  class OfflineFirstFlowRepo
  class sqliteFlowRepo
  class HttpProjectRepo
  class OfflineFirstProjectRepo
  class sqliteProjectRepo
  class HttpFacilityRepo
  class OfflineFirstFacilityRepo
  class sqliteFacilityRepo
  class sqliteSubmissionRepo {
    +assignOwner(userId)
    +listFailedSummaries(userId)
    +listPendingWithFiles(status)
  }
  class SecureStoreSessionRepo

  FlowRepo <|.. HttpFlowRepo
  FlowRepo <|.. OfflineFirstFlowRepo
  OfflineFirstFlowRepo --> HttpFlowRepo : usa
  OfflineFirstFlowRepo --> sqliteFlowRepo : cache

  ProjectRepo <|.. HttpProjectRepo
  ProjectRepo <|.. OfflineFirstProjectRepo
  OfflineFirstProjectRepo --> HttpProjectRepo
  OfflineFirstProjectRepo --> sqliteProjectRepo

  FacilityRepo <|.. HttpFacilityRepo
  FacilityRepo <|.. OfflineFirstFacilityRepo
  OfflineFirstFacilityRepo --> HttpFacilityRepo
  OfflineFirstFacilityRepo --> sqliteFacilityRepo

  SubmissionRepo <|.. sqliteSubmissionRepo
  UserSessionRepo <|.. SecureStoreSessionRepo
```

Los `OfflineFirst*Repo` implementan el mismo puerto que los `Http*Repo`: los casos de uso y la UI no distinguen el origen
de los datos.

---

## 4. Modelo de datos (SQLite)

```mermaid
erDiagram
  projects ||--o{ facilities : "project_id"
  flows ||--o{ flow_steps : "flow_id (ON DELETE CASCADE)"
  flows ||--o{ submissions : "flow_id"
  submissions ||--o| outbox : "payload.submissionId"

  projects {
    text id PK
    text name
    text status
    text user_ids_json
  }
  facilities {
    text id PK
    text project_id FK
    text name
    text status
    text user_ids_json
  }
  flows {
    text id PK
    text title
    text version
    text description
    int stepsCount
    text flowType
    int isActive
    text createdAt
    text updatedAt
  }
  flow_steps {
    text flow_id PK
    text step_id PK
    text step_json
  }
  submissions {
    text id PK
    text flow_id FK
    text step_id "siempre ALL"
    text payload_json "draft + projectId/facilityId/version"
    int has_files
    int synced
    int created_at
    text status "draft|queued|failed|legacy"
    text last_error
    text user_id
    int updated_at
  }
  outbox {
    text id PK
    text endpoint "tipo, p.ej. AUDIT_SUBMISSION"
    text method
    text payload_json
    text file_paths_json
    int attempts
    text last_error
    int created_at
    text status "pending|failed"
    int next_attempt_at
    text user_id
  }
```

Notas:

- `submissions` y `outbox` no tienen FK entre sí: el vínculo es lógico (`payload_json → submissionId`).
- Índices relevantes: `idx_outbox_ready(status, next_attempt_at, created_at)` para el lote, y
  `idx_submissions_status(status, flow_id)` para buscar drafts.
- Migraciones: 1 (esquema base) · 2 (proyectos y facilities) · 3 (metadatos de flows) · 4 (estados de
  submissions/outbox, `user_id`, backoff).
- Fuera de SQLite: tokens en SecureStore y fotos en `documentDirectory/kma/photos/<submissionId>/`.

---

## 5. Diagramas de estados

Los diagramas de transición de estados (submission, outbox, envío, corrida del flow, foto, `SyncService`,
sesión y catálogos) están en [DTE.md](./DTE.md).

---

## 6. Clases de sincronización

```mermaid
classDiagram
  class SyncService {
    -boolean running
    -boolean queued
    -boolean resetRequested
    -Timer wakeTimer
    +queue(opts)
    +runOnce()
    -run()
    -process(item)
    -handleRetry(item, reason)
    -scheduleWake(delayMs)
  }
  class OutboxRepo {
    <<interface>>
    +nextBatch(limit, now, userId) OutboxItem[]
    +markSuccess(id)
    +markRetry(id, nextAttemptAt, reason)
    +markFailed(id, reason)
    +defer(id, nextAttemptAt)
    +resetBackoff()
  }
  class sqliteOutboxRepo {
    +enqueue(params) id
    +requeue(id)
    +requeueBySubmissionId(id)
    +markFailedBySubmissionId(id, reason)
    +countPending(userId)
    +assignOwner(userId)
  }
  class OutboxItem {
    +string id
    +string type
    +unknown payload
    +number attempts
  }
  class Dispatcher {
    <<function>>
    +dispatch(item): success, retry, fail, drop o defer
  }
  class FileUploader {
    <<interface>>
    +upload(url, localUri, contentType) status
  }
  class expoFileUploader
  class UploadError {
    +response.status
  }

  SyncService --> OutboxRepo
  SyncService --> Dispatcher : delega
  OutboxRepo <|.. sqliteOutboxRepo
  SyncService ..> OutboxItem
  Dispatcher ..> sqliteSubmissionRepo : lee/borra
  Dispatcher ..> FileUploader : via submitAuditOnlineFromSnapshot
  FileUploader <|.. expoFileUploader
  expoFileUploader ..> UploadError : lanza
```

Constantes: `OUTBOX_BACKOFF_BASE_MS = 60 s`, `OUTBOX_BACKOFF_MAX_MS = 30 min`, `OUTBOX_MAX_ATTEMPTS = 15`.

---

## 7. Navegación de pantallas

```mermaid
flowchart LR
  L["(auth)/login"] -->|login OK| P["(app)/projects"]
  P -->|elige proyecto| F["(app)/facilities"]
  F -->|elige facility| S["(app)/selector"]
  S -->|"elige flow (steps por params)"| R["(app)/flow/[flowId]"]
  R -->|"Save audit"| S
  P -. header .-> PR["(app)/profile"]
  F -. header .-> PR
  S -. header .-> PR
  PR -->|logout| L
  G{{AuthGuard}} -. sin refreshToken .-> L
```

El `AuthGuard` envuelve todo `(app)`. El Selector muestra el banner de auditorías fallidas y el Profile su
sección con el botón *Retry*.
