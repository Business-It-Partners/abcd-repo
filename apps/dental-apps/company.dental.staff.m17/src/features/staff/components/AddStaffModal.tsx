import { useEffect, useState, type FormEvent } from "react";
import { Field, FieldPair, Input, Modal, ModalBody, ModalError, Select } from "@/shared/ui/workspace-primitives";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { todayISO } from "@/shared/dates/nepaliDate";
import type { StaffType, StaffWriteInput } from "../types";

type StaffForm = {
  fullName: string;
  staffType: StaffType;
  jobTitle: string;
  phone: string;
  email: string;
  joinedOn: string;
  baseSalaryAmount: string;
  status: "active" | "inactive";
};

const emptyForm = (): StaffForm => ({
  fullName: "",
  staffType: "doctor",
  jobTitle: "",
  phone: "",
  email: "",
  joinedOn: todayISO(),
  baseSalaryAmount: "",
  status: "active",
});

const toInput = (form: StaffForm): StaffWriteInput => ({
  fullName: form.fullName.trim(),
  staffType: form.staffType,
  jobTitle: form.jobTitle.trim() || null,
  phone: form.phone.trim() || null,
  email: form.email.trim() || null,
  joinedOn: form.joinedOn,
  baseSalaryAmount: form.baseSalaryAmount === "" ? null : Number(form.baseSalaryAmount),
  status: form.status,
});

export function AddStaffModal({
  busy,
  pending,
  error,
  onClose,
  onCreate,
  onRetry,
  onLifecycle,
}: {
  busy: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: StaffWriteInput) => Promise<void>;
  onRetry: () => Promise<void>;
  onLifecycle: (state: { dirty: boolean; modal: boolean }) => void;
}) {
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const blocked = busy || pending;

  useEffect(() => {
    onLifecycle({ dirty: true, modal: true });
    return () => onLifecycle({ dirty: false, modal: false });
  }, [onLifecycle]);

  const close = () => {
    if (!blocked) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!blocked) void onCreate(toInput(form));
  };

  return (
    <Modal title="Add a staff member" onClose={close} maxWidth={620}>
      <ModalBody as="form" onSubmit={submit}>
        <p className="staffModalIntro">Add a doctor or clinic team member to the operational staff roster.</p>
        {error ? <ModalError>{error}</ModalError> : null}
        <fieldset className="staffFormFields" disabled={blocked}>
          <Field label="Full name" required htmlFor="staff-full-name">
            <Input
              autoFocus
              id="staff-full-name"
              maxLength={160}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Full name"
              required
              value={form.fullName}
            />
          </Field>
          <FieldPair>
            <Field label="Staff type" required htmlFor="staff-type">
              <Select
                id="staff-type"
                onChange={(event) => setForm({ ...form, staffType: event.target.value as StaffType })}
                value={form.staffType}
              >
                <option value="doctor">Doctor (Clinician)</option>
                <option value="helper">Support staff</option>
                <option value="receptionist">Reception</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Role designation" htmlFor="staff-role">
              <Input
                id="staff-role"
                maxLength={120}
                onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                placeholder="e.g. Orthodontist"
                value={form.jobTitle}
              />
            </Field>
          </FieldPair>
          <FieldPair>
            <Field label="Monthly base salary (NPR)" htmlFor="staff-salary">
              <Input
                id="staff-salary"
                inputMode="numeric"
                min="0"
                onChange={(event) => setForm({ ...form, baseSalaryAmount: event.target.value })}
                placeholder="e.g. 85000"
                step="1"
                type="number"
                value={form.baseSalaryAmount}
              />
            </Field>
            <Field label="Joined date" required>
              <DatePicker
                fluid
                onChange={(joinedOn) => setForm({ ...form, joinedOn })}
                value={form.joinedOn}
              />
            </Field>
          </FieldPair>
          <FieldPair>
            <Field label="Phone" htmlFor="staff-phone">
              <Input
                id="staff-phone"
                inputMode="tel"
                maxLength={40}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+977 …"
                value={form.phone}
              />
            </Field>
            <Field label="Email (optional)" htmlFor="staff-email">
              <Input
                id="staff-email"
                maxLength={254}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@clinic.com"
                type="email"
                value={form.email}
              />
            </Field>
          </FieldPair>
          <Field label="Status" required htmlFor="staff-status">
            <Select
              id="staff-status"
              onChange={(event) => setForm({ ...form, status: event.target.value as StaffForm["status"] })}
              value={form.status}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </fieldset>
        <div className="staffFormActions">
          <button className="staffSecondary" disabled={blocked} onClick={close} type="button">Cancel</button>
          {pending ? (
            <button className="staffPrimary" disabled={busy} onClick={() => void onRetry()} type="button">
              {busy ? "Checking save…" : "Retry original save"}
            </button>
          ) : (
            <button className="staffPrimary" disabled={busy} type="submit">
              {busy ? "Saving…" : "Add staff member"}
            </button>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
