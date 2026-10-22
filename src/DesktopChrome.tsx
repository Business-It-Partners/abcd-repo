import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building2, CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Wifi, WifiOff } from 'lucide-react';
import { MAX_BS_YEAR, MIN_BS_YEAR, NEPALI_DAYS } from 'nepali-date-utils';
import { currentNepaliDate, gregorianMonthGrid, nepaliMonthGrid, nepaliMonthName, shiftNepaliMonth, type CalendarMonth } from './calendar';
import type { SessionView } from '../electron/identity/contracts';
import './DesktopChrome.css';

type Props = {
  activeApp?: string;
  session?: SessionView;
  sessionControls?: ReactNode;
  statusbarVisible: boolean;
  onOpenApps?: () => void;
  onShowWindows?: () => void;
  onSupport?: () => void;
};

const monthLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
const initialsFor = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => [...part][0]?.toLocaleUpperCase()).join('') || 'D';
const roleLabel = (value: string) => value ? value[0].toLocaleUpperCase() + value.slice(1) : '';
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DesktopChrome({ activeApp, session, sessionControls, statusbarVisible, onOpenApps, onShowWindows, onSupport }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
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

  const bsCalendar = useMemo(() => nepaliMonthGrid(shownBsMonth), [shownBsMonth]);
  const gregorianCalendar = useMemo(() => gregorianMonthGrid(shownGregorianMonth.getFullYear(), shownGregorianMonth.getMonth() + 1), [shownGregorianMonth]);
  const todayBs = currentNepaliDate(now);
  const today = now.getDate();
  const isCurrentBsMonth = shownBsMonth.year === todayBs.year && shownBsMonth.month === todayBs.month;
  const isCurrentGregorianMonth = shownGregorianMonth.getFullYear() === now.getFullYear() && shownGregorianMonth.getMonth() === now.getMonth();
  const clinicName = session?.clinicLabel || 'Sajilo Dental';
  const formatDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  const formatTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);

  return <>
    <header className={`desktop-statusbar ${statusbarVisible ? 'chrome-shown' : 'chrome-hidden'}`} aria-label="Desktop status bar" aria-hidden={!statusbarVisible} inert={!statusbarVisible}>
      <div className="statusbar-active" aria-live="polite">
        <Building2 size={15} aria-hidden="true" />
        <span>{activeApp || 'Sajilo Dental'}</span>
      </div>
      <nav className="statusbar-menu" aria-label="Desktop menus">
        <button type="button" onClick={onOpenApps} aria-label="Open apps catalog">Apps</button>
        <button type="button" onClick={onShowWindows} aria-label="Show open windows">Windows</button>
        <button type="button" onClick={onSupport} aria-label="Open support diagnostics">Help</button>
      </nav>
      <div className="statusbar-right">
        <span className={`statusbar-network ${online ? 'is-online' : 'is-offline'}`} aria-label={`Network ${online ? 'online' : 'offline'}`} title={online ? 'The system reports a network connection; this does not confirm clinic services are reachable.' : 'The system reports no network connection.'}>
          {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
          <span>{online ? 'Online' : 'Offline'}</span>
        </span>
        <time className="statusbar-date" dateTime={now.toISOString()}>{formatDate}</time>
        <time className="statusbar-time" dateTime={now.toISOString()}>{formatTime}</time>
        {session?.phase === 'ready' && sessionControls && <details className="clinic-widget-menu">
          <summary aria-label="Session options" title="Session options"><MoreHorizontal size={18} aria-hidden="true"/></summary>
          {sessionControls}
        </details>}
      </div>
    </header>

    {session?.phase === 'ready' && <section className="desktop-widget desktop-clinic-widget" aria-label="Clinic and signed-in user">
      <div className="clinic-widget-mark" aria-hidden="true">{initialsFor(clinicName)}</div>
      <div className="clinic-widget-copy">
        <strong title={clinicName}>{clinicName}</strong>
        <span>{session.userLabel || 'Signed-in user'}</span>
        {session.role && <small>{roleLabel(session.role)}</small>}
      </div>
    </section>}

    <section className="desktop-widget-collection" aria-label="Calendar and time widgets">
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
    </section>
  </>;
}
