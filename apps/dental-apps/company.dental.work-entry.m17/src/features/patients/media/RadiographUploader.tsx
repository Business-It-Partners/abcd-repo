import { ImageIcon, LockKeyhole } from 'lucide-react';
import type { XrayDraft, XrayType } from '@/features/work-entry/model/chartData';

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
  onRemoveSavedUpload?: (mediaAssetId: string, reason: string) => Promise<void>;
  onSavedUploadRemoved?: (mediaAssetId: string) => void;
};

export type SavedRadiographUpload = {
  mediaAssetId: string;
  displayFilename: string;
  xrayType: XrayType;
  previewUrl: string;
};

/** Work Entry's current signed media grant is read-only; never upload from this renderer. */
export default function RadiographUploader({ drafts }: Props) {
  return <section aria-label="Radiographs" style={{ display: 'grid', gap: 10, color: 'var(--ink-2)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-1)', fontWeight: 650 }}>
      <ImageIcon size={16} /> Radiographs <LockKeyhole size={13} aria-label="Read-only in this release" />
    </div>
    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
      Radiograph upload and withdrawal are not enabled for this Work Entry release. The clinical form will not send or save image files.
    </p>
    {drafts.length > 0 && <p role="alert" style={{ margin: 0, color: 'var(--danger, #a33)', fontSize: 13 }}>
      {drafts.length} image draft(s) cannot be included in the clinical commit. Remove them before continuing.
    </p>}
  </section>;
}
