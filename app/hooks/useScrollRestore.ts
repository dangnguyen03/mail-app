'use client'

import { useEffect } from 'react'

// Radix overlays (Dialog, AlertDialog, Select, DropdownMenu) mark <body> with
// this while they hold the scroll lock.
const LOCK_ATTRIBUTE = 'data-scroll-locked'

// How long to keep guarding the offset after the lock clears. The work that
// shortens the page runs *after* the dialog closes — handleResendSuccess awaits
// two IndexedDB writes — so the guard has to outlive the close, not stop at it.
const RESTORE_WINDOW_MS = 1200

/**
 * Holds the page in place while a dialog closes.
 *
 * Safety net, not a root-cause fix: anything that shortens the document makes the
 * browser clamp the scroll offset to the new maximum, and if the document briefly
 * drops below the viewport height the offset is clamped to 0. That can't be
 * prevented at the moment it happens, so we snapshot the offset when the lock goes
 * on and then re-assert it every frame for a short window afterwards.
 *
 * The window must run to completion rather than stopping at the first match: when
 * the lock is released the page usually hasn't shrunk *yet*, so an early exit
 * would hand back control moments before the collapse. We stop early only if the
 * user actually scrolls — wheel, touch or key — so this can never fight them.
 *
 * The snapshot comes from a passive scroll listener rather than a live read, so it
 * can never capture an already-clamped 0. Nested overlays only bump the lock
 * counter, so toggles that leave the locked state unchanged are ignored.
 */
export function useScrollRestore() {
  useEffect(() => {
    const body = document.body
    let isLocked = body.hasAttribute(LOCK_ATTRIBUTE)
    let lastOffset = window.scrollY
    let savedOffset = lastOffset
    let userTookOver = false
    let frame = 0
    let deadline = 0

    const handleScroll = () => {
      if (!isLocked) lastOffset = window.scrollY
    }
    const handleUserIntent = () => {
      userTookOver = true
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('wheel', handleUserIntent, { passive: true })
    window.addEventListener('touchmove', handleUserIntent, { passive: true })
    window.addEventListener('keydown', handleUserIntent)

    const tick = () => {
      frame = 0
      if (userTookOver || performance.now() > deadline) return
      if (Math.round(window.scrollY) !== Math.round(savedOffset)) {
        window.scrollTo(0, savedOffset)
        lastOffset = savedOffset
      }
      frame = requestAnimationFrame(tick)
    }

    const observer = new MutationObserver(() => {
      const nextLocked = body.hasAttribute(LOCK_ATTRIBUTE)
      if (nextLocked === isLocked) return
      isLocked = nextLocked

      if (nextLocked) {
        savedOffset = lastOffset
        userTookOver = false
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
      window.removeEventListener('wheel', handleUserIntent)
      window.removeEventListener('touchmove', handleUserIntent)
      window.removeEventListener('keydown', handleUserIntent)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
