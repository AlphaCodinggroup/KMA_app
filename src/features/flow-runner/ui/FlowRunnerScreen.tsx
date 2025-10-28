import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Alert } from 'react-native'
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

const FlowRunnerScreen: React.FC = () => {
  const router = useRouter()
  const {
    flowId,
    title,
    steps: rawSteps,
    description,
  } = useLocalSearchParams<{
    flowId: string
    title: string
    steps?: string | string[]
    description: string
  }>()

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [online, setOnline] = useState<boolean>(true)
  const [zoomed, setZoomed] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

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
      const data: FlowDetail = {
        flowId,
        title,
        steps,
        description,
      }

      setDetail(data)

      // Paso inicial = primera Question encontrada si existe; si no, primer step o END
      const firstQ = data.steps.find(s => s.type === 'Question')
      setCurrentId(firstQ?.id ?? data.steps[0]?.id ?? null)
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

  const goToNext = useCallback(
    (next?: string) => {
      let target: string | null = null

      if (!next) {
        target = stepsById.END ? 'END' : null
      } else if (next === 'END') {
        target = 'END'
      } else {
        target = stepsById[next] ? next : stepsById.END ? 'END' : null
      }

      setCurrentId(target)
    },
    [stepsById],
  )

  const onSkip = useCallback(
    async (step: QuestionStep) => {
      // Guardamos answer: null en el JSON
      answersRef.current[step.id] = {
        type: 'Question',
        answer: null,
        option: null,
      }

      if (detail) {
        await persistDraft({
          flowId: detail.flowId,
          title: detail.title,
          answers: answersRef.current,
        })
      }

      // Elegimos el próximo paso posible: yesNext > noNext > END/auto
      const next = step.yesNext ?? step.noNext
      goToNext(next)
    },
    [detail, goToNext],
  )

  const onAnswer = useCallback(
    async (step: QuestionStep, yes: boolean, extra?: { option?: string }) => {
      answersRef.current[step.id] = {
        type: 'Question',
        answer: yes ? 'YES' : 'NO',
        ...(extra?.option ? { option: extra.option } : {}),
      }

      if (detail) {
        await persistDraft({
          flowId: detail.flowId,
          title: detail.title,
          answers: answersRef.current,
        })
      }

      goToNext(yes ? step.yesNext : step.noNext)
    },
    [detail, goToNext],
  )

  const onSubmitForm = useCallback(
    async (step: FormStep, values: Record<string, unknown>) => {
      answersRef.current[step.id] = { type: 'Form', values }

      if (detail) {
        await persistDraft({
          flowId: detail.flowId,
          title: detail.title,
          answers: answersRef.current,
        })
      }

      goToNext(step.next)
    },
    [detail, goToNext],
  )

  // Handler para pasos de tipo "Select" reutilizando QuestionCard
  const onSelectOption = useCallback(
    async (stepId: string, payload: { label: string; next: string }) => {
      // Persistimos como "Question" con answer null + option seleccionada
      answersRef.current[stepId] = {
        type: 'Question',
        answer: null,
        option: payload.label,
      }

      if (detail) {
        await persistDraft({
          flowId: detail.flowId,
          title: detail.title,
          answers: answersRef.current,
        })
      }

      goToNext(payload.next)
    },
    [detail, goToNext],
  )

  /**
   * onFinish:
   * - Si está offline => se encola para sync posterior (finalizeSubmission se encarga).
   * - Si está online => sube fotos a S3 (PUT presignadas), luego POST /audits al backend.
   *
   * Navegación:
   * - Si hay historial volvemos atrás.
   * - Si no, mandamos al selector.
   */
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
        // TODO: wire real project/facility IDs cuando el usuario seleccione dónde audita
        projectId: 'p4a51',
        facilityId: 'f_7fc49228-e68d-4a51-b805',
      })

      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/(app)/selector')
      }
    } catch (err) {
      console.warn('[FlowRunnerScreen.onFinish] finalizeSubmission error', err)
      Alert.alert('Error', 'We were unable to complete the shipment.')
    } finally {
      setSubmitting(false)
    }
  }, [detail, online, router, submitting])

  // Loading state inicial / fallback si no hay steps
  if (loading || !detail || !currentId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  const current = stepsById[currentId]

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.subtitle}>{detail.description}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!zoomed}>
        {current && <StepIllustration stepId={current.id} onZoomChange={setZoomed} />}

        {current && current.type === 'Question' && (
          <QuestionCard
            step={current}
            onYes={opt => onAnswer(current, true, opt)}
            onNo={opt => onAnswer(current, false, opt)}
            onSkip={onSkip}
          />
        )}

        {current && current.type === 'Form' && (
          <DynamicForm
            step={current}
            onSubmit={values => onSubmitForm(current, values)}
            capturePhoto={pickOrCapturePhoto}
          />
        )}

        {current && current.type === 'Select' && (
          <QuestionCard
            step={{
              id: current.id,
              type: 'Question',
              text: current.title ?? current.text ?? '',
            }}
            onYes={() => {}}
            onNo={() => {}}
            onSkip={onSkip}
            {...(current.title ? { selectTitle: current.title } : {})}
            {...(current.text ? { selectText: current.text } : {})}
            selectOptions={current.options}
            onSelectOption={opt => onSelectOption(current.id, opt)}
          />
        )}

        {current && current.type === 'End' && <EndView onFinish={onFinish} loading={submitting} />}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
