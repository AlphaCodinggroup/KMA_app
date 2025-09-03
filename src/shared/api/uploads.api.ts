import { http } from './http'

export type SubmissionPayload = {
  flowId: string
  stepId: string
  values: Record<string, any>
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
