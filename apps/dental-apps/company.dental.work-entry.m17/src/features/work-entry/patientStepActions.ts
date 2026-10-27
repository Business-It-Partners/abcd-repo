/**
 * Actions that a hosted Patient & case step exposes to the Work Entry wizard
 * header.  Keeping them here means the step does not need to render a second
 * navigation bar just to save or move forward.
 */
export type PatientStepActions = {
  onSave: () => void;
  onNext: () => void;
  saveDisabled: boolean;
  nextDisabled: boolean;
  saving: boolean;
};
