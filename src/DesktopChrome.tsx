import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowRight, BatteryCharging, BatteryMedium, CalendarDays, ChevronLeft, ChevronRight, CloudCheck, LockKeyhole, LogOut, Minus, PackageCheck, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { MAX_BS_YEAR, MIN_BS_YEAR, NEPALI_DAYS } from 'nepali-date-utils';
import { currentNepaliDate, gregorianMonthGrid, nepaliMonthGrid, nepaliMonthName, shiftNepaliMonth, type CalendarMonth } from './calendar';
import type { StoreView } from '../electron/distribution/contracts';
import type { SessionView } from '../electron/identity/contracts';
import { hasAvailableStoreUpdate } from './storeUpdateState';
import type { DevelopmentAppView } from '../electron/developmentApps';
import type { BatteryStatus } from '../electron/host/battery';
import './DesktopChrome.css';

const sajiloDentalMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;

type Props = {
  session?: SessionView;
  sessionControls?: ReactNode;
  roleControls?: ReactNode;
  storeView: StoreView;
  developmentApps?: DevelopmentAppView;
  developmentMessage?: string;
  developmentTargets?: Record<string, RefObject<HTMLButtonElement | null>>;
  storeControlsLocked: boolean;
  statusbarVisible: boolean;
  onOpenApps?: () => void;
  onRequestUpdate(id: string): void;
  onCancelUpdate(): void;
  onRefreshApps(): void;
  onOpenDevelopmentApp?(id: string): void;
  onShowWindows?: () => void;
  onSupport?: () => void;
  onRequestLock?: () => void;
  onRequestSignOut?: () => void;
  onRequestClose(): void;
};

const monthLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
const initialsFor = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => [...part][0]?.toLocaleUpperCase()).join('') || 'D';
const roleLabel = (value: string) => value ? value[0].toLocaleUpperCase() + value.slice(1) : '';
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DesktopChrome({ session, sessionControls, roleControls, storeView, developmentApps, developmentMessage, developmentTargets, storeControlsLocked, statusbarVisible, onOpenApps, onRequestUpdate, onCancelUpdate, onRefreshApps, onOpenDevelopmentApp, onShowWindows, onSupport, onRequestLock, onRequestSignOut, onRequestClose }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [battery, setBattery] = useState<BatteryStatus>();
  const roleMenuRef = useRef<HTMLDetailsElement>(null);
  const [clinicLogo, setClinicLogo] = useState<{ generation: number; dataUrl: string }>();
  const [shownBsMonth, setShownBsMonth] = useState<CalendarMonth>(() => {
    const today = currentNepaliDate(new Date());
    return { year: today.year, month: today.month };
  });
  const [shownGregorianMonth, setShownGregorianMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    type BatteryManagerLike = {
      charging: boolean;
      level: number;
      addEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
      removeEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
    };
    const batteryNavigator = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    let active = true;
    let manager: BatteryManagerLike | undefined;
    const publishBrowserBattery = () => {
      if (!manager) return;
      setBattery({ percentage: Math.round(Math.max(0, Math.min(1, manager.level)) * 100), charging: manager.charging, state: manager.charging ? 'charging' : 'discharging' });
    };
    const onBrowserBatteryChange = () => { if (active) publishBrowserBattery(); };
    const read = async () => {
      let nativeStatus: BatteryStatus | undefined;
      try { nativeStatus = await window.desktop?.battery.view(); } catch {}
      if (!active) return;
      if (nativeStatus) {
        setBattery(nativeStatus);
        return;
      }
      if (!manager && batteryNavigator.getBattery) {
        try {
          manager = await batteryNavigator.getBattery();
          if (!active) return;
          manager.addEventListener('chargingchange', onBrowserBatteryChange);
          manager.addEventListener('levelchange', onBrowserBatteryChange);
        } catch {}
      }
      if (active && manager) publishBrowserBattery();
      else if (active) setBattery(undefined);
    };
    void read();
    const timer = window.setInterval(() => { void read(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      manager?.removeEventListener('chargingchange', onBrowserBatteryChange);
      manager?.removeEventListener('levelchange', onBrowserBatteryChange);
    };
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const menu = roleMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = roleMenuRef.current;
      if (event.key !== 'Escape' || !menu?.open) return;
      menu.open = false;
      menu.querySelector('summary')?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setClinicLogo(undefined);
    if (session?.phase !== 'ready') return () => { active = false; };
    const generation = session.generation;
    void window.desktop?.identity.clinicLogo().then(logo => {
      if (active && logo) setClinicLogo({ generation, dataUrl: logo });
    }).catch(() => {});
    return () => { active = false; };
  }, [session?.generation, session?.phase]);

  const bsCalendar = useMemo(() => nepaliMonthGrid(shownBsMonth), [shownBsMonth]);
  const gregorianCalendar = useMemo(() => gregorianMonthGrid(shownGregorianMonth.getFullYear(), shownGregorianMonth.getMonth() + 1), [shownGregorianMonth]);
  const todayBs = currentNepaliDate(now);
  const today = now.getDate();
  const isCurrentBsMonth = shownBsMonth.year === todayBs.year && shownBsMonth.month === todayBs.month;
  const isCurrentGregorianMonth = shownGregorianMonth.getFullYear() === now.getFullYear() && shownGregorianMonth.getMonth() === now.getMonth();
  const clinicName = session?.clinicLabel || 'Sajilo Dental';
  const clinicLogoUrl = clinicLogo?.generation === session?.generation ? clinicLogo?.dataUrl : undefined;
  const formatDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  const formatTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
  const availableUpdateCount = storeView.apps.filter(hasAvailableStoreUpdate).length;
  const updateApps = storeView.apps.filter(app => !!app.activeVersion && (
    hasAvailableStoreUpdate(app)
    || !!app.pendingVersion
    || !!app.trialVersion
    || storeView.job?.appId === app.id
  ));
  const hasPendingUpdate = updateApps.some(app => !!app.pendingVersion || !!app.trialVersion);
  const canRequestUpdate = !storeControlsLocked && storeView.phase === 'ready' && storeView.canInstall && !storeView.job;
  const widgetMessage = storeView.phase === 'refreshing' && updateApps.length === 0
    ? 'Checking the App Store for updates…'
    : storeView.phase === 'idle'
      ? 'Connecting to the App Store…'
      : storeView.phase === 'unavailable'
        ? storeView.message || 'App Store unavailable. Refresh to try again.'
        : storeView.message
          || (!storeView.canInstall && availableUpdateCount > 0
            ? 'App updates are unavailable for this session.'
            : updateApps.length === 0
              ? 'No app updates available.'
              : storeView.job
                ? 'The active app stays in place while this update is prepared.'
                : hasPendingUpdate
                  ? 'Pending updates apply on a later full app launch.'
                  : 'Select Update to prepare a verified release for the next app launch.');

  return <>
    <header className={`desktop-statusbar ${statusbarVisible ? 'chrome-shown' : 'chrome-hidden'}`} aria-label="Desktop status bar" aria-hidden={!statusbarVisible} inert={!statusbarVisible}>
      <div className="statusbar-brand" aria-label="Sajilo Dental">
        <img src={sajiloDentalMark} alt="" />
        <span className="statusbar-brand-sajilo">Sajilo</span><span className="statusbar-brand-dental">Dental</span>
      </div>
      <nav className="statusbar-menu" aria-label="Desktop menus" onClick={event=>{if(event.target instanceof HTMLElement&&event.target.closest('button'))event.currentTarget.querySelectorAll('details[open]').forEach(menu=>menu.removeAttribute('open'));}}>
        {roleControls ? <details ref={roleMenuRef} className="statusbar-role-menu">
          <summary aria-label="Switch role">Switch role</summary>
          <div className="statusbar-role-panel">
            {roleControls}
            {sessionControls}
          </div>
        </details> : <>
          <button type="button" onClick={onOpenApps} aria-label="Open apps catalog">Apps</button>
          <button type="button" onClick={onShowWindows} aria-label="Show open windows">Windows</button>
          <button type="button" onClick={onSupport} aria-label="Open support diagnostics">Help</button>
          {session?.phase === 'ready' && sessionControls && <details className="statusbar-account-menu">
            <summary aria-label="Account options">Account</summary>
            {sessionControls}
          </details>}
        </>}
      </nav>
      <div className="statusbar-right">
        <span className={`statusbar-network ${online ? 'is-online' : 'is-offline'}`} aria-label={`Network ${online ? 'online' : 'offline'}`} title={online ? 'The system reports a network connection; this does not confirm clinic services are reachable.' : 'The system reports no network connection.'}>
          {online ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          <span>{online ? 'Online' : 'Offline'}</span>
        </span>
        <time className="statusbar-date" dateTime={now.toISOString()}>{formatDate}</time>
        <time className="statusbar-time" dateTime={now.toISOString()}>{formatTime}</time>
        {battery && <span className={`statusbar-battery${battery.charging ? ' is-charging' : ''}${battery.percentage <= 20 && !battery.charging ? ' is-low' : ''}`} role="img" aria-label={`Battery ${battery.percentage}%, ${battery.state === 'full' ? 'fully charged' : battery.state === 'charging' ? 'charging' : battery.state === 'discharging' ? 'on battery' : battery.state === 'not-charging' ? 'not charging' : 'status unavailable'}`} title={`${battery.state === 'full' ? 'Fully charged' : battery.state === 'charging' ? 'Charging' : battery.state === 'discharging' ? 'On battery' : battery.state === 'not-charging' ? 'Not charging' : 'Battery'} · ${battery.percentage}%`}>
          {battery.charging ? <BatteryCharging size={16} aria-hidden="true" /> : <BatteryMedium size={16} aria-hidden="true" />}
          <span>{battery.percentage}%</span>
        </span>}
        <div className="statusbar-window-controls" role="group" aria-label="Sajilo Dental window controls">
          <button type="button" aria-label="Minimize Sajilo Dental" title="Minimize Sajilo Dental" onClick={() => void window.desktop?.control('minimize')}><Minus size={16} strokeWidth={2} aria-hidden="true"/></button>
          <button className="statusbar-window-close" type="button" aria-label="Close Sajilo Dental" title="Close Sajilo Dental" onClick={onRequestClose}><X size={16} strokeWidth={2} aria-hidden="true"/></button>
        </div>
      </div>
    </header>

    {session?.phase === 'ready' && <section className="desktop-widget desktop-clinic-widget" aria-label="Clinic and signed-in user">
      <div className={`clinic-widget-mark${clinicLogoUrl ? ' has-logo' : ''}`} aria-hidden="true">
        {clinicLogoUrl ? <img src={clinicLogoUrl} alt="" onError={() => setClinicLogo(undefined)} /> : initialsFor(clinicName)}
      </div>
      <div className="clinic-widget-copy">
        <strong title={clinicName}>{clinicName}</strong>
        <span>{session.userLabel || 'Signed-in user'}</span>
        {session.role && <small>{roleLabel(session.role)}</small>}
      </div>
      {onRequestLock && <button className="clinic-widget-lock" type="button" aria-label="Lock workspace" title="Lock workspace" onClick={onRequestLock}><LockKeyhole size={15} aria-hidden="true"/></button>}
      {onRequestSignOut && <button className="clinic-widget-signout" type="button" aria-label="Sign out" title="Sign out" onClick={onRequestSignOut}><LogOut size={15} aria-hidden="true"/><span>Sign out</span></button>}
    </section>}

    <section className="desktop-widget-collection" aria-label="Desktop widgets">
      <section className="desktop-widget nepali-calendar-widget" aria-label="Nepali calendar">
        <div className="widget-kicker">NEPALI CALENDAR</div>
        <div className="calendar-widget-heading">
          <span><CalendarDays size={14} aria-hidden="true" />{nepaliMonthName(shownBsMonth.month)} {shownBsMonth.year}</span>
          <div className="calendar-widget-controls">
            <button aria-label="Previous Nepali month" title="Previous Nepali month" disabled={shownBsMonth.year === MIN_BS_YEAR && shownBsMonth.month === 1} onClick={() => setShownBsMonth(month => shiftNepaliMonth(month, -1))}><ChevronLeft size={15}/></button>
            <button aria-label="Next Nepali month" title="Next Nepali month" disabled={shownBsMonth.year === MAX_BS_YEAR && shownBsMonth.month === 12} onClick={() => setShownBsMonth(month => shiftNepaliMonth(month, 1))}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="calendar-widget-grid nepali-calendar-grid" role="grid" aria-label={`${nepaliMonthName(shownBsMonth.month)} ${shownBsMonth.year}`}>
          {NEPALI_DAYS.map((day, index) => <span key={`nepali-weekday-${index}`} role="columnheader" aria-label={day}>{weekdays[index]}</span>)}
          {bsCalendar.days.map((day, index) => <span key={`nepali-day-${index}`} role="gridcell" aria-selected={!!day && isCurrentBsMonth && day === todayBs.day} aria-label={day ? `${day} ${nepaliMonthName(shownBsMonth.month)} ${shownBsMonth.year}` : undefined} className={day && isCurrentBsMonth && day === todayBs.day ? 'is-today' : ''}>{day || ''}</span>)}
        </div>
      </section>

      <section className="desktop-widget time-widget" aria-label="Local time">
        <div className="widget-kicker">LOCAL TIME</div>
        <div className="clock-widget-time" aria-label={`Current time ${formatTime}`}>{formatTime}</div>
        <time className="time-widget-date" dateTime={now.toISOString()}>{formatDate}</time>
      </section>

      <section className="desktop-widget gregorian-calendar-widget" aria-label="English calendar">
        <div className="calendar-widget-heading gregorian-calendar-heading">
          <span><CalendarDays size={14} aria-hidden="true" />{monthLabel(shownGregorianMonth)}</span>
          <div className="calendar-widget-controls">
            <button aria-label="Previous English month" title="Previous English month" onClick={() => setShownGregorianMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15}/></button>
            <button aria-label="Next English month" title="Next English month" onClick={() => setShownGregorianMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="calendar-widget-grid gregorian-calendar-grid" role="grid" aria-label={monthLabel(shownGregorianMonth)}>
          {weekdays.map((day, index) => <span key={`english-weekday-${index}`} role="columnheader" aria-label={new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + index))}>{day}</span>)}
          {gregorianCalendar.days.map((day, index) => <span key={`english-day-${index}`} role="gridcell" aria-selected={!!day && isCurrentGregorianMonth && day === today} aria-label={day ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(shownGregorianMonth.getFullYear(), shownGregorianMonth.getMonth(), day)) : undefined} className={day && isCurrentGregorianMonth && day === today ? 'is-today' : ''}>{day || ''}</span>)}
        </div>
      </section>

      <section className="desktop-widget app-updates-widget" aria-label="App updates">
        <div className="updates-widget-heading">
          <div className="updates-widget-title">Available app updates</div>
          <span className="updates-widget-tools">
            <span className="updates-count">{availableUpdateCount} available</span>
            <button className="updates-refresh-button" type="button" aria-label="Check for app updates" title="Check for app updates" disabled={storeControlsLocked || storeView.phase === 'refreshing' || !!storeView.job} onClick={onRefreshApps}><RefreshCw size={13} aria-hidden="true"/></button>
          </span>
        </div>
        {updateApps.length > 0 ? <div className="updates-list" aria-label="Installed app updates">
          {updateApps.map(app => {
            const job = storeView.job?.appId === app.id ? storeView.job : null;
            const targetVersion = app.pendingVersion || app.trialVersion || app.version;
            const percent = job && job.total > 0 ? Math.min(100, Math.floor(job.received / job.total * 100)) : 0;
            const phase = job?.phase === 'downloading' ? 'Downloading'
              : job?.phase === 'verifying' ? 'Verifying'
                : job?.phase === 'installing' ? 'Preparing'
                  : job ? 'Checking permission' : '';
            const state = job ? `${phase} · ${percent}%`
              : app.trialVersion ? `Starting update · ${app.trialVersion}`
                : app.pendingVersion ? app.pendingReady ? `Ready · applies next launch` : `Staged · checking readiness`
                  : `Update available · ${app.version}`;
            return <div className="update-app-row" key={app.id}>
              <span className="update-app-icon" aria-hidden="true"><PackageCheck size={16} strokeWidth={1.8} /></span>
              <div className="update-app-copy">
                <strong title={app.title}>{app.title}</strong>
                <small><span>{app.activeVersion}</span><ArrowRight size={11} aria-hidden="true"/><span>{targetVersion}</span><span className="update-app-state">· {state}</span></small>
                {job && <progress className="update-app-progress" aria-label={`${app.title} update progress`} max={Math.max(1, job.total)} value={job.received}/>}
              </div>
              {job
                ? <button className="update-app-button update-app-cancel" type="button" aria-label={`Cancel update for ${app.title}`} disabled={storeControlsLocked} onClick={onCancelUpdate}>Cancel</button>
                : app.pendingVersion || app.trialVersion
                  ? <span className="update-app-staged" role="status">{app.pendingReady ? 'Ready' : app.trialVersion ? 'Starting' : 'Staged'}</span>
                  : <button className="update-app-button" type="button" aria-label={`Update ${app.title}`} disabled={!canRequestUpdate || !app.available} onClick={() => onRequestUpdate(app.id)}>Update</button>}
            </div>;
          })}
        </div> : <div className="updates-empty" role={storeView.phase === 'unavailable' ? 'alert' : 'status'}>
          {storeView.phase === 'ready' && availableUpdateCount === 0
            ? <><span className="updates-empty-icon" aria-hidden="true"><CloudCheck size={19} strokeWidth={1.8}/></span><span>No app updates available</span></>
            : widgetMessage}
        </div>}
      </section>

    </section>

    {developmentApps?.enabled && <section className="desktop-widget development-apps-widget" aria-label="Development app collection">
        <div className="development-widget-heading">
          <div>
            <div className="widget-kicker">DEVELOPMENT APPS</div>
            <span className="development-widget-subtitle">Open the latest local build</span>
          </div>
        </div>
        <div className="development-app-grid" aria-label="First-party development apps">
          {developmentApps.apps.map(app => <button ref={developmentTargets?.[app.id]} className="development-app-tile" key={app.id} type="button" disabled={!onOpenDevelopmentApp || storeControlsLocked} onClick={() => onOpenDevelopmentApp?.(app.id)} aria-label={`Open ${app.title} development app`}>
            <span className="development-app-thumbnail"><img src={app.thumbnail} alt="" draggable="false"/></span>
            <span className="development-app-name">{app.title}</span>
          </button>)}
        </div>
        {developmentMessage && <div className="development-widget-message" role="status">{developmentMessage}</div>}
    </section>
  }
  </>;
}
