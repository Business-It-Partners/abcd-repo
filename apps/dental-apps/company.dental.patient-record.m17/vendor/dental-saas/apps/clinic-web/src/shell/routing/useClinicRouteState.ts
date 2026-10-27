import { useCallback, useState } from "react";
import {
  clinicTabForArea,
  patchClinicRoute,
  routeForTab,
  type ClinicArea,
  type ClinicDetailParam,
  type ClinicRouteParam,
  type ClinicRouteParams,
  type ClinicRouteState,
  type ClinicTab,
} from "./clinicRouteState";

type NavigationMode = "push" | "replace";
type RoutePatch = Partial<Record<ClinicRouteParam, string | null | undefined>>;

export function useClinicRouteState() {
  const [route, setRoute] = useState<ClinicRouteState>(() => routeForTab("patients"));
  const patch = useCallback((changes: RoutePatch, _mode: NavigationMode = "push") => {
    setRoute((current) => patchClinicRoute(current, changes));
  }, []);
  const navigate = useCallback((tab: ClinicTab, params: ClinicRouteParams = {}, _mode: NavigationMode = "push") => {
    setRoute(routeForTab(tab, params));
  }, []);
  const navigateArea = useCallback((area: ClinicArea, mode?: NavigationMode) => navigate(clinicTabForArea(area), {}, mode), [navigate]);
  const openDetail = useCallback((param: ClinicDetailParam, id: string, mode?: NavigationMode) => patch({ [param]: id }, mode), [patch]);
  const closeDetail = useCallback((param: ClinicDetailParam, mode?: NavigationMode) => patch({ [param]: null }, mode), [patch]);
  return { route, patch, navigate, navigateArea, openDetail, closeDetail };
}
