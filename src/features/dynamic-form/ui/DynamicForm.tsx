import { memo } from 'react'
import { View, Text, TextInput, Pressable, Image, Alert } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import type { FieldSchema, FormStep } from '@shared/validation/steps.schema'
import { AppColors } from '@shared/ui/colors'
import { styles } from './styles/dynamicForm.styles'

type Field = z.infer<typeof FieldSchema>

type Props = {
  step: FormStep
  onSubmit: (values: Record<string, unknown>) => void
  capturePhoto?: () => Promise<string | null>
}

/** Renderer de formularios dinámicos a partir de step.fields */
function DynamicFormBase({ step, onSubmit, capturePhoto }: Props) {
  const defaultValues = Object.fromEntries(step.fields.map(f => [f.id, null as unknown]))
  const { control, handleSubmit, watch, setValue } = useForm<Record<string, unknown>>({
    defaultValues,
    mode: 'onBlur',
  })

  const isDisplayableUri = (uri?: string | null) =>
    !!uri && /^(file|content|data|asset):/i.test(uri)

  const renderField = (field: Field) => {
    switch (field.type) {
      case 'text':
        return (
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
      case 'number':
        return (
          <Controller
            key={field.id}
            control={control}
            name={field.id}
            render={({ field: rhf }) => (
              <View style={styles.inputBlock}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  value={(rhf.value as number | null)?.toString() ?? ''}
                  onChangeText={txt => {
                    const n = Number(txt.replace(',', '.'))
                    rhf.onChange(Number.isNaN(n) ? null : n)
                  }}
                  onBlur={rhf.onBlur}
                  placeholder={field.label}
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>
            )}
          />
        )
      case 'photo': {
        const current = watch(field.id) as string | null | undefined
        return (
          <View key={field.id} style={styles.inputBlock}>
            <Text style={styles.label}>{field.label}</Text>

            {isDisplayableUri(current) ? (
              <View style={styles.photoRow}>
                <Image source={{ uri: current! }} style={styles.photoThumb} />
                <Pressable
                  onPress={() => setValue(field.id, null)}
                  style={({ pressed }) => [styles.smallBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.smallBtnText}>Remove</Text>
                </Pressable>
              </View>
            ) : current ? (
              // Si por algún motivo viene una URI rara, no intentamos renderizarla
              <View style={styles.photoRow}>
                <Text style={{ color: AppColors.MutedText }}>Image selected (no preview)</Text>
                <Pressable
                  onPress={() => setValue(field.id, null)}
                  style={({ pressed }) => [styles.smallBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.smallBtnText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={async () => {
                  if (!capturePhoto) {
                    Alert.alert('Photo', 'Camera/Picker not configured.')
                    return
                  }
                  const path = await capturePhoto()
                  if (path) setValue(field.id, path)
                }}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.btnText}>Take / Pick Photo</Text>
              </Pressable>
            )}
          </View>
        )
      }

      case 'button':
        return (
          <View key={field.id} style={styles.inputBlock}>
            <Pressable
              onPress={() => {}}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.btnText}>{field.label}</Text>
            </Pressable>
          </View>
        )
      default:
        return null
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{step.title}</Text>
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
