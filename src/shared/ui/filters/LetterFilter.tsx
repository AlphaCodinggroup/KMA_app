import React, { memo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { styles } from './letterFilter.styles'
import type { LetterKey } from '@shared/lib/alphaFilter'

type LetterFilterProps = {
  letters: string[]
  selected: LetterKey
  onSelect: (letter: LetterKey) => void
  label?: string
  allLabel?: string
}

const LetterFilter: React.FC<LetterFilterProps> = ({
  letters,
  selected,
  onSelect,
  label = 'Filter by letter:',
  allLabel = 'All',
}) => {
  return (
    <View style={styles.container} accessibilityRole="menu" accessible>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lettersRow}
      >
        <Chip
          label={allLabel}
          active={selected === 'ALL'}
          onPress={() => onSelect('ALL')}
          accessibilityLabel="Show all"
        />

        {letters.map(letter => (
          <Chip
            key={letter}
            label={letter}
            active={selected === letter}
            onPress={() => onSelect(letter)}
            accessibilityLabel={`Filter by letter ${letter}`}
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
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export default memo(LetterFilter)
