'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
    Hash,
    Download,
    RefreshCw,
    AlignVerticalSpaceAround,
    Type
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-700 animate-pulse rounded" />
});

type Position = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
type Format = 'n' | 'n of total' | 'Page n' | 'Page n of total';

interface PageNumberSettings {
    position: Position;
    format: Format;
    startFrom: number;
    fromPage: number;
    toPage: number | null;
    fontSize: number;
    margin: number;
    color: string;
}

const defaultSettings: PageNumberSettings = {
    position: 'bc',
    format: 'n',
    startFrom: 1,
    fromPage: 1,
    toPage: null,
    fontSize: 12,
    margin: 20,
    color: '#000000'
};

const PageNumbersPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [settings, setSettings] = useState<PageNumberSettings>(defaultSettings);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Initial file load to get page count
    useEffect(() => {
        if (!file) {
            setTotalPages(0);
            return;
        }

        const loadDoc = async () => {
            try {
                const buffer = await file.arrayBuffer();
                const doc = await PDFDocument.load(buffer);
                setTotalPages(doc.getPageCount());
                setSettings(s => ({ ...s, toPage: doc.getPageCount() }));
            } catch (e) {
                console.error("Error counting pages", e);
            }
        };
        loadDoc();
    }, [file]);


    const applyPageNumbers = useCallback(async (originalFile: File, currentSettings: PageNumberSettings, isPreview: boolean = false): Promise<Uint8Array | null> => {
        try {
            const arrayBuffer = await originalFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const pages = pdfDoc.getPages();
            const total = pages.length;

            // Determine loop range
            const startIdx = Math.max(0, currentSettings.fromPage - 1);
            const endIdx = currentSettings.toPage ? Math.min(total, currentSettings.toPage) : total;

            // Use currentSettings.startFrom for the first numbered page
            // Logic: Page `startIdx` gets number `startFrom`. 
            // Page `startIdx + 1` gets `startFrom + 1`.

            // For preview, we only generate the first page of the RANGE (to see the number).
            // Or better, just the first page of the document if it's in range, otherwise the first numbered page?
            // Let's stick to simple preview: always show the page `startIdx` (the first page that gets a number).

            const pagesToProcess = isPreview ? [startIdx] : Array.from({ length: endIdx - startIdx }, (_, i) => startIdx + i);

            for (const pageIdx of pagesToProcess) {
                if (pageIdx >= total) continue;
                const page = pages[pageIdx];
                const { width, height } = page.getSize();

                // Calculate number to display
                const numberVal = currentSettings.startFrom + (pageIdx - startIdx);

                let text = '';
                switch (currentSettings.format) {
                    case 'n': text = `${numberVal}`; break;
                    case 'n of total': text = `${numberVal} of ${total}`; break; // 'total' is usually total pages in doc
                    case 'Page n': text = `Page ${numberVal}`; break;
                    case 'Page n of total': text = `Page ${numberVal} of ${total}`; break;
                }

                const textWidth = helveticaFont.widthOfTextAtSize(text, currentSettings.fontSize);
                const textHeight = helveticaFont.heightAtSize(currentSettings.fontSize);

                // Convert hex color
                const hex = currentSettings.color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;

                // Determine X, Y
                let x = 0, y = 0;

                // Vertical
                if (currentSettings.position.startsWith('t')) {
                    y = height - currentSettings.margin - textHeight;
                } else {
                    y = currentSettings.margin;
                }

                // Horizontal
                if (currentSettings.position.includes('l')) {
                    x = currentSettings.margin;
                } else if (currentSettings.position.includes('c')) {
                    x = (width - textWidth) / 2;
                } else {
                    x = width - currentSettings.margin - textWidth;
                }

                page.drawText(text, {
                    x,
                    y,
                    size: currentSettings.fontSize,
                    font: helveticaFont,
                    color: rgb(r, g, b),
                });
            }

            // For preview, if we modified a specific page, we want to return the doc.
            // But if we return the whole doc, PDFThumbnail(pageIndex=0) will show the FIRST page of the doc.
            // If the first page of the doc is NOT numbered (e.g. fromPage=2), the preview will show nothing!
            // We should ideally show the first *numbered* page in the preview.
            // But PDFThumbnail component renders pageIndex=0 of the file provided.
            // So for preview, valid strategy: 
            // 1. Create a single-page PDF containing ONLY the page we just numbered (pages[startIdx]).

            if (isPreview) {
                // If we are previewing page `startIdx`, let's extract it.
                // pdf-lib can copy pages to a new doc.
                const previewDoc = await PDFDocument.create();
                const [copiedPage] = await previewDoc.copyPages(pdfDoc, [startIdx]);
                previewDoc.addPage(copiedPage);
                return await previewDoc.save();
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Page numbering error:', error);
            return null;
        }
    }, []);

    // Effect for preview
    useEffect(() => {
        if (!file || totalPages === 0) {
            setPreviewFile(null);
            return;
        }

        const timeoutId = setTimeout(async () => {
            const pdfBytes = await applyPageNumbers(file, settings, true);
            if (pdfBytes) {
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const newPreviewFile = new File([blob], 'preview.pdf', { type: 'application/pdf' });
                setPreviewFile(newPreviewFile);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [file, settings, totalPages, applyPageNumbers]);

    const handleDownload = async () => {
        if (!file) return;
        setIsProcessing(true);

        try {
            const pdfBytes = await applyPageNumbers(file, settings, false);
            if (pdfBytes) {
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `numbered_${file.name}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('Page numbers added successfully!');
            }
        } catch (e) {
            toast.error('Error processing PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    const PositionButton = ({ pos, label }: { pos: Position, label: string }) => (
        <button
            onClick={() => setSettings(s => ({ ...s, position: pos }))}
            className={`h-10 rounded border text-xs font-medium transition-all flex items-center justify-center ${settings.position === pos
                ? 'bg-primary border-primary text-white'
                : 'bg-card border-border hover:border-gray-500 text-gray-400'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Centered Header - Always visible */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">Add Page Numbers</h1>
                <p className="text-gray-400 text-lg">
                    Add page numbering to your PDF.
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
                                        <Download className="w-4 h-4 mr-2" /> Download Numbered PDF
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Settings Sidebar */}
                        <div className="w-full lg:w-80 shrink-0 space-y-6">

                            {/* Position */}
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <label className="text-sm font-medium text-gray-400 mb-3 block border-b border-gray-700 pb-2">Position</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <PositionButton pos="tl" label="Top Left" />
                                    <PositionButton pos="tc" label="Top Center" />
                                    <PositionButton pos="tr" label="Top Right" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <PositionButton pos="bl" label="Bot Left" />
                                    <PositionButton pos="bc" label="Bot Center" />
                                    <PositionButton pos="br" label="Bot Right" />
                                </div>
                            </div>

                            {/* Format Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                                <label className="text-sm font-medium text-gray-400 block border-b border-gray-700 pb-2">Format</label>

                                <select
                                    value={settings.format}
                                    onChange={(e) => setSettings(s => ({ ...s, format: e.target.value as Format }))}
                                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                                >
                                    <option value="n">1</option>
                                    <option value="n of total">1 of {totalPages}</option>
                                    <option value="Page n">Page 1</option>
                                    <option value="Page n of total">Page 1 of {totalPages}</option>
                                </select>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Start Number</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={settings.startFrom}
                                            onChange={(e) => setSettings(s => ({ ...s, startFrom: Number(e.target.value) }))}
                                            className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Margin</label>
                                        <input
                                            type="number"
                                            value={settings.margin}
                                            onChange={(e) => setSettings(s => ({ ...s, margin: Number(e.target.value) }))}
                                            className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Range Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                                <label className="text-sm font-medium text-gray-400 block border-b border-gray-700 pb-2">Page Range</label>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">From Page</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max={totalPages}
                                            value={settings.fromPage}
                                            onChange={(e) => setSettings(s => ({ ...s, fromPage: Math.min(Math.max(1, Number(e.target.value)), totalPages) }))}
                                            className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">To Page</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max={totalPages}
                                            value={settings.toPage || totalPages}
                                            onChange={(e) => setSettings(s => ({ ...s, toPage: Math.min(Math.max(1, Number(e.target.value)), totalPages) }))}
                                            className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Style Settings */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                                <label className="text-sm font-medium text-gray-400 block border-b border-gray-700 pb-2">Style</label>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Font Size</label>
                                        <input
                                            type="number"
                                            value={settings.fontSize}
                                            onChange={(e) => setSettings(s => ({ ...s, fontSize: Number(e.target.value) }))}
                                            className="w-full bg-secondary border border-border rounded p-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Color</label>
                                        <input
                                            type="color"
                                            value={settings.color}
                                            onChange={(e) => setSettings(s => ({ ...s, color: e.target.value }))}
                                            className="h-9 w-full bg-transparent cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div className="flex-1 bg-secondary/30 rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center overflow-hidden relative min-h-[500px]">
                            <div className="absolute top-4 left-4 text-xs font-mono text-gray-500 bg-black/50 px-2 py-1 rounded">
                                PREVIEW (Page {settings.fromPage})
                            </div>
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

export default PageNumbersPage;
