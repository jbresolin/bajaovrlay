import { AppShell } from '@/app/AppShell';

/**
 * The control page. It must be drawn inside a ControlPageStateProvider (main.tsx does
 * that with the real server connection; tests do it with a fake server).
 */
export function App() {
  return <AppShell />;
}
