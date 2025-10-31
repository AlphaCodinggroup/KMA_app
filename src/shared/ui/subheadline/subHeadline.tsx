import React from 'react'
import { type StyleProp, Text, type TextStyle } from 'react-native'
import { styles } from './subHeadline.styles'

type SubHeadlineProps = {
  text: string
  stylesText?: StyleProp<TextStyle>
}

const SubHeadline: React.FC<SubHeadlineProps> = ({ text, stylesText }) => {
  return (
    <Text style={[styles.subtitle, stylesText]} accessibilityRole="header">
      {text}
    </Text>
  )
}

export default SubHeadline
