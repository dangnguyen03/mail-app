'use client'

import { useEffect } from 'react'

// react-remove-scroll — used by every Radix overlay (Dialog, AlertDialog,
// Select, DropdownMenu) — marks the body while its scroll lock is active.
const LOCK_ATTRIBUTE = 'data-scroll-locked'

/**
 * Keeps the page where it was when a dialog opens.
 *
 * Radix locks scrolling with `overflow: hidden` on <body>. Because <html> is
 * `overflow: visible`, that value propagates to the viewport, so the document
 * cannot scroll while the lock is on and the browser clamps its offset. Opening
 * a dialog from far down the page therefore leaves you back at the top.
 *
 * We snapshot the offset the moment the lock is applied and restore it when the
 * lock is released. The offset is tracked from a passive scroll listener rather
 * than read on demand, so the snapshot can never pick up an already-clamped 0.
 */
export function useScrollLockPreserve() {
  useEffect(() => {
    const body = document.body
    let isLocked = body.hasAttribute(LOCK_ATTRIBUTE)
    let lastOffset = window.scrollY
    let savedOffset = lastOffset

    const handleScroll = () => {
      if (!isLocked) lastOffset = window.scrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const observer = new MutationObserver(() => {
      const nextLocked = body.hasAttribute(LOCK_ATTRIBUTE)
      // Nested overlays (a Select inside a Dialog) bump the lock counter without
      // clearing the attribute — only react when it actually toggles.
      if (nextLocked === isLocked) return
      isLocked = nextLocked

      if (nextLocked) {
        savedOffset = lastOffset
      } else if (window.scrollY !== savedOffset) {
        window.scrollTo(0, savedOffset)
        lastOffset = savedOffset
      }
    })
    observer.observe(body, { attributes: true, attributeFilter: [LOCK_ATTRIBUTE] })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])
}
