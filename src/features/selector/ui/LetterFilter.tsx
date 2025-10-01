import React, { memo } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { styles } from './styles/letterFilter.styles'

type LetterFilterProps = {
  letters: string[]
  selected: string | 'ALL'
  onSelect: (letter: string | 'ALL') => void
}

const LetterFilter: React.FC<LetterFilterProps> = ({ letters, selected, onSelect }) => {
  return (
    <View style={styles.container} accessibilityRole="menu" accessible>
      <Text style={styles.label}>Filter by letter:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lettersRow}
      >
        <Chip
          label="All"
          active={selected === 'ALL'}
          onPress={() => onSelect('ALL')}
          accessibilityLabel="Show all"
        />
        {letters.map(l => (
          <Chip
            key={l}
            label={l}
            active={selected === l}
            onPress={() => onSelect(l)}
            accessibilityLabel={`Filter by letter ${l}`}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const Chip: React.FC<{
  label: string
  active?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}> = ({ label, active, onPress, accessibilityLabel }) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </Pressable>
  )
}

export default memo(LetterFilter)
