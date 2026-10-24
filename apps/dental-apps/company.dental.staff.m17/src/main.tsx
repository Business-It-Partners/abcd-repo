import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicClient, ClinicError } from "../../../../packages/app-sdk/src/clinicClient";
import type { AppHistory } from "../../../../packages/app-sdk/src/appHistory";
import type { AppSdk } from "../../../../electron/sdk/contracts";
import { ClinicLoadingProvider } from "@/shared/ui/ClinicLoadingOverlay";
import { ClinicPageRefreshProvider } from "@/shared/ui/ClinicPageRefresh";
import { ClinicSnackbarProvider } from "@/shared/ui/ClinicSnackbar";
import { StaffApi } from "@/features/staff/api";
import { StaffDocumentMediaSdk } from "@/features/staff/documentMedia";
import { StaffDirectory } from "@/features/staff/components/StaffDirectory";
import "./shared/clinic.css";
import "./styles.css";

declare global {
  interface Window {
    dentalApp?: AppSdk;
  }
}

const APP_ID = "company.dental.staff.m17";
const MODULES = new Set(["staff"]);
type StaffModuleId = "staff";
type StaffPage =
  | { moduleId: StaffModuleId; screen: "directory" }
  | { moduleId: StaffModuleId; screen: "profile"; staffId: string };

function directoryPage(): StaffPage {
  return { moduleId: "staff", screen: "directory" };
}
type LifecycleState = { dirty: boolean; modal: boolean };

function friendly(cause: unknown) {
  if (cause instanceof ClinicError) return cause.message;
  return cause instanceof Error ? cause.message : "Staff could not be opened.";
}

function App() {
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [api, setApi] = useState<StaffApi | null>(null);
  const [media, setMedia] = useState<StaffDocumentMediaSdk | null>(null);
  const [clinicCapabilities, setClinicCapabilities] = useState<string[]>([]);
  const [mediaCapabilities, setMediaCapabilities] = useState<string[]>([]);
  const [activeModule, setActiveModule] = useState<StaffModuleId>("staff");
  const [page, setPage] = useState<StaffPage | null>(null);
  const [message, setMessage] = useState("Opening Staff…");
  const [lifecycle, setLifecycle] = useState<LifecycleState>({ dirty: false, modal: false });
  const activeModuleRef = useRef<StaffModuleId>("staff");
  const lifecycleRef = useRef(lifecycle);
  const historyRef = useRef<AppHistory<StaffPage> | null>(null);
  const unsubscribeHistoryRef = useRef<(() => void) | null>(null);
  const applyHistoryPage = useCallback((next: StaffPage) => {
    activeModuleRef.current = next.moduleId;
    setActiveModule(next.moduleId);
    setPage(next);
    setMessage("");
  }, []);
  const reportLifecycle = useCallback((next: LifecycleState) => {
    lifecycleRef.current = next;
    setLifecycle(current => current.dirty === next.dirty && current.modal === next.modal ? current : next);
  }, []);
  const openStaff = useCallback((staffId: string) => {
    const history = historyRef.current;
    if (!history) return;
    const current = history.current();
    if (current.moduleId === "staff" && current.screen === "directory") {
      history.push({ moduleId: "staff", screen: "profile", staffId });
    }
  }, []);
  const resetMissingStaff = useCallback(() => {
    const history = historyRef.current;
    const current = history?.current();
    if (history && current?.moduleId === "staff" && current.screen !== "directory") history.replace(directoryPage());
  }, []);
  const onSessionLost = useCallback(() => {
    unsubscribeHistoryRef.current?.();
    unsubscribeHistoryRef.current = null;
    historyRef.current?.dispose();
    historyRef.current = null;
    setClient(null);
    setApi(null);
    setMedia(null);
    setClinicCapabilities([]);
    setMediaCapabilities([]);
    setPage(null);
    setMessage("The clinic session changed. Reopen Staff from Dental OS.");
  }, []);

  useEffect(() => {
    let active = true;
    const bridge = window.dentalApp;
    if (!bridge) {
      setMessage("Open Staff from the Dental OS Store.");
      return;
    }
    const clinicClient = new ClinicClient(bridge, onSessionLost);
    const mediaClient = new StaffDocumentMediaSdk(bridge);
    const unsubscribe = clinicClient.onModuleSelected(({ moduleId }) => {
      if (!MODULES.has(moduleId)) {
        if (active) setMessage("The selected Staff module is unavailable.");
        return;
      }
      if (active) {
        const selected = moduleId as StaffModuleId;
        if (selected !== activeModuleRef.current) {
          lifecycleRef.current = { dirty: false, modal: false };
          setLifecycle(lifecycleRef.current);
          const history = historyRef.current;
          if (history) history.reset(directoryPage());
          else {
            activeModuleRef.current = selected;
            setActiveModule(selected);
          }
        }
        setMessage("");
      }
    });
    void clinicClient.initialize(APP_ID).then(async ({ session }) => {
      const access = session.clinicUser.capabilities;
      if (!access.includes("staff.manage")) {
        throw new ClinicError("FORBIDDEN", "Your clinic role does not have staff.manage access to the Staff app.");
      }
      let grantedMediaCapabilities: string[] = [];
      try {
        grantedMediaCapabilities = await mediaClient.capabilities();
      } catch {
        // Staff directory access does not depend on media grants. The document surface will
        // remain read-only or unavailable until the exact signed operation grant is present.
      }
      if (!active) return;
      setClinicCapabilities(access);
      setMediaCapabilities(grantedMediaCapabilities);
      const appHistory = clinicClient.createHistory<StaffPage>(directoryPage(), () => !lifecycleRef.current.dirty && !lifecycleRef.current.modal);
      historyRef.current = appHistory;
      unsubscribeHistoryRef.current = appHistory.subscribe(applyHistoryPage);
      setClient(clinicClient);
      setApi(new StaffApi(clinicClient));
      setMedia(mediaClient);
      setMessage("");
    }).catch((cause) => {
      if (active) setMessage(friendly(cause));
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeHistoryRef.current?.();
      unsubscribeHistoryRef.current = null;
      historyRef.current?.dispose();
      historyRef.current = null;
      clinicClient.report({ dirty: false, modal: false });
    };
  }, [applyHistoryPage, onSessionLost]);

  useEffect(() => {
    client?.report(lifecycle);
  }, [client, lifecycle]);

  if (!client || !api || !media || message) {
    const opening = message.startsWith("Opening");
    return <main className="clinicApp staffApp staffStatusScreen" role={opening ? "status" : "alert"}>{message}</main>;
  }
  if (activeModule !== "staff") {
    return <main className="clinicApp staffApp staffStatusScreen" role="alert">The selected Staff module is unavailable.</main>;
  }

  return (
    <main className="clinicApp staffApp">
      <ClinicSnackbarProvider>
        <ClinicLoadingProvider>
          <ClinicPageRefreshProvider>
            <StaffDirectory
              api={api}
              client={client}
              clinicCapabilities={clinicCapabilities}
              media={media}
              mediaCapabilities={mediaCapabilities}
              onLifecycle={reportLifecycle}
              selectedStaffId={page?.screen === "profile" ? page.staffId : null}
              onOpenStaff={openStaff}
              onInvalidStaff={resetMissingStaff}
            />
          </ClinicPageRefreshProvider>
        </ClinicLoadingProvider>
      </ClinicSnackbarProvider>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
