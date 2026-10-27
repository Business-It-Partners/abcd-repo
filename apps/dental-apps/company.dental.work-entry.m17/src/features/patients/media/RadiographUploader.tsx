import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import type { PatientMediaAsset } from '@/features/patients/types';
import type { XrayDraft, XrayType } from '@/features/work-entry/model/chartData';
import { patientMediaApi } from './api';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import styles from './RadiographUploader.module.css';

type Props = {
  drafts: XrayDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<XrayDraft[]>>;
  patientId?: string;
  chiefComplaintId?: string | null;
  defaultType: XrayType;
  dateLabel?: string;
  capturedOn?: string;
  onUploaded?: () => void | Promise<void>;
  replaceMediaAssetId?: string | null;
  savedUploads?: SavedRadiographUpload[];
  onUploadCompleted?: (upload: SavedRadiographUpload) => void;
  onError?: (message: string) => void;
  onRemoveSavedUpload?: (mediaAssetId: string, reason: string) => Promise<void>;
  onSavedUploadRemoved?: (mediaAssetId: string) => void;
  uploadAvailable?: boolean;
};

export type SavedRadiographUpload = {
  mediaAssetId: string;
  displayFilename: string;
  xrayType: XrayType;
  previewUrl: string;
};

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxFileBytes = 10 * 1024 * 1024;
const formatBytes = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;

function xrayType(value: PatientMediaAsset['xrayType'], fallback: XrayType): XrayType {
  return value === 'IOPA' || value === 'OPG' || value === 'CBCT' || value === 'Intraoral photo' ? value : fallback;
}

export default function RadiographUploader({
  drafts,
  setDrafts,
  patientId,
  chiefComplaintId = null,
  defaultType,
  dateLabel,
  capturedOn,
  onUploaded,
  savedUploads = [],
  onUploadCompleted,
  onError,
  onRemoveSavedUpload,
  onSavedUploadRemoved,
  uploadAvailable = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [listError, setListError] = useState('');
  const [remoteAssets, setRemoteAssets] = useState<PatientMediaAsset[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState('');
  const [removalTarget, setRemovalTarget] = useState<SavedRadiographUpload | null>(null);
  const [removingId, setRemovingId] = useState('');
  const [removalError, setRemovalError] = useState('');
  const [busyUploads, setBusyUploads] = useState(0);
  const canUpload = Boolean(patientId) && uploadAvailable;
  const reportError = (setLocalError: React.Dispatch<React.SetStateAction<string>>, message: string) => {
    if (onError) onError(message);
    else setLocalError(message);
  };

  const reloadMedia = useCallback(async () => {
    if (!patientId) {
      setRemoteAssets([]);
      setListError('');
      return;
    }
    try {
      const media = await patientMediaApi.listPatientMedia(patientId);
      setRemoteAssets(media);
      setListError('');
    } catch (cause) {
      reportError(setListError, cause instanceof Error ? cause.message : 'Saved radiographs could not be loaded.');
    }
  }, [onError, patientId]);

  useEffect(() => { void reloadMedia(); }, [reloadMedia]);

  const savedImages = useMemo(() => {
    const known = new Set(savedUploads.map(item => item.mediaAssetId));
    return [
      ...savedUploads,
      ...remoteAssets.filter(asset => !known.has(asset.mediaAssetId)).map(asset => ({
        mediaAssetId: asset.mediaAssetId,
        displayFilename: asset.displayFilename,
        xrayType: xrayType(asset.xrayType, defaultType),
        previewUrl: previewUrls[asset.mediaAssetId] ?? '',
      })),
    ];
  }, [defaultType, previewUrls, remoteAssets, savedUploads]);

  const openSavedPreview = async (upload: SavedRadiographUpload) => {
    if (upload.previewUrl) {
      setPreview({ url: upload.previewUrl, name: upload.displayFilename });
      return;
    }
    if (!patientId || previewLoadingId) return;
    setPreviewLoadingId(upload.mediaAssetId);
    setUploadError('');
    try {
      const url = await patientMediaApi.viewPatientMedia(patientId, upload.mediaAssetId);
      setPreviewUrls(current => ({ ...current, [upload.mediaAssetId]: url }));
      setPreview({ url, name: upload.displayFilename });
    } catch (cause) {
      reportError(setUploadError, cause instanceof Error ? cause.message : 'This radiograph could not be opened.');
    } finally {
      setPreviewLoadingId('');
    }
  };

  const removeSavedImage = async () => {
    const target = removalTarget;
    if (!target || !onRemoveSavedUpload) return;
    setRemovingId(target.mediaAssetId);
    setRemovalError('');
    try {
      // SaaS records an audited withdrawal. If the response is lost, confirm through a fresh list
      // read before changing the local gallery or asking the clinician to retry.
      try {
        await onRemoveSavedUpload(target.mediaAssetId, 'Removed by clinician from Work Entry.');
      } catch (withdrawalError) {
        if (!patientId) throw withdrawalError;
        let current: PatientMediaAsset[];
        try {
          current = await patientMediaApi.listPatientMedia(patientId);
        } catch {
          throw new Error(`${withdrawalError instanceof Error ? withdrawalError.message : 'The removal response was unclear.'} The clinic could not confirm whether the image was withdrawn; refresh the patient radiographs before retrying.`);
        }
        setRemoteAssets(current);
        if (current.some(asset => asset.mediaAssetId === target.mediaAssetId)) throw withdrawalError;
      }
      const localUrl = savedUploads.find(item => item.mediaAssetId === target.mediaAssetId)?.previewUrl;
      const remoteUrl = previewUrls[target.mediaAssetId];
      if (preview?.url === localUrl || preview?.url === remoteUrl) setPreview(null);
      if (localUrl) URL.revokeObjectURL(localUrl);
      if (remoteUrl) URL.revokeObjectURL(remoteUrl);
      setPreviewUrls(current => {
        const next = { ...current };
        delete next[target.mediaAssetId];
        return next;
      });
      setRemoteAssets(current => current.filter(asset => asset.mediaAssetId !== target.mediaAssetId));
      onSavedUploadRemoved?.(target.mediaAssetId);
      setRemovalTarget(null);
    } catch (cause) {
      reportError(setRemovalError, cause instanceof Error ? cause.message : 'The image was not removed. Please try again.');
    } finally {
      setRemovingId('');
    }
  };

  const ingestFiles = async (files: File[]) => {
    setUploadError('');
    if (busyUploads > 0) return;
    const rejected = files.filter(file => !acceptedTypes.includes(file.type) || file.size < 1 || file.size > maxFileBytes);
    if (rejected.length) reportError(setUploadError, 'Only JPEG, PNG, or WebP images from 1 byte up to 10 MiB can be uploaded.');
    if (!patientId) {
      if (files.length) reportError(setUploadError, 'Select or save the patient before adding radiographs.');
      return;
    }

    const validFiles = files.filter(file => acceptedTypes.includes(file.type) && file.size > 0 && file.size <= maxFileBytes);
    for (const file of validFiles) {
      const key = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setDrafts(current => [...current, { key, type: defaultType, previewUrl, sourceFilename: file.name,
        mimeType: file.type, byteSize: file.size, status: 'uploading' }]);
      setBusyUploads(current => current + 1);
      let mediaAssetId = '';
      try {
        mediaAssetId = await patientMediaApi.uploadPatientMedia(patientId, file, {
          chiefComplaintId,
          xrayType: defaultType,
          toothCode: null,
          clinicalNote: null,
          capturedOn: capturedOn ?? new Date().toISOString().slice(0, 10),
        }, sent => setDrafts(current => current.map(draft => draft.key === key ? { ...draft, progress: sent } : draft)));
      } catch (cause) {
        setDrafts(current => current.map(draft => draft.key === key ? { ...draft, status: 'error' } : draft));
        reportError(setUploadError, cause instanceof Error ? cause.message : 'The radiograph upload failed. The local draft remains available.');
        setBusyUploads(current => Math.max(0, current - 1));
        continue;
      }

      setDrafts(current => current.filter(draft => draft.key !== key));
      onUploadCompleted?.({ mediaAssetId, displayFilename: file.name, xrayType: defaultType, previewUrl });
      setBusyUploads(current => Math.max(0, current - 1));
      try {
        await onUploaded?.();
        await reloadMedia();
      } catch (cause) {
        reportError(setListError, cause instanceof Error ? cause.message : 'The image was saved, but the gallery could not be refreshed.');
      }
    }
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    void ingestFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const hasDraggedFiles = (transfer: DataTransfer) => transfer.types.includes('Files')
    || Array.from(transfer.items).some(item => item.kind === 'file');

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const items = Array.from(event.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    void ingestFiles(items.length ? items : Array.from(event.dataTransfer.files));
  };

  const onDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const accepted = canUpload && busyUploads === 0;
    event.dataTransfer.dropEffect = accepted ? 'copy' : 'none';
    setDragOver(accepted);
  };

  const onDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  };

  const removeDraft = (draft: XrayDraft) => {
    URL.revokeObjectURL(draft.previewUrl);
    setDrafts(current => current.filter(item => item.key !== draft.key));
  };

  return (
    <section aria-label="Radiographs" className={styles.radiographs}>
      <header>
        <h3 className={styles.heading}>
          <ImageIcon size={15} aria-hidden="true" /> Radiographs ({defaultType}) — attach if taken
        </h3>
      </header>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canUpload || busyUploads > 0}
        onChange={onFiles} className={styles.fileInput} />

      <div className={styles.gallery}>
          {savedImages.map(upload => (
            <article key={upload.mediaAssetId} className={styles.imageCard}>
              <button type="button" onClick={() => void openSavedPreview(upload)} disabled={previewLoadingId === upload.mediaAssetId}
                aria-label={`Preview ${upload.displayFilename}`} title="Open full-size image"
                className={styles.imageButton}>
                {upload.previewUrl ? <img src={upload.previewUrl} alt={upload.displayFilename} className={styles.image} />
                  : previewLoadingId === upload.mediaAssetId ? <Loader2 size={20} aria-label="Loading image" /> : <ImageIcon size={22} className={styles.imagePlaceholder} aria-hidden="true" />}
              </button>
              <div className={styles.caption} title={upload.displayFilename}>{upload.xrayType}</div>
              {onRemoveSavedUpload && <button type="button" onClick={() => { setRemovalError(''); setRemovalTarget(upload); }} disabled={Boolean(removingId)}
                aria-label={`Remove ${upload.displayFilename}`} title={`Remove ${upload.displayFilename}`} className={styles.removeImage}>
                {removingId === upload.mediaAssetId ? <Loader2 size={13} aria-label="Removing image" /> : <X size={14} aria-hidden="true" />}
              </button>}
            </article>
          ))}

        {drafts.map(draft => (
          <article key={draft.key} className={styles.imageCard}>
            <div className={styles.previewFrame}>
              <div className={styles.imageButton}>
                <img src={draft.previewUrl} alt={draft.sourceFilename ?? 'Radiograph preview'} className={styles.image} />
              </div>
              {draft.status === 'uploading' && <span role="status" aria-label="Uploading image" data-work-entry-upload-spinner className={styles.uploadingOverlay}>
                <Loader2 size={28} className={styles.uploadSpinner} aria-hidden="true" />
              </span>}
            </div>
            <div className={styles.caption}>{draft.type || defaultType}</div>
            <p className={styles.imageStatus}>
              {draft.status === 'uploading' ? `Uploading${draft.byteSize ? ` · ${formatBytes(draft.progress ?? 0)} / ${formatBytes(draft.byteSize)}` : ''}` : 'Upload failed · local draft'}
            </p>
            {draft.status === 'error' && <button type="button" className={styles.removeImage} aria-label={`Discard ${draft.sourceFilename ?? 'radiograph draft'}`} title="Discard draft" onClick={() => removeDraft(draft)}><X size={14} aria-hidden="true" /></button>}
          </article>
        ))}

        <button type="button" data-testid="radiograph-dropzone" className={`${styles.addImage} ${dragOver ? styles.dragOver : ''}`} disabled={!canUpload || busyUploads > 0}
        onClick={() => canUpload && !busyUploads && inputRef.current?.click()}
        onDragEnter={onDragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        aria-label={!canUpload ? 'Select a patient before adding images' : 'Add Image. Drop or browse'}>
          <span className={styles.uploadIcon}>{busyUploads ? <Loader2 size={17} aria-label="Upload in progress" /> : <Upload size={17} aria-hidden="true" />}</span>
          <strong className={styles.addTitle}>{!patientId ? 'Select a patient' : !uploadAvailable ? 'Upload in Patient Record' : busyUploads ? 'Uploading…' : 'Add Image'}</strong>
          <span className={styles.addHint}>{!patientId ? 'Choose a patient first' : !uploadAvailable ? 'Work Entry has read-only radiograph access' : 'Drop or browse'}</span>
        </button>
      </div>

      <p className={styles.filingNote}>
        {uploadAvailable ? <>Each film is stored in this clinic’s private imaging record after upload{dateLabel ? `. It is filed for ${dateLabel}.` : '.'}</> : 'Radiographs can be viewed here. Add or remove images in Patient Record.'}
      </p>

      {!onError && uploadError && <p role="alert" className={styles.error}>{uploadError}</p>}
      {!onError && listError && <p role="alert" className={styles.error}>{listError}</p>}
      {!onError && removalError && <p role="alert" className={styles.error}>{removalError}</p>}

      {preview && <div role="dialog" aria-modal="true" aria-label={`Radiograph preview: ${preview.name}`} onClick={() => setPreview(null)}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 28, background: 'rgba(15,23,42,.82)' }}>
        <button type="button" className="btn btn-secondary" onClick={event => { event.stopPropagation(); setPreview(null); }} aria-label="Close radiograph preview"
          style={{ position: 'absolute', top: 16, right: 16, background: '#fff' }}><X size={18} /></button>
        <img src={preview.url} alt={preview.name} onClick={event => event.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      </div>}

      {removalTarget && <ConfirmDialog title="Remove radiograph?"
        body={<>Work Entry will ask the clinic service to withdraw <strong>{removalTarget.displayFilename}</strong>. The preview will disappear after the service confirms.</>}
        confirmLabel="Remove image" cancelLabel="Keep image" destructive busy={removingId === removalTarget.mediaAssetId}
        onConfirm={() => void removeSavedImage()} onCancel={() => setRemovalTarget(null)} />}
    </section>
  );
}
