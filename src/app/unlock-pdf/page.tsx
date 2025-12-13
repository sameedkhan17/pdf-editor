'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import { Unlock, Eye, EyeOff, RefreshCw, ShieldOff, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

const UnlockPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isEncrypted, setIsEncrypted] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const handleFileSelected = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            setFile(selectedFile);
            setPassword('');
            setLoadError(null);
            setIsEncrypted(false);

            try {
                const buffer = await selectedFile.arrayBuffer();
                // Try to load without password first
                try {
                    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                    setPageCount(pdfDoc.getPageCount());

                    // Check if PDF is encrypted by trying to access content
                    try {
                        await PDFDocument.load(buffer);
                        setIsEncrypted(false);
                    } catch {
                        setIsEncrypted(true);
                    }
                } catch (error: any) {
                    // PDF is likely encrypted
                    setIsEncrypted(true);
                    setPageCount(0);
                    setLoadError('This PDF is encrypted. Enter the password to unlock it.');
                }
            } catch (error) {
                console.error('Error loading PDF:', error);
                toast.error('Invalid PDF file');
                setFile(null);
            }
        }
    };

    const handleUnlock = async () => {
        if (!file) return;

        setIsUnlocking(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (password) {
                formData.append('password', password);
            }

            const response = await fetch('/api/unlock-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to unlock PDF');
            }

            // Get the decrypted PDF blob from the response
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `unlocked_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('PDF unlocked successfully!');
        } catch (error) {
            console.error('Error unlocking PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to unlock PDF');
        } finally {
            setIsUnlocking(false);
        }
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
                <h1 className="text-4xl font-bold mb-4">Unlock PDF</h1>
                <p className="text-gray-400 text-lg">
                    Remove password protection from your PDF files.
                </p>
            </div>

            {!file ? (
                <FileUploader
                    onFilesSelected={handleFileSelected}
                    maxFiles={1}
                    className="min-h-[400px] flex items-center justify-center"
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* File Preview */}
                    <div className="bg-card border border-border p-8 rounded-xl flex flex-col items-center justify-center text-center gap-6">
                        <div className="w-48 h-64 bg-secondary rounded-lg overflow-hidden border border-border relative">
                            {loadError ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-gray-400">
                                    <Unlock className="w-12 h-12 mb-2 text-primary" />
                                    <span className="text-xs">Encrypted PDF</span>
                                </div>
                            ) : (
                                <PDFThumbnail
                                    file={file}
                                    pageIndex={0}
                                    width={192}
                                    className="w-full h-full object-contain"
                                />
                            )}
                            {isEncrypted && (
                                <div className="absolute top-2 right-2 bg-primary text-white p-1 rounded">
                                    <Unlock className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-2" title={file.name}>
                                {truncateFileName(file.name, 35)}
                            </h3>
                            <div className="flex items-center justify-center gap-2 text-gray-400">
                                {pageCount > 0 && <span>{pageCount} Pages</span>}
                                <span>•</span>
                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            {isEncrypted && (
                                <div className="mt-2 flex items-center justify-center gap-1 text-primary text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Password Protected</span>
                                </div>
                            )}
                        </div>
                        <Button variant="outline" onClick={() => setFile(null)}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Change File
                        </Button>
                    </div>

                    {/* Unlock Settings */}
                    <div className="bg-card border border-border p-8 rounded-xl flex flex-col gap-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-primary p-2 rounded-lg">
                                <Unlock className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl font-bold">Enter Password</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Password Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    PDF Password {!isEncrypted && <span className="text-gray-500">(optional)</span>}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={isEncrypted ? "Enter password to unlock" : "Enter password if required"}
                                        className="w-full bg-input border border-border rounded-md px-4 py-3 pr-12 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Info Box */}
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                                <ShieldOff className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-200">
                                    <p className="font-medium mb-1">Remove Password Protection</p>
                                    <p className="text-xs">
                                        Enter the password to unlock the PDF. The unlocked file will be downloadable without any password restrictions.
                                    </p>
                                </div>
                            </div>

                            {/* Warning for non-encrypted files */}
                            {!isEncrypted && file && (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-yellow-200">
                                        <p className="font-medium mb-1">PDF May Not Be Encrypted</p>
                                        <p className="text-xs">
                                            This PDF doesn&apos;t appear to require a password. You can still process it to ensure all restrictions are removed.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-6">
                            <Button
                                size="lg"
                                className="w-full text-lg h-14"
                                onClick={handleUnlock}
                                disabled={isUnlocking || (isEncrypted && !password)}
                            >
                                {isUnlocking ? 'Unlocking...' : (
                                    <>
                                        <Unlock className="mr-2 w-5 h-5" /> Unlock PDF
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnlockPDFPage;
