import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { useEffect, useState } from 'react';

/**
 * Returns "now" on the server's clock, read again every `refreshIntervalMs`, and draws
 * the component again each time. The page's times ("há 40 s", the session clock) count
 * from moments the server stamped, so they read the server-aligned now
 * (packages/shared/src/clock), never the tablet's own clock, which may be off by
 * seconds.
 * What could go wrong: the value is up to `refreshIntervalMs` old between two reads.
 */
export function useServerAlignedTimeMs(refreshIntervalMs: number): number {
  const [nowMs, setNowMs] = useState(() => readServerAlignedTimeMs());

  useEffect(() => {
    const readAgainTimer = setInterval(() => {
      setNowMs(readServerAlignedTimeMs());
    }, refreshIntervalMs);
    return () => {
      clearInterval(readAgainTimer);
    };
  }, [refreshIntervalMs]);

  return nowMs;
}
