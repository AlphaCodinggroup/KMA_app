# DTE — Diagramas de transición de estados

Estados y transiciones de las entidades con ciclo de vida en KMA Mobile. Contexto en
[ARQUITECTURA.md](./ARQUITECTURA.md); el modelo de datos en [UML.md](./UML.md).

Índice: 1. [Submission](#1-submission-auditoría-local) · 2. [Item de outbox](#2-item-de-outbox) ·
3. [Envío de una auditoría](#3-envío-de-una-auditoría) · 4. [Corrida del flow runner](#4-corrida-del-flow-runner) ·
5. [Foto](#5-foto) · 6. [SyncService](#6-syncservice) · 7. [Sesión](#7-sesión) ·
8. [Sincronización de catálogos](#8-sincronización-de-catálogos)

---

## 1. Submission (auditoría local)

Columna `submissions.status`.

```mermaid
stateDiagram-v2
  [*] --> draft : se responde el primer paso
  draft --> draft : cada paso guarda en la misma fila
  draft --> [*] : Start over / flow cambió de versión (se borra fila y fotos)
  draft --> queued : "Save audit" (se encola AUDIT_SUBMISSION)
  queued --> [*] : envío OK (se borra fila y fotos)
  queued --> failed : 4xx no recuperable, 15 intentos o foto faltante
  failed --> queued : Retry
  legacy --> legacy : se conserva, no se muestra
```

| Estado | Significado | Visible para el auditor |
|---|---|---|
| `draft` | auditoría en curso | se ofrece reanudarla al abrir el mismo flow/facility |
| `queued` | terminada, con item pendiente en el outbox | sí (como pendiente) |
| `failed` | el envío falló sin remedio automático | banner en Selector y sección en Profile, con *Retry* |
| `legacy` | filas anteriores al control de estados, sin item en outbox | no |

## 2. Item de outbox

Columna `outbox.status` más `attempts` y `next_attempt_at`.

```mermaid
stateDiagram-v2
  [*] --> pending : enqueue
  state pending {
    [*] --> listo
    listo --> en_espera : retry (attempts+1, backoff)
    en_espera --> listo : vence next_attempt_at o resetBackoff
    listo --> en_espera : defer (tipo desconocido, sin sumar intentos)
  }
  pending --> [*] : success o drop (se borra)
  pending --> failed : fail o attempts llega a 15
  failed --> pending : requeue (attempts=0, sin backoff)
```

`listo` = `pending` con `next_attempt_at` nulo o vencido: es el único subestado que entra en el lote.

## 3. Envío de una auditoría

Etapas internas de `submitAuditOnlineFromSnapshot` y su resultado hacia el `SyncService`.

```mermaid
stateDiagram-v2
  [*] --> VerificandoRed
  VerificandoRed --> retry : sin red
  VerificandoRed --> PidiendoPresign : online
  PidiendoPresign --> retry : error recuperable o falta URL de una foto
  PidiendoPresign --> fail : 4xx no recuperable
  PidiendoPresign --> SubiendoFotos : URLs de todas las fotos
  SubiendoFotos --> retry : error de red, 5xx o 403 de S3
  SubiendoFotos --> CreandoAuditoria : todas subidas
  CreandoAuditoria --> retry : timeout, 5xx, 429, 401, 403, 408
  CreandoAuditoria --> fail : 4xx no recuperable
  CreandoAuditoria --> LimpiandoLocal : 2xx
  LimpiandoLocal --> success : fotos, directorio y fila borrados
  success --> [*]
  retry --> [*]
  fail --> [*]
```

`retry`, `fail` y `success` son los resultados que consume el dispatcher (ver diagrama 2).

## 4. Corrida del flow runner

Ciclo de una auditoría desde que se abre el flow hasta que se guarda.

```mermaid
stateDiagram-v2
  [*] --> Cargando : se monta la pantalla
  Cargando --> Decidiendo : hay draft del mismo flow, facility y usuario
  Cargando --> EnCurso : no hay draft (corrida nueva)
  Decidiendo --> EnCurso : Start over (draft descartado)
  Decidiendo --> EnCurso : Resume draft (replayPath)
  Decidiendo --> EnCurso : otra versión del flow (se descarta con aviso)
  EnCurso --> EnCurso : responder paso (poda ramas y guarda draft)
  EnCurso --> Completo : se llega al paso End
  Completo --> EnCurso : el auditor cambia una respuesta anterior
  Completo --> Guardando : "Save audit"
  Guardando --> [*] : encolada, vuelve al Selector
  Guardando --> Completo : error al guardar (alerta)
  EnCurso --> [*] : sale de la pantalla (el draft queda guardado)
```

Los pasos visibles son una lista que crece al avanzar y se recorta al cambiar una respuesta anterior.

## 5. Foto

Archivo local de una foto de la auditoría.

```mermaid
stateDiagram-v2
  [*] --> EnCache : cámara o galería devuelven la uri
  EnCache --> Persistida : persistPhoto (HEIC a JPEG y copia a kma/photos)
  Persistida --> Descartada : el auditor la quita o hace Start over
  Persistida --> Subida : PUT a S3 correcto
  Persistida --> Faltante : el archivo ya no existe (migración)
  Subida --> Borrada : envío OK, se elimina el directorio de la submission
  Descartada --> [*]
  Borrada --> [*]
  Faltante --> [*] : la auditoría queda failed (photo_missing)
```

En SQLite la foto es solo una uri dentro de las respuestas del `Form`; el estado lo determina dónde está el archivo.

## 6. SyncService

```mermaid
stateDiagram-v2
  [*] --> Inactivo
  Inactivo --> Corriendo : queue() / runOnce()
  Corriendo --> CorriendoConPendiente : queue() mientras corre
  CorriendoConPendiente --> Corriendo : termina y se repite
  Corriendo --> Inactivo : sin usuario, sin red o cola vacía
  Corriendo --> Esperando : hay items en backoff (un solo timer)
  Esperando --> Corriendo : vence el timer o llega otro trigger
```

Dentro de `Corriendo` se drenan lotes hasta vaciar lo que está listo (máximo 50 lotes por corrida).

## 7. Sesión

```mermaid
stateDiagram-v2
  [*] --> SinSesion
  SinSesion --> Activa : login
  Activa --> Activa : refresh de IdToken
  Activa --> Activa : refresh falla por red (se conserva)
  Activa --> SinSesion : logout
  Activa --> SinSesion : refresh token rechazado (NotAuthorized)
```

Al volver a `SinSesion` el `AuthGuard` redirige al login. Los datos locales no se borran.

## 8. Sincronización de catálogos

```mermaid
stateDiagram-v2
  [*] --> Libre
  Libre --> Libre : offline o dentro del cooldown de 60 s (no hace nada)
  Libre --> EnCurso : trigger con red
  EnCurso --> EnCurso : otro trigger (comparte la misma promesa)
  EnCurso --> Proyectos
  Proyectos --> Flows
  Flows --> Facilities
  Facilities --> Libre : termina (registra la hora)
  Proyectos --> Flows : error (se registra y sigue)
  Flows --> Facilities : error (se registra y sigue)
```
