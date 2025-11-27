import React, { memo } from 'react'
import { View, Text } from 'react-native'
import SubHeadline from '@shared/ui/subheadline/subHeadline'
import { styles } from './EntityErrorState.styles'

export type EntityErrorStateProps = {
  title: string
  message: string
  //   containerStyle?: StyleProp<ViewStyle>
  //   headerStyle?: StyleProp<ViewStyle>
  //   messageTextStyle?: StyleProp<TextStyle>
  testID?: string
}

/**
 * EntityErrorState
 *
 * Componente genérico para mostrar el estado de error en listados
 * (projects, facilities, flows, etc.), evitando repetir la misma
 * estructura en cada pantalla.
 */
const EntityErrorStateComponent: React.FC<EntityErrorStateProps> = ({
  title,
  message,
  //   containerStyle,
  //   headerStyle,
  //   messageTextStyle,
  testID,
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerBlock}>
        <SubHeadline text={title} />
      </View>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

export const EntityErrorState = memo(EntityErrorStateComponent)
