let outboxTrigger: (() => void) | null = null

export function registerOutboxSyncTrigger(fn: () => void): void {
  outboxTrigger = fn
}

export function triggerOutboxSync(): void {
  if (!outboxTrigger) {
    if (__DEV__) {
      console.warn('[outboxTrigger] triggerOutboxSync called before registration')
    }
    return
  }

  try {
    outboxTrigger()
  } catch (err) {
    if (__DEV__) {
      console.warn('[outboxTrigger] Error running outbox trigger', err)
    }
  }
}
