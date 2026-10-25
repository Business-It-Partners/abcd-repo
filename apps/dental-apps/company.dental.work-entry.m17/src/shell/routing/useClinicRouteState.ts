import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppHistory } from '../../../../../../packages/app-sdk/src/appHistory';
import { clinicClient } from '@/sdk/client';
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

function routeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('tab')) params.set('tab', 'work-entry');
  return parseClinicRoute(params);
}

/** App routes stay private while opaque page IDs connect them to the OS Back button. */
export function useClinicRouteState() {
  const [initialRoute] = useState(routeFromLocation);
  const [route, setRoute] = useState(initialRoute);
  const history = useRef<AppHistory<ClinicRouteState> | null>(null);

  useEffect(() => {
    const pages = clinicClient().createHistory(
      initialRoute,
      undefined,
      (current, previous) => Boolean(current.params.caseId && current.params.caseId === previous?.params.caseId),
    );
    history.current = pages;
    const unsubscribe = pages.subscribe(next => {
      const nextUrl = href(next);
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState({}, '', nextUrl);
      setRoute(next);
    });
    return () => {
      unsubscribe();
      pages.dispose();
      if (history.current === pages) history.current = null;
    };
  }, [initialRoute]);

  const commit = useCallback((next: ClinicRouteState, mode: NavigationMode) => {
    const pages = history.current;
    if (!pages) return;
    if (mode === 'push') pages.push(next);
    else pages.replace(next);
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
