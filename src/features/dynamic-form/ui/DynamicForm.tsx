import React, { memo, useCallback, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, Keyboard } from 'react-native'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { FormField, FormStep } from '@shared/validation/steps.schema'
import { styles } from './styles/dynamicForm.styles'
import PhotoField from './fields/PhotoField'
import { sortFields } from '../lib/sortFields'
import { buildFieldsSchema, countPhotos, hasRequiredFields } from '../lib/buildFieldsSchema'

type Field = FormField

/** Id del step terminal. Sin `next` el runner también termina en END (ver `replayPath`). */
const END_STEP_ID = 'END'

const labelOf = (field: Field) => (field.required ? `${field.label} (required)` : field.label)

const FieldError: React.FC<{ message?: string | undefined }> = ({ message }) =>
  message ? <Text style={styles.fieldError}>{message}</Text> : null

type Props = {
  step: FormStep
  onSubmit: (values: Record<string, unknown>) => void
  /** Valores previos (reanudar un draft): pisan los defaults de cada campo. */
  initialValues?: Record<string, unknown> | undefined
  capturePhoto?: () => Promise<string | null>
  /** Borra el archivo local de una foto quitada del form. */
  discardPhoto?: (uri: string) => Promise<void>
}

/** DynamicForm
 * - Orquesta el render de cada field y delega UI específica a subcomponentes.
 * - Compatibilidad: si `photo` viniera como string desde datos antiguos, se normaliza a string[] solo en UI.
 */
function DynamicFormBase({ step, onSubmit, capturePhoto, discardPhoto, initialValues }: Props) {
  // Orden configurado por el admin (defensa por `order`; normalmente ya viene ordenado)
  const fields = useMemo(() => sortFields(step.fields), [step.fields])

  const defaultValues = React.useMemo(() => {
    const acc: Record<string, unknown> = {}
    for (const f of fields) {
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
    // Valores previos (draft reanudado) sobre los defaults
    if (initialValues) {
      for (const f of fields) {
        if (f.id in acc && initialValues[f.id] !== undefined) acc[f.id] = initialValues[f.id]
      }
    }
    return acc
    // initialValues sólo se lee al montar el form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  const schema = useMemo(() => buildFieldsSchema(fields), [fields])
  const resolver = useMemo(() => zodResolver(schema) as Resolver<Record<string, unknown>>, [schema])

  const { control, handleSubmit, watch } = useForm<Record<string, unknown>>({
    defaultValues,
    resolver,
    mode: 'onBlur',
  })

  // Con `required` en los fields rige la validación por campo; sin él, la regla legacy:
  // al menos una foto cargada en cualquier campo 'photo'.
  const legacyPhotoRule = !hasRequiredFields(fields)

  const photoFieldIds = useMemo(
    () => (legacyPhotoRule ? fields.filter(f => f.type === 'photo').map(f => f.id) : []),
    [fields, legacyPhotoRule],
  )

  const watchedPhotoValues = watch(photoFieldIds) as unknown[] | undefined

  const canSubmit = useMemo(() => {
    if (!legacyPhotoRule || photoFieldIds.length === 0) return true
    if (!watchedPhotoValues || watchedPhotoValues.length === 0) return false

    return watchedPhotoValues.some(v => countPhotos(v) > 0)
  }, [legacyPhotoRule, photoFieldIds.length, watchedPhotoValues])

  const isSubmitDisabled = !canSubmit
  const submitError =
    legacyPhotoRule && !canSubmit ? 'You must upload at least one photo to continue.' : ''

  const renderTextField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf, fieldState }) => (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>{labelOf(field)}</Text>
          {field.unit ? (
            <View
              style={[
                styles.inputRow,
                field.multiline && styles.inputRowMultiline,
                fieldState.error && styles.inputError,
              ]}
            >
              <TextInput
                value={(rhf.value as string) ?? ''}
                onChangeText={rhf.onChange}
                onBlur={rhf.onBlur}
                style={[
                  styles.textInputWithUnit,
                  field.multiline && styles.textInputWithUnitMultiline,
                ]}
                returnKeyType={field.multiline ? 'default' : 'done'}
                placeholder={field.placeholder}
                multiline={field.multiline === true}
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
              style={[
                styles.textInput,
                field.multiline && styles.textInputMultiline,
                fieldState.error && styles.inputError,
              ]}
              returnKeyType={field.multiline ? 'default' : 'done'}
              placeholder={field.placeholder}
              multiline={field.multiline === true}
            />
          )}
          <FieldError message={fieldState.error?.message} />
        </View>
      )}
    />
  )

  const renderNumberField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf, fieldState }) => {
        // Normalizar coma a punto para decimales (teclado iOS español muestra coma)
        const handleNumericChange = (text: string) => {
          const normalized = text.replace(/,/g, '.')
          rhf.onChange(normalized)
        }

        return (
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{labelOf(field)}</Text>
            {field.unit ? (
              <View style={[styles.inputRow, fieldState.error && styles.inputError]}>
                <TextInput
                  value={(rhf.value as string) ?? ''}
                  onChangeText={handleNumericChange}
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
                onChangeText={handleNumericChange}
                onBlur={rhf.onBlur}
                keyboardType="numeric"
                style={[styles.textInput, fieldState.error && styles.inputError]}
                returnKeyType="done"
                placeholder={field.placeholder}
              />
            )}
            <FieldError message={fieldState.error?.message} />
          </View>
        )
      }}
    />
  )

  const renderPhotoField = (field: Field) => (
    <Controller
      key={field.id}
      control={control}
      name={field.id}
      render={({ field: rhf, fieldState }) => {
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
          const removed = list[index]
          const next = list.slice(0, index).concat(list.slice(index + 1))
          if (removed && discardPhoto) void discardPhoto(removed)
          rhf.onChange(next)
        }

        const legacyError = legacyPhotoRule && !!submitError && list.length === 0
        const errorMessage = legacyError ? submitError : fieldState.error?.message

        return (
          <View style={styles.inputBlock}>
            <PhotoField
              label={labelOf(field)}
              value={list}
              onAdd={onAdd}
              onRemoveAt={onRemoveAt}
              addButtonText="Add another photo"
              removeButtonText="Remove"
              testID={`photo-field-${field.id}`}
            />
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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

  const actionLabel = !step.next || step.next === END_STEP_ID ? 'Submit' : 'Next'

  return (
    <View style={styles.container}>
      <View style={styles.formFields}>{fields.map(renderField)}</View>

      <TouchableOpacity
        onPress={handleNextPress}
        style={[styles.button, styles.primaryBtn, isSubmitDisabled && styles.btnDisabled]}
        disabled={isSubmitDisabled}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={[styles.btnText, styles.primaryBtnText]}>{actionLabel.toUpperCase()}</Text>
      </TouchableOpacity>
    </View>
  )
}

export const DynamicForm = memo(DynamicFormBase)
