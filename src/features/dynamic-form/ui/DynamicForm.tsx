import React, { memo, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import type { FormField, FormStep } from '@shared/validation/steps.schema'
import { styles } from './styles/dynamicForm.styles'
import PhotoField from './fields/PhotoField'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Field = FormField

type Props = {
  step: FormStep
  onSubmit: (values: Record<string, unknown>) => void
  capturePhoto?: () => Promise<string | null>
}

/** DynamicForm
 * - Orquesta el render de cada field y delega UI específica a subcomponentes.
 * - Compatibilidad: si `photo` viniera como string desde datos antiguos, se normaliza a string[] solo en UI.
 */
function DynamicFormBase({ step, onSubmit, capturePhoto }: Props) {
  const insets = useSafeAreaInsets()
  const defaultValues = React.useMemo(() => {
    const acc: Record<string, unknown> = {}
    for (const f of step.fields) {
      switch (f.type) {
        case 'text':
        case 'number':
          acc[f.id] = ''
          break
        case 'photo':
          acc[f.id] = [] as string[]
          break
        case 'button':
          // sin valor controlado
          break
      }
    }
    return acc
  }, [step.fields])

  const { control, handleSubmit, watch } = useForm<Record<string, unknown>>({
    defaultValues,
    mode: 'onBlur',
  })

  // --- Habilitación del submit: al menos una foto cargada en cualquier campo 'photo'
  const photoFieldIds = useMemo(
    () => step.fields.filter(f => f.type === 'photo').map(f => f.id),
    [step.fields],
  )

  const watchedPhotoValues = watch(photoFieldIds) as unknown[] | undefined

  const canSubmit = useMemo(() => {
    if (photoFieldIds.length === 0) return true
    if (!watchedPhotoValues || watchedPhotoValues.length === 0) return false

    const countPhotos = (v: unknown) => {
      if (Array.isArray(v)) return v.length
      if (typeof v === 'string') return v ? 1 : 0
      return 0
    }

    return watchedPhotoValues.some(v => countPhotos(v) > 0)
  }, [photoFieldIds.length, watchedPhotoValues])

  const isSubmitDisabled = !canSubmit

  const [kbHeight, setKbHeight] = useState<number>(0)
  React.useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, e => setKbHeight(e.endCoordinates?.height ?? 0))
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  const bottomSpacer = Math.max(0, kbHeight - insets.bottom)

  const renderTextField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf }) => (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            value={(rhf.value as string) ?? ''}
            onChangeText={rhf.onChange}
            onBlur={rhf.onBlur}
            placeholder={field.label}
            style={styles.textInput}
            returnKeyType="done"
          />
        </View>
      )}
    />
  )

  const renderNumberField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf }) => (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            value={(rhf.value as string) ?? ''}
            onChangeText={rhf.onChange}
            onBlur={rhf.onBlur}
            placeholder={field.label}
            keyboardType="numeric"
            style={styles.textInput}
            returnKeyType="done"
          />
        </View>
      )}
    />
  )

  const renderPhotoField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf }) => {
        const raw = rhf.value as unknown
        const list: string[] = Array.isArray(raw)
          ? (raw as string[])
          : typeof raw === 'string' && raw
            ? [raw]
            : []

        const onAdd = async () => {
          if (!capturePhoto) return null
          const uri = await capturePhoto()
          if (uri) rhf.onChange([...list, uri])
          return uri ?? null
        }

        const onRemoveAt = (index: number) => {
          if (index < 0 || index >= list.length) return
          const next = list.slice(0, index).concat(list.slice(index + 1))
          rhf.onChange(next)
        }

        return (
          <PhotoField
            label={field.label}
            value={list}
            onAdd={onAdd}
            onRemoveAt={onRemoveAt}
            addButtonText="Add another photo"
            removeButtonText="Remove"
            testID={`photo-field-${field.id}`}
          />
        )
      }}
    />
  )

  const renderButtonField = (field: Field) => (
    <View key={field.id} style={styles.inputBlock}>
      <TouchableOpacity
        onPress={() => {}}
        style={[styles.button, styles.secondaryBtn]}
        accessibilityRole="button"
        accessibilityLabel={field.label}
      >
        <Text style={styles.btnText}>{field.label}</Text>
      </TouchableOpacity>
    </View>
  )

  const renderField = (field: Field) => {
    switch (field.type) {
      case 'text':
        return renderTextField(field)
      case 'number':
        return renderNumberField(field)
      case 'photo':
        return renderPhotoField(field)
      case 'button':
        return renderButtonField(field)
      default:
        return null
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.container}>
        {!!step.title && <Text style={styles.title}>{step.title}</Text>}
        <View style={styles.formFields}>{step.fields.map(renderField)}</View>

        <TouchableOpacity
          onPress={handleSubmit(values => onSubmit(values))}
          style={[styles.button, styles.primaryBtn, isSubmitDisabled && styles.btnDisabled]}
          disabled={isSubmitDisabled}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Text style={[styles.btnText, styles.primaryBtnText]}>NEXT</Text>
        </TouchableOpacity>

        {/* Spacer dinámico: permite scrollear por encima del teclado sin tocar el ScrollView padre */}
        <View style={{ height: bottomSpacer }} />
      </View>
    </KeyboardAvoidingView>
  )
}

export const DynamicForm = memo(DynamicFormBase)
