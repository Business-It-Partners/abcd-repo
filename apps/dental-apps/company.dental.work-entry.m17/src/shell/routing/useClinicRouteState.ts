import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clinicTabForArea,
  parseClinicRoute,
  patchClinicRoute,
  routeForTab,
  serializeClinicRoute,
  type ClinicArea,
  type ClinicDetailParam,
  type ClinicRouteParam,
  type ClinicRouteParams,
  type ClinicRouteState,
  type ClinicTab,
} from '@/shell/routing/clinicRouteState';

type NavigationMode = 'push' | 'replace';
type RoutePatch = Partial<Record<ClinicRouteParam, string | null | undefined>>;

function href(route: ClinicRouteState) {
  return `${window.location.pathname}?${serializeClinicRoute(route).toString()}`;
}

/** App-local route state; it owns no cross-app navigation or business data. */
export function useClinicRouteState() {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const route = useMemo(() => {
    const params = new URLSearchParams(search);
    if (!params.has('tab')) params.set('tab', 'work-entry');
    return parseClinicRoute(params);
  }, [search]);

  const commit = useCallback((next: ClinicRouteState, mode: NavigationMode) => {
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', href(next));
    setSearch(window.location.search);
  }, []);
  const navigate = useCallback((tab: ClinicTab, params?: ClinicRouteParams, mode: NavigationMode = 'push') => {
    commit(routeForTab(tab, params), mode);
  }, [commit]);
  const navigateArea = useCallback((area: ClinicArea, mode: NavigationMode = 'push') => navigate(clinicTabForArea(area), {}, mode), [navigate]);
  const patch = useCallback((changes: RoutePatch, mode: NavigationMode = 'replace') => commit(patchClinicRoute(route, changes), mode), [commit, route]);
  const openDetail = useCallback((param: ClinicDetailParam, id: string, mode: NavigationMode = 'push') => patch({ [param]: id }, mode), [patch]);
  const closeDetail = useCallback((param: ClinicDetailParam, mode: NavigationMode = 'push') => patch({ [param]: null }, mode), [patch]);
  return { route, navigate, navigateArea, patch, openDetail, closeDetail };
}
