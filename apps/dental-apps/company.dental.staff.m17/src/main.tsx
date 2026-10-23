import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicClient, ClinicError } from "../../../../packages/app-sdk/src/clinicClient";
import { ClinicLoadingProvider } from "@/shared/ui/ClinicLoadingOverlay";
import { ClinicPageRefreshProvider } from "@/shared/ui/ClinicPageRefresh";
import { ClinicSnackbarProvider } from "@/shared/ui/ClinicSnackbar";
import { StaffApi } from "@/features/staff/api";
import { StaffDocumentMediaSdk } from "@/features/staff/documentMedia";
import { StaffDirectory } from "@/features/staff/components/StaffDirectory";
import "./shared/clinic.css";
import "./styles.css";

const APP_ID = "company.dental.staff.m17";
const MODULES = new Set(["staff"]);
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
  const [activeModule, setActiveModule] = useState("staff");
  const [message, setMessage] = useState("Opening Staff…");
  const [lifecycle, setLifecycle] = useState<LifecycleState>({ dirty: false, modal: false });
  const onSessionLost = useCallback(() => {
    setClient(null);
    setApi(null);
    setMedia(null);
    setClinicCapabilities([]);
    setMediaCapabilities([]);
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
        setActiveModule(moduleId);
        setMessage("");
        setLifecycle({ dirty: false, modal: false });
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
      clinicClient.report({ dirty: false, modal: false });
    };
  }, [onSessionLost]);

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
              onLifecycle={setLifecycle}
            />
          </ClinicPageRefreshProvider>
        </ClinicLoadingProvider>
      </ClinicSnackbarProvider>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
