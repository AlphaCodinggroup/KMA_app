import { useState, memo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
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
  const [decision, setDecision] = useState<'YES' | 'NO' | null>(null)

  const isSelectMode = Array.isArray(selectOptions) && selectOptions.length > 0
  const hasQuestionOptions = Array.isArray(questionOptions) && questionOptions.length > 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.question}>{isSelectMode ? (selectTitle ?? step.text) : step.text}</Text>
      {isSelectMode && selectText && <Text style={styles.optionText}>{selectText}</Text>}

      {/* Selector */}
      {isSelectMode ? (
        <View style={styles.optionsBox}>
          {selectOptions!.map((opt, idx) => {
            const isSelected = selected === opt.label
            return (
              <TouchableOpacity
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
              </TouchableOpacity>
            )
          })}
        </View>
      ) : (
        hasQuestionOptions && (
          <View style={styles.optionsBox}>
            {questionOptions!.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setSelected(opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === opt }}
                style={[styles.optionItem, selected === opt && styles.optionItemSelected]}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      )}

      {/* Acciones */}
      {!isSelectMode && (
        <>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                setDecision('NO')
                onNo(selected ? { option: selected } : undefined)
              }}
              style={[styles.button, styles.btnNo, decision === 'NO' && styles.selectedBtnStyle]}
              accessibilityRole="button"
              accessibilityLabel="No"
              accessibilityState={{ selected: decision === 'NO' }}
            >
              <Text style={styles.btnText}>NO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setDecision('YES')
                onYes(selected ? { option: selected } : undefined)
              }}
              style={[styles.button, styles.btnNo, decision === 'YES' && styles.selectedBtnStyle]}
              accessibilityRole="button"
              accessibilityLabel="Yes"
              accessibilityState={{ selected: decision === 'YES' }}
            >
              <Text style={styles.btnText}>YES</Text>
            </TouchableOpacity>
          </View>

          <View>
            <TouchableOpacity
              onPress={() => onSkip(step)}
              style={[styles.button, styles.btnNo, decision === null && styles.selectedBtnStyle]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text style={styles.btnText}>UNSURE - PENDING REVIEW</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}

export const QuestionCard = memo(QuestionCardBase)
