import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

/** The control page. For now: the product name and the server check. */
export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{ptBR.app.title}</h1>
      <ServerHealthCheck />
    </main>
  );
}
