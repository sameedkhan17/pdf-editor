'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import { Lock, Eye, EyeOff, RefreshCw, Shield } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

const ProtectPDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pageCount, setPageCount] = useState<number>(0);
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isProtecting, setIsProtecting] = useState(false);

    const handleFileSelected = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            setFile(selectedFile);

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

    const handleProtect = async () => {
        if (!file) return;

        if (!password) {
            toast.error('Please enter a password');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsProtecting(true);

        try {
            // Send the file to our API route for server-side encryption
            const formData = new FormData();
            formData.append('file', file);
            formData.append('password', password);

            const response = await fetch('/api/protect-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to protect PDF');
            }

            // Get the encrypted PDF blob from the response
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `protected_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('PDF protected successfully!');
        } catch (error) {
            console.error('Error protecting PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to protect PDF');
        } finally {
            setIsProtecting(false);
        }
    };

    const getPasswordStrength = (pwd: string): { strength: string; color: string } => {
        if (pwd.length === 0) return { strength: '', color: '' };
        if (pwd.length < 6) return { strength: 'Weak', color: 'text-red-400' };
        if (pwd.length < 10) return { strength: 'Medium', color: 'text-yellow-400' };
        return { strength: 'Strong', color: 'text-green-400' };
    };

    const truncateFileName = (fileName: string, maxLength: number = 30): string => {
        if (fileName.length <= maxLength) return fileName;

        const extension = fileName.substring(fileName.lastIndexOf('.'));
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

        const charsToShow = maxLength - extension.length - 3; // 3 for "..."
        const frontChars = Math.ceil(charsToShow / 2);
        const backChars = Math.floor(charsToShow / 2);

        return nameWithoutExt.substring(0, frontChars) + '...' + nameWithoutExt.substring(nameWithoutExt.length - backChars) + extension;
    };

    const passwordStrength = getPasswordStrength(password);

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Protect PDF</h1>
                <p className="text-gray-400 text-lg">
                    Add password protection to your PDF files securely in your browser.
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
                        <div className="w-48 h-64 bg-secondary rounded-lg overflow-hidden border border-border">
                            <PDFThumbnail
                                file={file}
                                pageIndex={0}
                                width={192}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-2" title={file.name}>
                                {truncateFileName(file.name, 35)}
                            </h3>
                            <p className="text-gray-400">{pageCount} Pages • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button variant="outline" onClick={() => setFile(null)}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Change File
                        </Button>
                    </div>

                    {/* Password Settings */}
                    <div className="bg-card border border-border p-8 rounded-xl flex flex-col gap-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-primary p-2 rounded-lg">
                                <Lock className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl font-bold">Set Password</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Password Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
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
                                {password && (
                                    <p className={`text-sm mt-1 ${passwordStrength.color}`}>
                                        Strength: {passwordStrength.strength}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter password"
                                        className="w-full bg-input border border-border rounded-md px-4 py-3 pr-12 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="text-sm mt-1 text-red-400">
                                        Passwords do not match
                                    </p>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-200">
                                    <p className="font-medium mb-1">Server-Side Encryption</p>
                                    <p className="text-xs">
                                        Your PDF is encrypted on your local server using Node.js crypto libraries for maximum reliability.
                                        Files never leave your device.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
                            <Button
                                size="lg"
                                className="w-full text-lg h-14"
                                onClick={handleProtect}
                                disabled={isProtecting || !password || !confirmPassword || password !== confirmPassword}
                            >
                                {isProtecting ? 'Protecting...' : (
                                    <>
                                        <Lock className="mr-2 w-5 h-5" /> Protect PDF
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

export default ProtectPDFPage;
