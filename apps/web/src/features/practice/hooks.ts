import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_AFTER_MS = 60_000;
const TICK_MS = 1_000;

/**
 * Active solving time without idle gaps (attempts' `activeMs`): counts a second while the tab is
 * visible and the learner gave input within the last minute.
 */
export function useActiveTime() {
  const [startedAt] = useState(() => Date.now());
  const active = useRef(0);
  const lastInput = useRef(startedAt);
  useEffect(() => {
    const onInput = () => {
      lastInput.current = Date.now();
    };
    const events = ['keydown', 'pointerdown', 'scroll', 'input'] as const;
    for (const e of events) window.addEventListener(e, onInput, { passive: true, capture: true });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInput.current < IDLE_AFTER_MS)
        active.current += TICK_MS;
    }, TICK_MS);
    return () => {
      for (const e of events) window.removeEventListener(e, onInput, { capture: true });
      clearInterval(timer);
    };
  }, []);
  const read = useCallback(() => {
    const value = active.current;
    active.current = 0; // the next attempt (retry) counts from here
    return value;
  }, []);
  return { startedAt, readActiveMs: read };
}
