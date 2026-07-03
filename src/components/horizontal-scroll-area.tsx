import { useEffect, useRef, type HTMLAttributes } from 'react'

import { cx } from '../lib/cx'

type HorizontalScrollAreaProps = Omit<HTMLAttributes<HTMLDivElement>, 'onWheel'>

type PointerPosition = {
  x: number
  y: number
}

function wheelUnit(event: WheelEvent, element: HTMLElement): number {
  if (event.deltaMode === 1) {
    return 18
  }

  if (event.deltaMode === 2) {
    return element.clientWidth
  }

  return 1
}

function isInsideVisibleFrame(event: { clientX: number; clientY: number }, element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()

  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
}

function isWheelArmed(event: WheelEvent, pointerPosition: PointerPosition | null): boolean {
  if (!pointerPosition) {
    return false
  }

  const tolerance = 2
  return Math.abs(pointerPosition.x - event.clientX) <= tolerance && Math.abs(pointerPosition.y - event.clientY) <= tolerance
}

function handleHorizontalWheel(event: WheelEvent, element: HTMLElement, pointerPosition: PointerPosition | null): boolean {
  if (!isInsideVisibleFrame(event, element)) {
    return false
  }

  if (!isWheelArmed(event, pointerPosition)) {
    return false
  }

  const canScrollHorizontally = element.scrollWidth > element.clientWidth + 1

  if (!canScrollHorizontally) {
    return false
  }

  const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY

  if (!primaryDelta) {
    return false
  }

  const delta = primaryDelta * wheelUnit(event, element)
  const atStart = element.scrollLeft <= 0
  const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1

  if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
    return false
  }

  event.preventDefault()
  element.scrollLeft += delta
  return true
}

export function HorizontalScrollArea({ className, ...props }: HorizontalScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pointerPositionRef = useRef<PointerPosition | null>(null)

  useEffect(() => {
    const element = scrollRef.current

    if (!element) {
      return undefined
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerPositionRef.current = isInsideVisibleFrame(event, element) ? { x: event.clientX, y: event.clientY } : null
    }

    const clearPointerPosition = () => {
      pointerPositionRef.current = null
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.defaultPrevented) {
        handleHorizontalWheel(event, element, pointerPositionRef.current)
      }
    }

    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerleave', clearPointerPosition)
    element.addEventListener('pointercancel', clearPointerPosition)
    element.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerleave', clearPointerPosition)
      element.removeEventListener('pointercancel', clearPointerPosition)
      element.removeEventListener('wheel', onWheel)
    }
  }, [])

  return <div {...props} ref={scrollRef} data-horizontal-scroll-area="true" className={cx('horizontal-scroll-area', className)} />
}
