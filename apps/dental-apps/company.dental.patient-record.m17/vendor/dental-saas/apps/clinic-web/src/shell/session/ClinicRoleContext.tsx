import { createContext, useContext } from "react";

export type ClinicRole = "admin" | "doctor" | "staff" | "assistant";
const ClinicRoleContext = createContext<ClinicRole>("assistant");

export function ClinicRoleProvider({ role, children }: { role: ClinicRole; children: React.ReactNode }) {
  return <ClinicRoleContext.Provider value={role}>{children}</ClinicRoleContext.Provider>;
}

export function useClinicRole(): ClinicRole {
  return useContext(ClinicRoleContext);
}
