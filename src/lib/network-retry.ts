type RetryOptions = {
  retries?: number
  baseDelayMs?: number
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
}

/**
 * Maps low-level fetch errors (often `TypeError: Failed to fetch` on Android Chrome)
 * to text learners can act on. Real networks can always drop — this is not always a bug.
 */
export function getFetchErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Check your connection and try again.'
  }
  const blob = `${error.name} ${error.message}`.toLowerCase()
  if (
    blob.includes('failed to fetch') ||
    blob.includes('networkerror') ||
    blob.includes('network request failed') ||
    blob.includes('load failed')
  ) {
    return (
      'The connection dropped before the upload finished. On phones this is often weak signal, ' +
      'switching Wi‑Fi and mobile data, or Data Saver. Stay on this screen and try again, preferably on Wi‑Fi.'
    )
  }
  if (error.name === 'AbortError') {
    return 'The request was cancelled or took too long. Please try again.'
  }
  return `Could not complete the request. ${error.name}: ${error.message}`
}

export async function retryAsync<T>(
  run: () => Promise<T>,
  options: RetryOptions = {},
  shouldRetry: (error: unknown) => boolean = isTransientFetchError,
): Promise<T> {
  const retries = options.retries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 350
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (!shouldRetry(error) || attempt >= retries) {
        throw error
      }
      await wait(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed')
}

/** Bytes sent to the server (XHR upload). `percent` is 0–100 when `total` is known. */
export type UploadProgressEvent = {
  loaded: number
  total: number | null
  percent: number | null
}

function xhrPostFile(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (e: UploadProgressEvent) => void,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.responseType = 'text'
    xhr.withCredentials = true
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }
    xhr.upload.onprogress = (ev) => {
      if (!onProgress) return
      let percent: number | null = null
      if (ev.lengthComputable && ev.total > 0) {
        percent = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
      } else if (file.size > 0) {
        percent = Math.min(99, Math.round((ev.loaded / file.size) * 100))
      }
      onProgress({
        loaded: ev.loaded,
        total: ev.lengthComputable ? ev.total : file.size > 0 ? file.size : null,
        percent,
      })
    }
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        bodyText: xhr.responseText ?? '',
      })
    }
    xhr.onerror = () => reject(new TypeError('Failed to fetch'))
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    xhr.send(file)
  })
}

/**
 * POST a `File` with upload progress (uses XMLHttpRequest — `fetch` cannot report bytes sent).
 * Retries transient network failures and HTTP 5xx like `fetchWithRetry`.
 */
export async function postFileWithRetry(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (e: UploadProgressEvent) => void,
  options: RetryOptions = {},
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const retries = options.retries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 350
  let lastError: unknown = new Error('Network request failed')

  for (let attempt = 0; attempt <= retries; attempt++) {
    onProgress({ loaded: 0, total: file.size || null, percent: 0 })
    try {
      const result = await xhrPostFile(url, file, headers, onProgress)
      if (result.status >= 500 && attempt < retries) {
        await wait(baseDelayMs * (attempt + 1))
        continue
      }
      return result
    } catch (error) {
      lastError = error
      if (!isTransientFetchError(error) || attempt >= retries) {
        throw error
      }
      await wait(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed')
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 350
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init)
      if (res.status >= 500 && attempt < retries) {
        await wait(baseDelayMs * (attempt + 1))
        continue
      }
      return res
    } catch (error) {
      lastError = error
      if (!isTransientFetchError(error) || attempt >= retries) {
        throw error
      }
      await wait(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed')
}

