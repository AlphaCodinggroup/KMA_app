import React, { memo } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
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

  const { control, handleSubmit } = useForm<Record<string, unknown>>({
    defaultValues,
    mode: 'onBlur',
  })

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
      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [styles.button, styles.secondaryBtn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel={field.label}
      >
        <Text style={styles.btnText}>{field.label}</Text>
      </Pressable>
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
    <View style={styles.container}>
      {!!step.title && <Text style={styles.title}>{step.title}</Text>}
      <View style={styles.formFields}>{step.fields.map(renderField)}</View>

      <Pressable
        onPress={handleSubmit(values => onSubmit(values))}
        style={({ pressed }) => [styles.button, styles.primaryBtn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Next"
      >
        <Text style={[styles.btnText, styles.primaryBtnText]}>NEXT</Text>
      </Pressable>
    </View>
  )
}

export const DynamicForm = memo(DynamicFormBase)
