import { ClinicClient, ClinicError, type ClinicCommand } from "../../../../packages/app-sdk/src/clinicClient";

export type ClinicUserAccount = {
  clinicUserId: string;
  displayName: string;
  username: string;
  role: "admin" | "doctor" | "reception";
  status: "enabled" | "disabled";
  identityStatus: "pending" | "linked";
  rowVersion: number;
};

export type ClinicUserCreate = {
  displayName: string;
  loginName: string;
  role: "doctor" | "reception";
  password: string;
};

export type ClinicUserUpdate = {
  displayName: string;
  role: "doctor" | "reception";
  status: "enabled" | "disabled";
  expectedRowVersion: number;
};

export type ClinicUserReceipt = { user: ClinicUserAccount };
export type PasswordReceipt = { changed: true };

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isClinicUserAccount(value: unknown): value is ClinicUserAccount {
  return record(value)
    && typeof value.clinicUserId === "string" && uuid.test(value.clinicUserId)
    && typeof value.displayName === "string" && value.displayName.length > 0 && value.displayName.length <= 160
    && typeof value.username === "string" && value.username.length > 0 && value.username.length <= 254
    && ["admin", "doctor", "reception"].includes(value.role as string)
    && ["enabled", "disabled"].includes(value.status as string)
    && ["pending", "linked"].includes(value.identityStatus as string)
    && Number.isSafeInteger(value.rowVersion) && (value.rowVersion as number) > 0;
}

function userReceipt(value: unknown): value is ClinicUserReceipt {
  return record(value) && isClinicUserAccount(value.user);
}

function passwordReceipt(value: unknown): value is PasswordReceipt {
  return record(value) && value.changed === true;
}

export class UserManagementApi {
  constructor(private readonly client: ClinicClient) {}

  async list(): Promise<ClinicUserAccount[]> {
    const value: unknown = await this.client.read("/v1/clinic/users");
    if (!record(value) || !Array.isArray(value.users) || !value.users.every(isClinicUserAccount)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid user list.");
    }
    return value.users;
  }

  create(input: ClinicUserCreate): ClinicCommand<ClinicUserReceipt> {
    return this.client.command("POST", "/v1/clinic/users", input, userReceipt);
  }

  update(clinicUserId: string, input: ClinicUserUpdate): ClinicCommand<ClinicUserReceipt> {
    return this.client.command("PATCH", `/v1/clinic/users/${clinicUserId}`, input, userReceipt);
  }

  changePassword(clinicUserId: string, password: string): ClinicCommand<PasswordReceipt> {
    return this.client.command("POST", `/v1/clinic/users/${clinicUserId}/password`, { password }, passwordReceipt);
  }
}

export function cleanLoginNameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").replace(/-{2,}/g, "-").slice(0, 64);
}

export function finalLoginName(value: string): string {
  return cleanLoginNameInput(value).replace(/-+$/, "");
}

export function sortClinicUsers(users: ClinicUserAccount[]): ClinicUserAccount[] {
  const roleOrder = { admin: 0, doctor: 1, reception: 2 } as const;
  return [...users].sort((left, right) => roleOrder[left.role] - roleOrder[right.role]
    || left.displayName.localeCompare(right.displayName));
}
