'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import './VideoModule.plyr.css'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

/** Fire completion when this many seconds remain (typical LMS “almost finished”). */
const END_SECONDS_THRESHOLD = 10

/** Black overlay fade-out (must match CSS `--veil-fade-duration` fallback). */
const VEIL_FADE_OUT_MS = 480

const FULL_VEIL_CLASS = 'video-module-full-veil'

function ensureFullVeil(wrapper: HTMLElement | null): HTMLDivElement | null {
  if (!wrapper) return null
  let veil = wrapper.querySelector<HTMLDivElement>(`.${FULL_VEIL_CLASS}`)
  if (!veil) {
    veil = document.createElement('div')
    veil.className = FULL_VEIL_CLASS
    wrapper.appendChild(veil)
  }
  return veil
}

interface VideoModuleProps {
  moduleId: string
  contentUrl: string
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

function isProbablyDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url.trim())
}

async function markVideoCompleteOnce(moduleId: string, doneRef: { current: boolean }) {
  if (doneRef.current) return
  doneRef.current = true
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('module_progress').upsert(
    {
      module_id: moduleId,
      learner_id: user.id,
      watch_pct: 100,
      is_completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'module_id,learner_id' },
  )
}

export default function VideoModule({ moduleId, contentUrl }: VideoModuleProps) {
  const router = useRouter()
  const embedRef = useRef<HTMLDivElement>(null)
  const ytId = extractYouTubeId(contentUrl)
  const vimeoId = !ytId ? extractVimeoId(contentUrl) : null
  const direct = !ytId && !vimeoId && isProbablyDirectVideo(contentUrl)
  const embedId = ytId ?? vimeoId
  const provider = ytId ? 'youtube' : vimeoId ? 'vimeo' : null

  const doneRef = useRef(false)

  const onReachEnd = useCallback(() => {
    const run = async () => {
      await markVideoCompleteOnce(moduleId, doneRef)
      router.refresh()
    }
    void run()
  }, [moduleId, router])

  // YouTube / Vimeo: load Plyr only in the browser — the package touches `document` at import time (SSR-safe).
  useLayoutEffect(() => {
    if (!provider || !embedId || !embedRef.current) return

    const el = embedRef.current
    let cancelled = false
    let pollId: number | undefined
    let lateTimer: number | undefined
    let lateTimer2: number | undefined
    let mo: MutationObserver | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Plyr is loaded dynamically
    let player: any = null
    let onTimeUpdate: (() => void) | undefined
    let onEndedHandler: (() => void) | undefined
    let onStateForEmbed: (() => void) | undefined
    let markEmbedPaintReady: (() => void) | undefined
    let onWaiting: (() => void) | undefined
    let onBufferingDone: (() => void) | undefined
    let onPlayingForVeil: (() => void) | undefined
    /** True while embed is stalled waiting for data. */
    let isWaiting = false
    let veilFadeEndTimer: number | undefined
    let veilFadeInProgress = false

    void (async () => {
      await import('plyr/dist/plyr.css')
      const { default: Plyr } = await import('plyr')
      if (cancelled || !embedRef.current) return

      player = new Plyr(el, {
        ratio: '16:9',
        youtube: {
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          customControls: true,
          controls: 0,
        },
        vimeo: {
          byline: false,
          portrait: false,
          title: false,
          speed: true,
          customControls: true,
        },
      })
      if (cancelled) {
        try {
          player.destroy()
        } catch {
          /* noop */
        }
        return
      }

      onTimeUpdate = () => {
        const d = player.duration
        const t = player.currentTime
        if (Number.isFinite(d) && d > 0 && d - t <= END_SECONDS_THRESHOLD) {
          onReachEnd()
        }
      }

      const container = player.elements.container

      markEmbedPaintReady = () => {
        container.classList.add('video-module-embed-ready')
      }
      player.once('playing', markEmbedPaintReady)
      player.once('error', markEmbedPaintReady)

      const findEmbedIframe = (): HTMLIFrameElement | null =>
        container.querySelector('iframe') ??
        player.elements.wrapper?.querySelector('iframe') ??
        null

      const clearVeilFadeTimer = () => {
        if (veilFadeEndTimer !== undefined) {
          window.clearTimeout(veilFadeEndTimer)
          veilFadeEndTimer = undefined
        }
      }

      const finishVeilFade = (veil: HTMLDivElement) => {
        clearVeilFadeTimer()
        veilFadeInProgress = false
        veil.classList.remove(
          'video-module-full-veil--visible',
          'video-module-full-veil--hiding',
          'video-module-full-veil--buffering',
        )
      }

      const applyEmbedChromeLock = () => {
        const iframe = findEmbedIframe()
        if (iframe) {
          iframe.style.setProperty('pointer-events', 'none', 'important')
        }

        const wrapper = player.elements?.wrapper as HTMLElement | undefined
        const embedReady = container.classList.contains('video-module-embed-ready')

        const paused = Boolean(player.paused)
        const ended = Boolean(player.ended)

        // Pre-play: gradient veil. After ready: black while paused or buffering (not ended).
        const blackOverlay = embedReady && !ended && (paused || isWaiting)
        const showFullVeil = !embedReady || blackOverlay

        const veil = ensureFullVeil(wrapper ?? null)
        if (!veil) return

        if (veilFadeInProgress) {
          // User paused again or show veil — cancel fade
          if (showFullVeil) {
            clearVeilFadeTimer()
            veilFadeInProgress = false
            veil.classList.remove('video-module-full-veil--hiding')
            veil.classList.toggle('video-module-full-veil--visible', true)
            veil.classList.toggle('video-module-full-veil--buffering', blackOverlay)
          }
          return
        }

        const hadBlack = veil.classList.contains('video-module-full-veil--buffering')
        const hadVisible = veil.classList.contains('video-module-full-veil--visible')

        // Fade out only when leaving the black overlay (resume or buffering ended). Pre-play → playing: instant.
        const fadeOutBlack =
          hadVisible &&
          hadBlack &&
          !blackOverlay &&
          !showFullVeil

        if (fadeOutBlack) {
          veilFadeInProgress = true
          veil.classList.add('video-module-full-veil--hiding')
          const onFadeDone = () => {
            if (cancelled || !veilFadeInProgress) return
            clearVeilFadeTimer()
            finishVeilFade(veil)
          }
          const onOpacityEnd = (e: TransitionEvent) => {
            if (e.propertyName !== 'opacity') return
            veil.removeEventListener('transitionend', onOpacityEnd)
            onFadeDone()
          }
          veil.addEventListener('transitionend', onOpacityEnd)
          clearVeilFadeTimer()
          veilFadeEndTimer = window.setTimeout(onFadeDone, VEIL_FADE_OUT_MS)
          return
        }

        veil.classList.toggle('video-module-full-veil--visible', showFullVeil)
        veil.classList.toggle('video-module-full-veil--buffering', blackOverlay)
      }

      onEndedHandler = () => {
        isWaiting = false
        onReachEnd()
      }

      player.on('timeupdate', onTimeUpdate)
      player.on('ended', onEndedHandler)

      onStateForEmbed = () => applyEmbedChromeLock()

      onWaiting = () => {
        isWaiting = true
        applyEmbedChromeLock()
      }
      onBufferingDone = () => {
        isWaiting = false
        applyEmbedChromeLock()
      }
      onPlayingForVeil = () => {
        isWaiting = false
        applyEmbedChromeLock()
      }

      player.on('ready', onStateForEmbed)
      player.on('pause', onStateForEmbed)
      player.on('playing', onPlayingForVeil)
      player.on('ended', onStateForEmbed)
      player.on('seeked', onStateForEmbed)
      player.on('timeupdate', onStateForEmbed)
      player.on('waiting', onWaiting)
      player.on('stalled', onWaiting)
      player.on('canplay', onBufferingDone)
      player.on('canplaythrough', onBufferingDone)

      queueMicrotask(applyEmbedChromeLock)
      lateTimer = window.setTimeout(applyEmbedChromeLock, 100)
      lateTimer2 = window.setTimeout(applyEmbedChromeLock, 600)

      pollId = window.setInterval(applyEmbedChromeLock, 150)

      mo = new MutationObserver(applyEmbedChromeLock)
      mo.observe(container, { childList: true, subtree: true })
    })()

    return () => {
      cancelled = true
      if (veilFadeEndTimer !== undefined) window.clearTimeout(veilFadeEndTimer)
      if (lateTimer !== undefined) window.clearTimeout(lateTimer)
      if (lateTimer2 !== undefined) window.clearTimeout(lateTimer2)
      if (pollId !== undefined) window.clearInterval(pollId)
      mo?.disconnect()
      if (player) {
        try {
          if (onTimeUpdate) player.off('timeupdate', onTimeUpdate)
          if (onEndedHandler) player.off('ended', onEndedHandler)
          if (onWaiting) {
            player.off('waiting', onWaiting)
            player.off('stalled', onWaiting)
          }
          if (onBufferingDone) {
            player.off('canplay', onBufferingDone)
            player.off('canplaythrough', onBufferingDone)
          }
          if (onPlayingForVeil) player.off('playing', onPlayingForVeil)
          if (onStateForEmbed) {
            player.off('ready', onStateForEmbed)
            player.off('pause', onStateForEmbed)
            player.off('ended', onStateForEmbed)
            player.off('seeked', onStateForEmbed)
            player.off('timeupdate', onStateForEmbed)
          }
        } catch {
          /* noop */
        }
        try {
          player.destroy()
        } catch {
          /* noop */
        }
      }
    }
  }, [provider, embedId, onReachEnd])

  if (direct) {
    return (
      <video
        src={contentUrl}
        controls
        className="w-full rounded-xl shadow-lg bg-black max-h-[70vh]"
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (!v.duration || Number.isNaN(v.duration)) return
          const left = v.duration - v.currentTime
          if (left <= END_SECONDS_THRESHOLD) onReachEnd()
        }}
        onEnded={() => onReachEnd()}
      />
    )
  }

  if (provider && embedId) {
    return (
      <div className="video-module-plyr-host relative aspect-video w-full rounded-xl overflow-hidden shadow-lg bg-black">
        <div
          key={embedId}
          ref={embedRef}
          className="h-full w-full"
          data-plyr-provider={provider}
          data-plyr-embed-id={embedId}
        />
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-lg bg-black">
      <iframe
        src={contentUrl}
        title="Video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
