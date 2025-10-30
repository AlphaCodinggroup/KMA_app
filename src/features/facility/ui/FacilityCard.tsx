import React, { memo } from 'react'
import type { ViewStyle, TextStyle } from 'react-native'
import Icon, { type IconName } from '@shared/ui/icons/Icon'
import ListItemCard from '@shared/ui/list/ListItemCard'

export interface FacilityCardProps {
  title: string
  onPress: () => void
  testID?: string
  style?: ViewStyle
  titleStyle?: TextStyle
  leftIconName?: IconName
}

const FacilityCard: React.FC<FacilityCardProps> = ({
  title,
  onPress,
  testID,
  leftIconName = 'building',
}) => {
  const baseProps = {
    title,
    left: <Icon name={leftIconName} size={22} />,
    chevron: true,
    onPress: onPress,
  }

  return <ListItemCard {...baseProps} {...(testID ? { testID } : {})} />
}

export default memo(FacilityCard)
