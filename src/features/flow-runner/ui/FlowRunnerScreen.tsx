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
import {
  ensureFlowSynced,
  finalizeSubmission,
  loadFlowDetail,
  persistDraft,
} from '../application/usecases'
import EndView from './EndView'
import StepIllustration from './StepIllustration'

type Answers = Record<string, SubmissionAnswer>

function mapById(steps: Step[]): Record<string, Step> {
  return steps.reduce<Record<string, Step>>((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
}

const FlowRunnerScreen: React.FC = () => {
  const router = useRouter()
  const { flowId: rawFlowId } = useLocalSearchParams<{ flowId?: string | string[] }>()
  const flowId: string = Array.isArray(rawFlowId) ? (rawFlowId[0] ?? '') : (rawFlowId ?? '')

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [online, setOnline] = useState<boolean>(true)
  const [zoomed, setZoomed] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // answersRef va acumulando todas las respuestas/valores/fotos del flujo
  const answersRef = useRef<Answers>({})

  // Estado de red (para feedback/decisiones de envío)
  useFocusEffect(
    useCallback(() => {
      const sub = NetInfo.addEventListener(s => setOnline(!!s.isConnected))
      return () => {
        sub && sub()
      }
    }, []),
  )

  // Carga + sync automática al ingresar
  const boot = useCallback(async () => {
    setLoading(true)
    try {
      // Sincronizamos catálogo/detalle offline-first (best effort)
      await ensureFlowSynced(flowId)

      // TODO: usar flowId real cuando esté disponible desde router
      const data = await loadFlowDetail('flow_ramp_accessibility_verification_20251009190307')
      setDetail(data)

      // Paso inicial = primer Question encontrada
      const firstQ = data.steps.find(s => s.type === 'Question')
      setCurrentId(firstQ?.id ?? null)
    } catch (err) {
      console.warn('[FlowRunnerScreen.boot] error loading flow', err)
      Alert.alert('Error', 'The stream could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [flowId])

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
        target = stepsById['END'] ? 'END' : null
      } else if (next === 'END') {
        target = 'END'
      } else {
        target = stepsById[next] ? next : stepsById['END'] ? 'END' : null
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
      // Persistimos como "Question" con answer null + option seleccionada (compatibilidad)
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
        <Text style={styles.subtitle}>v{detail.version}</Text>
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
            onSelectOption={opt => void onSelectOption(current.id, opt)}
          />
        )}

        {current && current.type === 'End' && <EndView step={current} onFinish={onFinish} />}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
