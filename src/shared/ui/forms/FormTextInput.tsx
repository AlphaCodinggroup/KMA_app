import React, { forwardRef, useMemo, useState } from 'react'
import { View, Text, TextInput, type TextInputProps, TouchableOpacity } from 'react-native'
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form'
import { AppColors } from '@shared/ui/colors'
import { styles } from './formTextInput.styles'
import Icon from '../icons/Icon'

type Props<T extends FieldValues> = TextInputProps & {
  control: Control<T>
  name: FieldPath<T>
  label?: string
}

export const FormTextInput = forwardRef<TextInput, Props<any>>(function FormTextInput(
  { control, name, label, style, ...inputProps },
  ref,
) {
  const isPasswordField = useMemo<boolean>(
    () => inputProps.textContentType === 'password' || inputProps.secureTextEntry === true,
    [inputProps.textContentType, inputProps.secureTextEntry],
  )

  const [showPassword, setShowPassword] = useState<boolean>(false)

  const {
    secureTextEntry: _secureTextEntryFromProps,
    textContentType: textContentTypeProp,
    autoCapitalize: autoCapitalizeProp,
    autoCorrect: autoCorrectProp,
    ...restInputProps
  } = inputProps

  const resolvedSecureTextEntry = isPasswordField ? !showPassword : _secureTextEntryFromProps
  const resolvedTextContentType = textContentTypeProp
  const resolvedAutoCapitalize = isPasswordField
    ? (autoCapitalizeProp ?? 'none')
    : autoCapitalizeProp
  const resolvedAutoCorrect = isPasswordField ? (autoCorrectProp ?? false) : autoCorrectProp

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => {
        const hasError = !!error
        return (
          <View style={styles.wrapper}>
            {label ? <Text style={styles.label}>{label}</Text> : null}

            <View style={styles.inputContainer}>
              <TextInput
                ref={ref}
                style={[
                  styles.input,
                  hasError && styles.inputError,
                  isPasswordField && styles.inputWithToggle,
                  style,
                ]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={AppColors.MutedText}
                secureTextEntry={resolvedSecureTextEntry}
                textContentType={resolvedTextContentType}
                autoCapitalize={resolvedAutoCapitalize}
                autoCorrect={resolvedAutoCorrect}
                {...restInputProps}
              />

              {isPasswordField && (
                <TouchableOpacity
                  onPress={() => setShowPassword(s => !s)}
                  style={styles.toggleBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </TouchableOpacity>
              )}
            </View>

            {hasError && <Text style={styles.error}>{error.message}</Text>}
          </View>
        )
      }}
    />
  )
})
