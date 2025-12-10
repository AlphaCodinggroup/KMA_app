import React, { type PropsWithChildren } from 'react'
import Toast from 'react-native-toast-message'
import { toastConfig } from './toastConfig'

export type AppToastType = 'success' | 'error' | 'info'

interface ShowToastParams {
  type?: AppToastType
  title?: string
  message?: string
}

/**
 * Provider global del sistema de toasts de la app.
 */
export const AppToastProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <>
      {children}
      {/* Componente raíz de la librería: debe estar al final del árbol */}
      <Toast config={toastConfig} />
    </>
  )
}

/**
 * Helper genérico para mostrar un toast con nuestra convención de props.
 * Esto evita depender directamente de la API de la librería en el resto de la app.
 */
export function showAppToast({ type = 'info', title, message }: ShowToastParams): void {
  Toast.show({
    type,
    text1: title, // si es undefined, la librería simplemente no muestra título
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    autoHide: true,
  })
}

/**
 * Atajos genéricos.
 */
export function showSuccessToast(message: string, title: string = 'Success'): void {
  showAppToast({ type: 'success', title, message })
}

export function showErrorToast(message: string, title: string = 'Error'): void {
  showAppToast({ type: 'error', title, message })
}

/**
 * Caso específico para auditorías creadas.
 * Se espera que se le pase el título de la auditoría.
 */
export function showAuditCreatedToast(auditTitle?: string): void {
  const message =
    auditTitle && auditTitle.trim().length > 0
      ? `Audit "${auditTitle}" created successfully.`
      : 'Audit created successfully.'
  showSuccessToast(message)
}

/**
 * Caso específico para cuando la auditoría se guarda localmente
 * (antes de enviarse al backend).
 */
export function showAuditProcessingToast(auditTitle?: string): void {
  const message =
    auditTitle && auditTitle.trim().length > 0
      ? `We are processing the audit "${auditTitle}".`
      : 'We are processing the audit.'
  showAppToast({
    type: 'info',
    title: 'Processing',
    message,
  })
}

/**
 * Caso específico para expiración de sesión (token vencido).
 * Pensado para llamarse desde el interceptor de auth / manejo de 401.
 */
export function showAuthExpiredToast(): void {
  showErrorToast('Your session has expired. Please sign in again.', 'Session expired')
}

export default AppToastProvider
