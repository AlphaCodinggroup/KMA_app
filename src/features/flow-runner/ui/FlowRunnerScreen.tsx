import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Alert, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import NetInfo from '@react-native-community/netinfo'

import type {
  FlowDetail,
  Step,
  QuestionStep,
  FormStep,
  SelectOption,
  SelectStep,
  ConditionalNext,
} from '@shared/validation/steps.schema'
import { isQuestionCondition, isSelectCondition } from '@entities/flow/model'
import type { SubmissionAnswer } from '@entities/submission/model'
import { QuestionCard } from '@features/question'
import { DynamicForm } from '@features/dynamic-form'
import { pickOrCapturePhoto } from '@features/camera'
import Loader from '@shared/ui/loader/Loader'

import { finalizeSubmission, persistDraft } from '../application/usecases'
import EndView from './EndView'
import StepIllustration from './StepIllustration'
import {
  END_ID,
  mapById,
  parseStepsParam,
  resolveInitialStepId,
  toVirtualQuestion,
} from '../lib/helpers'
import { styles } from './styles/flowRunner.styles'

export type FlowRunnerRouteParams = {
  flowId: string
  title: string
  version: string
  steps?: string | string[]
  projectId: string
  facilityId: string
}

export type SelectStep = Extract<Step, { type: 'Select' }>

const FlowRunnerScreen: React.FC = () => {
  const router = useRouter()

  const {
    flowId,
    title,
    steps: rawSteps,
    version,
    projectId,
    facilityId,
  } = useLocalSearchParams<FlowRunnerRouteParams>()

  const [detail, setDetail] = useState<FlowDetail | null>(null)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [online, setOnline] = useState<boolean>(true)
  const [zoomed, setZoomed] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const scrollRef = useRef<ScrollView>(null)

  // answersRef va acumulando todas las respuestas/valores/fotos del flujo
  const answersRef = useRef<Record<string, SubmissionAnswer>>({})

  // --------------------
  // Estado de red
  // --------------------
  useFocusEffect(
    useCallback(() => {
      const subscription = NetInfo.addEventListener(state => {
        setOnline(!!state.isConnected)
      })

      return () => {
        subscription && subscription()
      }
    }, []),
  )

  const boot = useCallback(() => {
    setLoading(true)

    try {
      const steps = parseStepsParam(rawSteps)

      const data: FlowDetail = {
        flowId,
        title,
        steps,
      }

      setDetail(data)

      const firstId = resolveInitialStepId(steps)
      setVisibleIds(firstId ? [firstId] : [])
    } catch (err) {
      console.warn('[FlowRunnerScreen.boot] error reading steps from params', err)
      Alert.alert('Error', 'The flow could not be loaded from the provided steps.')
      if (router.canGoBack()) router.back()
    } finally {
      setLoading(false)
    }
  }, [flowId, rawSteps, router, title])

  useFocusEffect(
    useCallback(() => {
      boot()
    }, [boot]),
  )

  const stepsById = useMemo<Record<string, Step>>(
    () => (detail ? mapById(detail.steps) : {}),
    [detail],
  )

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

  const sliceAfter = useCallback((stepId: string) => {
    setVisibleIds(prev => {
      const idx = prev.indexOf(stepId)
      if (idx === -1) return prev
      return prev.slice(0, idx + 1)
    })
  }, [])

  const appendNext = useCallback(
    (nextId: string | null) => {
      if (!nextId) return

      setVisibleIds(prev => {
        if (prev[prev.length - 1] === nextId) {
          return prev
        }
        const next = [...prev, nextId]
        return next
      })

      scrollToEnd()
    },
    [scrollToEnd],
  )

  const getNormalizedQuestionAnswer = useCallback((stepId: string): string | null => {
    const stored = answersRef.current[stepId]
    if (!stored || stored.type !== 'Question') return null

    const value = stored.answer
    if (value === null) return null

    return String(value).toUpperCase()
  }, [])

  const resolveQuestionNext = useCallback(
    (step: QuestionStep, answeredYes: boolean): string | null => {
      // Condicionales complejos
      const rules = answeredYes ? step.conditionalYesNext : step.conditionalNoNext

      if (rules && rules.length > 0) {
        // Función interna para evaluar una condición individual
        const check = (c: any): boolean => {
          const stored = answersRef.current[c.stepId]
          if (!stored) return false

          // Caso 1: Condición de Pregunta anterior (YES/NO)
          if (isQuestionCondition(c)) {
            const val = stored.answer // 'YES' | 'NO'
            const expected = c.answer ? 'YES' : 'NO'
            return val === expected
          }

          // Condición de Select anterior (Opción elegida)
          if (isSelectCondition(c)) {
            const val = stored.option // Label guardado
            return val === c.selectedOption
          }
          return false
        }

        for (const rule of rules) {
          // Si matchAny=true es un OR, si no es un AND (default)
          const pass = rule.matchAny ? rule.conditions.some(check) : rule.conditions.every(check)

          if (pass) return rule.next
        }
      }

      const defaultNext = answeredYes
        ? (step.yesNext ?? step.noNext ?? null)
        : (step.noNext ?? step.yesNext ?? null)

      if (!Array.isArray(step.checkPreviousNos) || step.checkPreviousNos.length === 0) {
        return defaultNext
      }

      const answers = step.checkPreviousNos.map(id => getNormalizedQuestionAnswer(id))

      const hasNo = answers.some(ans => ans === 'NO')
      const allYes = step.checkPreviousNos.length > 0 && answers.every(ans => ans === 'YES')

      if (hasNo) return step.noNext ?? step.yesNext ?? defaultNext
      if (allYes) return step.yesNext ?? step.noNext ?? defaultNext

      // Si falta info, preferimos el camino defensivo (noNext) para no saltar validaciones.
      return step.noNext ?? step.yesNext ?? defaultNext
    },
    [getNormalizedQuestionAnswer],
  )

  const resolveOptionNext = useCallback(
    (option: SelectOption): string | null => {
      if (option.condition) {
        const expected = String(option.condition.answer ?? '').toUpperCase()
        const actual = getNormalizedQuestionAnswer(option.condition.stepId) ?? ''
        const matches = actual === expected

        if (matches) {
          return option.yesNext ?? option.next ?? option.noNext ?? null
        }
        return option.noNext ?? option.next ?? option.yesNext ?? null
      }

      return option.next ?? option.yesNext ?? option.noNext ?? null
    },
    [getNormalizedQuestionAnswer],
  )

  /**
   * Persistimos el estado completo de la auditoría:
   * - flowId / title
   * - answers acumuladas
   * - projectId / facilityId / version (contexto para el envío)
   */
  const persistAll = useCallback(async () => {
    if (!detail) return

    await persistDraft({
      flowId: detail.flowId,
      title: detail.title,
      answers: answersRef.current,
      projectId,
      facilityId,
      version,
    })
  }, [detail, facilityId, projectId, version])

  /**
   * Helper general para:
   *  persistir
   *  cortar steps posteriores si se re-edita
   *  resolver y agregar el siguiente step
   */
  const advanceFrom = useCallback(
    async (currentStepId: string, rawNext?: string | null) => {
      await persistAll()
      sliceAfter(currentStepId)

      const next = resolveNextId(rawNext)
      appendNext(next)
    },
    [appendNext, persistAll, resolveNextId, sliceAfter],
  )

  const onSkip = useCallback(
    async (step: QuestionStep) => {
      answersRef.current[step.id] = {
        type: 'Question',
        answer: null,
        option: null,
      }

      const rawNext = step.yesNext ?? step.noNext ?? null
      await advanceFrom(step.id, rawNext)
    },
    [advanceFrom],
  )

  const onAnswer = useCallback(
    async (step: QuestionStep, yes: boolean, extra?: { option?: string }) => {
      answersRef.current[step.id] = {
        type: 'Question',
        answer: yes ? 'YES' : 'NO',
        ...(extra?.option ? { option: extra.option } : {}),
      }

      const rawNext = resolveQuestionNext(step, yes)
      await advanceFrom(step.id, rawNext ?? null)
    },
    [advanceFrom, resolveQuestionNext],
  )

  const onSubmitForm = useCallback(
    async (step: FormStep, values: Record<string, unknown>) => {
      answersRef.current[step.id] = {
        type: 'Form',
        values,
      }

      await advanceFrom(step.id, step.next ?? null)
    },
    [advanceFrom],
  )

  const onSelectOption = useCallback(
    async (stepId: string, option: SelectOption) => {
      answersRef.current[stepId] = {
        type: 'Question',
        answer: null,
        option: option.label,
      }

      const rawNext = resolveOptionNext(option)
      await advanceFrom(stepId, rawNext ?? null)
    },
    [advanceFrom, resolveOptionNext],
  )

  const onFinish = useCallback(async () => {
    if (!detail || submitting) return

    try {
      setSubmitting(true)

      const ok = await finalizeSubmission({
        flowId: detail.flowId,
        title: detail.title,
        answers: answersRef.current,
        online,
        projectId,
        facilityId,
        version,
      })

      if (ok) {
        router.replace({
          pathname: '/(app)/selector',
          params: { facilityId, projectId },
        })
      } else {
        // finalizeSubmission ya registra logs y/o toasts;
        // acá solo informamos que no se pudo completar.
        Alert.alert('Error', 'We were unable to complete the submission.')
      }
    } catch (err) {
      console.log('[FlowRunnerScreen.onFinish] finalizeSubmission error', err)
      Alert.alert('Error', 'We were unable to complete the submission.')
    } finally {
      setSubmitting(false)
    }
  }, [detail, facilityId, online, projectId, router, submitting, version])

  const renderSelectStep = useCallback(
    (step: SelectStep) => {
      const virtualQuestion = toVirtualQuestion(step)

      return (
        <QuestionCard
          step={virtualQuestion}
          onYes={() => {}}
          onNo={() => {}}
          onSkip={() => onSkip(virtualQuestion)}
          {...(step.title ? { selectTitle: step.title } : {})}
          {...(step.text ? { selectText: step.text } : {})}
          selectOptions={step.options}
          onSelectOption={opt => onSelectOption(step.id, opt)}
        />
      )
    },
    [onSelectOption, onSkip],
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
                  onYes={opt => onAnswer(step, true, opt)}
                  onNo={opt => onAnswer(step, false, opt)}
                  onSkip={() => onSkip(step)}
                />
              )}

              {step.type === 'Form' && (
                <DynamicForm
                  step={step as FormStep}
                  onSubmit={values => onSubmitForm(step as FormStep, values)}
                  capturePhoto={pickOrCapturePhoto}
                />
              )}

              {step.type === 'Select' && renderSelectStep(step as SelectStep)}

              {step.type === 'End' && <EndView onFinish={onFinish} loading={submitting} />}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default FlowRunnerScreen
