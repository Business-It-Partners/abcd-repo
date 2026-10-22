import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertCircle, ArrowDownAZ, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, File, FileImage, FileText, Folder, FolderOpen, HardDrive, Home, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSessionGeneration } from './SessionBoundary';
import type { FileEntry, FileRoot, FileFilter } from '../electron/host/localFiles';

type Crumb = { id: string; name: string };
type DisplaySort = 'name' | 'kind' | 'date' | 'size';
const PAGE_LIMIT = 100;
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
export function FilesApp({ visible, active = false, picker }: { visible: boolean; active?:boolean; picker?: FilesPickerOptions }) {
  const generation = useSessionGeneration();
  const [roots, setRoots] = useState<FileRoot[]>([]);
  const [history, setHistory] = useState<Crumb[][]>([]);
  const [position, setPosition] = useState(-1);
  const [rows, setRows] = useState<FileEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [sorting, setSorting] = useState<DisplaySort>('name');
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
  const current = history[position] ?? [];
  const folder = current[current.length - 1];
  const folderId = folder?.id ?? null;
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
  const list = [...rows].sort((a, b) => {
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
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = list.findIndex(item => item.id === selected);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1
        : Math.max(0, Math.min(list.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
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
      <div className="files-heading"><FolderOpen size={17}/><span>Files</span><small>On this computer</small></div>
      {roots.map(root => <button key={root.id} className={'files-location' + (current[0]?.id === root.id ? ' is-active' : '')}
        onClick={() => navigate([{ id: root.id, name: root.label }])} aria-current={current[0]?.id === root.id ? 'page' : undefined}>
        {root.kind === 'home' ? <Home size={17}/> : root.kind === 'volume' ? <HardDrive size={17}/> : <Folder size={17}/>}
        <span>{root.label}</span>
      </button>)}
      {!roots.length && <p className="files-side-note">No accessible locations found.</p>}
      <p className="files-side-note">Read-only browsing. Files stay on your computer.</p>
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
        <label className="files-sort">Sort loaded files
          <select aria-label="Sort loaded files" value={sorting} onChange={event => setSorting(event.target.value as DisplaySort)}>
            <option value="name">Name</option><option value="kind">Type</option><option value="date">Modified</option><option value="size">Size</option>
          </select><ArrowDownAZ size={15} aria-hidden="true"/>
        </label>
      </div>
      <div className="files-columns" aria-hidden="true"><span>Name</span><span>Modified</span><span>Size</span></div>
      <div className="files-list" role="listbox" aria-label="Files in current folder" tabIndex={0} ref={itemsRef} onKeyDown={keyboard} aria-activedescendant={selected ? (picker?'picker-file-':'file-option-') + selected : undefined}>
        {list.map(item => <div role="option" id={(picker?'picker-file-':'file-option-') + item.id} key={item.id}
          className={'files-row' + (selected === item.id || picked.includes(item.id) ? ' is-selected' : '')}
          aria-disabled={!allowedFile(item)} aria-selected={selected === item.id || picked.includes(item.id)} onClick={event => chooseEntry(item,event.ctrlKey||event.metaKey)}
          onDoubleClick={() => open(item)}>
          <span className="files-name">
            {item.kind === 'directory' ? <Folder size={17}/> : item.typeHint.match(/png|jpg|jpeg|webp|tif|bmp|dcm/i) ? <FileImage size={17}/> : item.typeHint.match(/pdf|doc|txt/i) ? <FileText size={17}/> : <File size={17}/>}
            <span title={item.name}>{item.name}</span>
          </span>
          <span>{item.modifiedAt === null ? '—' : new Date(item.modifiedAt).toLocaleDateString()}</span>
          <span>{item.sizeBytes === null ? '—' : item.sizeBytes < 1024 ? item.sizeBytes + ' B' : (item.sizeBytes / 1024).toFixed(1) + ' KB'}</span>
        </div>)}
        {!loading && !error && !list.length && <div className="files-placeholder">This folder is empty.</div>}
        {loading && <p className="files-state" role="status"><LoaderCircle size={16} className="files-spin"/> Reading files…</p>}
        {error && <p className="files-error" role="alert"><AlertCircle size={17}/>{error} <button onClick={refresh}>Try again</button></p>}
        {nextCursor && !loading && <button className="files-more" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more files'}</button>}
      </div>
      <footer className="files-footer">
        <span>{rows.length} item{rows.length === 1 ? '' : 's'} loaded{nextCursor ? ' · More available' : ''}</span>
        <span>{chosen ? chosen.kind === 'directory' ? 'Double-click to open folder' : 'Selected: ' + chosen.name : 'Select a file to view its details'}</span>
        {picker ? <div className="files-picker-actions">
          <button onClick={picker.onCancel}>Cancel</button>
          <button onClick={picker.onNative}>Use native picker</button>
          <button disabled={!picked.length||loading} onClick={()=>picker.onChoose(picked)}>Choose {picked.length||''} file{picked.length===1?'':'s'}</button>
        </div> : <div className="files-send-actions">
          <span className="files-readonly">{destination ? 'Recipient: ' + destination.title : 'Open an eligible dental app before Files to enable transfer'}</span>
          <button disabled={!active||!destination||!picked.length||loading||sending} onClick={()=>void sendSelected()}>Send to active eligible app</button>
        </div>}
      </footer>
      {!picker&&sendMessage&&<p className="files-send-status" role="status">{sendMessage}</p>}
    </section>
  </div>;
}
