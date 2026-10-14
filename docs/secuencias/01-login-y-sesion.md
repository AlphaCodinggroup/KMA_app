# 01 — Login, sesión y refresh de token

Participantes: Auditor, LoginScreen/`useLogin`, `loginUseCase`, Cognito, Session, SecureStore, AuthGuard, Http.

## 1.1 Login (online)

```mermaid
sequenceDiagram
  actor A as Auditor
  participant UI as LoginScreen / useLogin
  participant UC as loginUseCase
  participant C as Cognito
  participant S as Session
  participant SS as SecureStore
  participant G as AuthGuard
  participant B as Bootstrap (suscripciones)

  A->>UI: usuario + contraseña
  UI->>UC: loginUseCase(username, password)
  UC->>C: InitiateAuth
  alt credenciales válidas
    C-->>UC: IdToken, AccessToken, RefreshToken, ExpiresIn
    UC-->>UI: LoginTokens
    UI->>S: saveSession(tokens)
    S->>SS: guarda tokens (chunked)
    S-->>S: actualiza memoria + emit "login"
    S-->>B: evento login
    B->>B: claimOrphanRows + queue({resetBackoff}) + sync catálogos y flows
    S-->>G: evento login → hasSession = true
    UI->>UI: router.replace("/(app)/projects")
  else NotAuthorized / UserNotFound / etc.
    C-->>UC: error 4xx
    UC-->>UI: AuthError(code)
    UI-->>A: mensaje legible (normalizeAuthError)
  end
```

El login requiere red. Sin conexión la pantalla muestra el error de red y no se crea sesión.

## 1.2 Reapertura de la app con sesión persistida (online u offline)

```mermaid
sequenceDiagram
  actor A as Auditor
  participant R as RootLayout
  participant BS as bootstrapApp
  participant S as Session
  participant SS as SecureStore
  participant G as AuthGuard
  participant UI as Rutas (app)

  A->>R: abre la app
  R->>BS: bootstrapApp()
  BS->>S: initSession()
  S->>SS: read()
  SS-->>S: SessionRecord (o null)
  S-->>BS: snapshot en memoria
  BS-->>R: listo
  R->>G: render (app)
  alt hay refreshToken
    G-->>UI: renderiza las pantallas (sin pedir login)
  else no hay refreshToken
    G->>G: router.replace("/(auth)/login")
  end
```

No hace falta red para entrar: el IdToken vencido se renueva recién cuando hay una request que lo necesita.

## 1.3 Request con token vencido (refresh single-flight)

```mermaid
sequenceDiagram
  participant UC as UseCase / Repo HTTP
  participant H as Http (interceptor)
  participant S as Session
  participant C as Cognito
  participant SS as SecureStore
  participant API as API

  UC->>H: request
  H->>S: getValidToken()
  alt IdToken en memoria vigente
    S-->>H: IdToken
  else vencido y hay refreshToken
    Note over S: una sola renovación en vuelo,<br/>las demás esperan la misma promesa
    S->>C: REFRESH_TOKEN_AUTH
    alt refresh OK
      C-->>S: nuevo IdToken / AccessToken
      S->>SS: save (refreshToken se conserva)
      S-->>S: emit "refresh" y "change"
      S-->>H: IdToken
    else refresh token rechazado (NotAuthorized)
      S->>S: clearSession() → emit "logout"
      S-->>H: error
      H-->>UC: rechaza + toast "Session expired" (una vez)
    else falla de red / timeout (offline)
      S-->>H: error recuperable
      H-->>UC: rechaza SIN desloguear ni toast
    end
  end
  H->>API: request + Authorization: Bearer IdToken
  alt 401
    API-->>H: 401
    H->>S: renueva (una vez) y reintenta
  else OK
    API-->>H: 2xx
    H-->>UC: respuesta
  end
```

Offline: el fallo de refresh por red no cierra la sesión; el outbox reintenta cuando vuelva la conexión.

## 1.4 Logout

```mermaid
sequenceDiagram
  actor A as Auditor
  participant P as ProfileScreen
  participant O as sqliteOutboxRepo
  participant L as logoutUseCase
  participant C as Cognito
  participant S as Session
  participant G as AuthGuard

  A->>P: Sign out
  P->>O: countPending(userId)
  Note over P,O: con pendientes se confirma (ver flujo 09)
  P->>L: logoutUseCase()
  L->>C: GlobalSignOut(accessToken) — best-effort
  C-->>L: ok / error ignorado
  L->>S: clearSession()
  S-->>S: borra SecureStore + memoria, emit "logout"
  S-->>G: evento logout → hasSession = false
  G->>G: router.replace("/(auth)/login")
```

Si no hay red, el `GlobalSignOut` falla y se ignora: la sesión local igual se limpia.
