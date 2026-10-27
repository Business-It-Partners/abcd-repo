import { createContext, useContext } from "react";
import type { PatientMediaSdk } from "./api";

const PatientMediaContext = createContext<PatientMediaSdk | null>(null);

export function PatientMediaProvider({ sdk, children }: { sdk: PatientMediaSdk; children: React.ReactNode }) {
  return <PatientMediaContext.Provider value={sdk}>{children}</PatientMediaContext.Provider>;
}

export function usePatientMediaSdk(): PatientMediaSdk {
  const sdk = useContext(PatientMediaContext);
  if (!sdk) throw new Error("Patient Record imaging is not connected to Dental OS.");
  return sdk;
}
