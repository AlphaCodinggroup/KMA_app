import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Alert, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import NetInfo from '@react-native-community/netinfo'
import type { FlowDetail, Step, QuestionStep, FormStep } from '@shared/validation/steps.schema'
import type { SubmissionAnswer } from '@entities/submission/model'
import { QuestionCard } from '@features/question'
import { DynamicForm } from '@features/dynamic-form'
import { pickOrCapturePhoto } from '@features/camera'
import { styles } from './styles/flowRunner.styles'
import { finalizeSubmission, persistDraft } from '../application/usecases'
import EndView from './EndView'
import StepIllustration from './StepIllustration'
import Loader from '@shared/ui/loader/Loader'

// --------------------
// Helpers
// --------------------
function mapById(steps: Step[]): Record<string, Step> {
  return steps.reduce<Record<string, Step>>((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
}

function isValidStepsPayload(v: unknown): v is Step[] {
  return (
    Array.isArray(v) &&
    v.every(
      s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.type === 'string',
    )
  )
}

type SelectStep = Extract<Step, { type: 'Select' }>

const toVirtualQuestion = (s: SelectStep): QuestionStep => ({
  id: s.id,
  type: 'Question',
  text: s.title ?? s.text ?? '',
  image: s.image,
})

const END_ID = 'END'

const FlowRunnerScreen: React.FC = () => {
  const router = useRouter()
  const {
    flowId,
    title,
    steps: rawSteps,
    description,
    projectId,
    facilityId,
  } = useLocalSearchParams<{
    flowId: string
    title: string
    steps?: string | string[]
    description: string
    projectId: string
    facilityId: string
  }>()

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [online, setOnline] = useState<boolean>(true)
  const [zoomed, setZoomed] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const scrollRef = useRef<ScrollView>(null)

  // answersRef va acumulando todas las respuestas/valores/fotos del flujo
  const answersRef = useRef<Record<string, SubmissionAnswer>>({})

  // Estado de red (para feedback/decisiones de envío)
  useFocusEffect(
    useCallback(() => {
      const sub = NetInfo.addEventListener(s => setOnline(!!s.isConnected))
      return () => sub && sub()
    }, []),
  )

  // Boot a partir de params.steps (JSON string)
  const boot = useCallback(async () => {
    setLoading(true)
    try {
      const stepsStr = Array.isArray(rawSteps) ? rawSteps[0] : rawSteps
      if (!stepsStr) throw new Error('Missing steps payload in navigation params')

      let parsed: unknown
      try {
        parsed = JSON.parse(stepsStr)
      } catch (e) {
        throw new Error(`Invalid steps JSON in navigation params, ${e}`)
      }

      if (!isValidStepsPayload(parsed)) {
        throw new Error('Steps payload does not match expected shape')
      }

      const steps = parsed as Step[]
      // Construimos el FlowDetail local (no dependemos de GET en esta pantalla)
      const data: FlowDetail = { flowId, title, steps, description }

      // Paso inicial = primera Question encontrada si existe; si no, primer step o END
      setDetail(data)
      const firstId =
        data.steps.find(s => s.type === 'Question')?.id ??
        data.steps[0]?.id ??
        (data.steps.find(s => s.id === END_ID) ? END_ID : null)

      setVisibleIds(firstId ? [firstId] : [])
    } catch (err) {
      console.warn('[FlowRunnerScreen.boot] error reading steps from params', err)
      Alert.alert('Error', 'The flow could not be loaded from the provided steps.')
      if (router.canGoBack()) router.back()
    } finally {
      setLoading(false)
    }
  }, [description, flowId, rawSteps, router, title])

  useFocusEffect(
    useCallback(() => {
      boot()
    }, [boot]),
  )

  const stepsById = useMemo(() => (detail ? mapById(detail.steps) : {}), [detail])

  // Resolver próximo id válido según el grafo
  const resolveNextId = useCallback(
    (next?: string | null): string | null => {
      if (!next) return stepsById[END_ID] ? END_ID : null
      if (next === END_ID) return END_ID
      return stepsById[next] ? next : stepsById[END_ID] ? END_ID : null
    },
    [stepsById],
  )

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  // Cuando se re-edita un paso previo, cortamos los siguientes
  const sliceAfter = useCallback((stepId: string) => {
    setVisibleIds(prev => {
      const idx = prev.indexOf(stepId)
      if (idx === -1) return prev
      return prev.slice(0, idx + 1)
    })
  }, [])

  // Agregar el siguiente paso al listado
  const appendNext = useCallback(
    (nextId: string | null) => {
      if (!nextId) return
      setVisibleIds(prev => {
        if (prev[prev.length - 1] === nextId) return prev
        return [...prev, nextId]
      })
      scrollToEnd()
    },
    [scrollToEnd],
  )

  // Persistencia best-effort
  const persistAll = useCallback(async () => {
    if (!detail) return
    await persistDraft({
      flowId: detail.flowId,
      title: detail.title,
      answers: answersRef.current,
    })
  }, [detail])

  // Handlers
  const onSkip = useCallback(
    async (step: QuestionStep) => {
      answersRef.current[step.id] = { type: 'Question', answer: null, option: null }
      await persistAll()

      const next = resolveNextId(step.yesNext ?? step.noNext)
      sliceAfter(step.id)
      appendNext(next)
    },
    [appendNext, persistAll, resolveNextId, sliceAfter],
  )

  const onAnswer = useCallback(
    async (step: QuestionStep, yes: boolean, extra?: { option?: string }) => {
      answersRef.current[step.id] = {
        type: 'Question',
        answer: yes ? 'YES' : 'NO',
        ...(extra?.option ? { option: extra.option } : {}),
      }
      await persistAll()

      const next = resolveNextId(yes ? step.yesNext : step.noNext)
      sliceAfter(step.id)
      appendNext(next)
    },
    [appendNext, persistAll, resolveNextId, sliceAfter],
  )

  const onSubmitForm = useCallback(
    async (step: FormStep, values: Record<string, unknown>) => {
      answersRef.current[step.id] = { type: 'Form', values }
      await persistAll()

      const next = resolveNextId(step.next)
      sliceAfter(step.id)
      appendNext(next)
    },
    [appendNext, persistAll, resolveNextId, sliceAfter],
  )

  // Handler para pasos de tipo "Select" reutilizando QuestionCard
  const onSelectOption = useCallback(
    async (stepId: string, payload: { label: string; next: string }) => {
      answersRef.current[stepId] = { type: 'Question', answer: null, option: payload.label }
      await persistAll()

      const next = resolveNextId(payload.next)
      sliceAfter(stepId)
      appendNext(next)
    },
    [appendNext, persistAll, resolveNextId, sliceAfter],
  )

  // Finalización
  const onFinish = useCallback(async () => {
    if (!detail) return
    if (submitting) return

    try {
      setSubmitting(true)

      await finalizeSubmission({
        flowId: detail.flowId,
        title: detail.title,
        answers: answersRef.current,
        online,
        projectId,
        facilityId,
      })

      return router.replace({
        pathname: '/(app)/selector',
        params: { facilityId, projectId },
      })
    } catch (err) {
      console.warn('[FlowRunnerScreen.onFinish] finalizeSubmission error', err)
      Alert.alert('Error', 'We were unable to complete the shipment.')
    } finally {
      setSubmitting(false)
    }
  }, [detail, facilityId, online, projectId, router, submitting])

  // Loading / fallback
  if (loading || !detail) return <Loader loading={loading} />

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.subtitle}>{detail.description}</Text>
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

          if (!step && id === END_ID) {
            return (
              <View key={id} style={styles.containerComponents}>
                <EndView onFinish={onFinish} loading={submitting} />
              </View>
            )
          }

          if (!step) return null

          return (
            <View key={id} style={styles.containerComponents}>
              {step.image && <StepIllustration image={step.image} onZoomChange={setZoomed} />}

              {step.type === 'Question' && (
                <QuestionCard
                  step={step}
                  onYes={opt => onAnswer(step as QuestionStep, true, opt)}
                  onNo={opt => onAnswer(step as QuestionStep, false, opt)}
                  onSkip={() => onSkip(step as QuestionStep)}
                />
              )}

              {step.type === 'Form' && (
                <DynamicForm
                  step={step as FormStep}
                  onSubmit={values => onSubmitForm(step as FormStep, values)}
                  capturePhoto={pickOrCapturePhoto}
                />
              )}

              {step.type === 'Select' &&
                (() => {
                  const s = step as SelectStep
                  const virtual = toVirtualQuestion(s)
                  return (
                    <QuestionCard
                      step={virtual}
                      onYes={() => {}}
                      onNo={() => {}}
                      onSkip={() => onSkip(virtual)}
                      {...(s.title ? { selectTitle: s.title } : {})}
                      {...(s.text ? { selectText: s.text } : {})}
                      selectOptions={s.options}
                      onSelectOption={opt => onSelectOption(s.id, opt)}
                    />
                  )
                })()}

              {step.type === 'End' && <EndView onFinish={onFinish} loading={submitting} />}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
