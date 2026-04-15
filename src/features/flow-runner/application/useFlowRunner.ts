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

import { finalizeSubmission, persistDraft } from './usecases'
import { END_ID, mapById, parseStepsParam, resolveInitialStepId } from '../lib/helpers'
import {
  appendVisibleId,
  bumpRenderVersions,
  getStepIdsAfter,
  getStoredQuestionState as readStoredQuestionState,
  removeAnswers,
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

export type UseFlowRunnerResult = {
  detail: FlowDetail | null
  loading: boolean
  zoomed: boolean
  submitting: boolean
  visibleIds: string[]
  stepsById: Record<string, Step>
  stepRenderVersions: Record<string, number>
  scrollRef: RefObject<ScrollView | null>
  setZoomed: (value: boolean) => void
  getStoredQuestionState: (stepId: string) => StoredQuestionState
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

  const scrollRef = useRef<ScrollView>(null)
  const visibleIdsRef = useRef<string[]>([])
  const answersRef = useRef<Record<string, SubmissionAnswer>>({})

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

  const boot = useCallback(() => {
    setLoading(true)

    try {
      const steps = parseStepsParam(rawSteps)
      const initialVisibleIds = (() => {
        const firstId = resolveInitialStepId(steps)
        return firstId ? [firstId] : []
      })()

      answersRef.current = {}
      visibleIdsRef.current = initialVisibleIds

      setStepRenderVersions({})
      setDetail({
        flowId,
        title,
        steps,
      })
      setVisibleIds(initialVisibleIds)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useFlowRunner.boot] error reading steps from params', err)
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

  const advanceFrom = useCallback(
    async (currentStepId: string, rawNext?: string | null) => {
      pruneAnswersAfter(currentStepId)
      await persistAll()
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
  }
}
