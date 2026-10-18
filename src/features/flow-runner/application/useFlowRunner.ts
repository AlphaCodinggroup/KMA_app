import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Alert } from 'react-native'
import type { ScrollView } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import type { SubmissionAnswer } from '@entities/submission/model'
import type {
  FlowDetail,
  FormStep,
  QuestionStep,
  SelectOption,
  Step,
} from '@shared/validation/steps.schema'
import type { QuestionAnswerValue } from '@shared/lib/questionAnswers'

import {
  discardDraft,
  findResumableDraft,
  newSubmissionId,
  persistDraft,
  startAuditDraft,
} from './usecases'
import { recordAnswerDelta } from './auditDeltas'
import { finalizeAudit } from './auditSubmit'
import { discardPrunedPhotos } from './photoUploads'
import { END_ID, mapById, parseStepsParam, resolveInitialStepId } from '../lib/helpers'
import {
  appendVisibleId,
  bumpRenderVersions,
  getStepIdsAfter,
  getStoredQuestionState as readStoredQuestionState,
  removeAnswers,
  replayPath,
  resolveQuestionNextStep,
  resolveSelectOptionNext,
  sliceVisibleIdsAfterStep,
} from '../lib/runnerNavigation'

export type FlowRunnerRouteParams = {
  flowId: string
  title: string
  version: string
  steps?: string | string[]
  projectId: string
  facilityId: string
}

type StoredQuestionState = ReturnType<typeof readStoredQuestionState>

/** Pregunta si se reanuda el draft encontrado o se empieza de nuevo. */
function askResumeDraft(): Promise<'resume' | 'restart'> {
  return new Promise(resolve => {
    Alert.alert(
      'Resume draft?',
      'You have an unfinished audit for this flow in this facility.',
      [
        { text: 'Start over', style: 'destructive', onPress: () => resolve('restart') },
        { text: 'Resume draft', onPress: () => resolve('resume') },
      ],
      { cancelable: false },
    )
  })
}

export type UseFlowRunnerResult = {
  detail: FlowDetail | null
  loading: boolean
  /** Id local de la corrida: una auditoría = una fila en `submissions` y un directorio de fotos. */
  submissionId: string
  zoomed: boolean
  submitting: boolean
  visibleIds: string[]
  stepsById: Record<string, Step>
  stepRenderVersions: Record<string, number>
  scrollRef: RefObject<ScrollView | null>
  setZoomed: (value: boolean) => void
  getStoredQuestionState: (stepId: string) => StoredQuestionState
  /** Valores guardados de un step Form (al reanudar un draft), para precargar el formulario. */
  getStoredFormValues: (stepId: string) => Record<string, unknown> | undefined
  onAnswer: (
    step: QuestionStep,
    answer: QuestionAnswerValue,
    extra?: { option?: string },
  ) => Promise<void>
  onSubmitForm: (step: FormStep, values: Record<string, unknown>) => Promise<void>
  onSelectOption: (stepId: string, option: SelectOption) => Promise<void>
  onFinish: () => Promise<void>
}

export const useFlowRunner = (): UseFlowRunnerResult => {
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
  const [stepRenderVersions, setStepRenderVersions] = useState<Record<string, number>>({})
  const [submissionId, setSubmissionId] = useState<string>(() => newSubmissionId())

  const scrollRef = useRef<ScrollView>(null)
  const visibleIdsRef = useRef<string[]>([])
  const answersRef = useRef<Record<string, SubmissionAnswer>>({})
  const submissionIdRef = useRef<string>(submissionId)
  const bootTokenRef = useRef(0)
  // El router no entra en las deps de `boot`: si su identidad cambia, no debe reiniciar la corrida
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    visibleIdsRef.current = visibleIds
  }, [visibleIds])

  useFocusEffect(
    useCallback(() => {
      const subscription = NetInfo.addEventListener(state => {
        setOnline(!!state.isConnected)
      })

      return () => {
        subscription?.()
      }
    }, []),
  )

  const startRun = useCallback(
    (steps: Step[], id: string, answers: Record<string, SubmissionAnswer>, path?: string[]) => {
      const initialVisibleIds =
        path && path.length > 0
          ? path
          : (() => {
              const firstId = resolveInitialStepId(steps)
              return firstId ? [firstId] : []
            })()

      submissionIdRef.current = id
      answersRef.current = answers
      visibleIdsRef.current = initialVisibleIds

      setSubmissionId(id)
      setStepRenderVersions({})
      setDetail({ flowId, title, steps })
      setVisibleIds(initialVisibleIds)
    },
    [flowId, title],
  )

  const boot = useCallback(async () => {
    const token = ++bootTokenRef.current
    setLoading(true)

    try {
      const steps = parseStepsParam(rawSteps)

      // ¿Hay un draft de este flow + facility para reanudar?
      let draft = null
      try {
        draft = await findResumableDraft({ flowId, projectId, facilityId })
      } catch (err) {
        if (__DEV__) console.warn('[useFlowRunner.boot] findResumableDraft', err)
      }
      if (token !== bootTokenRef.current) return

      // Un borrador sin respuestas (p. ej. el que crea V2 al entrar) no vale la pena preguntarlo
      const draftHasAnswers = !!draft && Object.keys(draft.answers ?? {}).length > 0

      if (draft && draft.version !== (version ?? '')) {
        // Cambió la versión del flow: el draft ya no es compatible
        await discardDraft(draft.id)
        if (draftHasAnswers) {
          Alert.alert(
            'Flow updated',
            'This flow changed since you started, so you will start over.',
          )
        }
        draft = null
      }

      if (draft) {
        const choice = draftHasAnswers ? await askResumeDraft() : 'resume'
        if (token !== bootTokenRef.current) return

        if (choice === 'resume') {
          const answers = { ...draft.answers }
          const path = replayPath(steps, answers)
          if (path.length > 0) {
            // Respuestas fuera del camino reconstruido: quedaron huérfanas
            removeAnswers(
              answers,
              Object.keys(answers).filter(id => !path.includes(id)),
            )
            startRun(steps, draft.id, answers, path)
            return
          }
        }
        await discardDraft(draft.id)
      }

      // Run nuevo. Con AUDITS_V2 apagado `startAuditDraft` no hace nada (pipeline v1 como siempre)
      const newId = newSubmissionId()
      await startAuditDraft({ submissionId: newId, flowId, title, projectId, facilityId, version })
      if (token !== bootTokenRef.current) return

      startRun(steps, newId, {})
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useFlowRunner.boot] error reading steps from params', err)
      Alert.alert('Error', 'The flow could not be loaded from the provided steps.')
      if (routerRef.current.canGoBack()) routerRef.current.back()
    } finally {
      if (token === bootTokenRef.current) setLoading(false)
    }
  }, [facilityId, flowId, projectId, rawSteps, startRun, title, version])

  // Sólo al montar o cuando cambian los params: volver a enfocar la pantalla no reinicia la corrida
  useEffect(() => {
    void boot()
  }, [boot])

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
    setVisibleIds(prev => sliceVisibleIdsAfterStep(prev, stepId))
  }, [])

  const appendNext = useCallback(
    (nextId: string | null) => {
      if (!nextId) return

      setVisibleIds(prev => appendVisibleId(prev, nextId))
      scrollToEnd()
    },
    [scrollToEnd],
  )

  const pruneAnswersAfter = useCallback((stepId: string) => {
    const removedIds = getStepIdsAfter(visibleIdsRef.current, stepId)
    if (removedIds.length === 0) return

    removeAnswers(answersRef.current, removedIds)
    setStepRenderVersions(prev => bumpRenderVersions(prev, removedIds))
  }, [])

  const getStoredQuestionState = useCallback((stepId: string) => {
    return readStoredQuestionState(answersRef.current, stepId)
  }, [])

  const getStoredFormValues = useCallback((stepId: string) => {
    const stored = answersRef.current[stepId]
    return stored?.type === 'Form' ? stored.values : undefined
  }, [])

  const persistAll = useCallback(async () => {
    if (!detail) return

    await persistDraft({
      submissionId: submissionIdRef.current,
      flowId: detail.flowId,
      title: detail.title,
      answers: answersRef.current,
      projectId,
      facilityId,
      version,
    })
  }, [detail, facilityId, projectId, version])

  const advanceFrom = useCallback(
    async (currentStepId: string, rawNext?: string | null) => {
      // Pasos que la nueva respuesta deja afuera (rama abandonada): V2 los borra también en el server
      const removedStepIds = getStepIdsAfter(visibleIdsRef.current, currentStepId)
      pruneAnswersAfter(currentStepId)
      await discardPrunedPhotos(submissionIdRef.current, removedStepIds)
      await persistAll()
      // V2: marca el paso como pendiente y encola el delta (no-op si la corrida es v1)
      await recordAnswerDelta({
        submissionId: submissionIdRef.current,
        stepId: currentStepId,
        removedStepIds,
      })
      sliceAfter(currentStepId)

      const nextId = resolveNextId(rawNext)
      appendNext(nextId)
    },
    [appendNext, persistAll, pruneAnswersAfter, resolveNextId, sliceAfter],
  )

  const onAnswer = useCallback(
    async (step: QuestionStep, answer: QuestionAnswerValue, extra?: { option?: string }) => {
      answersRef.current[step.id] = {
        type: 'Question',
        answer,
        ...(extra?.option ? { option: extra.option } : {}),
      }

      const rawNext = resolveQuestionNextStep(step, answer, answersRef.current)
      await advanceFrom(step.id, rawNext ?? null)
    },
    [advanceFrom],
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

      const rawNext = resolveSelectOptionNext(option, answersRef.current)
      await advanceFrom(stepId, rawNext ?? null)
    },
    [advanceFrom],
  )

  const onFinish = useCallback(async () => {
    if (!detail || submitting) return

    try {
      setSubmitting(true)

      const ok = await finalizeAudit({
        submissionId: submissionIdRef.current,
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
        Alert.alert('Error', 'We were unable to complete the submission.')
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[useFlowRunner.onFinish] finalizeSubmission error', err)
      Alert.alert('Error', 'We were unable to complete the submission.')
    } finally {
      setSubmitting(false)
    }
  }, [detail, facilityId, online, projectId, router, submitting, version])

  return {
    detail,
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
  }
}
