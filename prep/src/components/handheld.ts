'use client'

import { useSyncExternalStore } from 'react'

export type Handheld = 'android' | 'ios' | null

function detect(): Handheld {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS 13+ asks for desktop sites and reports itself as a Mac; touch support gives it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  return null
}

const noop = () => () => {}

/** Phone or tablet platform, or null on desktop. Always null during server render and hydration. */
export function useHandheld(): Handheld {
  return useSyncExternalStore(noop, detect, () => null)
}

/**
 * A link that opens the YouTube app when it's installed and the website otherwise.
 * Android: an intent URL naming the app, with the web page as the fallback.
 * iOS / iPadOS: the plain youtube.com link, which iOS hands to the app as a universal link.
 */
export function youtubeAppHref(videoId: string, platform: Handheld) {
  const web = `https://www.youtube.com/watch?v=${videoId}`
  if (platform === 'android') {
    return `intent://www.youtube.com/watch?v=${videoId}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(web)};end`
  }
  return web
}
