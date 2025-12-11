import React, { memo, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, Keyboard } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import type { FormField, FormStep } from '@shared/validation/steps.schema'
import { styles } from './styles/dynamicForm.styles'
import PhotoField from './fields/PhotoField'

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
  const submitError = !canSubmit ? 'You must upload at least one photo to continue.' : ''

  const renderTextField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf }) => (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>{field.label}</Text>
          {field.unit ? (
            <View style={styles.inputRow}>
              <TextInput
                value={(rhf.value as string) ?? ''}
                onChangeText={rhf.onChange}
                onBlur={rhf.onBlur}
                style={styles.textInputWithUnit}
                returnKeyType="done"
                placeholder={field.placeholder}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>{field.unit}</Text>
              </View>
            </View>
          ) : (
            <TextInput
              value={(rhf.value as string) ?? ''}
              onChangeText={rhf.onChange}
              onBlur={rhf.onBlur}
              style={styles.textInput}
              returnKeyType="done"
              placeholder={field.placeholder}
            />
          )}
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
          {field.unit ? (
            <View style={styles.inputRow}>
              <TextInput
                value={(rhf.value as string) ?? ''}
                onChangeText={rhf.onChange}
                onBlur={rhf.onBlur}
                keyboardType="numeric"
                style={styles.textInputWithUnit}
                returnKeyType="done"
                placeholder={field.placeholder}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>{field.unit}</Text>
              </View>
            </View>
          ) : (
            <TextInput
              value={(rhf.value as string) ?? ''}
              onChangeText={rhf.onChange}
              onBlur={rhf.onBlur}
              keyboardType="numeric"
              style={styles.textInput}
              returnKeyType="done"
              placeholder={field.placeholder}
            />
          )}
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

        const shouldShowError = !!submitError && list.length === 0

        return (
          <View style={styles.inputBlock}>
            <PhotoField
              label={field.label}
              value={list}
              onAdd={onAdd}
              onRemoveAt={onRemoveAt}
              addButtonText="Add another photo"
              removeButtonText="Remove"
              testID={`photo-field-${field.id}`}
            />
            {shouldShowError && <Text style={styles.errorText}>{submitError}</Text>}
          </View>
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

  const handleNextPress = useCallback(
    () =>
      handleSubmit(values => {
        Keyboard.dismiss()
        onSubmit(values)
      })(),
    [handleSubmit, onSubmit],
  )

  return (
    <View style={styles.container}>
      <View style={styles.formFields}>{step.fields.map(renderField)}</View>

      <TouchableOpacity
        onPress={handleNextPress}
        style={[styles.button, styles.primaryBtn, isSubmitDisabled && styles.btnDisabled]}
        disabled={isSubmitDisabled}
        accessibilityRole="button"
        accessibilityLabel="Next"
      >
        <Text style={[styles.btnText, styles.primaryBtnText]}>NEXT</Text>
      </TouchableOpacity>
    </View>
  )
}

export const DynamicForm = memo(DynamicFormBase)
