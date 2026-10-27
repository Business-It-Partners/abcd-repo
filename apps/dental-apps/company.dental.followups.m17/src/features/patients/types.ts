// Selected pure declarations imported from Dental SaaS f0d059d36540b4b6907cace089085ce0df62d454.
export type PatientSex = "female" | "male" | "other" | "not_recorded";

export type FollowUpCreateInput = {
  patientId: string;
  chiefComplaintId: string | null;
  dueOn: string;
  dueTime: string | null;
  reason: string;
  requestedByStaffId: string | null;
};

export type PatientFollowUp = {
  followUpId: string;
  patientId: string;
  chiefComplaintId: string | null;
  dueOn: string;
  dueTime: string | null;
  reason: string;
  status: "pending" | "caught" | "missed" | "cancelled";
};

export type FollowUpWorklistItem = PatientFollowUp & {
  rowVersion: number;
  patientNumber: string;
  patientName: string;
  patientPhone: string | null;
  requestedByStaffName: string | null;
  lastVisitOn: string | null;
  called: boolean;
  noAnswer: boolean;
};

export type FollowUpToggleInput = {
  field: "called" | "no_answer" | "caught";
  checked: boolean;
  expectedRowVersion: number;
};

export type FollowUpToggleResult = {
  followUpId: string;
  field: FollowUpToggleInput["field"];
  checked: boolean;
  status: "pending" | "caught" | "missed" | "cancelled";
  rowVersion: number;
};

export type FollowUpScheduleInput = {
  dueOn: string;
  dueTime: string | null;
  reason: string;
  expectedRowVersion: number;
};

export type PatientSummary = {
  patientId: string;
  patientNumber: string;
  fullName: string;
  dateOfBirth: string | null;
  ageYears: number | null;
  sex: PatientSex | null;
  phone: string | null;
  status: "active" | "inactive";
  registeredOn: string;
  rowVersion: number;
};
