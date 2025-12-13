'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument, degrees } from 'pdf-lib';
import { FileText, RotateCw, RotateCcw, Download, RefreshCw, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

const RotatePDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [rotations, setRotations] = useState<number[]>([]);
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
                setRotations(new Array(count).fill(0));
            } catch (error) {
                console.error('Error loading PDF:', error);
                alert('Invalid PDF file');
                setFile(null);
            }
        }
    };

    const handleRotateAll = (angle: number) => {
        setRotations(prev => prev.map(r => (r + angle) % 360));
    };

    const handleRotatePage = (index: number, angle: number) => {
        setRotations(prev => {
            const newRotations = [...prev];
            newRotations[index] = (newRotations[index] + angle) % 360;
            return newRotations;
        });
    };

    const handleSave = async () => {
        if (!file) return;
        setIsProcessing(true);

        try {
            const buffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(buffer);
            const pages = pdfDoc.getPages();

            pages.forEach((page, index) => {
                const rotation = rotations[index];
                if (rotation !== 0) {
                    page.setRotation(degrees(page.getRotation().angle + rotation));
                }
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `rotated_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('PDF rotated successfully!');
        } catch (error) {
            console.error('Error rotating PDF:', error);
            toast.error('Failed to rotate PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Rotate PDF files</h1>
                <p className="text-gray-400 text-lg">
                    Rotate your PDF pages individually or all at once.
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
                            <Button variant="outline" onClick={() => handleRotateAll(-90)}>
                                <RotateCcw className="w-4 h-4 mr-2" /> Rotate All Left
                            </Button>
                            <Button variant="outline" onClick={() => handleRotateAll(90)}>
                                <RotateCw className="w-4 h-4 mr-2" /> Rotate All Right
                            </Button>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button variant="destructive" onClick={() => setFile(null)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Remove
                            </Button>
                            <Button onClick={handleSave} disabled={isProcessing} className="min-w-[150px]">
                                {isProcessing ? 'Processing...' : (
                                    <>
                                        Download PDF <Download className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Pages Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {rotations.map((rotation, index) => (
                            <div key={index} className="group relative">
                                <div className="bg-card border border-border rounded-lg p-4 aspect-[3/4] flex items-center justify-center relative overflow-hidden transition-all hover:border-primary">
                                    <motion.div
                                        animate={{ rotate: rotation }}
                                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                        className="w-full h-full bg-white text-black flex items-center justify-center shadow-sm overflow-hidden"
                                    >
                                        <PDFThumbnail
                                            file={file}
                                            pageIndex={index}
                                            width={300}
                                            className="w-full h-full object-contain pointer-events-none"
                                        />
                                    </motion.div>

                                    {/* Overlay Controls */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => handleRotatePage(index, -90)}
                                            className="p-2 bg-white/10 hover:bg-primary rounded-full text-white transition-colors"
                                            title="Rotate Left"
                                            aria-label={`Rotate page ${index + 1} left`}
                                        >
                                            <RotateCcw className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRotatePage(index, 90)}
                                            className="p-2 bg-white/10 hover:bg-primary rounded-full text-white transition-colors"
                                            title="Rotate Right"
                                            aria-label={`Rotate page ${index + 1} right`}
                                        >
                                            <RotateCw className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-center mt-2 text-sm text-gray-500">
                                    Page {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RotatePDFPage;
