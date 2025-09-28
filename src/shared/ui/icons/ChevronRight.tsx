import React from 'react'
import Svg, { Path } from 'react-native-svg'

type Props = { width?: number; height?: number; color?: string }

const ChevronRight: React.FC<Props> = ({ width = 20, height = 20, color = '#000' }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
export default ChevronRight
