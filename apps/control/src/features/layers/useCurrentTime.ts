import { useEffect, useState } from 'react';

/**
 * Returns the current time and redraws the component every `refreshIntervalInMilliseconds`,
 * so text such as "há 2 min" keeps up while the page is left open.
 */
export function useCurrentTime(refreshIntervalInMilliseconds: number): Date {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, refreshIntervalInMilliseconds);
    return () => {
      clearInterval(refreshTimer);
    };
  }, [refreshIntervalInMilliseconds]);

  return currentTime;
}
