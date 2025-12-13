'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument, rgb, degrees, StandardFonts, grayscale, BlendMode, PDFArray, PDFName } from 'pdf-lib';
import {
    Stamp,
    Download,
    Type,
    Image as ImageIcon,
    RotateCw,
    Move,
    LayoutGrid,
    RefreshCw
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-700 animate-pulse rounded" />
});

type WatermarkType = 'text' | 'image';
type Position = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br';

interface WatermarkSettings {
    type: WatermarkType;
    text: string;
    textSize: number;
    textColor: string;
    opacity: number;
    rotation: number;
    position: Position;
    imageFile: File | null;
    imageScale: number;
    isTiled: boolean;
    startPage: number;
    endPage: number | null;
    layer: 'over' | 'under';
}

const defaultSettings: WatermarkSettings = {
    type: 'text',
    text: 'CONFIDENTIAL',
    textSize: 48,
    textColor: '#FF0000',
    opacity: 0.5,
    rotation: -45,
    position: 'cc',
    imageFile: null,
    imageScale: 0.5,
    isTiled: false,
    startPage: 1,
    endPage: null,
    layer: 'over',
};

const WatermarkPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [settings, setSettings] = useState<WatermarkSettings>(defaultSettings);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Apply watermark to creating a preview or final download
    const applyWatermark = useCallback(async (originalFile: File, currentSettings: WatermarkSettings, isPreview: boolean = false): Promise<Uint8Array | null> => {
        try {
            const arrayBuffer = await originalFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();

            const startIdx = Math.max(0, (currentSettings.startPage ?? 1) - 1);
            const endIdx = currentSettings.endPage
                ? Math.min(pages.length - 1, currentSettings.endPage - 1)
                : pages.length - 1;

            // Generate set of target indices
            const targetIndices = new Set<number>();
            if (endIdx >= startIdx) {
                for (let i = startIdx; i <= endIdx; i++) targetIndices.add(i);
            }

            // Filter pages: if preview, show first page; otherwise only target pages
            // If preview, we ALWAYS show the effect on the first page so user sees what it looks like
            const pagesToProcess = isPreview ? [pages[0]] : pages.filter((_, i) => targetIndices.has(i));

            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            // If we are doing 'under' via stream manipulation, we rely on Normal blend mode (opaque over transparent bg)
            // But if we fail to manipulate stream, Multiply is a fallback.
            // If layer is 'under', we try to put stream at start.

            const blendMode = BlendMode.Normal;

            // Prepare Image (skip if preview to avoid lag)
            let embeddedImage = null;
            if (currentSettings.type === 'image' && currentSettings.imageFile && !isPreview) {
                const imageBytes = await currentSettings.imageFile.arrayBuffer();
                const fileType = currentSettings.imageFile.type;
                try {
                    if (fileType === 'image/png') {
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } else {
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    }
                } catch (firstError) {
                    try {
                        if (fileType === 'image/png') embeddedImage = await pdfDoc.embedJpg(imageBytes);
                        else embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } catch (e) {
                        console.error('Image embed failed', e);
                    }
                }
            }

            for (const page of pagesToProcess) {
                const { width, height } = page.getSize();

                if (currentSettings.type === 'text') {
                    const hex = currentSettings.textColor.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;

                    const textWidth = helveticaFont.widthOfTextAtSize(currentSettings.text, currentSettings.textSize);
                    const textHeight = helveticaFont.heightAtSize(currentSettings.textSize);

                    const drawTextAt = (x: number, y: number) => {
                        page.drawText(currentSettings.text, {
                            x,
                            y,
                            size: currentSettings.textSize,
                            font: helveticaFont,
                            color: rgb(r, g, b),
                            opacity: currentSettings.opacity,
                            rotate: degrees(currentSettings.rotation),
                            blendMode,
                        });
                    };

                    if (currentSettings.isTiled) {
                        for (let ix = 0; ix < 3; ix++) {
                            for (let iy = 0; iy < 3; iy++) {
                                // Centers: 1/6, 3/6, 5/6
                                const cx = width * ((ix * 2 + 1) / 6);
                                const cy = height * ((iy * 2 + 1) / 6);
                                drawTextAt(cx - textWidth / 2, cy - textHeight / 3);
                            }
                        }
                    } else {
                        let x = (width - textWidth) / 2;
                        let y = (height - textHeight) / 2;

                        const margin = 20;
                        if (currentSettings.position.includes('l')) x = margin;
                        if (currentSettings.position.includes('r')) x = width - textWidth - margin;
                        if (currentSettings.position.includes('t')) y = height - textHeight - margin;
                        if (currentSettings.position.includes('b')) y = margin;

                        drawTextAt(x, y);
                    }

                } else if (currentSettings.type === 'image') {
                    // Decide if we use placeholder or real image
                    let imgW = 0, imgH = 0;

                    if (isPreview) {
                        // PLACEHOLDER MODE
                        // Assume a default ratio or square?
                        // Let's us a standard 200x100 box scaled
                        imgW = 200 * currentSettings.imageScale;
                        imgH = 100 * currentSettings.imageScale;

                        const drawPlaceholder = (x: number, y: number) => {
                            page.drawRectangle({
                                x, y, width: imgW, height: imgH,
                                color: rgb(0.9, 0.9, 0.9),
                                borderColor: rgb(0.6, 0.6, 0.6),
                                borderWidth: 1,
                                opacity: currentSettings.opacity,
                                rotate: degrees(currentSettings.rotation),
                                blendMode,
                            });
                            page.drawText('IMAGE', {
                                x: x + imgW / 2 - 20,
                                y: y + imgH / 2 - 5,
                                size: 12,
                                font: helveticaFont,
                                color: rgb(0.5, 0.5, 0.5),
                                rotate: degrees(currentSettings.rotation),
                                blendMode,
                            });
                        };

                        if (currentSettings.isTiled) {
                            for (let ix = 0; ix < 3; ix++) {
                                for (let iy = 0; iy < 3; iy++) {
                                    const cx = width * ((ix * 2 + 1) / 6);
                                    const cy = height * ((iy * 2 + 1) / 6);
                                    drawPlaceholder(cx - imgW / 2, cy - imgH / 2);
                                }
                            }
                        } else {
                            let x = (width - imgW) / 2;
                            let y = (height - imgH) / 2;
                            const margin = 20;
                            if (currentSettings.position.includes('l')) x = margin;
                            if (currentSettings.position.includes('r')) x = width - imgW - margin;
                            if (currentSettings.position.includes('t')) y = height - imgH - margin;
                            if (currentSettings.position.includes('b')) y = margin;
                            drawPlaceholder(x, y);
                        }

                    } else if (embeddedImage) {
                        // REAL IMAGE MODE
                        const dims = embeddedImage.scale(currentSettings.imageScale);
                        imgW = dims.width;
                        imgH = dims.height;

                        const drawImageAt = (x: number, y: number) => {
                            page.drawImage(embeddedImage!, {
                                x, y, width: imgW, height: imgH,
                                opacity: currentSettings.opacity,
                                rotate: degrees(currentSettings.rotation),
                                blendMode,
                            });
                        };

                        if (currentSettings.isTiled) {
                            for (let ix = 0; ix < 3; ix++) {
                                for (let iy = 0; iy < 3; iy++) {
                                    const cx = width * ((ix * 2 + 1) / 6);
                                    const cy = height * ((iy * 2 + 1) / 6);
                                    drawImageAt(cx - imgW / 2, cy - imgH / 2);
                                }
                            }
                        } else {
                            let x = (width - imgW) / 2;
                            let y = (height - imgH) / 2;
                            const margin = 20;
                            if (currentSettings.position.includes('l')) x = margin;
                            if (currentSettings.position.includes('r')) x = width - imgW - margin;
                            if (currentSettings.position.includes('t')) y = height - imgH - margin;
                            if (currentSettings.position.includes('b')) y = margin;
                            drawImageAt(x, y);
                        }
                    }
                }

                // HANDLE LAYERING 'UNDER' (Move watermark stream to front)
                if (currentSettings.layer === 'under') {
                    // The last operation added a new content stream. We want to move it to index 0 of Contents array.
                    // Access internal dict
                    try {
                        const contents = page.node.Contents();
                        if (contents instanceof PDFArray) {
                            const lastIdx = contents.size() - 1;
                            if (lastIdx > 0) {
                                const lastStream = contents.get(lastIdx);
                                contents.remove(lastIdx);
                                contents.insert(0, lastStream);
                            }
                        } else {
                            // If it's a single stream, we can't easily put "under" unless we had multiple.
                            // But usually adding text on existing PDF converts Contents to array [Old, New].
                            // If it's still a stream, it means it's the ONLY stream (e.g. blank page).
                            // In that case, order doesn't matter.
                        }
                    } catch (e) {
                        console.warn('Could not reorder streams for Under layer', e);
                    }
                }
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Watermark error:', error);
            return null;
        }
    }, [toast]);

    // Effect for generating preview
    useEffect(() => {
        if (!file) {
            setPreviewFile(null);
            return;
        }

        const timeoutId = setTimeout(async () => {
            if (settings.type === 'image' && !settings.imageFile) {
                // If image mode but no image, just show original
                setPreviewFile(file);
                return;
            }

            const pdfBytes = await applyWatermark(file, settings, true);
            if (pdfBytes) {
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const newPreviewFile = new File([blob], 'preview.pdf', { type: 'application/pdf' });
                setPreviewFile(newPreviewFile);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [file, settings, applyWatermark]);

    // Initialize settings when file changes
    useEffect(() => {
        if (file) {
            file.arrayBuffer().then(ab => PDFDocument.load(ab)).then(doc => {
                setSettings(s => ({ ...s, endPage: doc.getPageCount() }));
            }).catch(console.error);
        }
    }, [file]);

    const handleDownload = async () => {
        if (!file) return;
        setIsProcessing(true);

        try {
            const pdfBytes = await applyWatermark(file, settings, false);
            if (pdfBytes) {
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `watermarked_${file.name}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('Watermark added successfully!');
            } else {
                toast.error('Failed to create PDF');
            }
        } catch (e) {
            toast.error('Error processing PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    const PositionGrid = () => (
        <div className="grid grid-cols-3 gap-2 w-32">
            {['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'].map((pos) => (
                <button
                    key={pos}
                    onClick={() => setSettings(s => ({ ...s, position: pos as Position, isTiled: false }))}
                    className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${settings.position === pos && !settings.isTiled
                        ? 'bg-primary border-primary text-white'
                        : 'bg-card border-border hover:border-gray-500'
                        }`}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                </button>
            ))}
        </div>
    );

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Centered Header - Always visible */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">Watermark PDF</h1>
                <p className="text-gray-400 text-lg">
                    Add text or image watermarks to your documents.
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
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 sticky top-20 z-10 shadow-xl shadow-black/20">
                        <span className="text-sm text-gray-400">
                            Editing: <strong className="text-white">{file.name}</strong>
                        </span>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setFile(null); setSettings(defaultSettings); }}>
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

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Settings Sidebar */}
                        <div className="w-full lg:w-80 shrink-0 space-y-6">

                            {/* Type Selection */}
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <label className="text-sm font-medium text-gray-400 mb-3 block">Watermark Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setSettings(s => ({ ...s, type: 'text' }))}
                                        className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${settings.type === 'text'
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-secondary border-transparent hover:bg-secondary/80'
                                            }`}
                                    >
                                        <Type className="w-4 h-4" /> Text
                                    </button>
                                    <button
                                        onClick={() => setSettings(s => ({ ...s, type: 'image' }))}
                                        className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${settings.type === 'image'
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-secondary border-transparent hover:bg-secondary/80'
                                            }`}
                                    >
                                        <ImageIcon className="w-4 h-4" /> Image
                                    </button>
                                </div>
                            </div>

                            {/* Content Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                                {settings.type === 'text' ? (
                                    <div key="text-settings">
                                        <label className="text-sm font-medium text-gray-400 mb-2 block">Text</label>
                                        <input
                                            key="text-input"
                                            type="text"
                                            value={settings.text ?? ''}
                                            onChange={(e) => setSettings(s => ({ ...s, text: e.target.value }))}
                                            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                ) : (
                                    <div key="image-settings">
                                        <label className="text-sm font-medium text-gray-400 mb-2 block">Upload Image</label>
                                        <input
                                            key="image-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setSettings(s => ({ ...s, imageFile: e.target.files![0] }));
                                                }
                                            }}
                                            className="w-full text-sm text-gray-400
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-lg file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-primary file:text-white
                                                hover:file:bg-primary-hover"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Appearance Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                                <label className="text-sm font-medium text-gray-400 block border-b border-gray-700 pb-2">Appearance</label>

                                {settings.type === 'text' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 mb-1 block">Size</label>
                                                <input
                                                    type="number"
                                                    value={settings.textSize ?? 48}
                                                    onChange={(e) => setSettings(s => ({ ...s, textSize: Number(e.target.value) }))}
                                                    className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 mb-1 block">Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.textColor ?? '#FF0000'}
                                                        onChange={(e) => setSettings(s => ({ ...s, textColor: e.target.value }))}
                                                        className="h-9 w-full bg-transparent cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {settings.type === 'image' && (
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Scale ({settings.imageScale}x)</label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="2"
                                            step="0.1"
                                            value={settings.imageScale ?? 0.5}
                                            onChange={(e) => setSettings(s => ({ ...s, imageScale: Number(e.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Opacity ({Math.round((settings.opacity ?? 0.5) * 100)}%)</label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.1"
                                        value={settings.opacity ?? 0.5}
                                        onChange={(e) => setSettings(s => ({ ...s, opacity: Number(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block flex items-center gap-2">
                                        <RotateCw className="w-3 h-3" /> Rotation ({settings.rotation ?? 0}°)
                                    </label>
                                    <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="15"
                                        value={settings.rotation ?? 0}
                                        onChange={(e) => setSettings(s => ({ ...s, rotation: Number(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            {/* Position Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <label className="text-sm font-medium text-gray-400 mb-3 block border-b border-gray-700 pb-2">Position</label>

                                <div className="flex items-start gap-4">
                                    <PositionGrid />
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.isTiled ?? false}
                                                onChange={(e) => setSettings(s => ({ ...s, isTiled: e.target.checked }))}
                                                className="rounded border-gray-600 bg-secondary text-primary focus:ring-primary"
                                            />
                                            <LayoutGrid className="w-4 h-4" /> Tile
                                        </label>
                                        <p className="text-xs text-gray-500">
                                            {settings.isTiled ? 'Repeats across page' : 'Fixed position'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Layout & Pages */}
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <label className="text-sm font-medium text-gray-400 mb-3 block border-b border-gray-700 pb-2">Layout & Pages</label>

                                <div className="space-y-4">
                                    {/* Layer Selection */}
                                    <div>
                                        <label className="text-xs text-gray-500 mb-2 block">Layer</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setSettings(s => ({ ...s, layer: 'over' }))}
                                                className={`px-3 py-2 rounded text-xs font-medium border transition-all ${settings.layer === 'over'
                                                    ? 'bg-primary border-primary text-white'
                                                    : 'bg-secondary border-border hover:border-gray-500 text-gray-400'
                                                    }`}
                                            >
                                                Over Content
                                            </button>
                                            <button
                                                onClick={() => setSettings(s => ({ ...s, layer: 'under' }))}
                                                className={`px-3 py-2 rounded text-xs font-medium border transition-all ${settings.layer === 'under'
                                                    ? 'bg-primary border-primary text-white'
                                                    : 'bg-secondary border-border hover:border-gray-500 text-gray-400'
                                                    }`}
                                            >
                                                Below Content
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">"Below" will attempt to place watermark behind content (experimental).</p>
                                    </div>

                                    {/* Page Range */}
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Pages</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-400 mb-1 block">From</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={settings.startPage ?? 1}
                                                    onChange={(e) => setSettings(s => ({ ...s, startPage: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                    className="w-full bg-secondary border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-400 mb-1 block">To</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={settings.endPage ?? ''}
                                                    placeholder="End"
                                                    onChange={(e) => setSettings(s => ({ ...s, endPage: e.target.value ? parseInt(e.target.value) : null }))}
                                                    className="w-full bg-secondary border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Preview Area */}
                        <div className="flex-1 bg-secondary/30 rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center overflow-hidden relative min-h-[500px]">
                            <div className="absolute top-4 left-4 text-xs font-mono text-gray-500 bg-black/50 px-2 py-1 rounded">PREVIEW (Page 1)</div>
                            {previewFile ? (
                                <div className="shadow-2xl h-full max-h-[800px] aspect-[1/1.414]">
                                    <PDFThumbnail
                                        file={previewFile}
                                        pageIndex={0}
                                        width={600}
                                        className="h-full w-full object-contain bg-white rounded-lg"
                                    />
                                </div>
                            ) : (
                                <div className="animate-pulse bg-gray-800 rounded-lg w-[400px] h-[560px]" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WatermarkPDFPage;
