import React, { memo } from 'react'
import ListItemCard from '@shared/ui/list/ListItemCard'
import Icon from '@shared/ui/icons/Icon'
import { RFValue } from 'react-native-responsive-fontsize'

export interface ProjectCardProps {
  title: string
  onPress: () => void
  testID?: string
}

const ProjectCard: React.FC<ProjectCardProps> = ({ title, onPress, testID }) => {
  const baseProps = {
    title,
    left: <Icon name="folder" size={RFValue(22)} />,
    chevron: true,
    onPress: onPress,
  }

  return <ListItemCard {...baseProps} {...(testID ? { testID } : {})} />
}

export default memo(ProjectCard)
