import { useState, useEffect } from 'react';

const MOBILE_MQL = '(max-width: 599px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_MQL).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MQL);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
