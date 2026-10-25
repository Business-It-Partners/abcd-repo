"use client";

import { useState, useEffect } from "react";
import styles from "@/features/patients/patient-record.module.css";
import {
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
  Calendar,
  Trash2,
} from "lucide-react";
import type { XrayImage } from "@/features/work-entry/model/chartData";
import { formatDateShort } from "@/features/patients/model/domain";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { Field, Input } from "@/shared/ui/workspace-primitives";
import { usePatientMediaSdk } from "@/saasMediaContext";

interface XRayGalleryProps {
  xrays?: XrayImage[];
  isLoading?: boolean;
  onDeleteXray: (id: string, reason: string) => Promise<void>;
}

interface RadiographImageProps {
  image: XrayImage;
  alt: string;
  style?: React.CSSProperties;
  thumbnail?: { width: number; height: number };
  onDragStart?: React.DragEventHandler<HTMLImageElement>;
}

function RadiographImage({ image, alt, style, onDragStart }: RadiographImageProps) {
  const media = usePatientMediaSdk();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let current = true;
    let blobUrl: string | null = null;

    setLoadError(false);
    setSourceUrl(null);
    if (!image.patientId) {
      setLoadError(true);
      return () => {
        current = false;
      };
    }

    void media.view(image.patientId, image.imageId)
      .then((viewUrl) => {
        blobUrl = viewUrl;
        if (current) setSourceUrl(viewUrl);
        else URL.revokeObjectURL(viewUrl);
      })
      .catch(() => {
        if (current) setLoadError(true);
      });

    return () => {
      current = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [image, media]);

  if (!sourceUrl) {
    return (
      <div
        role="img"
        aria-label={`${alt} ${loadError ? "could not be loaded" : "is loading"}`}
        style={{ ...style, display: "grid", placeItems: "center", background: "#0f172a", color: "#cbd5e1", padding: 12, textAlign: "center" }}
      >
        {loadError ? "Unable to load private image" : "Loading private image…"}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- browser-session object URLs cannot use Next's image optimizer.
  return <img src={sourceUrl} alt={alt} style={style} onDragStart={onDragStart} />;
}

export default function XRayGallery({ xrays = [], isLoading = false, onDeleteXray }: XRayGalleryProps) {
  const [items, setItems] = useState<XrayImage[]>(xrays);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setItems(xrays);
  }, [xrays]);

  const activeXray = items[selectedIndex] || items[0];

  const handleOpenLightbox = (index: number) => {
    setSelectedIndex(index);
    resetZoom();
    setIsLightboxOpen(true);
  };

  const handleDeleteFilm = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deletingId) return;
    setPendingDeleteId(id);
    setDeleteReason("");
  };

  const confirmDeleteFilm = async () => {
    if (!pendingDeleteId || deletingId || !deleteReason.trim()) return;
    const id = pendingDeleteId;

    setDeletingId(id);
    setDeleteError("");

    try {
      await onDeleteXray(id, deleteReason.trim());

      const updated = items.filter((x) => x.id !== id);
      setItems(updated);

      if (updated.length === 0) {
        setIsLightboxOpen(false);
      } else {
        setSelectedIndex((prev) => Math.min(prev, updated.length - 1));
        resetZoom();
      }
    } catch (error) {
      console.error("Failed to remove radiograph", error);
      setDeleteError("Could not remove this radiograph. It remains in the record. Please try again.");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
      setDeleteReason("");
    }
  };

  const handleNext = () => {
    if (!items.length) return;
    setSelectedIndex((prev) => (prev + 1) % items.length);
    resetZoom();
  };

  const handlePrev = () => {
    if (!items.length) return;
    setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    resetZoom();
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(4, z + 0.5));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZ = Math.max(1, z - 0.5);
      if (nextZ === 1) setPan({ x: 0, y: 0 });
      return nextZ;
    });
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers for zoomed image inside lightbox
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!items || items.length === 0) {
    return (
      <div className={styles.xrayLayout}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <ImageIcon size={16} /> Radiographs & Imaging
            </h3>
          </div>
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "var(--fs-14)",
              fontWeight: "var(--fw-medium)",
            }}
          >
            {isLoading ? <span role="status">Loading radiographs…</span> : "No radiographs attached to this patient record yet."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.xrayLayout}>
      {/* On-Page Card Grid View (Clean thumbnail cards) */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <ImageIcon size={16} /> Radiographs & Imaging
          </h3>
        </div>

        {deleteError && !isLightboxOpen && (
          <div
            role="alert"
            style={{
              margin: "12px 16px 0",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "var(--fs-13)",
              fontWeight: "var(--fw-medium)",
            }}
          >
            {deleteError}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            padding: 16,
          }}
        >
          {items.map((x, idx) => (
            <div
              key={x.id}
              onClick={() => handleOpenLightbox(idx)}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.04)";
              }}
            >
              <div style={{ position: "relative", width: "100%", height: 160, background: "#0f172a" }}>
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    zIndex: 2,
                    fontSize: "var(--fs-12)",
                    fontWeight: "var(--fw-bold)",
                    padding: "3px 9px",
                    borderRadius: "20px",
                    background: "rgba(15, 23, 42, 0.75)",
                    backdropFilter: "blur(4px)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {x.type}
                </span>

                {/* Remove Button on Card */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteFilm(x.id, e)}
                  disabled={deletingId !== null}
                  title={deletingId === x.id ? "Removing radiograph" : "Remove radiograph"}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 4,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(220, 38, 38, 0.85)",
                    backdropFilter: "blur(4px)",
                    border: "none",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: deletingId ? "wait" : "pointer",
                    opacity: deletingId && deletingId !== x.id ? 0.55 : 1,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#dc2626")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(220, 38, 38, 0.85)")}
                >
                  <Trash2 size={13} />
                </button>

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(15, 23, 42, 0.35)",
                    opacity: 0,
                    transition: "opacity 0.2s ease",
                    zIndex: 3,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  <span
                    style={{
                      background: "rgba(124, 58, 237, 0.9)",
                      color: "#ffffff",
                      fontSize: "var(--fs-12)",
                      fontWeight: "var(--fw-bold)",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Maximize2 size={13} /> View Lightbox
                  </span>
                </div>

                <RadiographImage
                  image={x}
                  thumbnail={{ width: 400, height: 300 }}
                  alt={`${x.type}${x.tooth ? ` — tooth ${x.tooth}` : ""}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {x.tooth ? (
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "var(--acc)", background: "var(--acc-soft)", padding: "2px 8px", borderRadius: "6px" }}>
                      Tooth {x.tooth}
                    </span>
                  ) : <div />}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--fs-12)", color: "#64748b", fontWeight: "var(--fw-medium)" }}>
                    <Calendar size={13} /> {formatDateShort(x.date)}
                  </div>
                </div>
                {x.note && (
                  <div style={{ fontSize: "var(--fs-13)", color: "#334155", lineHeight: 1.4, marginTop: "2px" }}>{x.note}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Lightbox Popup Modal */}
      {isLightboxOpen && activeXray && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(9, 13, 22, 0.94)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Lightbox Header */}
          <div
            style={{
              padding: "16px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                <ImageIcon size={18} style={{ color: "#a78bfa" }} /> Radiograph Lightbox — {activeXray.type} {activeXray.tooth ? `(Tooth ${activeXray.tooth})` : ""}
              </span>
              <span style={{ fontSize: "var(--fs-13)", color: "#94a3b8" }}>
                {formatDateShort(activeXray.date)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Remove Button inside Lightbox */}
              <button
                type="button"
                onClick={() => handleDeleteFilm(activeXray.id)}
                disabled={deletingId !== null}
                title={deletingId === activeXray.id ? "Removing radiograph" : "Remove Radiograph"}
                style={{
                  background: "rgba(220, 38, 38, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "20px",
                  padding: "6px 12px",
                  color: "#fca5a5",
                  fontSize: "var(--fs-12)",
                  fontWeight: "var(--fw-medium)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: deletingId ? "wait" : "pointer",
                  opacity: deletingId && deletingId !== activeXray.id ? 0.55 : 1,
                }}
              >
                <Trash2 size={14} /> {deletingId === activeXray.id ? "Removing…" : "Remove Film"}
              </button>

              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {deleteError && (
            <div
              role="alert"
              style={{
                padding: "10px 24px",
                borderBottom: "1px solid rgba(248, 113, 113, 0.35)",
                background: "rgba(127, 29, 29, 0.9)",
                color: "#fecaca",
                fontSize: "var(--fs-13)",
                fontWeight: "var(--fw-medium)",
              }}
            >
              {deleteError}
            </div>
          )}

          {/* Main Lightbox Viewport with Nav & Zoom Controls */}
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              userSelect: "none",
              cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Top Toolbar Controls */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 20,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(15, 23, 42, 0.85)",
                backdropFilter: "blur(8px)",
                padding: "6px 14px",
                borderRadius: "24px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                title="Zoom Out"
                style={{
                  background: "none",
                  border: "none",
                  color: zoom <= 1 ? "rgba(255, 255, 255, 0.3)" : "#ffffff",
                  cursor: zoom <= 1 ? "not-allowed" : "pointer",
                  padding: "2px",
                  display: "flex",
                }}
              >
                <ZoomOut size={16} />
              </button>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", minWidth: "40px", textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                title="Zoom In"
                style={{
                  background: "none",
                  border: "none",
                  color: zoom >= 4 ? "rgba(255, 255, 255, 0.3)" : "#ffffff",
                  cursor: zoom >= 4 ? "not-allowed" : "pointer",
                  padding: "2px",
                  display: "flex",
                }}
              >
                <ZoomIn size={16} />
              </button>

              {zoom > 1 && (
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset Zoom (100%)"
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontSize: "var(--fs-11)",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    marginLeft: 4,
                  }}
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            {/* Left Nav Arrow (<) */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                title="Previous X-Ray (<)"
                style={{
                  position: "absolute",
                  left: 24,
                  zIndex: 10,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "rgba(15, 23, 42, 0.8)",
                  backdropFilter: "blur(6px)",
                  border: "1.5px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124, 58, 237, 0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)")}
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Right Nav Arrow (>) */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                title="Next X-Ray (>)"
                style={{
                  position: "absolute",
                  right: 24,
                  zIndex: 10,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "rgba(15, 23, 42, 0.8)",
                  backdropFilter: "blur(6px)",
                  border: "1.5px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124, 58, 237, 0.9)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)")}
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* High Resolution Image Viewport */}
            <div
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                maxWidth: "92vw",
                maxHeight: "75vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RadiographImage
                image={activeXray}
                alt={activeXray.type}
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
                  borderRadius: "6px",
                }}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>

            {/* Notes overlay inside popup */}
            {activeXray.note && (
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 24,
                  right: 24,
                  zIndex: 10,
                  background: "rgba(15, 23, 42, 0.85)",
                  backdropFilter: "blur(8px)",
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#f8fafc",
                  fontSize: "var(--fs-13)",
                  maxWidth: "600px",
                  margin: "0 auto",
                }}
              >
                <strong style={{ color: "#a7f3d0" }}>Clinical Note: </strong>
                {activeXray.note}
              </div>
            )}
          </div>

          {/* Film Strip at Bottom of Lightbox */}
          {items.length > 1 && (
            <div
              style={{
                padding: "14px 24px",
                background: "rgba(15, 23, 42, 0.95)",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
                {items.map((x, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => {
                        setSelectedIndex(idx);
                        resetZoom();
                      }}
                      style={{
                        position: "relative",
                        width: 64,
                        height: 50,
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: isActive ? "2px solid #a78bfa" : "1px solid rgba(255, 255, 255, 0.2)",
                        opacity: isActive ? 1 : 0.5,
                        cursor: "pointer",
                        padding: 0,
                        background: "#000000",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <RadiographImage
                        image={x}
                        thumbnail={{ width: 120, height: 90 }}
                        alt={x.type}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes xraySpin { to { transform: rotate(360deg); } }`}</style>
      {pendingDeleteId && (
        <ConfirmDialog
          title="Remove radiograph?"
          body={
            <div>
              This image will be removed from the active clinical record but its audited history will be retained.
              <Field label="Reason for removal *" style={{ marginTop: 12 }}>
                <Input value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} autoFocus />
              </Field>
            </div>
          }
          confirmLabel="Remove radiograph"
          destructive
          busy={deletingId !== null}
          confirmDisabled={!deleteReason.trim()}
          onConfirm={() => void confirmDeleteFilm()}
          onCancel={() => { if (!deletingId) { setPendingDeleteId(null); setDeleteReason(""); } }}
        />
      )}
    </div>
  );
}
