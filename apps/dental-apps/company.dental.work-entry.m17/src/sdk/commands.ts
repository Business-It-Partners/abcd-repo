import { ClinicCommand, ClinicError, clinicClient } from './client';

type PendingCommand = { operationId: string; client: ReturnType<typeof clinicClient>; method: 'POST' | 'PUT' | 'PATCH'; path: string; body: string; command: ClinicCommand<unknown>; state: 'pending' | 'unknown' };
const commands = new Map<string, PendingCommand>();

/**
 * Keep an immutable command instance for same-key retries while this app session
 * is alive. Reusing an operation ID with edited data is rejected locally.
 */
export async function executeClinicCommand<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  input: unknown,
  operationId?: string,
  valid: (value: unknown) => boolean = () => true,
): Promise<T> {
  const client = clinicClient();
  const body = JSON.stringify(input);
  let existing = operationId ? commands.get(operationId) : undefined;
  const blocking = [...commands.values()].find(entry => entry.state === 'unknown' || entry.state === 'pending');
  if (!operationId && blocking && blocking.method === method && blocking.path === path && blocking.body === body) existing = blocking;
  if (blocking && !existing) throw new ClinicError('BUSY', 'Check the original save before starting another clinic change.');
  const key = existing?.operationId ?? operationId ?? crypto.randomUUID();
  if (existing && (existing.client !== client || existing.method !== method || existing.path !== path || existing.body !== body)) {
    throw new ClinicError('BUSY', 'The original save is unresolved. Check it before changing this draft.');
  }
  const command = (existing?.command as ClinicCommand<T> | undefined)
    ?? new ClinicCommand<T>(client, method, path, body, key, valid);
  commands.set(key, { operationId: key, client, method, path, body, command: command as ClinicCommand<unknown>, state: 'pending' });
  try {
    const result = await command.execute();
    commands.delete(key);
    return result;
  } catch (cause) {
    if (cause instanceof ClinicError && cause.outcome === 'unknown') {
      const pending = commands.get(key);
      if (pending) pending.state = 'unknown';
    } else commands.delete(key);
    throw cause;
  }
}
