import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppColors } from '@shared/ui/colors'
import type {
  FlowDetail,
  Step,
  QuestionStep,
  FormStep,
  EndStep,
} from '@shared/validation/steps.schema'
import { flowDetail as defaultFlowDetail, allFlows } from '@shared/mocks/flows'
import { QuestionCard } from '@features/question'
import { DynamicForm } from '@features/dynamic-form'
import { pickOrCapturePhoto } from '@features/camera'
import { submitSubmissionMultipart, buildSubmissionMultipart } from '@shared/api/submissions.api'

type Answers = Record<string, unknown>

function mapById(steps: Step[]): Record<string, Step> {
  return steps.reduce<Record<string, Step>>((acc, s) => {
    acc[s.id] = s
    return acc
  }, {})
}

export default function FlowRunnerScreen() {
  const router = useRouter()
  const { flowId: rawFlowId } = useLocalSearchParams<{ flowId?: string | string[] }>()
  const flowId = Array.isArray(rawFlowId) ? rawFlowId[0] : (rawFlowId ?? '')
  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const answersRef = useRef<Answers>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const found = allFlows.flows.find(f => f.flowId === flowId)
        const data = found ?? defaultFlowDetail
        setDetail(data)
        const firstQ = data.steps.find(s => s.type === 'Question')
        setCurrentId(firstQ?.id ?? null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [flowId])

  const stepsById = useMemo(() => (detail ? mapById(detail.steps) : {}), [detail])

  const goToNext = React.useCallback(
    (next?: string) => {
      // Regla:
      // - si next es "END" → ir a END
      // - si next existe en el mapa → ir a ese id
      // - si no hay next o es desconocido → caer en END si existe; si no, null
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

  const persistDraft = async (): Promise<void> => {
    if (!detail) return
    const payload = {
      flowId: detail.flowId,
      title: detail.title,
      createdAt: new Date().toISOString(),
      answers: answersRef.current,
    }
    console.log('[FLOW SUBMISSION DRAFT]', JSON.stringify(payload, null, 2))
  }
  const handleAnswer = async (step: QuestionStep, yes: boolean, extra?: { option?: string }) => {
    answersRef.current[step.id] = {
      type: 'Question',
      answer: yes ? 'YES' : 'NO',
      ...(extra?.option ? { option: extra.option } : {}),
    }
    await persistDraft()

    const next = yes ? step.yesNext : step.noNext
    goToNext(next)
  }

  const handleFormSubmit = async (step: FormStep, values: Record<string, unknown>) => {
    answersRef.current[step.id] = { type: 'Form', values }
    await persistDraft()
    goToNext(step.next)
  }

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
            step={current as QuestionStep}
            onYes={opt => handleAnswer(current as QuestionStep, true, opt)}
            onNo={opt => handleAnswer(current as QuestionStep, false, opt)}
          />
        )}

        {current && current.type === 'Form' && (
          <DynamicForm
            step={current as FormStep}
            onSubmit={values => handleFormSubmit(current as FormStep, values)}
            capturePhoto={pickOrCapturePhoto}
          />
        )}

        {current && current.type === 'End' && (
          <EndView
            step={current}
            onFinish={async () => {
              const draft = {
                flowId: detail.flowId,
                title: detail.title,
                createdAt: Date.now(),
                answers: answersRef.current,
              }
              const { payload } = await buildSubmissionMultipart(draft)
              console.log('[FINAL PAYLOAD PARA BACKEND]', JSON.stringify(payload, null, 2))
              await submitSubmissionMultipart(draft)
              Alert.alert('OK', 'Envío realizado.')
              router.replace('/(app)/selector')
            }}
          />
        )}
      </ScrollView>
    </View>
  )
}

function EndView({ step, onFinish }: { step: EndStep; onFinish: () => void }) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.endMessage}>{step.message}</Text>
      <Pressable
        onPress={onFinish}
        style={({ pressed }) => [styles.finishBtn, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <Text style={styles.finishBtnText}>Back to selector</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.Background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomColor: AppColors.Border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: AppColors.Background,
  },
  title: { fontSize: 18, fontWeight: '700', color: AppColors.Primary },
  subtitle: { fontSize: 12, color: AppColors.MutedText, marginTop: 2 },
  content: { padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  endMessage: { fontSize: 16, color: AppColors.Primary },
  finishBtn: {
    borderRadius: 12,
    backgroundColor: AppColors.Primary,
    borderColor: AppColors.Primary,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: { color: '#FFFFFF', fontWeight: '700' },
})
