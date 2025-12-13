'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import { FileText, Scissors, ArrowRight, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

const SplitPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileSelected = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            setFile(selectedFile);

            try {
                const buffer = await selectedFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(buffer);
                const count = pdfDoc.getPageCount();
                setPageCount(count);
                // Select all pages by default? Or none? Let's select none to let user pick.
                // Or maybe select all so they can deselect? Let's start with empty.
                setSelectedPages(new Set());
            } catch (error) {
                console.error('Error loading PDF:', error);
                alert('Invalid PDF file');
                setFile(null);
            }
        }
    };

    const togglePageSelection = (index: number) => {
        const newSelected = new Set(selectedPages);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedPages(newSelected);
    };

    const selectAll = () => {
        if (selectedPages.size === pageCount) {
            setSelectedPages(new Set());
        } else {
            const all = new Set<number>();
            for (let i = 0; i < pageCount; i++) all.add(i);
            setSelectedPages(all);
        }
    };

    const handleSplit = async () => {
        if (!file) return;
        setIsProcessing(true);

        try {
            const buffer = await file.arrayBuffer();
            const srcDoc = await PDFDocument.load(buffer);
            const newDoc = await PDFDocument.create();

            const pageIndices = Array.from(selectedPages).sort((a, b) => a - b);

            if (pageIndices.length === 0) {
                toast.error('Please select at least one page');
                setIsProcessing(false);
                return;
            }

            const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
            copiedPages.forEach((page) => newDoc.addPage(page));

            const pdfBytes = await newDoc.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `split_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('PDF split successfully!');
        } catch (error) {
            console.error('Error splitting PDF:', error);
            toast.error('Failed to split PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Split PDF file</h1>
                <p className="text-gray-400 text-lg">
                    Click on the pages you want to extract.
                </p>
            </div>

            {!file ? (
                <FileUploader
                    onFilesSelected={handleFileSelected}
                    maxFiles={1}
                    className="min-h-[400px] flex items-center justify-center max-w-4xl mx-auto"
                />
            ) : (
                <div className="space-y-8">
                    {/* Toolbar */}
                    <div className="bg-card border border-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 sticky top-20 z-10 shadow-xl shadow-black/20">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={selectAll}>
                                {selectedPages.size === pageCount ? 'Deselect All' : 'Select All'}
                            </Button>
                            <span className="text-sm text-gray-400">
                                {selectedPages.size} pages selected
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button variant="destructive" onClick={() => setFile(null)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Change File
                            </Button>
                            <Button
                                onClick={handleSplit}
                                disabled={isProcessing || selectedPages.size === 0}
                                className="min-w-[150px]"
                            >
                                {isProcessing ? 'Splitting...' : (
                                    <>
                                        Split PDF <ArrowRight className="ml-2 w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Pages Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {Array.from({ length: pageCount }).map((_, index) => {
                            const isSelected = selectedPages.has(index);
                            return (
                                <div
                                    key={index}
                                    onClick={() => togglePageSelection(index)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            togglePageSelection(index);
                                        }
                                    }}
                                    role="checkbox"
                                    aria-checked={isSelected}
                                    tabIndex={0}
                                    className={cn(
                                        "group relative cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary rounded-lg",
                                        isSelected ? "scale-105" : "hover:scale-105"
                                    )}
                                >
                                    <div className={cn(
                                        "bg-card border-2 rounded-lg p-4 aspect-[3/4] flex items-center justify-center relative overflow-hidden transition-all",
                                        isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-border hover:border-primary/50"
                                    )}>
                                        <div className={cn("w-full h-full transition-opacity", isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                                            <PDFThumbnail
                                                file={file}
                                                pageIndex={index}
                                                width={300}
                                                className="w-full h-full object-contain pointer-events-none"
                                            />
                                        </div>

                                        {/* Selection Indicator */}
                                        <div className={cn(
                                            "absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                                            isSelected ? "bg-primary text-white scale-100" : "bg-black/50 text-transparent scale-90 group-hover:scale-100 group-hover:bg-black/70"
                                        )}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div className="text-center mt-2 text-sm text-gray-500">
                                        Page {index + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default SplitPDFPage;
