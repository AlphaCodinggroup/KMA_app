# 04 — Ejecución de un flow, draft y reanudación

El draft se guarda **siempre en SQLite**, con o sin red. Una auditoría = una fila de `submissions`
(id estable por corrida).

## 4.1 Iniciar un flow y responder pasos

```mermaid
sequenceDiagram
  actor A as Auditor
  participant SEL as SelectorScreen
  participant RT as Router
  participant HK as useFlowRunner
  participant UC as usecases (persistDraft)
  participant SR as sqliteSubmissionRepo
  participant DB as SQLite

  A->>SEL: elige un flow
  SEL->>RT: push /flow/[flowId] (flowId, title, version, steps JSON, projectId, facilityId)
  RT->>HK: monta FlowRunnerScreen
  HK->>HK: boot(): parseStepsParam + resolveInitialStepId
  Note over HK: ver 4.2: ¿hay un draft para reanudar?
  HK-->>A: muestra el primer paso

  loop por cada respuesta
    A->>HK: onAnswer / onSubmitForm / onSelectOption
    HK->>HK: guarda en answersRef
    HK->>HK: resuelve el próximo paso (reglas yes/no, condicionales, select)
    HK->>HK: poda respuestas de ramas abandonadas
    HK->>UC: persistDraft({submissionId, answers, project, facility, version})
    UC->>SR: saveDraft({id: submissionId, ...})
    SR->>DB: UPDATE o INSERT (status 'draft', user_id)
    HK->>HK: recorta/agrega pasos visibles y hace scroll
    HK-->>A: siguiente paso
  end
```

Todo esto ocurre localmente: el flow viene por parámetros de navegación (cargado de la cache) y el draft va a
SQLite, por lo que **no necesita red**.

## 4.2 Reanudar o empezar de nuevo

```mermaid
sequenceDiagram
  actor A as Auditor
  participant HK as useFlowRunner.boot
  participant UC as usecases
  participant SR as sqliteSubmissionRepo
  participant PH as discardPhotoGroup

  HK->>UC: findResumableDraft(flowId, projectId, facilityId)
  UC->>SR: findDraft(... userId actual)
  SR-->>UC: draft más reciente o null
  alt no hay draft
    HK->>HK: nueva corrida (newSubmissionId)
  else el draft es de otra versión del flow
    HK->>UC: discardDraft(id)
    UC->>SR: delete(id)
    UC->>PH: borra kma/photos/<id>
    HK-->>A: aviso "Flow updated" y arranca de cero
  else hay draft de la misma versión
    HK-->>A: "Resume draft?" (Start over / Resume draft)
    alt Resume draft
      HK->>HK: replayPath(steps, answers) reconstruye pasos visibles
      HK->>HK: descarta respuestas fuera del camino
      HK->>HK: reutiliza el submissionId del draft
      HK-->>A: continúa donde quedó (formularios y fotos precargados)
    else Start over
      HK->>UC: discardDraft(id) → fila + fotos
      HK->>HK: nueva corrida
    end
  end
```

Salir de la pantalla y volver no reinicia la corrida (el `boot` solo corre al montar o cuando cambian los params).
Si el auditor sale sin terminar, el draft queda disponible para la próxima vez.
