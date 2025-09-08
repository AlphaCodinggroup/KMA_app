import { forwardRef } from 'react'
import { View, Text, TextInput, type TextInputProps } from 'react-native'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { AppColors } from '@shared/ui/colors'
import { styles } from './formTextInput.styles'

type Props<T extends FieldValues> = TextInputProps & {
  control: Control<T>
  name: FieldPath<T>
  label?: string
}

export const FormTextInput = forwardRef<TextInput, Props<any>>(function FormTextInput(
  { control, name, label, style, ...inputProps },
  ref,
) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => {
        const hasError = !!error
        return (
          <View style={styles.wrapper}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <TextInput
              ref={ref}
              style={[styles.input, hasError && styles.inputError, style]}
              value={value as any}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholderTextColor={AppColors.MutedText}
              {...inputProps}
            />
            {hasError ? <Text style={styles.error}>{error.message}</Text> : null}
          </View>
        )
      }}
    />
  )
})
