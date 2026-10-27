"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import "../standard-app-page.css";

type ScrollbarMetrics = { visible: boolean; top: number; height: number; value: number };

export function StandardPageScroll({
  children,
  contentClassName,
  viewportClassName,
  shellClassName,
  id,
  label = "Page scroll position",
}: {
  children: ReactNode;
  contentClassName?: string;
  viewportClassName?: string;
  shellClassName?: string;
  id?: string;
  label?: string;
}) {
  const generatedId = useId().replace(/:/g, "");
  const scrollId = id ?? `standard-page-scroll-${generatedId}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startTop: number } | null>(null);
  const [scrollbar, setScrollbar] = useState<ScrollbarMetrics>({ visible: false, top: 0, height: 0, value: 0 });

  const updateScrollbar = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const trackHeight = Math.max(0, viewport.clientHeight - 16);
    if (!maxScroll || !trackHeight) {
      setScrollbar(current => current.visible ? { visible: false, top: 0, height: 0, value: 0 } : current);
      return;
    }

    const nativeThumbHeight = viewport.clientHeight * viewport.clientHeight / viewport.scrollHeight;
    const height = Math.min(trackHeight, Math.max(14, nativeThumbHeight * 0.3));
    const thumbTravel = Math.max(0, trackHeight - height);
    const value = viewport.scrollTop / maxScroll;
    const next = { visible: true, top: value * thumbTravel, height, value: value * 100 };
    setScrollbar(current => current.visible === next.visible && current.top === next.top && current.height === next.height && current.value === next.value ? current : next);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = viewport?.firstElementChild;
    if (!viewport || !content) return;

    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScrollbar);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(viewport);
    resizeObserver.observe(content);
    viewport.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [updateScrollbar]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || !scrollbar.visible) return;

    event.preventDefault();
    const target = event.target;
    const clickedThumb = target instanceof Element && target.closest(".clinic-standard-scrollbar-thumb") !== null;
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const maxThumbTop = Math.max(0, track.clientHeight - scrollbar.height);
    const targetTop = clickedThumb
      ? scrollbar.top
      : Math.max(0, Math.min(maxThumbTop, event.clientY - track.getBoundingClientRect().top - scrollbar.height / 2));
    if (!clickedThumb && maxThumbTop) viewport.scrollTop = targetTop / maxThumbTop * maxScroll;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startTop: targetTop };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport || !track) return;

    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const maxThumbTop = Math.max(0, track.clientHeight - scrollbar.height);
    if (!maxScroll || !maxThumbTop) return;
    const top = Math.max(0, Math.min(maxThumbTop, drag.startTop + event.clientY - drag.startY));
    viewport.scrollTop = top / maxThumbTop * maxScroll;
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const pageStep = Math.max(50, viewport.clientHeight * 0.8);
    const offsets: Record<string, number> = { ArrowDown: 50, ArrowUp: -50, PageDown: pageStep, PageUp: -pageStep };
    if (event.key in offsets) {
      event.preventDefault();
      viewport.scrollBy({ top: offsets[event.key] });
    } else if (event.key === "Home") {
      event.preventDefault();
      viewport.scrollTop = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      viewport.scrollTop = viewport.scrollHeight;
    }
  };

  return <div className={`clinic-standard-scroll-shell${shellClassName ? ` ${shellClassName}` : ""}`} data-sajilo-standard-scroll-shell="">
    <div id={scrollId} ref={viewportRef} className={`clinic-standard-scroll-viewport${viewportClassName ? ` ${viewportClassName}` : ""}`} data-sajilo-standard-scroll-viewport="">
      <div className={`clinic-standard-scroll-content${contentClassName ? ` ${contentClassName}` : ""}`} data-sajilo-standard-scroll-content="">{children}</div>
    </div>
    {scrollbar.visible && <div
      ref={trackRef}
      className="clinic-standard-scrollbar-track"
      role="scrollbar"
      aria-label={label}
      aria-controls={scrollId}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(scrollbar.value)}
      aria-valuetext={`${Math.round(scrollbar.value)}% scrolled`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span className="clinic-standard-scrollbar-thumb" style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }} />
    </div>}
  </div>;
}
