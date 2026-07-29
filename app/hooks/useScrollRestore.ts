'use client'

import { useEffect } from 'react'

// Radix overlays (Dialog, AlertDialog, Select, DropdownMenu) mark <body> with
// this while they hold the scroll lock.
const LOCK_ATTRIBUTE = 'data-scroll-locked'

// How long to keep trying after the lock clears. Long enough for a re-render and
// a couple of async state updates to settle, short enough that it can't fight a
// deliberate scroll for more than a blink.
const RESTORE_WINDOW_MS = 800

/**
 * Puts the page back where it was once a dialog closes.
 *
 * Safety net, not a root-cause fix: anything that shortens the document makes the
 * browser clamp the scroll offset to the new maximum, and if the document briefly
 * becomes shorter than the viewport the offset is clamped all the way to 0. That
 * is unrecoverable at the moment it happens, so instead we snapshot the offset
 * when the lock goes on and then keep reapplying it across animation frames until
 * it sticks — by which point the page has grown back to its real height.
 *
 * The snapshot comes from a passive scroll listener rather than a live read, so it
 * can never capture an already-clamped 0. Nested overlays only bump the lock
 * counter, so toggles where the locked state is unchanged are ignored.
 */
export function useScrollRestore() {
  useEffect(() => {
    const body = document.body
    let isLocked = body.hasAttribute(LOCK_ATTRIBUTE)
    let lastOffset = window.scrollY
    let savedOffset = lastOffset
    let frame = 0
    let deadline = 0

    const handleScroll = () => {
      if (!isLocked) lastOffset = window.scrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const tick = () => {
      frame = 0
      // Already back where we wanted — stop, so we never fight a real scroll.
      if (Math.round(window.scrollY) === Math.round(savedOffset)) return
      if (performance.now() > deadline) return
      window.scrollTo(0, savedOffset)
      frame = requestAnimationFrame(tick)
    }

    const observer = new MutationObserver(() => {
      const nextLocked = body.hasAttribute(LOCK_ATTRIBUTE)
      if (nextLocked === isLocked) return
      isLocked = nextLocked

      if (nextLocked) {
        savedOffset = lastOffset
        if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
      } else {
        deadline = performance.now() + RESTORE_WINDOW_MS
        if (!frame) frame = requestAnimationFrame(tick)
      }
    })
    observer.observe(body, { attributes: true, attributeFilter: [LOCK_ATTRIBUTE] })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
