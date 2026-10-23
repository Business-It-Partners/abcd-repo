import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Search } from 'lucide-react';
import { ManagedWindowFrame, type WindowController } from './ManagedWindow';
import './StandardWindow1.css';

type CaseStatus = 'Open' | 'In progress' | 'Completed' | 'Closed';
type DemoCase = {
  caseKey: string;
  id: string;
  patient: string;
  phone: string;
  complaint: string;
  opened: string;
  protocols: number;
  status: CaseStatus;
};
type StatusFilter = 'All' | 'Active' | 'Completed' | 'Closed';
type SortKey = 'patient' | 'complaint';
type HistoryPage = { key: number; kind: 'table' } | { key: number; kind: 'case'; caseId: string };
type ScrollbarMetrics = { visible: boolean; top: number; height: number; value: number };

const INITIAL_CASES: DemoCase[] = [
  { caseKey: 'case-1', id: 'PT-0001', patient: 'Abishek Tiwari', phone: '9999999999', complaint: 'Pain in lower motor', opened: '2026-10-05', protocols: 2, status: 'In progress' },
  { caseKey: 'case-2', id: 'PT-0019', patient: 'Nirmala Adhikari', phone: '9800001119', complaint: 'Lower-left molar sensitivity — staging workflow test', opened: '2026-10-04', protocols: 0, status: 'Open' },
  { caseKey: 'case-3', id: 'PT-0002', patient: 'Sangam Kandel', phone: '9999999999', complaint: 'Pain in the upper end', opened: '2026-10-04', protocols: 0, status: 'Open' },
  { caseKey: 'case-4', id: 'PT-0002', patient: 'Sangam Kandel', phone: '9999999999', complaint: 'Pain in the front teeth', opened: '2026-10-04', protocols: 2, status: 'In progress' },
  { caseKey: 'case-5', id: 'PT-0001', patient: 'Abishek Tiwari', phone: '9999999999', complaint: 'Pain in the upper motor', opened: '2026-10-04', protocols: 0, status: 'Open' },
  { caseKey: 'case-6', id: 'PT-0002', patient: 'Sangam Kandel', phone: '9999999999', complaint: 'Pain in upper motor', opened: '2026-10-04', protocols: 0, status: 'Open' },
  { caseKey: 'case-7', id: 'PT-0024', patient: 'Roshani Gurung', phone: '9801234567', complaint: 'Sensitivity in upper premolar', opened: '2026-10-03', protocols: 1, status: 'Open' },
  { caseKey: 'case-8', id: 'PT-0028', patient: 'Prakash Rana', phone: '9812345678', complaint: 'Broken filling on lower-right molar', opened: '2026-10-02', protocols: 2, status: 'In progress' },
  { caseKey: 'case-9', id: 'PT-0034', patient: 'Mina Shrestha', phone: '9841234567', complaint: 'Gum discomfort near front teeth', opened: '2026-10-01', protocols: 0, status: 'Open' },
  { caseKey: 'case-10', id: 'PT-0041', patient: 'Ayusha Koirala', phone: '9807654321', complaint: 'Pain in upper canine', opened: '2026-09-30', protocols: 1, status: 'Open' },
  { caseKey: 'case-11', id: 'PT-0048', patient: 'Suman KC', phone: '9861234567', complaint: 'Routine crown review', opened: '2026-09-28', protocols: 3, status: 'Completed' },
  { caseKey: 'case-12', id: 'PT-0052', patient: 'Sabina Thapa', phone: '9847654321', complaint: 'Extraction follow-up', opened: '2026-09-27', protocols: 1, status: 'Closed' },
];
const FIRST_PAGE: HistoryPage = { key: 0, kind: 'table' };
const PAGE_SIZE = 10;
const STATUS_FILTERS: StatusFilter[] = ['All', 'Active', 'Completed', 'Closed'];

/** First-party sample app for the shared Dental OS table and window patterns. */
export function StandardWindow1({ controller }: { controller: WindowController }) {
  const nextKey = useRef(1);
  const nextCaseNumber = useRef(53);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarDrag = useRef<{ pointerId: number; startY: number; startTop: number } | null>(null);
  const [cases, setCases] = useState(INITIAL_CASES);
  const [history, setHistory] = useState<HistoryPage[]>([FIRST_PAGE]);
  const [position, setPosition] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('Active');
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [scrollbar, setScrollbar] = useState<ScrollbarMetrics>({ visible: false, top: 0, height: 0, value: 0 });
  const page = history[position] ?? FIRST_PAGE;

  const updateScrollbar = useCallback(() => {
    const scroller = pageScrollRef.current;
    if (!scroller) return;

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const trackHeight = Math.max(0, scroller.clientHeight - 16);
    if (!maxScroll || !trackHeight) {
      setScrollbar(current => current.visible ? { visible: false, top: 0, height: 0, value: 0 } : current);
      return;
    }

    const nativeThumbHeight = scroller.clientHeight * scroller.clientHeight / scroller.scrollHeight;
    const thumbHeight = Math.min(trackHeight, Math.max(14, nativeThumbHeight * 0.3));
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const value = scroller.scrollTop / maxScroll;
    const next = { visible: true, top: value * thumbTravel, height: thumbHeight, value: value * 100 };
    setScrollbar(current => current.visible === next.visible && current.top === next.top && current.height === next.height && current.value === next.value ? current : next);
  }, []);

  const handleScrollbarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = pageScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!scroller || !track || !scrollbar.visible) return;

    event.preventDefault();
    const clickedThumb = (event.target as HTMLElement).closest('.standard-window-scrollbar-thumb') !== null;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const maxThumbTop = Math.max(0, track.clientHeight - scrollbar.height);
    const targetTop = clickedThumb
      ? scrollbar.top
      : Math.max(0, Math.min(maxThumbTop, event.clientY - track.getBoundingClientRect().top - scrollbar.height / 2));
    if (!clickedThumb && maxThumbTop) scroller.scrollTop = targetTop / maxThumbTop * maxScroll;

    event.currentTarget.setPointerCapture(event.pointerId);
    scrollbarDrag.current = { pointerId: event.pointerId, startY: event.clientY, startTop: targetTop };
  };

  const handleScrollbarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = scrollbarDrag.current;
    const scroller = pageScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !scroller || !track) return;

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const maxThumbTop = Math.max(0, track.clientHeight - scrollbar.height);
    if (!maxScroll || !maxThumbTop) return;
    const top = Math.max(0, Math.min(maxThumbTop, drag.startTop + event.clientY - drag.startY));
    scroller.scrollTop = top / maxThumbTop * maxScroll;
  };

  const handleScrollbarPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrollbarDrag.current?.pointerId !== event.pointerId) return;
    scrollbarDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleScrollbarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const scroller = pageScrollRef.current;
    if (!scroller) return;
    const pageStep = Math.max(50, scroller.clientHeight * 0.8);
    const offsets: Record<string, number> = { ArrowDown: 50, ArrowUp: -50, PageDown: pageStep, PageUp: -pageStep };
    if (event.key in offsets) {
      event.preventDefault();
      scroller.scrollBy({ top: offsets[event.key] });
    } else if (event.key === 'Home') {
      event.preventDefault();
      scroller.scrollTop = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      scroller.scrollTop = scroller.scrollHeight;
    }
  };

  useEffect(() => {
    if (controller.win.phase !== 'closed') return;
    setHistory([FIRST_PAGE]);
    setPosition(0);
  }, [controller.win.phase]);

  const selectedCase = page.kind === 'case' ? cases.find(item => item.caseKey === page.caseId) : undefined;
  const canGoBack = position > 0;
  const canGoForward = position < history.length - 1;

  const navigateToCase = (caseId: string) => {
    const next: HistoryPage = { key: nextKey.current++, kind: 'case', caseId };
    setHistory(previous => [...previous.slice(0, position + 1), next]);
    setPosition(position + 1);
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCases = cases.filter(item => {
    const matchesFilter = filter === 'All'
      || filter === 'Active' && (item.status === 'Open' || item.status === 'In progress')
      || filter === 'Completed' && item.status === 'Completed'
      || filter === 'Closed' && item.status === 'Closed';
    const searchable = `${item.patient} ${item.id} ${item.phone} ${item.complaint}`.toLocaleLowerCase();
    return matchesFilter && (!normalizedSearch || searchable.includes(normalizedSearch));
  });
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  const sortedCases = [...filteredCases].sort((left, right) => {
    if (!sort.key) return 0;
    const comparison = collator.compare(left[sort.key], right[sort.key]);
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(sortedCases.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, pageCount - 1);
  const visibleCases = sortedCases.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const firstVisible = sortedCases.length ? currentPage * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min((currentPage + 1) * PAGE_SIZE, sortedCases.length);

  useEffect(() => {
    if (page.kind !== 'table') return;
    const scroller = pageScrollRef.current;
    const content = scroller?.querySelector<HTMLElement>('.standard-window-scroll-content');
    if (!scroller || !content) return;

    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScrollbar);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(scroller);
    resizeObserver.observe(content);
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      scroller.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [page.kind, updateScrollbar]);

  const toggleSort = (key: SortKey) => {
    setSort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const refresh = () => {
    setCases(INITIAL_CASES);
    setHistory([FIRST_PAGE]);
    setPosition(0);
    setFilter('Active');
    setSearch('');
    setPageNumber(0);
    setSort({ key: null, direction: 'asc' });
    nextCaseNumber.current = 53;
  };

  const addCase = () => {
    const number = nextCaseNumber.current++;
    const created: DemoCase = {
      caseKey: `case-${number}`,
      id: `PT-${String(number).padStart(4, '0')}`,
      patient: 'New patient',
      phone: '—',
      complaint: 'New case',
      opened: '2026-10-23',
      protocols: 0,
      status: 'Open',
    };
    setCases(previous => [created, ...previous]);
    setFilter('Active');
    setSearch('');
    setSort({ key: null, direction: 'asc' });
    setPageNumber(0);
    setHistory([FIRST_PAGE]);
    setPosition(0);
  };

  const startWork = (caseId: string) => {
    setCases(previous => previous.map(item => item.caseKey === caseId && item.status === 'Open' ? { ...item, status: 'In progress' } : item));
  };

  const titleBarNavigation = <div className="standard-window-history" role="group" aria-label="Page history">
    <button type="button" aria-label="Back" title="Back" disabled={!canGoBack} onClick={() => setPosition(value => Math.max(0, value - 1))}><ArrowLeft size={24}/></button>
    <button type="button" aria-label="Forward" title="Forward" disabled={!canGoForward} onClick={() => setPosition(value => Math.min(history.length - 1, value + 1))}><ArrowRight size={24}/></button>
  </div>;

  const statusClass = (status: CaseStatus) => status.toLocaleLowerCase().replace(' ', '-');
  return <ManagedWindowFrame controller={controller} titleBarLeading={titleBarNavigation}>
    <div className="standard-window-body" data-testid="standard-window-1-app">
      {page.kind === 'table' ? <>
        <div className="standard-window-scroll-shell">
          <div id="standard-window-page-scroll" ref={pageScrollRef} className="standard-window-page-scroll" onScroll={updateScrollbar}>
            <div className="standard-window-scroll-content">
              <header className="standard-window-page-header">
                <h1>Standard Window 1</h1>
                <div className="standard-window-page-actions" role="group" aria-label="Page actions">
                  <button className="standard-window-refresh" type="button" onClick={refresh}><RefreshCw size={15}/>Refresh</button>
                  <button className="standard-window-new" type="button" onClick={addCase}><Plus size={16}/>New</button>
                </div>
              </header>
              <main className="standard-window-content" aria-label="Standard Window 1 content">
                <section className="standard-window-table-panel" aria-label="Cases table">
              <div className="standard-window-table-toolbar">
                <div className="standard-window-filter-tabs" role="tablist" aria-label="Filter cases by status">
                  {STATUS_FILTERS.map(status => <button key={status} type="button" role="tab" aria-selected={filter === status} className={filter === status ? 'is-selected' : ''} onClick={() => { setFilter(status); setPageNumber(0); }}>{status}</button>)}
                </div>
                <label className="standard-window-search">
                  <Search size={16} aria-hidden="true"/>
                  <input aria-label="Search patient, record ID, phone or complaint" placeholder="Search patient, record ID, phone or complaint..." value={search} onChange={event => { setSearch(event.target.value); setPageNumber(0); }}/>
                </label>
                <span className="standard-window-case-count">{filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}</span>
              </div>
              <div className="standard-window-table-scroll">
                <table className="standard-window-table">
                  <colgroup><col className="case-index-col"/><col className="case-patient-col"/><col className="case-complaint-col"/><col className="case-protocol-col"/><col className="case-status-col"/><col className="case-actions-col"/></colgroup>
                  <thead>
                    <tr>
                      <th aria-label="Row number"/>
                      <th aria-sort={sort.key === 'patient' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="standard-window-sort" onClick={() => toggleSort('patient')}>Patient</button></th>
                      <th aria-sort={sort.key === 'complaint' ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="standard-window-sort" onClick={() => toggleSort('complaint')}>Chief complaint / case</button></th>
                      <th>Treatment protocols</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCases.map((item, index) => <tr key={item.caseKey}>
                      <td><span className="standard-window-row-number">{currentPage * PAGE_SIZE + index + 1}</span></td>
                      <td><div className="standard-window-primary-cell"><strong>{item.patient}</strong><span>{item.id} · {item.phone}</span></div></td>
                      <td><div className="standard-window-primary-cell"><strong>{item.complaint}</strong><span>Opened {item.opened}</span></div></td>
                      <td className="standard-window-centered-cell">{item.protocols}</td>
                      <td><span className={`standard-window-status status-${statusClass(item.status)}`}>{item.status}</span></td>
                      <td><div className="standard-window-row-actions"><button className="standard-window-start" type="button" onClick={() => startWork(item.caseKey)}>Start work</button><button className="standard-window-update" type="button" onClick={() => navigateToCase(item.caseKey)}>Update</button></div></td>
                    </tr>)}
                    {!visibleCases.length && <tr><td colSpan={6} className="standard-window-empty">No cases found</td></tr>}
                  </tbody>
                </table>
              </div>
                </section>
              </main>
            </div>
          </div>
          {scrollbar.visible && <div
            ref={scrollbarTrackRef}
            className="standard-window-scrollbar-track"
            role="scrollbar"
            aria-label="Page scroll position"
            aria-controls="standard-window-page-scroll"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollbar.value)}
            aria-valuetext={`${Math.round(scrollbar.value)}% scrolled`}
            tabIndex={0}
            onKeyDown={handleScrollbarKeyDown}
            onPointerDown={handleScrollbarPointerDown}
            onPointerMove={handleScrollbarPointerMove}
            onPointerUp={handleScrollbarPointerEnd}
            onPointerCancel={handleScrollbarPointerEnd}
          >
            <span className="standard-window-scrollbar-thumb" style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }}/>
          </div>}
        </div>
        <footer className="standard-window-table-footer">
          <span>Showing {firstVisible} to {lastVisible} of {sortedCases.length} {sortedCases.length === 1 ? 'case' : 'cases'}</span>
          <nav className="standard-window-pagination" aria-label="Table pagination">
            <button type="button" disabled={currentPage === 0} onClick={() => setPageNumber(value => Math.max(0, value - 1))}><span aria-hidden="true">‹</span> Previous</button>
            <button type="button" className="current-page" aria-current="page">{currentPage + 1}</button>
            <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPageNumber(value => Math.min(pageCount - 1, value + 1))}>Next <span aria-hidden="true">›</span></button>
          </nav>
        </footer>
      </> : <main className="standard-window-content is-detail-page" aria-label={selectedCase ? `${selectedCase.patient} case details` : 'Standard Window 1 content'}>
        {selectedCase ? <section className="standard-window-case-detail" aria-label="Case details">
          <h2>{selectedCase.patient}</h2>
          <p>{selectedCase.id} · {selectedCase.phone}</p>
          <dl>
            <div><dt>Chief complaint / case</dt><dd>{selectedCase.complaint}</dd></div>
            <div><dt>Opened</dt><dd>{selectedCase.opened}</dd></div>
            <div><dt>Treatment protocols</dt><dd>{selectedCase.protocols}</dd></div>
            <div><dt>Status</dt><dd><span className={`standard-window-status status-${statusClass(selectedCase.status)}`}>{selectedCase.status}</span></dd></div>
          </dl>
        </section> : null}
      </main>}
    </div>
  </ManagedWindowFrame>;
}
