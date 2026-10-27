export function showsStandalonePatientRegistrationFields(input: {
  isNewPatient: boolean;
  hideStepTabs: boolean;
  patientStepOnly: boolean;
}): boolean {
  return input.isNewPatient && input.hideStepTabs && !input.patientStepOnly;
}
