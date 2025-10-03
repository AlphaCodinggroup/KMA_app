import { useState, memo } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { QuestionStep } from '@shared/validation/steps.schema'
import { styles } from './styles/questionCard.styles'

type Props = {
  step: QuestionStep
  onYes: (payload?: { option?: string }) => void
  onNo: (payload?: { option?: string }) => void
}

/** Presentacional: muestra el texto de la pregunta, opcionalmente opciones, y botones YES/NO */
function QuestionCardBase({ step, onYes, onNo }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{step.text}</Text>

      {Array.isArray(step.options) && step.options.length > 0 && (
        <View style={styles.optionsBox}>
          {step.options.map(opt => (
            <Pressable
              key={opt}
              onPress={() => setSelected(opt)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === opt }}
              style={[styles.optionItem, selected === opt && styles.optionItemSelected]}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => onNo(selected ? { option: selected } : undefined)}
          style={({ pressed }) => [styles.button, styles.btnNo, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="No"
        >
          <Text style={styles.btnText}>NO</Text>
        </Pressable>

        <Pressable
          onPress={() => onYes(selected ? { option: selected } : undefined)}
          style={({ pressed }) => [styles.button, styles.btnYes, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Yes"
        >
          <Text style={[styles.btnText, styles.btnYesText]}>YES</Text>
        </Pressable>
      </View>
    </View>
  )
}

export const QuestionCard = memo(QuestionCardBase)
