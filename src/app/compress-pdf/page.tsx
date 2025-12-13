'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import { Minimize2, RefreshCw, Zap, Scale, Shield, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

type CompressionLevel = 'extreme' | 'recommended' | 'less';

interface CompressionOption {
    id: CompressionLevel;
    title: string;
    subtitle: string;
    description: string;
    icon: typeof Zap;
    color: string;
    bgColor: string;
    borderColor: string;
}

const compressionOptions: CompressionOption[] = [
    {
        id: 'extreme',
        title: 'Extreme Compression',
        subtitle: 'Smallest file size',
        description: 'Images at 72 DPI. Text stays selectable. Best for email/web.',
        icon: Zap,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/50'
    },
    {
        id: 'recommended',
        title: 'Recommended',
        subtitle: 'Balanced quality & size',
        description: 'Images at 150 DPI. Text stays selectable. Good for sharing.',
        icon: Scale,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary'
    },
    {
        id: 'less',
        title: 'Less Compression',
        subtitle: 'Best quality',
        description: 'Images at 300 DPI. No downsampling. Best for printing.',
        icon: Shield,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/50'
    }
];

const CompressPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [isCompressing, setIsCompressing] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState<CompressionLevel>('recommended');
    const [result, setResult] = useState<{
        originalSize: number;
        compressedSize: number;
    } | null>(null);

    const handleFileSelected = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            setFile(selectedFile);
            setResult(null);

            try {
                const buffer = await selectedFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(buffer);
                setPageCount(pdfDoc.getPageCount());
            } catch (error) {
                console.error('Error loading PDF:', error);
                toast.error('Invalid PDF file');
                setFile(null);
            }
        }
    };

    const handleCompress = async () => {
        if (!file) return;
        setIsCompressing(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('level', selectedLevel);

            const response = await fetch('/api/compress-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to compress PDF');
            }

            // Get size info from headers
            const originalSize = parseInt(response.headers.get('X-Original-Size') || '0');
            const compressedSize = parseInt(response.headers.get('X-Compressed-Size') || '0');

            // Get the compressed PDF blob
            const blob = await response.blob();
            setResult({ originalSize: file.size, compressedSize: blob.size });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `compressed_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            const reduction = ((1 - blob.size / file.size) * 100).toFixed(1);
            if (blob.size < file.size) {
                toast.success(`PDF compressed! Size reduced by ${reduction}%`);
            } else {
                toast.info('PDF processed. File is already well-optimized.');
            }
        } catch (error) {
            console.error('Error compressing PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to compress PDF');
        } finally {
            setIsCompressing(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const truncateFileName = (fileName: string, maxLength: number = 30): string => {
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.substring(fileName.lastIndexOf('.'));
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const charsToShow = maxLength - extension.length - 3;
        const frontChars = Math.ceil(charsToShow / 2);
        const backChars = Math.floor(charsToShow / 2);
        return nameWithoutExt.substring(0, frontChars) + '...' + nameWithoutExt.substring(nameWithoutExt.length - backChars) + extension;
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Compress PDF</h1>
                <p className="text-gray-400 text-lg">
                    Reduce your PDF file size with powerful compression.
                </p>
            </div>

            {!file ? (
                <FileUploader
                    onFilesSelected={handleFileSelected}
                    maxFiles={1}
                    className="min-h-[400px] flex items-center justify-center"
                />
            ) : (
                <div className="space-y-8">
                    {/* File Info Card */}
                    <div className="bg-card border border-border p-6 rounded-xl">
                        <div className="flex items-start gap-6">
                            <div className="w-24 h-32 flex-shrink-0 bg-secondary rounded-lg overflow-hidden border border-border">
                                <PDFThumbnail
                                    file={file}
                                    pageIndex={0}
                                    width={96}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold mb-2" title={file.name}>
                                    {truncateFileName(file.name, 40)}
                                </h3>
                                <div className="space-y-1 text-sm text-gray-400">
                                    <p>Original size: <span className="text-white font-medium">{formatFileSize(file.size)}</span></p>
                                    <p>Pages: <span className="text-white font-medium">{pageCount}</span></p>
                                    {result && (
                                        <p className={result.compressedSize < result.originalSize ? 'text-green-400' : 'text-yellow-400'}>
                                            Compressed: <span className="font-medium">{formatFileSize(result.compressedSize)}</span>
                                            <span className="ml-2 text-xs">
                                                ({((1 - result.compressedSize / result.originalSize) * 100).toFixed(1)}%
                                                {result.compressedSize < result.originalSize ? ' saved' : ' increase'})
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button variant="outline" onClick={() => { setFile(null); setResult(null); }} size="sm">
                                <RefreshCw className="w-4 h-4 mr-2" /> Change
                            </Button>
                        </div>
                    </div>

                    {/* Compression Level Selection */}
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Select Compression Level</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {compressionOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = selectedLevel === option.id;

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedLevel(option.id)}
                                        className={`relative p-5 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? `${option.borderColor} ${option.bgColor}`
                                            : 'border-border bg-card hover:border-gray-600'
                                            }`}
                                    >
                                        {/* Selected checkmark */}
                                        {isSelected && (
                                            <div className={`absolute top-3 right-3 p-1 rounded-full ${option.bgColor}`}>
                                                <Check className={`w-4 h-4 ${option.color}`} />
                                            </div>
                                        )}

                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${option.bgColor}`}>
                                            <Icon className={`w-5 h-5 ${option.color}`} />
                                        </div>

                                        <h3 className="font-bold text-white mb-1">{option.title}</h3>
                                        <p className={`text-sm font-medium mb-2 ${option.color}`}>{option.subtitle}</p>
                                        <p className="text-xs text-gray-400">{option.description}</p>

                                        {option.id === 'recommended' && (
                                            <div className="absolute -top-2 left-4 px-2 py-0.5 bg-primary text-white text-xs font-bold rounded">
                                                BEST
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Button */}
                    <Button
                        size="lg"
                        className="w-full text-lg h-14"
                        onClick={handleCompress}
                        disabled={isCompressing}
                    >
                        {isCompressing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Compressing...
                            </>
                        ) : (
                            <>
                                <Minimize2 className="mr-2 w-5 h-5" /> Compress PDF
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default CompressPDFPage;
