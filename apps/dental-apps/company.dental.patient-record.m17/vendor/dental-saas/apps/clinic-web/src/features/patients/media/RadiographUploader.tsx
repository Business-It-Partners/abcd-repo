"use client";


// Shared radiograph capture. The browser only retains a short-lived preview while
// the original file is uploaded to the clinic's private R2 bucket through the
// Worker-issued upload intent.

import { useRef, useState } from "react";
import { ImageIcon, Upload, X, Loader2, AlertTriangle } from "lucide-react";
import { type XrayDraft, type XrayType, XRAY_TYPES } from "@/features/work-entry/model/chartData";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { usePatientMediaSdk } from "@/saasMediaContext";

interface RadiographUploaderProps {
  drafts: XrayDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<XrayDraft[]>>;
  patientId?: string;
  /** Optional case association for images captured during an existing Work Entry case. */
  chiefComplaintId?: string | null;
  /** Inferred/most-likely type each new film defaults to; individually retaggable after. */
  defaultType: XrayType;
  /** Visit date, shown in the helper line so it's clear when the films are being filed. */
  dateLabel?: string;
  /** Clinical capture date sent to the trusted media service. */
  capturedOn?: string;
  /** Refreshes the persisted radiograph gallery after a verified upload. */
  onUploaded?: () => void | Promise<void>;
  /** When set, this upload replaces that active private radiograph after finalisation. */
  replaceMediaAssetId?: string | null;
  /** Images saved during this open clinical workflow, not the patient's historical imaging record. */
  savedUploads?: SavedRadiographUpload[];
  /** Keeps the saved-in-this-visit list visible when the clinician changes workflow steps. */
  onUploadCompleted?: (upload: SavedRadiographUpload) => void;
  /** Audited removal for an image uploaded during this Work Entry visit. */
  onRemoveSavedUpload?: (mediaAssetId: string, reason: string) => Promise<void>;
  /** Removes the withdrawn file from this visit's local thumbnail list. */
  onSavedUploadRemoved?: (mediaAssetId: string) => void;
}

export type SavedRadiographUpload = {
  mediaAssetId: string;
  displayFilename: string;
  xrayType: XrayType;
  previewUrl: string;
};

let draftSeq = 0;

export default function RadiographUploader({
  drafts,
  setDrafts,
  patientId,
  chiefComplaintId = null,
  defaultType,
  dateLabel,
  capturedOn,
  onUploaded,
  replaceMediaAssetId = null,
  savedUploads = [],
  onUploadCompleted,
  onRemoveSavedUpload,
  onSavedUploadRemoved,
}: RadiographUploaderProps) {
  const media = usePatientMediaSdk();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canUpload = Boolean(patientId);
  // The film open full-size in a lightbox. A radiograph is read, not glanced at — an 88px thumbnail
  // is only enough to confirm the right image was picked, so clicking it shows the whole thing.
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingSavedRemovalId, setPendingSavedRemovalId] = useState<string | null>(null);
  const [removingSavedUploadId, setRemovingSavedUploadId] = useState<string | null>(null);
  const [savedRemovalError, setSavedRemovalError] = useState<string | null>(null);

  const uploadFile = async (file: File, key: string, previewUrl: string) => {
    try {
      const resolvedPatientId = patientId;
      if (!resolvedPatientId) throw new Error("Save the patient record before attaching an X-ray.");
      const pending = await media.begin(resolvedPatientId, file, {
        chiefComplaintId,
        xrayType: defaultType,
        toothCode: null,
        clinicalNote: null,
        capturedOn: capturedOn ?? new Date().toISOString().slice(0, 10),
      }, replaceMediaAssetId ? { assetId: replaceMediaAssetId, reason: "" } : undefined);
      const finalised = await media.transfer(pending);
      setDrafts((current) => {
        return current.filter((draft) => draft.key !== key);
      });
      onUploadCompleted?.({
        mediaAssetId: finalised.assetId,
        displayFilename: file.name,
        xrayType: defaultType,
        previewUrl,
      });
      await onUploaded?.();
    } catch (error) {
      setDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, status: "error" } : draft));
      setUploadError(error instanceof Error ? error.message : "Could not upload the X-ray. Please try again.");
    }
  };

  // The file dialog and drag/drop feed the same verified private-storage path.
  const ingestFiles = (files: File[]) => {
    setUploadError(null);
    const rejected: string[] = [];
    for (const file of files) {
      if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) || file.size > 10 * 1024 * 1024) {
        rejected.push(file.name);
        continue;
      }
      const key = `xd-${++draftSeq}`;
      const previewUrl = URL.createObjectURL(file);
      setDrafts((prev) => [...prev, {
        key,
        type: defaultType,
        previewUrl,
        sourceFilename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        status: "uploading",
      }]);
      void uploadFile(file, key, previewUrl);
    }
    if (rejected.length) setUploadError("Only JPEG, PNG, and WebP X-rays up to 10 MB can be uploaded.");
  };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    ingestFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    ingestFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeDraft = (key: string) =>
    setDrafts((prev) => {
      const gone = prev.find((d) => d.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((d) => d.key !== key);
    });

  const retag = (key: string, type: XrayType) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, type } : d)));

  const removeSavedUpload = async () => {
    const mediaAssetId = pendingSavedRemovalId;
    if (!mediaAssetId || !onRemoveSavedUpload) return;
    setRemovingSavedUploadId(mediaAssetId);
    setSavedRemovalError(null);
    try {
      // The service records a reason in the audit history. This concise, consistent
      // system reason keeps the clinician's confirmation lightweight during Work Entry.
      await onRemoveSavedUpload(mediaAssetId, "Removed by clinician from Work Entry.");
      const removed = savedUploads.find((upload) => upload.mediaAssetId === mediaAssetId);
      if (removed) {
        if (preview === removed.previewUrl) setPreview(null);
        URL.revokeObjectURL(removed.previewUrl);
      }
      onSavedUploadRemoved?.(mediaAssetId);
    } catch (error) {
      setSavedRemovalError(error instanceof Error ? error.message : "Could not remove this image. Please try again.");
      return;
    } finally {
      setRemovingSavedUploadId(null);
    }
    setPendingSavedRemovalId(null);
  };

  return (
    <div>
      <h4
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          fontSize: "var(--fs-14)",
          fontWeight: "var(--fw-bold)",
          color: "#334155",
          margin: "0 0 12px",
        }}
      >
        <ImageIcon size={15} /> Radiographs ({defaultType}) — attach if taken
      </h4>
           {/* Hidden file input used for both empty state & "+ Add Image" card */}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canUpload} onChange={onFiles} style={{ display: "none" }} />

      {/* GALLERY ROW: saved images and in-flight cards stay visible beside the next upload action. */}
      {drafts.length > 0 || savedUploads.length > 0 ? (
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "stretch", marginBottom: "12px" }}>
          {savedUploads.map((upload) => (
            <div
              key={upload.mediaAssetId}
              style={{
                position: "relative",
                width: "160px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              {onRemoveSavedUpload && (
                <button
                  type="button"
                  onClick={() => {
                    if (removingSavedUploadId) return;
                    setSavedRemovalError(null);
                    setPendingSavedRemovalId(upload.mediaAssetId);
                  }}
                  disabled={removingSavedUploadId !== null}
                  title={removingSavedUploadId === upload.mediaAssetId ? "Removing image" : "Remove image"}
                  aria-label={`Remove ${upload.displayFilename}`}
                  style={{
                    position: "absolute",
                    top: "-7px",
                    right: "-7px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: "1px solid #fecaca",
                    background: "#ffffff",
                    color: "#dc2626",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: removingSavedUploadId ? "wait" : "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    zIndex: 2,
                  }}
                >
                  {removingSavedUploadId === upload.mediaAssetId ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <X size={13} />}
                </button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- this is the clinician's selected local preview for the saved private file. */}
              <img
                src={upload.previewUrl}
                alt={upload.displayFilename}
                onClick={() => setPreview(upload.previewUrl)}
                title="Click to view full size"
                style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "zoom-in" }}
              />
              <div style={{ width: "100%", padding: "5px 8px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155" }}>
                {upload.xrayType}
              </div>
            </div>
          ))}
          {drafts.map((x) => (
            <div
              key={x.key}
              style={{
                position: "relative",
                width: "160px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ position: "relative", width: "100%", height: "120px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={x.previewUrl}
                  alt="radiograph"
                  onClick={() => setPreview(x.previewUrl)}
                  title="Click to view full size"
                  style={{
                    width: "100%",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    opacity: x.status === "done" ? 1 : 0.55,
                    cursor: "zoom-in",
                  }}
                />
                {x.status === "uploading" && (
                  <span style={overlayBadge}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  </span>
                )}
                {x.status === "error" && (
                  <span style={{ ...overlayBadge, color: "#dc2626" }} title="Upload failed — remove and try again">
                    <AlertTriangle size={20} />
                  </span>
                )}
              </div>

              {/* Remove button badge */}
              <button
                type="button"
                onClick={() => removeDraft(x.key)}
                title="Remove image"
                style={{
                  position: "absolute",
                  top: "-7px",
                  right: "-7px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#dc2626",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  zIndex: 2,
                }}
              >
                <X size={13} />
              </button>

              {/* Xray Type Selector */}
              <select
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  fontSize: "var(--fs-12)",
                  fontWeight: "var(--fw-medium)",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#334155",
                  cursor: "pointer",
                }}
                value={x.type}
                onChange={(e) => retag(x.key, e.target.value as XrayType)}
              >
                {XRAY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          ))}

          {/* "+ Add Image" card placed after the last image card */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={onDrop}
            onClick={() => canUpload && inputRef.current?.click()}
            onKeyDown={(e) => { if (canUpload && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
            style={{
              width: "160px",
              minHeight: "160px",
              border: `2px dashed ${dragOver ? "var(--acc, #7c3aed)" : "#c4b5fd"}`,
              background: dragOver ? "var(--acc-soft, #ede9fe)" : "linear-gradient(180deg, #fdfcff 0%, #faf5ff 100%)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: canUpload ? "pointer" : "not-allowed",
              textAlign: "center",
              padding: "12px",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                boxShadow: "0 3px 10px rgba(124, 58, 237, 0.2)",
              }}
            >
              <Upload size={18} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#7c3aed" }}>
              Add Image
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Drop or browse
            </div>
          </div>
        </div>
      ) : (
        /* FULL DROP ZONE when NO images are attached yet */
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={onDrop}
            onClick={() => canUpload && inputRef.current?.click()}
            onKeyDown={(e) => { if (canUpload && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            width: "100%",
            padding: "28px 20px",
            border: `2px dashed ${dragOver ? "var(--acc, #7c3aed)" : "#c4b5fd"}`,
            background: dragOver ? "var(--acc-soft, #ede9fe)" : "linear-gradient(180deg, #fdfcff 0%, #faf5ff 100%)",
            borderRadius: "16px",
            cursor: canUpload ? "pointer" : "not-allowed",
            textAlign: "center",
            boxShadow: dragOver ? "0 0 24px rgba(124, 58, 237, 0.15)" : "none",
            transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Upload size={20} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)", color: "#1e293b" }}>
              Drag &amp; drop X-ray images here, or{" "}
              <span
                style={{
                  color: "var(--acc, #7c3aed)",
                  fontWeight: "var(--fw-bold)",
                  background: "var(--acc-soft, #ede9fe)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  marginLeft: "2px",
                }}
              >
                browse
              </span>
            </div>
            <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-normal)", color: "#64748b" }}>
              JPEG, PNG, or WebP · maximum 10 MB each
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: "var(--fs-12)", color: "#1e293b", marginTop: "10px" }}>
        Each film is stored in this clinic&apos;s private imaging record after upload. {dateLabel ? `It is filed for ${dateLabel}.` : ""}
      </div>
      {uploadError && (
        <div role="alert" style={{ fontSize: "var(--fs-12)", color: "#b91c1c", marginTop: "8px" }}>
          {uploadError}
        </div>
      )}
      {savedRemovalError && (
        <div role="alert" style={{ fontSize: "var(--fs-12)", color: "#b91c1c", marginTop: "8px" }}>
          {savedRemovalError}
        </div>
      )}

      {/* Full-size preview. Fixed to the viewport, so no scrollable ancestor can clip it. */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,0.82)",
            display: "grid",
            placeItems: "center",
            padding: "28px",
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Close preview"
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border: "none",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="radiograph full size"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px", cursor: "default" }}
          />
        </div>
      )}

      {pendingSavedRemovalId && (
        <ConfirmDialog
          title="Remove image?"
          body="Are you sure you want to remove this image? It will no longer appear in this active clinical record."
          confirmLabel="Yes, remove image"
          destructive
          busy={removingSavedUploadId !== null}
          onConfirm={() => void removeSavedUpload()}
          onCancel={() => {
            if (!removingSavedUploadId) {
              setPendingSavedRemovalId(null);
            }
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const overlayBadge: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: "#7c3aed",
};
