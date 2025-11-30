import {
  BaseToast,
  ErrorToast,
  type BaseToastProps,
  type ToastConfig,
} from 'react-native-toast-message'
import { styles } from './toastConfig.styles'

/**
 * Config global de toasts.
 *
 * Centraliza el look & feel para:
 *  - success
 *  - info
 *  - error
 *
 * De esta forma, el resto de la app solo usa los helpers
 * (showAuditCreatedToast, showAuditProcessingToast, showAuthExpiredToast, etc.)
 * y no se acopla a la librería.
 */
const renderBase = (props: BaseToastProps, variant: 'success' | 'info') => (
  <BaseToast
    {...props}
    style={[styles.base, variant === 'success' ? styles.success : styles.info, props.style]}
    contentContainerStyle={[styles.content, props.contentContainerStyle]}
    text1Style={[styles.text1, props.text1Style]}
    text2Style={[styles.text2, props.text2Style]}
    text1NumberOfLines={1}
    text2NumberOfLines={2}
  />
)

const renderError = (props: BaseToastProps) => (
  <ErrorToast
    {...props}
    style={[styles.base, styles.error, props.style]}
    contentContainerStyle={[styles.content, props.contentContainerStyle]}
    text1Style={[styles.text1, styles.textError, props.text1Style]}
    text2Style={[styles.text2, props.text2Style]}
    text1NumberOfLines={1}
    text2NumberOfLines={3}
  />
)

export const toastConfig: ToastConfig = {
  success: props => renderBase(props, 'success'),
  info: props => renderBase(props, 'info'),
  error: props => renderError(props),
}
