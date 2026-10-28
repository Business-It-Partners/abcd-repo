import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Check, Copy, KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserRoundCog, UserRoundPlus } from "lucide-react";
import { ClinicClient, ClinicError, type ClinicCommand } from "../../../../packages/app-sdk/src/clinicClient";
import { connectBrowserRuntime } from "../../../../apps/clinic-app-runtime/runtimeBridge";
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from "../../../../packages/dental-ui/src/shared/ui/workspace-primitives/sandboxedFormSubmit";
import { ClinicSnackbarProvider, useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import {
  cleanLoginNameInput,
  finalLoginName,
  isClinicUserAccount,
  sortClinicUsers,
  UserManagementApi,
  type ClinicUserAccount,
  type ClinicUserCreate,
  type ClinicUserReceipt,
  type ClinicUserUpdate,
  type PasswordReceipt,
} from "./userManagementApi";
import "../../../../packages/dental-ui/src/shared/clinic.css";
import "./styles.css";

const APP_ID = "user-management";
const LOGIN_DOMAIN = "sphirontech.com";
const browserRuntime = connectBrowserRuntime();
type CreateForm = ClinicUserCreate & { confirmPassword: string };
type EditForm = { account: ClinicUserAccount; displayName: string; role: "doctor" | "reception" };
type PasswordForm = { account: ClinicUserAccount; password: string; confirmPassword: string };
type PendingWrite = { command: ClinicCommand<unknown>; label: string; apply: (value: unknown) => void };

const initialCreate: CreateForm = { displayName: "", loginName: "", role: "doctor", password: "", confirmPassword: "" };

function friendly(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "CONFLICT") return "This account changed. Refresh the list and try again.";
    if (cause.code === "FORBIDDEN") return "Your clinic role no longer allows user management.";
    if (cause.code === "VALIDATION") return "The clinic rejected this change. Check the details and refresh the list.";
    return cause.message || fallback;
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function App() {
  const { showSuccess, showError } = useClinicSnackbar();
  const clientRef = useRef<ClinicClient | null>(null);
  const apiRef = useRef<UserManagementApi | null>(null);
  const pendingWriteRef = useRef<PendingWrite | null>(null);
  const writeBusyRef = useRef(false);
  const loadEpochRef = useRef(0);
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Opening User Management…");
  const [users, setUsers] = useState<ClinicUserAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [copiedEmail, setCopiedEmail] = useState("");
  const copyTimeoutRef = useRef<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordForm | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");
  const modalOpen = !!createForm || !!editForm || !!passwordForm;
  const writeBlocked = saving || !!pendingLabel;

  const clearSessionView = useCallback(() => {
    loadEpochRef.current++;
    pendingWriteRef.current = null;
    writeBusyRef.current = false;
    apiRef.current = null;
    clientRef.current = null;
    setUsers([]);
    setCurrentUserId("");
    setClient(null);
    setReady(false);
    setLoading(false);
    setSaving(false);
    setPendingLabel("");
    setCreateForm(null);
    setEditForm(null);
    setPasswordForm(null);
    setFormDirty(false);
    setMessage("The clinic session changed. Reopen User Management from Dental OS.");
  }, []);

  const refresh = useCallback(async (api = apiRef.current) => {
    if (!api) return;
    const epoch = ++loadEpochRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const rows = await api.list();
      if (epoch === loadEpochRef.current) setUsers(sortClinicUsers(rows));
    } catch (cause) {
      if (epoch === loadEpochRef.current) setLoadError(friendly(cause, "Clinic users could not be loaded."));
    } finally {
      if (epoch === loadEpochRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let sdk: ClinicClient | null = null;
    let unsubscribe = () => {};
    void browserRuntime.then(async bridge => {
      if (!active) return;
      sdk = new ClinicClient(bridge, clearSessionView);
      clientRef.current = sdk;
      unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
        if (moduleId !== APP_ID && active) setMessage("The selected User Management module is unavailable.");
      });
      const { session } = await sdk.initialize(APP_ID);
      if (session.clinicUser.role !== "admin" || !session.clinicUser.capabilities.includes("clinic_users.manage")) {
        throw new ClinicError("FORBIDDEN", "User Management is available only to clinic administrators.");
      }
      const clinicUserId = session.clinicUser.clinicUserId;
      if (typeof clinicUserId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clinicUserId)) {
        throw new ClinicError("INVALID_RESPONSE", "The clinic session is missing its account identity.");
      }
      if (!active) return;
      const api = new UserManagementApi(sdk);
      apiRef.current = api;
      setCurrentUserId(clinicUserId);
      setClient(sdk);
      setReady(true);
      setMessage("");
      void refresh(api);
    }).catch((cause) => {
      if (active) setMessage(friendly(cause, "User Management could not be opened."));
    });
    return () => {
      active = false;
      unsubscribe();
      sdk?.report({ dirty: false, modal: false });
      if (clientRef.current === sdk) {
        clientRef.current = null;
        apiRef.current = null;
      }
    };
  }, [clearSessionView, refresh]);

  useEffect(() => {
    client?.report({ dirty: formDirty || !!pendingLabel, modal: modalOpen });
  }, [client, formDirty, modalOpen, pendingLabel]);

  const runPendingWrite = useCallback(async () => {
    const pending = pendingWriteRef.current;
    if (!pending || writeBusyRef.current) return;
    writeBusyRef.current = true;
    setSaving(true);
    try {
      const value = await pending.command.execute();
      if (pendingWriteRef.current !== pending) return;
      pendingWriteRef.current = null;
      setPendingLabel("");
      pending.apply(value);
    } catch (cause) {
      if (pendingWriteRef.current !== pending) return;
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setPendingLabel(pending.label);
        const message = "The clinic has not confirmed this save. Check the original request before starting another change.";
        showError(message);
      } else {
        pendingWriteRef.current = null;
        setPendingLabel("");
        const message = friendly(cause, "The clinic could not save this change.");
        showError(message);
      }
    } finally {
      writeBusyRef.current = false;
      setSaving(false);
    }
  }, [showError]);

  const submitWrite = useCallback(<T,>(command: ClinicCommand<T>, label: string, apply: (value: T) => void) => {
    if (writeBusyRef.current || pendingWriteRef.current) return;
    const pending: PendingWrite = {
      command: command as ClinicCommand<unknown>,
      label,
      apply: value => apply(value as T),
    };
    pendingWriteRef.current = pending;
    setPendingLabel(label);
    void runPendingWrite();
  }, [runPendingWrite]);

  const closeDialogs = useCallback(() => {
    if (writeBlocked) return;
    setCreateForm(null);
    setEditForm(null);
    setPasswordForm(null);
    setDialogError("");
    setFormDirty(false);
  }, [writeBlocked]);

  const openCreate = () => {
    setCreateForm({ ...initialCreate });
    setEditForm(null);
    setPasswordForm(null);
    setDialogError("");
    setFormDirty(false);
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm || !apiRef.current || writeBlocked) return;
    if (createForm.password !== createForm.confirmPassword) {
      setDialogError("Passwords do not match.");
      return;
    }
    const loginName = finalLoginName(createForm.loginName);
    if (!loginName) {
      setDialogError("Enter a login name containing letters or numbers.");
      return;
    }
    const input: ClinicUserCreate = {
      displayName: createForm.displayName.trim(),
      loginName,
      role: createForm.role,
      password: createForm.password,
    };
    const command = apiRef.current.create(input);
    setDialogError("");
    submitWrite(command, "create login", ({ user }) => {
      setUsers(current => sortClinicUsers([...current, user]));
      setCreateForm(null);
      setFormDirty(false);
      showSuccess(`Login created for ${user.username}.`);
    });
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm || !apiRef.current || writeBlocked) return;
    const input: ClinicUserUpdate = {
      displayName: editForm.displayName.trim(),
      role: editForm.role,
      status: editForm.account.status,
      expectedRowVersion: editForm.account.rowVersion,
    };
    const command = apiRef.current.update(editForm.account.clinicUserId, input);
    setDialogError("");
    submitWrite(command, "update account", ({ user }) => {
      setUsers(current => sortClinicUsers(current.map(item => item.clinicUserId === user.clinicUserId ? user : item)));
      setEditForm(null);
      setFormDirty(false);
      showSuccess(`${user.displayName}'s access was updated.`);
    });
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordForm || !apiRef.current || writeBlocked) return;
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setDialogError("Passwords do not match.");
      return;
    }
    const account = passwordForm.account;
    const command = apiRef.current.changePassword(account.clinicUserId, passwordForm.password);
    setDialogError("");
    submitWrite(command, "change password", (_receipt: PasswordReceipt) => {
      setPasswordForm(null);
      setFormDirty(false);
      showSuccess(`Password changed for ${account.username}.`);
    });
  };

  const toggleStatus = (account: ClinicUserAccount) => {
    if (!apiRef.current || writeBlocked || account.role === "admin") return;
    const nextStatus = account.status === "enabled" ? "disabled" : "enabled";
    const input: ClinicUserUpdate = {
      displayName: account.displayName,
      role: account.role,
      status: nextStatus,
      expectedRowVersion: account.rowVersion,
    };
    const command = apiRef.current.update(account.clinicUserId, input);
    submitWrite(command, `change ${account.displayName}'s status`, ({ user }) => {
      setUsers(current => sortClinicUsers(current.map(item => item.clinicUserId === user.clinicUserId ? user : item)));
      showSuccess(`${user.displayName} is now ${user.status}.`);
    });
  };

  const copyLoginEmail = async (email: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = email;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        let copied = false;
        try {
          textarea.select();
          copied = document.execCommand("copy");
        } finally {
          textarea.remove();
        }
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setCopiedEmail(email);
      showSuccess("Login email copied.");
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedEmail(current => current === email ? "" : current);
        copyTimeoutRef.current = null;
      }, 1_400);
    } catch {
      showError("Login email could not be copied.");
    }
  };

  useEffect(() => () => {
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
  }, []);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(user => !term || `${user.displayName} ${user.username} ${user.role} ${user.status}`.toLowerCase().includes(term));
  }, [search, users]);

  if (!ready) {
    const opening = message.startsWith("Opening");
    return <main className="clinicApp userManagementStatus" role={opening ? "status" : "alert"}><ShieldCheck aria-hidden="true" size={21} /><p>{message}</p></main>;
  }

  return <main className="clinicApp userManagementApp">
    <header className="umHeader">
      <div className="umHeading">
        <p className="umEyebrow">Access management</p>
        <h1><UserRoundCog aria-hidden="true" size={22} />User Management</h1>
        <p>Manage clinic login accounts. Staff profiles remain separate.</p>
      </div>
      <button className="umPrimary" type="button" disabled={writeBlocked} onClick={openCreate}><UserRoundPlus aria-hidden="true" size={16} />Add user</button>
    </header>

    <section className="umPanel" aria-label="Clinic login accounts">
      <div className="umToolbar">
        <label className="umSearch"><Search aria-hidden="true" size={16} /><span className="umSrOnly">Search clinic users</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users" /></label>
        <span className="umCount">{loading ? "Loading users…" : `${visibleUsers.length} ${visibleUsers.length === 1 ? "user" : "users"}`}</span>
        <button className="umRefresh" type="button" aria-label="Refresh clinic users" title="Refresh" disabled={loading || writeBlocked} onClick={() => void refresh()}><RefreshCw aria-hidden="true" size={15} /></button>
      </div>

      {loadError && <p className="umAlert" role="alert">{loadError}</p>}

      <div className="umTableWrap">
        <table className="umTable">
          <thead><tr><th scope="col">Name</th><th scope="col">Login email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Identity</th><th scope="col" className="umActionsHeading">Actions</th></tr></thead>
          <tbody>
            {!loading && !loadError && visibleUsers.length === 0 && <tr><td colSpan={6} className="umEmpty">{users.length ? "No users match this search." : "No clinic users found."}</td></tr>}
            {visibleUsers.map(account => <tr key={account.clinicUserId}>
              <td><span className="umName"><span className="umAvatar" aria-hidden="true">{account.displayName.trim().slice(0, 1).toUpperCase() || "?"}</span><strong>{account.displayName}</strong></span></td>
              <td className="umEmail"><span className="umEmailText">{account.username}</span><button className="umCopyEmail" type="button" aria-label={`Copy ${account.username}`} title="Copy login email" onClick={() => void copyLoginEmail(account.username)}>{copiedEmail === account.username ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}</button></td>
              <td><span className={`umRole umRole-${account.role}`}>{account.role}</span></td>
              <td><span className={`umStatus umStatus-${account.status}`}>{account.status}</span></td>
              <td><span className={`umIdentity umIdentity-${account.identityStatus}`}>{account.identityStatus === "linked" ? "Linked" : "Pending"}</span></td>
              <td className="umActions">
                {account.role === "admin" ? <span className="umProtected">Protected account</span> : <>
                  <button className="umAction" type="button" disabled={writeBlocked} onClick={() => { setEditForm({ account, displayName: account.displayName, role: account.role as "doctor" | "reception" }); setCreateForm(null); setPasswordForm(null); setDialogError(""); setFormDirty(false); }}><Pencil aria-hidden="true" size={13} />Edit</button>
                  <button className="umAction" type="button" disabled={writeBlocked || account.identityStatus !== "linked"} title={account.identityStatus !== "linked" ? "This login is not linked to Firebase Authentication yet." : "Change password"} onClick={() => { setPasswordForm({ account, password: "", confirmPassword: "" }); setCreateForm(null); setEditForm(null); setDialogError(""); setFormDirty(false); }}><KeyRound aria-hidden="true" size={13} />Password</button>
                  <button className="umTextButton" type="button" disabled={writeBlocked || account.clinicUserId === currentUserId} title={account.clinicUserId === currentUserId ? "You cannot disable your own account." : undefined} onClick={() => toggleStatus(account)}>{account.status === "enabled" ? "Disable" : "Enable"}</button>
                </>}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {loading && users.length === 0 && <p className="umLoading" role="status">Loading clinic login accounts…</p>}
    </section>

    {createForm && <ClinicModal title="Add clinic user" description="Create a doctor or reception login. The password is sent to the clinic service and is not persisted to this device." onClose={closeDialogs} closeDisabled={writeBlocked} size="large">
      <form className="umForm" onSubmit={submitCreate} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown}>
        <label>Display name<input autoComplete="off" maxLength={160} required value={createForm.displayName} disabled={writeBlocked} onChange={event => { setCreateForm({ ...createForm, displayName: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        <label>Username<span className="umLoginField"><input autoComplete="off" maxLength={64} required value={createForm.loginName} disabled={writeBlocked} onChange={event => { setCreateForm({ ...createForm, loginName: cleanLoginNameInput(event.target.value) }); setFormDirty(true); setDialogError(""); }} /><span>@{LOGIN_DOMAIN}</span></span><small>Login email: {finalLoginName(createForm.loginName) || "username"}@{LOGIN_DOMAIN}</small></label>
        <label>Role<select value={createForm.role} disabled={writeBlocked} onChange={event => { setCreateForm({ ...createForm, role: event.target.value as "doctor" | "reception" }); setFormDirty(true); }}><option value="doctor">Doctor</option><option value="reception">Reception</option></select></label>
        <label>Password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={createForm.password} disabled={writeBlocked} onChange={event => { setCreateForm({ ...createForm, password: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        <label>Confirm password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={createForm.confirmPassword} disabled={writeBlocked} onChange={event => { setCreateForm({ ...createForm, confirmPassword: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        {dialogError && <p className="umAlert" role="alert">{dialogError}</p>}
        <div className="umFormActions"><button className="umSecondary" type="button" disabled={writeBlocked} onClick={closeDialogs}>Cancel</button>{pendingLabel ? <button className="umPrimary" type="button" disabled={saving} onClick={() => void runPendingWrite()}>Check original save</button> : <button className="umPrimary" type="submit" disabled={saving}><Plus aria-hidden="true" size={15} />{saving ? "Creating…" : "Create login"}</button>}</div>
      </form>
    </ClinicModal>}

    {editForm && <ClinicModal title="Edit clinic user" description={`Update the name and access role for ${editForm.account.username}.`} onClose={closeDialogs} closeDisabled={writeBlocked} size="small">
      <form className="umForm" onSubmit={submitEdit} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown}>
        <label>Display name<input autoComplete="off" maxLength={160} required value={editForm.displayName} disabled={writeBlocked} onChange={event => { setEditForm({ ...editForm, displayName: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        <label>Role<select value={editForm.role} disabled={writeBlocked} onChange={event => { setEditForm({ ...editForm, role: event.target.value as "doctor" | "reception" }); setFormDirty(true); }}><option value="doctor">Doctor</option><option value="reception">Reception</option></select></label>
        {dialogError && <p className="umAlert" role="alert">{dialogError}</p>}
        <div className="umFormActions"><button className="umSecondary" type="button" disabled={writeBlocked} onClick={closeDialogs}>Cancel</button>{pendingLabel ? <button className="umPrimary" type="button" disabled={saving} onClick={() => void runPendingWrite()}>Check original save</button> : <button className="umPrimary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>}</div>
      </form>
    </ClinicModal>}

    {passwordForm && <ClinicModal title="Change password" description={`Set a new password for ${passwordForm.account.username}. No reset email will be sent.`} onClose={closeDialogs} closeDisabled={writeBlocked} size="small">
      <form className="umForm" onSubmit={submitPassword} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown}>
        <label>New password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={passwordForm.password} disabled={writeBlocked} onChange={event => { setPasswordForm({ ...passwordForm, password: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        <label>Confirm new password<input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={passwordForm.confirmPassword} disabled={writeBlocked} onChange={event => { setPasswordForm({ ...passwordForm, confirmPassword: event.target.value }); setFormDirty(true); setDialogError(""); }} /></label>
        {dialogError && <p className="umAlert" role="alert">{dialogError}</p>}
        <div className="umFormActions"><button className="umSecondary" type="button" disabled={writeBlocked} onClick={closeDialogs}>Cancel</button>{pendingLabel ? <button className="umPrimary" type="button" disabled={saving} onClick={() => void runPendingWrite()}>Check original save</button> : <button className="umPrimary" type="submit" disabled={saving}>{saving ? "Changing…" : "Change password"}</button>}</div>
      </form>
    </ClinicModal>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<ClinicSnackbarProvider><App /></ClinicSnackbarProvider>);
