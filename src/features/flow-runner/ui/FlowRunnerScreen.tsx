import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import NetInfo from '@react-native-community/netinfo'
import type { FlowDetail, Step, QuestionStep, FormStep } from '@shared/validation/steps.schema'
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

type Answers = Record<string, unknown>

function mapById(steps: Step[]): Record<string, Step> {
  return steps.reduce<Record<string, Step>>((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
}

const FlowRunnerScreen: React.FC = () => {
  const router = useRouter()
  const { flowId: rawFlowId } = useLocalSearchParams<{ flowId?: string | string[] }>()
  const flowId = Array.isArray(rawFlowId) ? rawFlowId[0] : (rawFlowId ?? '')

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState<boolean>(true)

  const answersRef = useRef<Answers>({})

  // Estado de red (para feedback/decisiones de envío)
  useFocusEffect(
    useCallback(() => {
      const sub = NetInfo.addEventListener(s => setOnline(!!s.isConnected))
      return () => sub && sub()
    }, []),
  )

  // Carga + sync automática al ingresar
  const boot = useCallback(async () => {
    setLoading(true)
    try {
      await ensureFlowSynced(flowId) // best-effort
      const data = await loadFlowDetail(flowId)
      setDetail(data)
      const firstQ = data.steps.find(s => s.type === 'Question')
      setCurrentId(firstQ?.id ?? null)
    } catch {
      Alert.alert('Error', 'No fue posible cargar el flujo.')
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

  const onFinish = useCallback(async () => {
    if (!detail) return
    try {
      await finalizeSubmission({
        flowId: detail.flowId,
        title: detail.title,
        answers: answersRef.current,
        online,
      })
      Alert.alert('OK', online ? 'Envío realizado.' : 'Guardado para enviar cuando haya conexión.')
      router.replace('/(app)/selector')
    } catch {
      Alert.alert('Error', 'No pudimos finalizar el envío.')
    }
  }, [detail, online, router])

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
        <Text style={styles.subtitle}>{detail.version}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {current && current.type === 'Question' && (
          <QuestionCard
            step={current}
            onYes={opt => onAnswer(current, true, opt)}
            onNo={opt => onAnswer(current, false, opt)}
          />
        )}

        {current && current.type === 'Form' && (
          <DynamicForm
            step={current}
            onSubmit={values => onSubmitForm(current, values)}
            capturePhoto={pickOrCapturePhoto}
          />
        )}

        {current && current.type === 'End' && <EndView step={current} onFinish={onFinish} />}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
