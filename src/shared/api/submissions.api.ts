// import { http } from '@shared/api/http'
import { ensureWebImage, type WebImage } from '@features/camera/application/ensureWebImage'
import type { SubmissionDraft, SubmissionAnswer } from '@entities/submission/model'

/** Recorre answers y extrae los campos 'photo' con URI local */
function collectPhotoUris(answers: Record<string, SubmissionAnswer>) {
  type Item = { stepId: string; fieldId: string; uri: string }
  const items: Item[] = []
  const clone: Record<string, SubmissionAnswer> = {}

  for (const [stepId, ans] of Object.entries(answers)) {
    if (ans.type === 'Form') {
      const values = { ...ans.values }
      for (const [fieldId, v] of Object.entries(values)) {
        if (
          fieldId.toLowerCase().includes('photo') &&
          typeof v === 'string' &&
          v.startsWith('file')
        ) {
          // guardamos la referencia como marcador de archivo, no la URI local
          const placeholder = `${stepId}_${fieldId}`
          items.push({ stepId, fieldId, uri: v })
          values[fieldId] = { __file__: placeholder }
        }
      }
      clone[stepId] = { type: 'Form', values }
    } else {
      clone[stepId] = ans
    }
  }
  return { photoItems: items, answersWithPlaceholders: clone }
}

/** Construye el FormData con payload JSON y N archivos */
export async function buildSubmissionMultipart(draft: SubmissionDraft) {
  const { photoItems, answersWithPlaceholders } = collectPhotoUris(draft.answers)

  // normalizamos imágenes (HEIC → JPEG)
  const images: Array<{ key: string; img: WebImage }> = []
  for (const it of photoItems) {
    const img = await ensureWebImage(it.uri)
    const key = `${it.stepId}_${it.fieldId}` // clave para referenciar desde el JSON
    images.push({ key, img })
  }

  const payload = {
    flowId: draft.flowId,
    title: draft.title,
    createdAt: draft.createdAt,
    answers: answersWithPlaceholders, // las fotos quedan como { __file__: "<step_field>" }
  }

  const form = new FormData()
  //JSON con placeholders
  form.append('payload', JSON.stringify(payload))

  // Archivos (usa claves reproducibles)
  for (const { key, img } of images) {
    form.append(`files[${key}]`, {
      uri: img.uri,
      type: img.type,
      name: img.name,
    } as unknown as Blob)
  }

  return { formData: form, payload, filesCount: images.length }
}

/** POST final. Dejá que axios setee el boundary. */
export async function submitSubmissionMultipart(
  draft: SubmissionDraft,
  endpoint: string = `/flows/${draft.flowId}/submit`,
): Promise<void> {
  const { formData } = await buildSubmissionMultipart(draft)
  // await http.post(endpoint, formData, {
  //   // Importante: en React Native, axios arma el boundary.
  //   headers: { 'Content-Type': 'multipart/form-data' },
  // })
}

//! JSON QUE RECIBE BACKEND (VER SI HAY QUE MODIFICAR ALGO)
// {
//   "flowId": "RampAccessibilityVerification",
//   "title": "Ramp Accessibility Verification",
//   "createdAt": 1757101695344,
//   "answers": {
//     "F01": {
//       "type": "Form",
//       "values": {
//         "photo": { "__file__": "F01_photo" },
//         "notes": "algo",
//         "quantity": 2
//       }
//     },
//     "Q02": { "type": "Question", "answer": "YES" }
//   }
// }
