'use client'

import { useEffect } from 'react'

/**
 * TEMPORARY DIAGNOSTIC — remove once the Remind/Resend scroll jump is pinned down.
 *
 * Logs everything that can move the page, so one reproduction tells us which it is:
 *  - SCROLL      a jump larger than a stray wheel tick, plus what had focus
 *  - DOC HEIGHT  content collapsing (the browser then clamps the offset to fit)
 *  - LOCK        Radix applying/releasing its scroll lock
 * `page.tsx` additionally logs RENDER lines when it falls back to the spinner or
 * sign-in screen, which would mean the whole dashboard unmounted and remounted.
 */
export function useScrollJumpDebug(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const tag = '[jump]'
    const docHeight = () => Math.round(document.documentElement.scrollHeight)
    let lastY = Math.round(window.scrollY)
    let lastHeight = docHeight()

    console.warn(tag, 'armed — scrollY:', lastY, 'docHeight:', lastHeight)

    const onScroll = () => {
      const y = Math.round(window.scrollY)
      if (Math.abs(y - lastY) > 80) {
        const active = document.activeElement as HTMLElement | null
        console.warn(
          tag,
          'SCROLL',
          lastY,
          '->',
          y,
          '| locked:',
          document.body.hasAttribute('data-scroll-locked'),
          '| docHeight:',
          docHeight(),
          '| focus:',
          active ? `${active.tagName}.${String(active.className).slice(0, 40)}` : 'none',
        )
      }
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // body grows/shrinks with the contact table, so this catches content collapse
    const resizeObserver = new ResizeObserver(() => {
      const height = docHeight()
      if (Math.abs(height - lastHeight) > 80) {
        console.warn(tag, 'DOC HEIGHT', lastHeight, '->', height, '| scrollY:', Math.round(window.scrollY))
        lastHeight = height
      }
    })
    resizeObserver.observe(document.body)

    const lockObserver = new MutationObserver(() => {
      console.warn(
        tag,
        'LOCK',
        document.body.getAttribute('data-scroll-locked') ?? 'released',
        '| scrollY:',
        Math.round(window.scrollY),
      )
    })
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] })

    return () => {
      window.removeEventListener('scroll', onScroll)
      resizeObserver.disconnect()
      lockObserver.disconnect()
    }
  }, [enabled])
}
