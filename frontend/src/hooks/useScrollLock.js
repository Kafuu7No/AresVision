import { useEffect } from 'react';

// Module-level counter — survives React re-renders, handles nested modals correctly.
// Body overflow is locked when count > 0, restored only when count reaches 0.
let lockCount = 0;

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [active]);
}
