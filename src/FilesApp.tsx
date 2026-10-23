import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Folder, Grid2X2, HardDrive, Home, List, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
import { useSessionGeneration } from './SessionBoundary';
import type { FileEntry, FileRoot, FileFilter } from '../electron/host/localFiles';
import { createLocalThumbnail } from './filesPreview';

type Crumb = { id: string; name: string };
type DisplaySort = 'name' | 'kind' | 'date' | 'size';
type DisplayMode = 'grid' | 'list';
const PAGE_LIMIT = 100;
const THUMBNAIL_TYPES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const VIEWABLE_TYPES = THUMBNAIL_TYPES;
const IMAGE_FILE_TYPES = new Set([...THUMBNAIL_TYPES, '.tif', '.tiff', '.dcm', '.dicom']);
const DOCUMENT_FILE_TYPES = new Set(['.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.rtf', '.odt']);
let activeThumbnailReads = 0;
const thumbnailWaiters: Array<() => void> = [];
async function withThumbnailSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeThumbnailReads >= 2) await new Promise<void>(resolve => thumbnailWaiters.push(resolve));
  activeThumbnailReads++;
  try { return await work(); }
  finally { activeThumbnailReads--; thumbnailWaiters.shift()?.(); }
}

function FileTypeIcon({ item, size }: { item: FileEntry; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 48 48', className: 'files-type-icon', 'aria-hidden': true as const };
  if (item.kind === 'directory') return <svg {...common} data-file-icon="folder">
    <path d="M5.5 13.8c0-2 1.6-3.6 3.6-3.6h10.2l4.1 4.1h15.3c2.5 0 4.4 2.2 4 4.7l-2.8 17.5a4 4 0 0 1-4 3.4H9.1a4 4 0 0 1-4-4.6l2.4-18.1c.2-1.5 1.4-2.8 2.9-3.1Z" fill="#713448"/>
    <path d="M7.6 19.2c.2-1.6 1.5-2.8 3.1-2.8h27.1c1.9 0 3.4 1.7 3.1 3.6l-2.2 15.2a3.5 3.5 0 0 1-3.5 3H9.3a3.5 3.5 0 0 1-3.5-4l1.8-15Z" fill="#85888b" stroke="#66696c" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M9.5 20.4h28.1" fill="none" stroke="#b5b7b9" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
  if (IMAGE_FILE_TYPES.has(item.typeHint)) return <svg {...common} data-file-icon="image">
    <path d="M13 6.5h17l7 7V39a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3Z" fill="#fafafa" stroke="#c7c7c7" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M30 7v7h7" fill="#ededed" stroke="#c7c7c7" strokeWidth="1.5" strokeLinejoin="round"/>
    <rect x="14" y="19" width="17" height="13" rx="2" fill="#ededed"/>
    <circle cx="26.2" cy="23" r="1.7" fill="#a5a5a5"/>
    <path d="m15.5 30 5.3-5 4.1 3.6 2.5-2 4.1 4.3v1.1h-16Z" fill="#8b8b8b"/>
  </svg>;
  const isPdf = item.typeHint === '.pdf';
  const isDocument = DOCUMENT_FILE_TYPES.has(item.typeHint);
  return <svg {...common} data-file-icon={isDocument ? 'document' : 'file'} data-file-type={isPdf ? 'pdf' : undefined}>
    <path d="M13.5 5.5h14l8 8V39a3.5 3.5 0 0 1-3.5 3.5H13.5A3.5 3.5 0 0 1 10 39V9a3.5 3.5 0 0 1 3.5-3.5Z" fill={isPdf ? '#e31b36' : '#fff'} stroke={isPdf ? '#c9152d' : '#c8c8c8'} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M27.5 6v7.5H35" fill={isPdf ? '#f58a98' : '#ededed'} stroke={isPdf ? '#c9152d' : '#c8c8c8'} strokeWidth="1.5" strokeLinejoin="round"/>
    {isPdf ? <>
      <path d="M23.9 18.5c1.7 2.6 3.1 6.2 3.6 8.4m-3.6-8.4c-.4 3.5-2.6 8.6-5 11.4m5-11.4c1.4 2.6 3.8 5.5 6.7 7.6m-11.7 3.8c3.1-1.8 8.5-2.1 12.6-.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="24" y="37.2" fill="#fff" fontSize="5.5" fontWeight="700" textAnchor="middle" letterSpacing=".45">PDF</text>
    </> : <>
      <path d="M15 21h16M15 26h16M15 31h11M15 36h13" stroke="#a4a4a4" strokeWidth="1.7" strokeLinecap="round"/>
    </>}
  </svg>;
}

function FileThumbnail({ item, generation, scrollRoot }: { item: FileEntry; generation: number; scrollRoot: HTMLDivElement | null }) {
  const frame = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node || item.kind !== 'file' || !THUMBNAIL_TYPES.has(item.typeHint)) return;
    let disposed = false, requested = false;
    const load = () => {
      if (requested) return;
      requested = true;
      void withThumbnailSlot(async () => {
        if (disposed || !window.desktop?.files) return;
        const preview = await window.desktop.files.thumbnail(item.id, generation);
        if (!preview) return;
        if (disposed) { preview.bytes.fill(0); return; }
        const blob = await createLocalThumbnail({ bytes: preview.bytes, typeHint: preview.typeHint });
        preview.bytes.fill(0);
        if (!blob || disposed) return;
        const dataUrl = await new Promise<string | null>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (!dataUrl || disposed) return;
        setSource(dataUrl);
      }).catch(() => {});
    };
    if (typeof IntersectionObserver === 'undefined') load();
    else {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { root: scrollRoot, rootMargin: '72px' });
      observer.observe(node);
      return () => { disposed = true; observer.disconnect(); };
    }
    return () => { disposed = true; };
  }, [item.id, item.kind, item.typeHint, generation, scrollRoot]);

  return <div className="files-card-preview" ref={frame} aria-hidden="true">
    {source ? <img src={source} alt="" draggable={false}/> : <FileTypeIcon item={item} size={30}/>}
  </div>;
}

const statusText = (reason: unknown): string => {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (message.includes('RESOURCE_LIMIT')) return 'This folder contains too many items for safe browsing. Choose a smaller folder.';
  if (message.includes('STALE_SELECTION')) return 'This folder changed while browsing. Refresh to see the latest files.';
  if (message.includes('FORBIDDEN')) return 'Dental OS cannot access this location. Check its permissions.';
  if (message.includes('NOT_FOUND')) return 'This folder is no longer available. Choose another location.';
  if (message.includes('Workspace')) return 'Your session changed. Reopen Files after signing in.';
  return 'Files are temporarily unavailable. Try refreshing this folder.';
};
export type FilesPickerOptions={maxSelections:number;fileTypes:FileFilter;onChoose(ids:string[]):void;onNative():void;onCancel():void};
export type FilesImageRequest = {directoryId:string;fileIds:string[];selectedId:string;generation:number};
export function FilesApp({ visible, active = false, picker, onViewImage }: { visible: boolean; active?:boolean; picker?: FilesPickerOptions; onViewImage?:(request:FilesImageRequest)=>void }) {
  const generation = useSessionGeneration();
  const [roots, setRoots] = useState<FileRoot[]>([]);
  const [history, setHistory] = useState<Crumb[][]>([]);
  const [position, setPosition] = useState(-1);
  const [rows, setRows] = useState<FileEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [sorting, setSorting] = useState<DisplaySort>('name');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [destination,setDestination]=useState<{title:string}|null>(null);
  const [sending,setSending]=useState(false);
  const [sendMessage,setSendMessage]=useState('');
  useEffect(()=>{
    if(picker||!window.desktop?.files)return;
    let disposed=false;
    void window.desktop.files.foreground(generation,active).catch(()=>{});
    if(!active){setDestination(null);setSendMessage('');}
    return()=>{disposed=true;if(!disposed)return;};
  },[active,generation,!!picker]);
  useEffect(()=>{
    if(!active||picker||!selected||!window.desktop?.files){setDestination(null);return;}
    let live=true;
    void window.desktop.files.transferTarget(generation).then(value=>{if(live)setDestination(value);})
      .catch(()=>{if(live)setDestination(null);});
    return()=>{live=false;};
  },[active,generation,selected,!!picker]);
  const sendSelected=async()=>{
    if(!active||!destination||!picked.length||sending||picker)return;
    setSending(true);setSendMessage('');
    try{
      const result=await window.desktop?.files.send({generation,fileIds:[...picked]});
      setSendMessage(result?`Delivered ${result.fileCount} file receipt(s) to ${result.destination}. Not uploaded or saved to a patient record.`:'Transfer unavailable.');
      setPicked([]);setSelected(null);setDestination(null);
    }catch{setSendMessage('Transfer denied or recipient unavailable. Reopen the receiving app and try again.');}
    finally{setSending(false);}
  };
  const sequence = useRef(0);
  const itemsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const current = history[position] ?? [];
  const folder = current[current.length - 1];
  const folderId = folder?.id ?? null;
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    setSearchPending(false);
  }, [folderId]);
  const navigate = useCallback((trail: Crumb[]) => {
    setHistory(previous => [...previous.slice(0, position + 1), trail]);
    setPosition(previous => previous + 1);
    setSelected(null);setPicked([]);
    setError('');
  }, [position]);
  useEffect(() => {
    if (!visible || !window.desktop?.files) return;
    let active = true;
    void window.desktop.files.roots(generation).then(values => {
      if (!active) return;
      setRoots(values);
      setHistory(previous => previous.length || !values.length ? previous : [[{ id: values[0].id, name: values[0].label }]]);
      setPosition(previous => previous < 0 && values.length ? 0 : previous);
    }).catch(reason => { if (active) setError(statusText(reason)); });
    return () => { active = false; };
  }, [generation, visible]);
  useEffect(() => {
    const token = ++sequence.current;
    if (!visible || !folderId || !window.desktop?.files) {
      setRows([]); setNextCursor(null); setLoading(false); setLoadingMore(false);
      return;
    }
    setLoading(true); setLoadingMore(false); setError(''); setRows([]); setNextCursor(null); setSelected(null);setPicked([]);
    void window.desktop.files.list({ directoryId: folderId, cursor: null, limit: PAGE_LIMIT, generation })
      .then(value => { if (sequence.current === token) { setRows(value.entries); setNextCursor(value.nextCursor); } })
      .catch(reason => { if (sequence.current === token) setError(statusText(reason)); })
      .finally(() => { if (sequence.current === token) setLoading(false); });
    return () => { sequence.current++; };
  }, [generation, visible, folderId]);
  const searchActive = searchOpen && Boolean(searchQuery.trim());
  useEffect(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!searchOpen || !query || !visible || !folderId || !window.desktop?.files) {
      setSearchResults(null);
      setSearchPending(false);
      return;
    }
    let cancelled = false;
    setSearchResults(null);
    setSearchPending(true);
    setError('');
    const timer = window.setTimeout(() => {
      void (async () => {
        let cursor: string | null = null;
        const matches: FileEntry[] = [];
        try {
          do {
            const page = await window.desktop!.files.list({ directoryId: folderId, cursor, limit: PAGE_LIMIT, generation });
            if (cancelled) return;
            matches.push(...page.entries.filter(item => item.name.toLocaleLowerCase().includes(query)));
            cursor = page.nextCursor;
          } while (cursor && !cancelled);
          if (!cancelled) setSearchResults(matches);
        } catch (reason) {
          if (!cancelled) {
            setSearchResults([]);
            setError(statusText(reason));
          }
        } finally {
          if (!cancelled) setSearchPending(false);
        }
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [generation, visible, folderId, searchOpen, searchQuery]);
  const refresh = () => {
    // A new bounded page request; never replay a stale cursor.
    if (!folderId) return;
    const token = ++sequence.current;
    setLoading(true); setLoadingMore(false); setError(''); setRows([]); setSelected(null);setPicked([]); setNextCursor(null);
    void window.desktop?.files.list({ directoryId: folderId, cursor: null, limit: PAGE_LIMIT, generation })
      .then(value => { if (sequence.current === token) { setRows(value.entries); setNextCursor(value.nextCursor); } })
      .catch(reason => { if (sequence.current === token) setError(statusText(reason)); })
      .finally(() => { if (sequence.current === token) setLoading(false); });
  };
  const closeSearch = () => {
    const hadQuery = Boolean(searchQuery.trim());
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    if (hadQuery) refresh();
  };
  const more = () => {
    if (!folderId || !nextCursor || loading || loadingMore) return;
    const token = sequence.current;
    setLoadingMore(true);
    void window.desktop?.files.list({ directoryId: folderId, cursor: nextCursor, limit: PAGE_LIMIT, generation })
      .then(value => {
        if (sequence.current !== token) return;
        setRows(previous => [...previous, ...value.entries]);
        setNextCursor(value.nextCursor);
      })
      .catch(reason => { if (sequence.current === token) { setNextCursor(null); setError(statusText(reason)); } })
      .finally(() => { if (sequence.current === token) setLoadingMore(false); });
  };
  const list = [...(searchActive ? searchResults ?? [] : rows)].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    if (sorting === 'size') return (b.sizeBytes ?? -1) - (a.sizeBytes ?? -1) || a.name.localeCompare(b.name);
    if (sorting === 'date') return (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) || a.name.localeCompare(b.name);
    if (sorting === 'kind') return a.typeHint.localeCompare(b.typeHint) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
  const allowedFile=(item:FileEntry)=>{
    if(item.kind==='directory'||!picker)return true;
    if(picker.fileTypes==='all')return true;
    const ext=item.typeHint;
    if(picker.fileTypes==='documents')return ['.pdf','.txt','.csv','.doc','.docx','.xls','.xlsx'].includes(ext);
    const image=['.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff'];
    return image.includes(ext)||(picker.fileTypes==='medical-images'&&['.dcm','.dicom'].includes(ext));
  };
  const chosen = list.find(item => item.id === selected);
  const chooseEntry=(item:FileEntry,extend=false)=>{
    setSelected(item.id);
    if(item.kind!=='file'||!allowedFile(item))return;
    if(!picker){setPicked(previous=>extend?previous.includes(item.id)?previous.filter(id=>id!==item.id):previous.length<10?[...previous,item.id]:previous:[item.id]);setSendMessage('');return;}
    setPicked(previous=>{
      if(!extend||picker.maxSelections===1)return [item.id];
      if(previous.includes(item.id))return previous.filter(id=>id!==item.id);
      return previous.length<picker.maxSelections?[...previous,item.id]:previous;
    });
  };
  const open = (entry: FileEntry) => {
    chooseEntry(entry);
    if (entry.kind === 'directory') navigate([...current, { id: entry.id, name: entry.name }]);
    else if(!picker&&folderId&&VIEWABLE_TYPES.has(entry.typeHint)) {
      onViewImage?.({directoryId:folderId,fileIds:list.filter(item=>item.kind==='file'&&VIEWABLE_TYPES.has(item.typeHint)).map(item=>item.id),selectedId:entry.id,generation});
    }
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = list.findIndex(item => item.id === selected);
    const horizontalGridKey = displayMode === 'grid' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End' || horizontalGridKey) {
      event.preventDefault();
      const columns = displayMode === 'grid' && itemsRef.current
        ? Math.max(1, getComputedStyle(itemsRef.current).gridTemplateColumns.split(' ').length) : 1;
      const step = event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns
        : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1
        : Math.max(0, Math.min(list.length - 1, (index < 0 ? 0 : index) + step));
      if (list[next]) setSelected(list[next].id);
    } else if (event.key === 'Enter' && chosen) {
      event.preventDefault();
      if(chosen.kind==='directory')open(chosen);
      else chooseEntry(chosen);
    } else if (event.key === 'Backspace' && current.length > 1) {
      event.preventDefault(); navigate(current.slice(0, -1));
    }
  };
  return <div className="files-app" data-testid={picker?'files-picker-browser':'files-app'}>
    <aside className="files-sidebar" aria-label="File locations">
      <div className="files-heading">Places</div>
      {roots.map(root => <button key={root.id} className={'files-location' + (current[0]?.id === root.id ? ' is-active' : '')}
        onClick={() => navigate([{ id: root.id, name: root.label }])} aria-current={current[0]?.id === root.id ? 'page' : undefined}>
        {root.kind === 'home' ? <Home size={17}/> : root.kind === 'volume' ? <HardDrive size={17}/> : <Folder size={17}/>}
        <span>{root.label}</span>
      </button>)}
      {!roots.length && <p className="files-side-note">No accessible locations found.</p>}
    </aside>
    <section className="files-main" aria-label="Local files">
      <div className="files-toolbar">
        <div className="files-navigation" aria-label="Folder navigation">
          <button aria-label="Back" disabled={position <= 0} onClick={() => { setPosition(position - 1); }}><ArrowLeft size={16}/></button>
          <button aria-label="Forward" disabled={position >= history.length - 1} onClick={() => { setPosition(position + 1); }}><ArrowRight size={16}/></button>
          <button aria-label="Up one folder" disabled={current.length < 2} onClick={() => navigate(current.slice(0,-1))}><ArrowUp size={16}/></button>
          <button aria-label="Refresh folder" disabled={!folderId || loading} onClick={refresh}><RefreshCw size={16}/></button>
        </div>
        <nav className="files-breadcrumb" aria-label="Current folder">
          {current.map((part,index) => <span key={part.id}>
            {index > 0 && <ChevronRight size={14} aria-hidden="true"/>}
            <button onClick={() => navigate(current.slice(0,index + 1))} aria-current={index === current.length - 1 ? 'location' : undefined}>{part.name}</button>
          </span>)}
        </nav>
        {searchOpen ? <div className="files-search-field">
          <Search size={15} aria-hidden="true"/>
          <input ref={searchInputRef} aria-label="Search current folder" placeholder="Search this folder" value={searchQuery}
            onChange={event => { const value = event.target.value; if (searchQuery.trim() && !value.trim()) refresh(); setSearchQuery(value); setSelected(null); setPicked([]); }}
            onKeyDown={event => { if (event.key === 'Escape') closeSearch(); }}/>
          <button type="button" aria-label="Close search" onClick={closeSearch}><X size={15}/></button>
        </div> : <button className="files-search-button" type="button" aria-label="Search files" onClick={() => setSearchOpen(true)}><Search size={17}/></button>}
        <label className="files-sort"><span>Sort by</span>
          <select aria-label="Sort files" value={sorting} onChange={event => setSorting(event.target.value as DisplaySort)}>
            <option value="name">Name</option><option value="kind">Type</option><option value="date">Modified</option><option value="size">Size</option>
          </select>
        </label>
        <div className="files-view-toggle" role="group" aria-label="File display">
          <button type="button" aria-label="Grid view" aria-pressed={displayMode === 'grid'} onClick={() => setDisplayMode('grid')}><Grid2X2 size={15}/></button>
          <button type="button" aria-label="List view" aria-pressed={displayMode === 'list'} onClick={() => setDisplayMode('list')}><List size={15}/></button>
        </div>
      </div>
      {displayMode === 'list' && <div className="files-columns" aria-hidden="true"><span>Name</span><span>Modified</span><span>Size</span></div>}
      <div className={'files-list ' + (displayMode === 'grid' ? 'is-grid' : 'is-list')} role="listbox" aria-label="Files in current folder" tabIndex={0} ref={itemsRef} onKeyDown={keyboard} aria-activedescendant={selected ? (picker?'picker-file-':'file-option-') + selected : undefined}>
        {list.map(item => <div role="option" id={(picker?'picker-file-':'file-option-') + item.id} key={item.id}
          data-testid="file-entry" data-file-kind={item.kind}
          className={'files-row' + (displayMode === 'grid' ? ' is-card' : '') + (selected === item.id || picked.includes(item.id) ? ' is-selected' : '')}
          aria-disabled={!allowedFile(item)} aria-selected={selected === item.id || picked.includes(item.id)} onClick={event => chooseEntry(item,event.ctrlKey||event.metaKey)}
          onDoubleClick={() => open(item)}>
          {displayMode === 'grid' ? <>
            <FileThumbnail item={item} generation={generation} scrollRoot={itemsRef.current}/>
            <span className="files-card-name" title={item.name}>{item.name}</span>
          </> : <>
          <span className="files-name">
            <FileTypeIcon item={item} size={17}/>
            <span title={item.name}>{item.name}</span>
          </span>
          <span>{item.modifiedAt === null ? '—' : new Date(item.modifiedAt).toLocaleDateString()}</span>
          <span>{item.sizeBytes === null ? '—' : item.sizeBytes < 1024 ? item.sizeBytes + ' B' : (item.sizeBytes / 1024).toFixed(1) + ' KB'}</span>
          </>}
        </div>)}
        {!loading && !searchPending && !error && !list.length && <div className="files-placeholder">{searchActive ? 'No matching items.' : 'This folder is empty.'}</div>}
        {loading && <p className="files-state" role="status"><LoaderCircle size={16} className="files-spin"/> Reading files…</p>}
        {searchPending && <p className="files-state" role="status"><LoaderCircle size={16} className="files-spin"/> Searching this folder…</p>}
        {error && <p className="files-error" role="alert"><AlertCircle size={17}/>{error} <button onClick={refresh}>Try again</button></p>}
        {!searchActive && nextCursor && !loading && <button className="files-more" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more files'}</button>}
      </div>
      <footer className="files-footer">
        <span>{searchActive ? searchPending ? 'Searching…' : `${list.length} result${list.length === 1 ? '' : 's'}` : `${rows.length} item${rows.length === 1 ? '' : 's'}${nextCursor ? ' · More in folder' : ''}`}</span>
        <span>{chosen ? chosen.kind === 'directory' ? 'Folder · Double-click to open' : 'Selected: ' + chosen.name : 'No file selected'}</span>
        {picker ? <div className="files-picker-actions">
          <button onClick={picker.onCancel}>Cancel</button>
          <button onClick={picker.onNative}>Use native picker</button>
          <button disabled={!picked.length||loading} onClick={()=>picker.onChoose(picked)}>Choose {picked.length||''} file{picked.length===1?'':'s'}</button>
        </div> : <div className="files-send-actions">
          <span className="files-readonly">{destination ? 'To ' + destination.title : 'No eligible app open'}</span>
          <button aria-label="Send selected files to active eligible app" disabled={!active||!destination||!picked.length||loading||sending} onClick={()=>void sendSelected()}>Send</button>
        </div>}
      </footer>
      {!picker&&sendMessage&&<p className="files-send-status" role="status">{sendMessage}</p>}
    </section>
  </div>;
}
