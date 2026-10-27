import { describe, expect, it } from "vitest";
import { showsStandalonePatientRegistrationFields } from "./standalonePatientRegistration";

describe("standalone patient registration fields", () => {
  it("shows patient code and registration date on Patient Record new-patient entry", () => {
    expect(showsStandalonePatientRegistrationFields({
      isNewPatient: true,
      hideStepTabs: true,
      patientStepOnly: false,
    })).toBe(true);
  });

  it("does not show registration fields in the full visit wizard", () => {
    expect(showsStandalonePatientRegistrationFields({
      isNewPatient: true,
      hideStepTabs: false,
      patientStepOnly: false,
    })).toBe(false);
  });

  it("does not show registration fields for an existing patient or case", () => {
    expect(showsStandalonePatientRegistrationFields({
      isNewPatient: false,
      hideStepTabs: true,
      patientStepOnly: false,
    })).toBe(false);
    expect(showsStandalonePatientRegistrationFields({
      isNewPatient: false,
      hideStepTabs: false,
      patientStepOnly: true,
    })).toBe(false);
  });
});
