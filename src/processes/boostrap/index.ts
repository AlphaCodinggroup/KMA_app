/**
 * @file Hook de arranque (bootstrap) de la app.
 * Ejecuta migraciones de SQLite y registra los triggers de sincronización:
 * - Foreground: al volver la app a primer plano.
 * - BackgroundFetch: tarea periódica best-effort en iOS/Android.
 * - Reconexión de red: dispara un ciclo de sync al recuperar conectividad.
 *
 * @remarks
 * - Llamar este hook **una sola vez** en el layout raíz (p. ej., `app/_layout.tsx`).
 * - `BackgroundFetch` es de mejor esfuerzo; no garantiza ejecución estricta.
 * - En web, `expo-sqlite` no está soportado; usar dispositivos/emuladores nativos.
 *
 * @example
 * // app/_layout.tsx
 * import { Stack } from 'expo-router';
 * import { useBootstrap } from '@processes/bootstrap';
 *
 * export default function RootLayout() {
 *   useBootstrap(); // inicializa DB + sync
 *   return <Stack screenOptions={{ headerShown: false }} />;
 * }
 */

import { useEffect } from 'react'
import { runMigrations } from '@core/repos/sqlite'
import {
  registerBackgroundSync,
  registerForegroundTriggers,
  runSyncCycle,
} from '@processes/sync/service'
import NetInfo from '@react-native-community/netinfo'

/**
 * Inicializa la infraestructura de la app (migraciones y sincronización).
 * - Corre migraciones de SQLite (idempotentes).
 * - Registra triggers de sync en foreground y background.
 * - Escucha cambios de conectividad y sincroniza al reconectar.
 *
 * @returns {void}
 */
export function useBootstrap(): void {
  useEffect(() => {
    ;(async () => {
      await runMigrations() // Migraciones (API async de expo-sqlite)
      registerForegroundTriggers()
      registerBackgroundSync()
    })()

    // Al recuperar conectividad efectiva, disparar un ciclo de sync
    const sub = NetInfo.addEventListener(async s => {
      if (s.isConnected && (s.isInternetReachable ?? true)) {
        await runSyncCycle()
      }
    })

    // Limpieza del listener de red al desmontar
    return () => sub()
  }, [])
}
