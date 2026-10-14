# 09 — Pendientes por usuario y logout

Las submissions y los items de outbox llevan `user_id` (el `sub` del IdToken). El outbox solo se drena con el
token de su dueño.

## 9.1 Logout con auditorías pendientes

```mermaid
sequenceDiagram
  actor A as Auditor (usuario A)
  participant P as ProfileScreen
  participant OB as sqliteOutboxRepo
  participant L as logoutUseCase
  participant S as Session
  participant G as AuthGuard

  A->>P: Sign out
  P->>OB: countPending(userId A)
  alt 0 pendientes
    P->>L: logoutUseCase()
  else N pendientes
    P-->>A: "You have N audits pending sync. They will be sent the next time you log in."
    alt Cancel
      P-->>A: no hace nada
    else Sign out
      P->>L: logoutUseCase()
    end
  end
  L->>S: GlobalSignOut + clearSession()
  S-->>G: logout → login
```

Los datos locales **no se borran** al cerrar sesión: drafts, auditorías encoladas y fotos quedan en el dispositivo.

## 9.2 Otro usuario inicia sesión en el mismo dispositivo

```mermaid
sequenceDiagram
  actor B as Auditor (usuario B)
  participant LG as Login
  participant S as Session
  participant BS as Bootstrap (evento login)
  participant DB as SQLite
  participant SY as SyncService

  B->>LG: login (usuario B)
  LG->>S: saveSession → emit "login"
  S-->>BS: login
  BS->>DB: claimOrphanRows(): solo filas con user_id NULL → B
  BS->>SY: queue({resetBackoff:true})
  SY->>DB: nextBatch(..., userId B)
  Note over SY,DB: solo items con user_id = B.<br/>Los de A quedan intactos y NO se envían con el token de B.
  DB-->>SY: items de B (los de A no aparecen)
```

También quedan filtrados por usuario: la búsqueda de drafts para reanudar y la lista de auditorías fallidas.

## 9.3 Vuelve el usuario original

```mermaid
sequenceDiagram
  actor A as Auditor (usuario A)
  participant LG as Login
  participant BS as Bootstrap
  participant SY as SyncService
  participant DB as SQLite
  participant API as API

  A->>LG: login (usuario A)
  LG-->>BS: evento login
  BS->>SY: queue({resetBackoff:true})
  SY->>DB: nextBatch(..., userId A)
  DB-->>SY: auditorías pendientes de A
  SY->>API: las envía con el token de A (flujo 06)
```

## 9.4 Sin sesión

Sin `refreshToken` persistido, los triggers del bootstrap son no-op. Con refresh token pero sin `sub`
decodificable, `SyncService` no drena (`getUserId() = null`). Los items esperan hasta que haya un usuario válido.

## 9.5 Filas sin dueño

Las filas creadas por versiones anteriores de la app no tienen `user_id` (`NULL`). En el primer arranque con sesión
(y en cada login) se asignan al usuario actual, asumiendo un solo auditor por dispositivo en esos datos.
