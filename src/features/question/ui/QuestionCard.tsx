import { useState, memo } from 'react'
import { View, Text, Pressable } from 'react-native'
import type { QuestionStep } from '@shared/validation/steps.schema'
import { styles } from './styles/questionCard.styles'

type SelectOption = { label: string; next: string }

type Props = {
  step: QuestionStep
  onYes: (payload?: { option?: string }) => void
  onNo: (payload?: { option?: string }) => void
  onSkip: (step: QuestionStep) => void
  questionOptions?: string[]
  selectTitle?: string
  selectText?: string
  selectOptions?: SelectOption[]
  onSelectOption?: (opt: SelectOption) => void
}

/**
 * Presentacional:
 * - Modo Question: muestra texto de pregunta, (questionOptions) y botones YES/NO + SKIP.
 */
function QuestionCardBase({
  step,
  onYes,
  onNo,
  onSkip,
  questionOptions,
  selectTitle,
  selectText,
  selectOptions,
  onSelectOption,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const isSelectMode = Array.isArray(selectOptions) && selectOptions.length > 0
  const hasQuestionOptions = Array.isArray(questionOptions) && questionOptions.length > 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.question}>{isSelectMode ? (selectTitle ?? step.text) : step.text}</Text>
      {isSelectMode && selectText ? <Text style={styles.optionText}>{selectText}</Text> : null}

      {/* Selector */}
      {isSelectMode ? (
        <View style={styles.optionsBox}>
          {selectOptions!.map((opt, idx) => {
            const isSelected = selected === opt.label
            return (
              <Pressable
                key={`${opt.label}-${idx}`}
                onPress={() => {
                  setSelected(opt.label)
                  onSelectOption?.(opt)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={[styles.optionItem, isSelected && styles.optionItemSelected]}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        hasQuestionOptions && (
          <View style={styles.optionsBox}>
            {questionOptions!.map(opt => (
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
        )
      )}

      {/* Acciones */}
      {!isSelectMode && (
        <>
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

          <View>
            <Pressable
              onPress={() => onSkip(step)}
              style={({ pressed }) => [styles.button, styles.btnNo, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text style={styles.btnText}>SKIP</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  )
}

export const QuestionCard = memo(QuestionCardBase)
