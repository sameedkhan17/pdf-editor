'use client';

import React, { useState, useEffect, useCallback, useRef, MouseEvent } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
    Crop,
    Download,
    RefreshCw,
    RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface CropSettings {
    startPage: number;
    endPage: number | null;
    applyToAll: boolean;
}

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PageImage {
    url: string;
    width: number;
    height: number;
    pageNum: number;
}

const defaultSettings: CropSettings = {
    startPage: 1,
    endPage: null,
    applyToAll: true,
};

const CropPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [settings, setSettings] = useState<CropSettings>(defaultSettings);
    const [pageCount, setPageCount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // All page images
    const [pageImages, setPageImages] = useState<PageImage[]>([]);

    // Crop box state (percentage-based relative to page)
    const [cropBox, setCropBox] = useState<CropBox>({ x: 10, y: 10, width: 80, height: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const firstPageRef = useRef<HTMLDivElement>(null);
    const pointerActiveRef = useRef<{ active: boolean; pointerId: number | null }>({ active: false, pointerId: null });
    const [pagesMounted, setPagesMounted] = useState(false);

    // Render all PDF pages to images
    const renderAllPages = useCallback(async (pdfFile: File) => {
        setIsLoading(true);
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;

            const images: PageImage[] = [];

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport,
                }).promise;

                images.push({
                    url: canvas.toDataURL('image/png'),
                    width: viewport.width,
                    height: viewport.height,
                    pageNum: i,
                });
            }

            setPageImages(images);
            setPagesMounted(false); // Reset, will be set true after render
            pdf.destroy();
        } catch (error) {
            console.error('Error rendering pages:', error);
            toast.error('Failed to render PDF pages');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initialize when file changes
    useEffect(() => {
        if (!file) {
            setPageImages([]);
            setPageCount(0);
            setCropBox({ x: 10, y: 10, width: 80, height: 80 });
            return;
        }

        const init = async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const count = pdf.getPageCount();
                setPageCount(count);
                setSettings(s => ({ ...s, endPage: count }));

                await renderAllPages(file);
            } catch (error) {
                console.error('Error loading PDF:', error);
                toast.error('Failed to load PDF');
            }
        };

        init();
    }, [file, renderAllPages]);

    const resetCrop = () => {
        setCropBox({ x: 10, y: 10, width: 80, height: 80 });
    };

    // Mouse handlers for crop selection
    const handleMouseDown = (e: MouseEvent, action: 'drag' | string, pageEl: HTMLElement) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = pageEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setDragStart({
            x,
            y,
            boxX: cropBox.x,
            boxY: cropBox.y,
            boxW: cropBox.width,
            boxH: cropBox.height,
        });

        if (action === 'drag') {
            setIsDragging(true);
        } else {
            setIsResizing(action);
        }
    };

    // Touch handlers for mobile
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, action: 'drag' | string) => {
        e.stopPropagation();
        if (pointerActiveRef.current.active) {
            return;
        }

        // Note: We rely on touch-action: none in CSS to prevent scrolling
        // e.preventDefault() is removed here as it causes issues with passive listeners

        const pageEl = document.querySelector('[data-crop-page]') as HTMLElement;
        if (!pageEl) {
            return;
        }

        const touch = e.touches[0];
        const rect = pageEl.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;

        setDragStart({
            x,
            y,
            boxX: cropBox.x,
            boxY: cropBox.y,
            boxW: cropBox.width,
            boxH: cropBox.height,
        });

        if (action === 'drag') {
            setIsDragging(true);
        } else {
            setIsResizing(action);
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, action: 'drag' | string) => {
        if (e.pointerType !== 'touch') return;
        e.stopPropagation();
        if (e.cancelable) {
            e.preventDefault();
        }

        pointerActiveRef.current = { active: true, pointerId: e.pointerId };

        const pageEl = (e.currentTarget as HTMLElement).closest('[data-crop-page]') as HTMLElement
            | null
            | undefined
            || firstPageRef.current;
        if (!pageEl) {
            return;
        }

        const rect = pageEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setDragStart({
            x,
            y,
            boxX: cropBox.x,
            boxY: cropBox.y,
            boxW: cropBox.width,
            boxH: cropBox.height,
        });

        if (action === 'drag') {
            setIsDragging(true);
        } else {
            setIsResizing(action);
        }

        const target = e.currentTarget as HTMLElement;
        if (target.setPointerCapture) {
            target.setPointerCapture(e.pointerId);
        }
    };

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (!isDragging && !isResizing) return;

        const pageEl = document.querySelector('[data-crop-page]') as HTMLElement;
        if (!pageEl) return;

        const rect = pageEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        if (isDragging) {
            let newX = dragStart.boxX + deltaX;
            let newY = dragStart.boxY + deltaY;

            // Constrain to bounds
            newX = Math.max(0, Math.min(100 - cropBox.width, newX));
            newY = Math.max(0, Math.min(100 - cropBox.height, newY));

            setCropBox(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            let newBox = { ...cropBox };

            switch (isResizing) {
                case 'nw':
                    newBox.width = dragStart.boxW - deltaX;
                    newBox.height = dragStart.boxH - deltaY;
                    newBox.x = dragStart.boxX + deltaX;
                    newBox.y = dragStart.boxY + deltaY;
                    break;
                case 'ne':
                    newBox.width = dragStart.boxW + deltaX;
                    newBox.height = dragStart.boxH - deltaY;
                    newBox.y = dragStart.boxY + deltaY;
                    break;
                case 'sw':
                    newBox.width = dragStart.boxW - deltaX;
                    newBox.height = dragStart.boxH + deltaY;
                    newBox.x = dragStart.boxX + deltaX;
                    break;
                case 'se':
                    newBox.width = dragStart.boxW + deltaX;
                    newBox.height = dragStart.boxH + deltaY;
                    break;
                case 'n':
                    newBox.height = dragStart.boxH - deltaY;
                    newBox.y = dragStart.boxY + deltaY;
                    break;
                case 's':
                    newBox.height = dragStart.boxH + deltaY;
                    break;
                case 'w':
                    newBox.width = dragStart.boxW - deltaX;
                    newBox.x = dragStart.boxX + deltaX;
                    break;
                case 'e':
                    newBox.width = dragStart.boxW + deltaX;
                    break;
            }

            // Enforce minimum size and bounds
            newBox.width = Math.max(5, Math.min(100, newBox.width));
            newBox.height = Math.max(5, Math.min(100, newBox.height));
            newBox.x = Math.max(0, Math.min(100 - newBox.width, newBox.x));
            newBox.y = Math.max(0, Math.min(100 - newBox.height, newBox.y));

            setCropBox(newBox);
        }
    }, [isDragging, isResizing, dragStart, cropBox]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(null);
    }, []);

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement> | TouchEvent) => {
        if (pointerActiveRef.current.active) {
            return;
        }
        if (!isDragging && !isResizing) {
            return;
        }

        // Note: touch-action: none handles scroll prevention

        const touch = e.touches[0];
        const pageEl = document.querySelector('[data-crop-page]') as HTMLElement;
        if (!pageEl) {
            return;
        }

        const rect = pageEl.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;

        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        if (isDragging) {
            setCropBox(prev => {
                let newX = dragStart.boxX + deltaX;
                let newY = dragStart.boxY + deltaY;
                // Use dragStart values for constraints to avoid stale closure
                newX = Math.max(0, Math.min(100 - dragStart.boxW, newX));
                newY = Math.max(0, Math.min(100 - dragStart.boxH, newY));
                return { ...prev, x: newX, y: newY };
            });
        } else if (isResizing) {
            setCropBox(() => {
                let newBox = { x: dragStart.boxX, y: dragStart.boxY, width: dragStart.boxW, height: dragStart.boxH };
                switch (isResizing) {
                    case 'nw':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.x = dragStart.boxX + deltaX;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 'ne':
                        newBox.width = dragStart.boxW + deltaX;
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 'sw':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.height = dragStart.boxH + deltaY;
                        newBox.x = dragStart.boxX + deltaX;
                        break;
                    case 'se':
                        newBox.width = dragStart.boxW + deltaX;
                        newBox.height = dragStart.boxH + deltaY;
                        break;
                    case 'n':
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 's':
                        newBox.height = dragStart.boxH + deltaY;
                        break;
                    case 'w':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.x = dragStart.boxX + deltaX;
                        break;
                    case 'e':
                        newBox.width = dragStart.boxW + deltaX;
                        break;
                }
                newBox.width = Math.max(5, Math.min(100, newBox.width));
                newBox.height = Math.max(5, Math.min(100, newBox.height));
                newBox.x = Math.max(0, Math.min(100 - newBox.width, newBox.x));
                newBox.y = Math.max(0, Math.min(100 - newBox.height, newBox.y));
                return newBox;
            });
        }
    };

    const handlePointerMove = useCallback((e: PointerEvent) => {
        if (!isDragging && !isResizing) return;
        if (e.pointerType !== 'touch') return;
        if (!pointerActiveRef.current.active || pointerActiveRef.current.pointerId !== e.pointerId) return;

        const pageEl = firstPageRef.current ?? document.querySelector('[data-crop-page]') as HTMLElement | null;
        if (!pageEl) {
            return;
        }

        const rect = pageEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        if (isDragging) {
            setCropBox(prev => {
                let newX = dragStart.boxX + deltaX;
                let newY = dragStart.boxY + deltaY;
                newX = Math.max(0, Math.min(100 - dragStart.boxW, newX));
                newY = Math.max(0, Math.min(100 - dragStart.boxH, newY));
                return { ...prev, x: newX, y: newY };
            });
        } else if (isResizing) {
            setCropBox(() => {
                let newBox = { x: dragStart.boxX, y: dragStart.boxY, width: dragStart.boxW, height: dragStart.boxH };
                switch (isResizing) {
                    case 'nw':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.x = dragStart.boxX + deltaX;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 'ne':
                        newBox.width = dragStart.boxW + deltaX;
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 'sw':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.height = dragStart.boxH + deltaY;
                        newBox.x = dragStart.boxX + deltaX;
                        break;
                    case 'se':
                        newBox.width = dragStart.boxW + deltaX;
                        newBox.height = dragStart.boxH + deltaY;
                        break;
                    case 'n':
                        newBox.height = dragStart.boxH - deltaY;
                        newBox.y = dragStart.boxY + deltaY;
                        break;
                    case 's':
                        newBox.height = dragStart.boxH + deltaY;
                        break;
                    case 'w':
                        newBox.width = dragStart.boxW - deltaX;
                        newBox.x = dragStart.boxX + deltaX;
                        break;
                    case 'e':
                        newBox.width = dragStart.boxW + deltaX;
                        break;
                }
                newBox.width = Math.max(5, Math.min(100, newBox.width));
                newBox.height = Math.max(5, Math.min(100, newBox.height));
                newBox.x = Math.max(0, Math.min(100 - newBox.width, newBox.x));
                newBox.y = Math.max(0, Math.min(100 - newBox.height, newBox.y));
                return newBox;
            });
        }
    }, [isDragging, isResizing, dragStart]);

    const handleTouchEnd = () => {
        if (pointerActiveRef.current.active) {
            return;
        }
        setIsDragging(false);
        setIsResizing(null);
    };



    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    useEffect(() => {
        const handleWindowTouchMove = (e: TouchEvent) => {
            if (!isDragging && !isResizing) return;
            if (e.cancelable) {
                e.preventDefault();
            }
            handleTouchMove(e);
        };

        const handleWindowTouchEnd = () => {
            if (!isDragging && !isResizing) return;
            handleTouchEnd();
        };

        window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
        window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchmove', handleWindowTouchMove);
            window.removeEventListener('touchend', handleWindowTouchEnd);
            window.removeEventListener('touchcancel', handleWindowTouchEnd);
        };
    }, [isDragging, isResizing]);



    useEffect(() => {
        const handleWindowPointerMove = (e: PointerEvent) => {
            if (!isDragging && !isResizing) return;
            if (e.pointerType !== 'touch') return;
            if (!pointerActiveRef.current.active || pointerActiveRef.current.pointerId !== e.pointerId) return;
            if (e.cancelable) {
                e.preventDefault();
            }
            handlePointerMove(e);
        };

        const handleWindowPointerUp = (e: PointerEvent) => {
            if (!isDragging && !isResizing) return;
            if (e.pointerType !== 'touch') return;
            if (!pointerActiveRef.current.active || pointerActiveRef.current.pointerId !== e.pointerId) return;
            pointerActiveRef.current = { active: false, pointerId: null };
            handleTouchEnd();
        };

        window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
        window.addEventListener('pointerup', handleWindowPointerUp, { passive: true });
        window.addEventListener('pointercancel', handleWindowPointerUp, { passive: true });

        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener('pointercancel', handleWindowPointerUp);
        };
    }, [isDragging, isResizing, handlePointerMove]);

    const handleDownload = async () => {
        if (!file) {
            toast.error('No file selected');
            return;
        }

        setIsProcessing(true);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();

            const startIdx = Math.max(0, settings.startPage - 1);
            const endIdx = settings.endPage
                ? Math.min(pages.length - 1, settings.endPage - 1)
                : pages.length - 1;

            for (let i = startIdx; i <= endIdx; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Convert percentage to PDF points
                const cropX = (cropBox.x / 100) * width;
                const cropY = (cropBox.y / 100) * height;
                const cropWidth = (cropBox.width / 100) * width;
                const cropHeight = (cropBox.height / 100) * height;

                // PDF coordinate system: origin is bottom-left, flip Y
                const pdfY = height - cropY - cropHeight;

                page.setCropBox(cropX, pdfY, cropWidth, cropHeight);
                page.setMediaBox(cropX, pdfY, cropWidth, cropHeight);
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cropped_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(`Cropped ${endIdx - startIdx + 1} page(s) successfully!`);
        } catch (error) {
            console.error('Error cropping PDF:', error);
            toast.error('Failed to crop PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    // Crop overlay component for each page
    const CropOverlay = () => {
        const pageEl = firstPageRef.current;
        if (!pageEl) return null;

        return (
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 10 }}
            >
                {/* Dimmed areas outside crop */}
                <div className="absolute bg-black/60" style={{ top: 0, left: 0, right: 0, height: `${cropBox.y}%` }} />
                <div className="absolute bg-black/60" style={{ bottom: 0, left: 0, right: 0, top: `${cropBox.y + cropBox.height}%` }} />
                <div className="absolute bg-black/60" style={{ top: `${cropBox.y}%`, left: 0, width: `${cropBox.x}%`, height: `${cropBox.height}%` }} />
                <div className="absolute bg-black/60" style={{ top: `${cropBox.y}%`, right: 0, left: `${cropBox.x + cropBox.width}%`, height: `${cropBox.height}%` }} />

                {/* Crop box */}
                <div
                    className="absolute border-2 border-primary pointer-events-auto cursor-move select-none"
                    style={{
                        left: `${cropBox.x}%`,
                        top: `${cropBox.y}%`,
                        width: `${cropBox.width}%`,
                        height: `${cropBox.height}%`,
                        touchAction: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'drag', pageEl)}
                    onTouchStart={(e) => handleTouchStart(e, 'drag')}
                    onPointerDown={(e) => handlePointerDown(e, 'drag')}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        {[...Array(4)].map((_, i) => (
                            <div key={`v-${i}`} className="absolute top-0 bottom-0 w-px bg-primary/30" style={{ left: `${(i + 1) * 25}%` }} />
                        ))}
                        {[...Array(4)].map((_, i) => (
                            <div key={`h-${i}`} className="absolute left-0 right-0 h-px bg-primary/30" style={{ top: `${(i + 1) * 25}%` }} />
                        ))}
                    </div>

                    {/* Corner handles - larger touch targets for mobile */}
                    <div className="absolute -top-4 -left-4 w-8 h-8 md:-top-3 md:-left-3 md:w-6 md:h-6 bg-primary border-2 border-white rounded-sm cursor-nw-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'nw', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'nw')} onPointerDown={(e) => handlePointerDown(e, 'nw')} />
                    <div className="absolute -top-4 -right-4 w-8 h-8 md:-top-3 md:-right-3 md:w-6 md:h-6 bg-primary border-2 border-white rounded-sm cursor-ne-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'ne', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'ne')} onPointerDown={(e) => handlePointerDown(e, 'ne')} />
                    <div className="absolute -bottom-4 -left-4 w-8 h-8 md:-bottom-3 md:-left-3 md:w-6 md:h-6 bg-primary border-2 border-white rounded-sm cursor-sw-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'sw', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'sw')} onPointerDown={(e) => handlePointerDown(e, 'sw')} />
                    <div className="absolute -bottom-4 -right-4 w-8 h-8 md:-bottom-3 md:-right-3 md:w-6 md:h-6 bg-primary border-2 border-white rounded-sm cursor-se-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'se', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'se')} onPointerDown={(e) => handlePointerDown(e, 'se')} />

                    {/* Edge handles - larger touch targets for mobile */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 md:-top-2 md:w-10 md:h-4 bg-primary border-2 border-white rounded-sm cursor-n-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'n', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'n')} onPointerDown={(e) => handlePointerDown(e, 'n')} />
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-6 md:-bottom-2 md:w-10 md:h-4 bg-primary border-2 border-white rounded-sm cursor-s-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 's', pageEl)} onTouchStart={(e) => handleTouchStart(e, 's')} onPointerDown={(e) => handlePointerDown(e, 's')} />
                    <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 md:-left-2 md:w-4 md:h-10 bg-primary border-2 border-white rounded-sm cursor-w-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'w', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'w')} onPointerDown={(e) => handlePointerDown(e, 'w')} />
                    <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 md:-right-2 md:w-4 md:h-10 bg-primary border-2 border-white rounded-sm cursor-e-resize select-none" style={{ touchAction: 'none' }} onMouseDown={(e) => handleMouseDown(e, 'e', pageEl)} onTouchStart={(e) => handleTouchStart(e, 'e')} onPointerDown={(e) => handlePointerDown(e, 'e')} />
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Centered Header - Always visible */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">Crop PDF</h1>
                <p className="text-gray-400 text-lg">
                    Visually crop your PDF pages.
                </p>
            </div>

            {!file ? (
                <FileUploader
                    onFilesSelected={(files) => files.length && setFile(files[0])}
                    maxFiles={1}
                    className="min-h-[400px] flex items-center justify-center max-w-4xl mx-auto"
                />
            ) : (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30 shadow-xl shadow-black/20">
                        <span className="text-sm text-gray-400">
                            Editing: <strong className="text-white">{file.name}</strong>
                        </span>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setFile(null); setSettings(defaultSettings); resetCrop(); }}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Change File
                            </Button>
                            <Button onClick={handleDownload} disabled={isProcessing}>
                                {isProcessing ? 'Processing...' : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" /> Download PDF
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse lg:flex-row gap-4 lg:gap-6">
                        {/* Settings Sidebar - Compact on mobile, full on desktop */}
                        <div className="w-full lg:w-72 shrink-0 lg:overflow-y-auto space-y-3 lg:space-y-4 max-h-[200px] lg:max-h-none overflow-y-auto">
                            {/* Mobile: Compact layout with all controls */}
                            <div className="lg:hidden space-y-3">
                                {/* Crop Info Row */}
                                <div className="bg-card p-3 rounded-xl border border-border">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-gray-500">Crop: <strong className="text-white">{cropBox.width.toFixed(0)}% × {cropBox.height.toFixed(0)}%</strong></span>
                                        </div>
                                        <button
                                            onClick={resetCrop}
                                            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-xs flex items-center gap-1"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                    </div>
                                </div>

                                {/* Apply Crop To - Mobile */}
                                <div className="bg-card p-3 rounded-xl border border-border">
                                    <label className="text-xs font-medium text-gray-400 mb-2 block">Apply Crop To</label>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.applyToAll}
                                                onChange={(e) => setSettings(s => ({
                                                    ...s,
                                                    applyToAll: e.target.checked,
                                                    startPage: e.target.checked ? 1 : 1,
                                                    endPage: e.target.checked ? pageCount : 1
                                                }))}
                                                className="rounded border-gray-600 bg-secondary text-primary focus:ring-primary w-3 h-3"
                                            />
                                            All ({pageCount})
                                        </label>
                                        {!settings.applyToAll && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={pageCount}
                                                    value={settings.startPage}
                                                    onChange={(e) => setSettings(s => ({ ...s, startPage: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                    className="w-12 bg-secondary border border-border rounded p-1 text-xs text-center"
                                                />
                                                <span className="text-gray-500">to</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={pageCount}
                                                    value={settings.endPage ?? pageCount}
                                                    onChange={(e) => setSettings(s => ({ ...s, endPage: Math.min(pageCount, parseInt(e.target.value) || pageCount) }))}
                                                    className="w-12 bg-secondary border border-border rounded p-1 text-xs text-center"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Desktop: Full sidebar */}
                            <div className="hidden lg:block space-y-4">
                                {/* Crop Info */}
                                <div className="bg-card p-4 rounded-xl border border-border">
                                    <label className="text-sm font-medium text-gray-400 mb-3 block border-b border-gray-700 pb-2">
                                        Crop Selection
                                    </label>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-secondary/50 p-2 rounded">
                                            <span className="text-gray-500 text-xs">X</span>
                                            <p className="font-medium">{cropBox.x.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-secondary/50 p-2 rounded">
                                            <span className="text-gray-500 text-xs">Y</span>
                                            <p className="font-medium">{cropBox.y.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-secondary/50 p-2 rounded">
                                            <span className="text-gray-500 text-xs">Width</span>
                                            <p className="font-medium">{cropBox.width.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-secondary/50 p-2 rounded">
                                            <span className="text-gray-500 text-xs">Height</span>
                                            <p className="font-medium">{cropBox.height.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={resetCrop}
                                        className="w-full mt-3 p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Reset Selection
                                    </button>
                                </div>

                                {/* Apply To Pages */}
                                <div className="bg-card p-4 rounded-xl border border-border">
                                    <label className="text-sm font-medium text-gray-400 mb-3 block border-b border-gray-700 pb-2">
                                        Apply Crop To
                                    </label>
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.applyToAll}
                                                onChange={(e) => setSettings(s => ({
                                                    ...s,
                                                    applyToAll: e.target.checked,
                                                    startPage: e.target.checked ? 1 : 1,
                                                    endPage: e.target.checked ? pageCount : 1
                                                }))}
                                                className="rounded border-gray-600 bg-secondary text-primary focus:ring-primary w-4 h-4"
                                            />
                                            All Pages ({pageCount})
                                        </label>

                                        {!settings.applyToAll && (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-xs text-gray-500 mb-1 block">From</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={pageCount}
                                                        value={settings.startPage}
                                                        onChange={(e) => setSettings(s => ({ ...s, startPage: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                        className="w-full bg-secondary border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs text-gray-500 mb-1 block">To</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={pageCount}
                                                        value={settings.endPage ?? pageCount}
                                                        onChange={(e) => setSettings(s => ({ ...s, endPage: Math.min(pageCount, parseInt(e.target.value) || pageCount) }))}
                                                        className="w-full bg-secondary border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="bg-card/50 p-4 rounded-xl border border-border/50">
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        <strong className="text-gray-400">Instructions:</strong><br />
                                        • Drag the selection box to reposition<br />
                                        • Use corner handles to resize freely<br />
                                        • Use edge handles to adjust individual sides<br />
                                        • Scroll to see all pages with crop preview
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Pages View - Scrollable - Takes priority on mobile */}
                        <div ref={containerRef} className="flex-1 overflow-y-auto min-h-[300px] lg:min-h-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-6">
                                    {pageImages.map((pageImg, index) => (
                                        <div key={pageImg.pageNum} className="flex flex-col items-center">
                                            <div className="text-xs text-gray-500 mb-2">Page {pageImg.pageNum} of {pageCount}</div>
                                            <div
                                                ref={index === 0 ? firstPageRef : undefined}
                                                data-crop-page={pageImg.pageNum}
                                                className="relative bg-white shadow-xl rounded-lg overflow-visible"
                                                style={{
                                                    maxWidth: '500px',
                                                    width: '100%',
                                                }}
                                            >
                                                <img
                                                    src={pageImg.url}
                                                    alt={`Page ${pageImg.pageNum}`}
                                                    className="w-full h-auto block"
                                                    draggable={false}
                                                    onLoad={() => {
                                                        if (index === 0) {
                                                            setPagesMounted(true);
                                                        }
                                                    }}
                                                />
                                                {index === 0 && pagesMounted && (
                                                    <CropOverlay />
                                                )}
                                                {index > 0 && (
                                                    <div
                                                        className="absolute pointer-events-none"
                                                        style={{
                                                            left: `${cropBox.x}%`,
                                                            top: `${cropBox.y}%`,
                                                            width: `${cropBox.width}%`,
                                                            height: `${cropBox.height}%`,
                                                            border: '2px dashed rgba(239, 68, 68, 0.6)',
                                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CropPDFPage;
