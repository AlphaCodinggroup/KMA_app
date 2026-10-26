import React, { useCallback } from 'react'
import { View, Text, ScrollView, Platform } from 'react-native'

import type { SelectStep } from '@shared/validation/steps.schema'
import { QuestionCard } from '@features/question'
import { DynamicForm } from '@features/dynamic-form'
import { pickOrCapturePhoto } from '@features/camera'
import { PhotoEvidenceSection, usePhotoSyncStatus } from '@features/photo-sync'
import Loader from '@shared/ui/loader/Loader'

import { useFlowRunner } from '../application/useFlowRunner'
import { discardCapturedPhoto, registerCapturedPhoto } from '../application/photoUploads'
import EndView from './EndView'
import StepIllustration from './StepIllustration'
import { END_ID, toVirtualQuestion } from '../lib/helpers'
import { styles } from './styles/flowRunner.styles'

const FlowRunnerScreen: React.FC = () => {
  const {
    detail,
    isEdit,
    loading,
    submissionId,
    zoomed,
    submitting,
    visibleIds,
    stepsById,
    stepRenderVersions,
    scrollRef,
    setZoomed,
    getStoredQuestionState,
    getStoredFormValues,
    onAnswer,
    onSubmitForm,
    onSelectOption,
    onFinish,
  } = useFlowRunner()

  // Estado de backup de cada foto de la corrida (sólo auditorías V2; vacío en v1)
  const { badgeByUri } = usePhotoSyncStatus(submissionId)

  // Las fotos de la corrida viven en un directorio propio: kma/photos/<submissionId>
  // y cada foto se registra en `photo_uploads` (step + field) apenas se captura
  const capturePhoto = useCallback(
    async (ctx: { stepId: string; fieldId: string }) => {
      const uri = await pickOrCapturePhoto(submissionId)
      // Al editar no hay submission: la foto nueva se sube al sincronizar la edición
      if (uri && !isEdit) await registerCapturedPhoto({ submissionId, ...ctx, uri })
      return uri
    },
    [isEdit, submissionId],
  )

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
        {isEdit ? (
          <Text style={styles.editHint}>
            Editing a completed audit. After changing a step, tap Next or Submit on it.
          </Text>
        ) : null}
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
                <EndView
                  onFinish={onFinish}
                  loading={submitting}
                  {...(isEdit ? { label: 'Save changes' } : {})}
                />
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
                  initialValues={getStoredFormValues(step.id)}
                  capturePhoto={capturePhoto}
                  discardPhoto={discardCapturedPhoto}
                  photoStatusByUri={badgeByUri}
                />
              )}

              {step.type === 'Select' && renderSelectStep(step)}

              {step.type === 'End' && (
                <>
                  {!isEdit && (
                    <PhotoEvidenceSection
                      submissionId={submissionId}
                      stepTitleOf={stepId => {
                        const s = stepsById[stepId]
                        return s && 'title' in s ? s.title : undefined
                      }}
                    />
                  )}
                  <EndView
                    onFinish={onFinish}
                    loading={submitting}
                    {...(isEdit ? { label: 'Save changes' } : {})}
                  />
                </>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
