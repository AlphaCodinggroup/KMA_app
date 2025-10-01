import ListItemCard from '@shared/ui/list/ListItemCard'
import { memo } from 'react'

export interface FlowCardProps {
  title: string
  version?: string
  description?: string
  stepsCount?: number
  onPress: () => void
  testID?: string
}

const FlowCard: React.FC<FlowCardProps> = ({
  title,
  version,
  stepsCount,
  description,
  onPress,
  testID,
}) => {
  const baseProps = {
    title: title,
    chevron: true,
    version: version ?? '',
    steps: stepsCount,
    description: description,
    onPress: onPress,
  }
  return <ListItemCard {...baseProps} {...(testID ? { testID } : {})} />
}

export default memo(FlowCard)
