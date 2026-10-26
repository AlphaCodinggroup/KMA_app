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
import { discardCapturedPhoto, discardPrunedPhotos } from './photoUploads'
import { loadAuditForEdit, saveEditedAudit } from './auditEdit'
import { extractPhotoArray, photoUriOf } from '@entities/submission/lib/photos'
import { END_ID, mapById, parseStepsParam, resolveInitialStepId } from '../lib/helpers'
import {
  appendVisibleId,
  applyEditedAnswer,
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
  /** `edit`: edita una auditoría completada (los steps y respuestas se cargan por `auditId`). */
  mode?: string
  auditId?: string
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

/** Edición: avisa antes de descartar respuestas de pasos que la nueva respuesta deja afuera. */
function confirmDiscardAnswers(count: number): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Change this answer?',
      `This will remove ${count} later ${count === 1 ? 'answer' : 'answers'}, including any photos or measurements entered there.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Change answer', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    )
  })
}

export type UseFlowRunnerResult = {
  detail: FlowDetail | null
  /** True al editar una auditoría ya completada. */
  isEdit: boolean
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
    mode,
    auditId,
  } = useLocalSearchParams<FlowRunnerRouteParams>()
  const isEdit = mode === 'edit' && !!auditId

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
  // Edición: pasos con respuesta al abrir y eliminados por una edición anterior sin enviar
  const baseAnswersRef = useRef<Record<string, SubmissionAnswer>>({})
  const priorDeletedRef = useRef<string[]>([])
  const priorChangedRef = useRef<string[]>([])
  const editSavedRef = useRef(false)
  // El router no entra en las deps de `boot`: si su identidad cambia, no debe reiniciar la corrida
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    visibleIdsRef.current = visibleIds
  }, [visibleIds])

  // Edición descartada (o sin cambios): las fotos nuevas que no estaban al abrir no se van a subir
  useEffect(() => {
    if (!isEdit) return
    return () => {
      if (editSavedRef.current) return
      const localUris = (answers: Record<string, SubmissionAnswer>) => {
        const out = new Set<string>()
        for (const a of Object.values(answers)) {
          if (a.type !== 'Form') continue
          for (const p of extractPhotoArray(a.values)) {
            const uri = photoUriOf(p)
            if (uri.startsWith('file://')) out.add(uri)
          }
        }
        return out
      }
      const base = localUris(baseAnswersRef.current)
      for (const uri of localUris(answersRef.current)) {
        if (!base.has(uri)) void discardCapturedPhoto(uri).catch(() => undefined)
      }
    }
  }, [isEdit])

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
      if (isEdit && auditId) {
        const loaded = await loadAuditForEdit(auditId)
        if (token !== bootTokenRef.current) return

        if (!loaded.ok) {
          Alert.alert('This audit cannot be edited', loaded.message)
          if (routerRef.current.canGoBack()) routerRef.current.back()
          return
        }

        baseAnswersRef.current = { ...loaded.answers }
        priorDeletedRef.current = loaded.audit.deletedStepIds ?? []
        priorChangedRef.current = loaded.audit.changedStepIds ?? []
        // La sesión de edición usa un id propio: no es una submission ni toca el outbox
        startRun(loaded.steps, `edit_${auditId}`, loaded.answers, loaded.path)
        return
      }

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
  }, [auditId, facilityId, flowId, isEdit, projectId, rawSteps, startRun, title, version])

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

  /**
   * Edición: aplica la respuesta sin cortar lo que sigue; sólo descarta los pasos que quedan fuera
   * del camino nuevo, y pide confirmación si hay alguno. No toca el outbox ni `submissions`.
   */
  const commitEditedAnswer = useCallback(
    async (stepId: string, answer: SubmissionAnswer, opts?: { remountOnCancel?: boolean }) => {
      if (!detail) return
      const result = applyEditedAnswer(detail.steps, answersRef.current, stepId, answer)

      if (result.removedStepIds.length > 0) {
        const accepted = await confirmDiscardAnswers(result.removedStepIds.length)
        if (!accepted) {
          // Las tarjetas de pregunta muestran la selección nueva: se vuelven a montar con la guardada
          if (opts?.remountOnCancel) {
            setStepRenderVersions(prev => bumpRenderVersions(prev, [stepId]))
          }
          return
        }

        // Fotos nuevas (locales) de los pasos descartados: ya no se van a subir
        for (const id of result.removedStepIds) {
          const old = answersRef.current[id]
          if (old?.type !== 'Form') continue
          for (const p of extractPhotoArray(old.values)) {
            const uri = photoUriOf(p)
            if (uri.startsWith('file://')) await discardCapturedPhoto(uri)
          }
        }
        setStepRenderVersions(prev => bumpRenderVersions(prev, result.removedStepIds))
      }

      const grew = result.path.length > visibleIdsRef.current.length
      answersRef.current = result.answers
      visibleIdsRef.current = result.path
      setVisibleIds(result.path)
      if (grew) scrollToEnd()
    },
    [detail, scrollToEnd],
  )

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
      const stored: SubmissionAnswer = {
        type: 'Question',
        answer,
        ...(extra?.option ? { option: extra.option } : {}),
      }
      if (isEdit) {
        await commitEditedAnswer(step.id, stored, { remountOnCancel: true })
        return
      }
      answersRef.current[step.id] = stored

      const rawNext = resolveQuestionNextStep(step, answer, answersRef.current)
      await advanceFrom(step.id, rawNext ?? null)
    },
    [advanceFrom, commitEditedAnswer, isEdit],
  )

  const onSubmitForm = useCallback(
    async (step: FormStep, values: Record<string, unknown>) => {
      const stored: SubmissionAnswer = { type: 'Form', values }
      if (isEdit) {
        await commitEditedAnswer(step.id, stored)
        return
      }
      answersRef.current[step.id] = stored

      await advanceFrom(step.id, step.next ?? null)
    },
    [advanceFrom, commitEditedAnswer, isEdit],
  )

  const onSelectOption = useCallback(
    async (stepId: string, option: SelectOption) => {
      const stored: SubmissionAnswer = { type: 'Question', answer: null, option: option.label }
      if (isEdit) {
        await commitEditedAnswer(stepId, stored, { remountOnCancel: true })
        return
      }
      answersRef.current[stepId] = stored

      const rawNext = resolveSelectOptionNext(option, answersRef.current)
      await advanceFrom(stepId, rawNext ?? null)
    },
    [advanceFrom, commitEditedAnswer, isEdit],
  )

  const onFinish = useCallback(async () => {
    if (!detail || submitting) return

    try {
      setSubmitting(true)

      if (isEdit && auditId) {
        const queued = await saveEditedAudit({
          auditId,
          baseAnswers: baseAnswersRef.current,
          priorDeletedStepIds: priorDeletedRef.current,
          priorChangedStepIds: priorChangedRef.current,
          answers: answersRef.current,
        })
        editSavedRef.current = queued
        Alert.alert(
          queued ? 'Changes saved' : 'No changes',
          queued
            ? online
              ? 'Your changes are being sent.'
              : 'Your changes will be sent as soon as there is a connection.'
            : 'You did not change anything in this audit.',
        )
        if (routerRef.current.canGoBack()) routerRef.current.back()
        return
      }

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
  }, [auditId, detail, facilityId, isEdit, online, projectId, router, submitting, version])

  return {
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
  }
}
