import React from 'react'
import Svg, { Path } from 'react-native-svg'

type Props = { width?: number; height?: number; color?: string }

const Folder: React.FC<Props> = ({ width = 24, height = 24, color = '#333' }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 6.75A1.75 1.75 0 0 1 5.25 5h3.879c.464 0 .907.185 1.235.514l1.122 1.122c.328.329.771.514 1.235.514h4.029A1.75 1.75 0 0 1 18.5 8.9v8.35A1.75 1.75 0 0 1 16.75 19H5.25A1.75 1.75 0 0 1 3.5 17.25V6.75Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export default Folder
