import { ClinicCommand, ClinicError, type ClinicClient } from "../../../../../packages/app-sdk/src/clinicClient";

type PendingCommand = {
  client: ClinicClient;
  command: ClinicCommand<unknown>;
  state: "pending" | "unknown";
};

const commands = new Map<string, PendingCommand>();

/** Unknown outcomes block new writes until the original immutable command is resolved. */
export async function executeStaffCommand<T>(client: ClinicClient, command: ClinicCommand<T>): Promise<T> {
  const blocking = Array.from(commands.values()).find((entry) => entry.state === "pending" || entry.state === "unknown");
  const existing = commands.get(command.operationId) ?? (blocking
    && blocking.command.method === command.method
    && blocking.command.path === command.path
    && blocking.command.body === command.body ? blocking : undefined);
  if (blocking && !existing) {
    throw new ClinicError("BUSY", "Check the original save before starting another clinic change.");
  }
  if (existing && (existing.client !== client || existing.command.method !== command.method
    || existing.command.path !== command.path || existing.command.body !== command.body)) {
    throw new ClinicError("BUSY", "The original save is unresolved. Check it before changing this draft.");
  }
  const stable = (existing?.command as ClinicCommand<T> | undefined) ?? command;
  commands.set(stable.operationId, { client, command: stable as ClinicCommand<unknown>, state: "pending" });
  try {
    const result = await stable.execute();
    commands.delete(stable.operationId);
    return result;
  } catch (cause) {
    if (cause instanceof ClinicError && cause.outcome === "unknown") {
      const pending = commands.get(stable.operationId);
      if (pending) pending.state = "unknown";
    } else {
      commands.delete(stable.operationId);
    }
    throw cause;
  }
}
