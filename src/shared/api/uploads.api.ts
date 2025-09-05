import { http } from './http'
import type { WebImage } from '@features/camera/application/ensureWebImage'

export type SubmissionPayload = {
  flowId: string
  stepId: string
  values: Record<string, any>
}

export type UploadResponse = {
  remoteUrl: string
}

export async function apiPostSubmission(
  endpoint: string,
  payload: SubmissionPayload,
  filePaths?: string[],
) {
  if (filePaths?.length) {
    const form = new FormData()
    form.append('data', JSON.stringify(payload))
    filePaths.forEach((p, i) =>
      form.append(`file${i}`, { uri: p, type: 'image/jpeg', name: `photo${i}.jpg` } as any),
    )
    await http.post(endpoint, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  } else {
    await http.post(endpoint, payload)
  }
}

export async function uploadMultipart(img: WebImage): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', {
    // En RN, el tipo correcto para FormData file es este objeto:
    uri: img.uri,
    name: img.name,
    type: img.type,
  } as unknown as Blob)

  const { data } = await http.post<UploadResponse>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
