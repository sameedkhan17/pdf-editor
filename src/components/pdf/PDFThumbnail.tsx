'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '@/lib/utils';

// Set worker source
// Note: In a production app, you might want to host this worker file yourself
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFThumbnailProps {
    file: File | Blob;
    pageIndex?: number; // 0-indexed
    width?: number;
    className?: string;
    password?: string; // Optional password for encrypted PDFs
}

export const PDFThumbnail = ({
    file,
    pageIndex = 0,
    width = 200,
    className,
    password
}: PDFThumbnailProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEncrypted, setIsEncrypted] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let pdfDocument: any = null;

        const renderPage = async () => {
            try {
                setLoading(true);
                setError(null);
                setIsEncrypted(false);

                const arrayBuffer = await file.arrayBuffer();

                // Create loading task with password if provided
                const loadingTaskOptions: any = { data: arrayBuffer };
                if (password) {
                    loadingTaskOptions.password = password;
                }

                const loadingTask = pdfjsLib.getDocument(loadingTaskOptions);

                try {
                    pdfDocument = await loadingTask.promise;
                } catch (loadError: any) {
                    // Check if it's a password error
                    if (loadError?.name === 'PasswordException') {
                        if (isMounted) {
                            setIsEncrypted(true);
                            setError('Password protected');
                        }
                        return;
                    }
                    throw loadError;
                }

                // PDF.js uses 1-based indexing
                const page = await pdfDocument.getPage(pageIndex + 1);

                const viewport = page.getViewport({ scale: 1 });
                const scale = width / viewport.width;
                const scaledViewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                if (!canvas || !isMounted) return;

                const context = canvas.getContext('2d');
                if (!context) throw new Error('Could not get canvas context');

                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: scaledViewport,
                };

                await page.render(renderContext).promise;
            } catch (err: any) {
                console.error('Error rendering PDF thumbnail:', err);
                if (isMounted) {
                    // Provide more specific error messages
                    if (err?.name === 'PasswordException') {
                        setIsEncrypted(true);
                        setError('Password protected');
                    } else {
                        setError('Failed to load preview');
                    }
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        renderPage();

        return () => {
            isMounted = false;
            if (pdfDocument) {
                pdfDocument.destroy().catch(console.error);
            }
        };
    }, [file, pageIndex, width, password]);

    return (
        <div className={cn("relative overflow-hidden bg-white", className)}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
                    Loading...
                </div>
            )}
            {error ? (
                <div className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center p-2 text-center",
                    isEncrypted ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-400"
                )}>
                    {isEncrypted ? (
                        <>
                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="text-xs font-medium">Encrypted</span>
                        </>
                    ) : (
                        <span className="text-xs">{error}</span>
                    )}
                </div>
            ) : (
                <canvas ref={canvasRef} className="block w-full h-auto" />
            )}
        </div>
    );
};
