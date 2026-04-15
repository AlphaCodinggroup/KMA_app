import React, { useCallback } from 'react'
import { View, Text, ScrollView, Platform } from 'react-native'

import type { SelectStep } from '@shared/validation/steps.schema'
import { QuestionCard } from '@features/question'
import { DynamicForm } from '@features/dynamic-form'
import { pickOrCapturePhoto } from '@features/camera'
import Loader from '@shared/ui/loader/Loader'

import { useFlowRunner } from '../application/useFlowRunner'
import EndView from './EndView'
import StepIllustration from './StepIllustration'
import { END_ID, toVirtualQuestion } from '../lib/helpers'
import { styles } from './styles/flowRunner.styles'

const FlowRunnerScreen: React.FC = () => {
  const {
    detail,
    loading,
    zoomed,
    submitting,
    visibleIds,
    stepsById,
    stepRenderVersions,
    scrollRef,
    setZoomed,
    getStoredQuestionState,
    onAnswer,
    onSubmitForm,
    onSelectOption,
    onFinish,
  } = useFlowRunner()

  const renderSelectStep = useCallback(
    (step: SelectStep) => {
      const virtualQuestion = toVirtualQuestion(step)
      const storedState = getStoredQuestionState(step.id)

      return (
        <QuestionCard
          step={virtualQuestion}
          onYes={() => {}}
          onNo={() => {}}
          onUnsure={() => onAnswer(virtualQuestion, 'UNSURE')}
          selectedDecision={storedState.decision}
          selectedOption={storedState.option}
          {...(step.title ? { selectTitle: step.title } : {})}
          {...(step.text ? { selectText: step.text } : {})}
          selectOptions={step.options}
          onSelectOption={option => onSelectOption(step.id, option)}
        />
      )
    },
    [getStoredQuestionState, onAnswer, onSelectOption],
  )

  if (loading || !detail) return <Loader loading={loading} />

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.title}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        scrollEnabled={!zoomed}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
      >
        {visibleIds.map(id => {
          const step = stepsById[id]
          const renderKey = `${id}:${stepRenderVersions[id] ?? 0}`

          if (!step && id === END_ID) {
            return (
              <View key={renderKey} style={styles.containerComponents}>
                <EndView onFinish={onFinish} loading={submitting} />
              </View>
            )
          }

          if (!step) return null

          const storedState = getStoredQuestionState(step.id)

          return (
            <View key={renderKey} style={styles.containerComponents}>
              <StepIllustration
                onZoomChange={setZoomed}
                {...(typeof step.image === 'string' ? { image: step.image } : {})}
                {...(Array.isArray(step.images) ? { images: step.images } : {})}
              />

              {step.type === 'Question' && (
                <QuestionCard
                  step={step}
                  onYes={option => onAnswer(step, 'YES', option)}
                  onNo={option => onAnswer(step, 'NO', option)}
                  onUnsure={option => onAnswer(step, 'UNSURE', option)}
                  selectedDecision={storedState.decision}
                  selectedOption={storedState.option}
                />
              )}

              {step.type === 'Form' && (
                <DynamicForm
                  step={step}
                  onSubmit={values => onSubmitForm(step, values)}
                  capturePhoto={pickOrCapturePhoto}
                />
              )}

              {step.type === 'Select' && renderSelectStep(step)}

              {step.type === 'End' && <EndView onFinish={onFinish} loading={submitting} />}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
