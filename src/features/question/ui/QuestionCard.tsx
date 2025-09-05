import { useState, memo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import type { QuestionStep } from '@shared/validation/steps.schema'
import { AppColors } from '@shared/ui/colors'

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

const styles = StyleSheet.create({
  container: { gap: 16, padding: 16 },
  question: { fontSize: 18, fontWeight: '600', color: AppColors.Primary },
  optionsBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.Border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionItem: {
    padding: 12,
    backgroundColor: AppColors.Background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.Border,
  },
  optionItemSelected: { backgroundColor: '#F3F4F6' },
  optionText: { color: AppColors.Primary },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnNo: { backgroundColor: AppColors.Background, borderColor: AppColors.Border },
  btnYes: { backgroundColor: AppColors.Primary, borderColor: AppColors.Primary },
  btnPressed: { opacity: 0.9 },
  btnText: { fontWeight: '700', color: AppColors.Primary },
  btnYesText: { color: '#FFFFFF' },
})
