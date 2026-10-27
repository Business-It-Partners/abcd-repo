import { ClinicCommand, ClinicError, clinicClient } from './client';

export { ClinicCommand, ClinicError };

type PendingCommand = {
  operationId: string;
  client: ReturnType<typeof clinicClient>;
  method: 'POST' | 'PATCH' | 'PUT';
  path: string;
  body: string;
  command: ClinicCommand<unknown>;
  state: 'pending' | 'unknown';
};

const commands = new Map<string, PendingCommand>();

/** Reuse the same immutable intent and key after an uncertain write result. */
export async function executeClinicCommand<T>(command: ClinicCommand<T>): Promise<T> {
  const client = clinicClient();
  const blocking = [...commands.values()].find(entry => entry.state === 'unknown' || entry.state === 'pending');
  const existing = commands.get(command.operationId) ?? (blocking
    && blocking.method === command.method
    && blocking.path === command.path
    && blocking.body === command.body ? blocking : undefined);
  if (blocking && !existing) throw new ClinicError('BUSY', 'Check the original save before starting another clinic change.');
  if (existing && (existing.client !== client || existing.method !== command.method || existing.path !== command.path || existing.body !== command.body)) {
    throw new ClinicError('BUSY', 'The original save is unresolved. Check it before changing this draft.');
  }
  const stable = existing?.command as ClinicCommand<T> | undefined ?? command;
  commands.set(stable.operationId, {
    operationId: stable.operationId, client, method: stable.method, path: stable.path,
    body: stable.body, command: stable as ClinicCommand<unknown>, state: 'pending',
  });
  try {
    const result = await stable.execute();
    commands.delete(stable.operationId);
    return result;
  } catch (cause) {
    if (cause instanceof ClinicError && cause.outcome === 'unknown') {
      const pending = commands.get(stable.operationId);
      if (pending) pending.state = 'unknown';
    } else commands.delete(stable.operationId);
    throw cause;
  }
}
