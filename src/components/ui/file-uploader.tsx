'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface FileUploaderProps {
    onFilesSelected: (files: File[]) => void;
    accept?: Record<string, string[]>;
    maxFiles?: number;
    className?: string;
    variant?: 'default' | 'compact';
}

export const FileUploader = ({
    onFilesSelected,
    accept = { 'application/pdf': ['.pdf'] },
    maxFiles = 1,
    className,
    variant = 'default'
}: FileUploaderProps) => {

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            onFilesSelected(acceptedFiles);
        }
    }, [onFilesSelected]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxFiles
    });

    const variantClasses = variant === 'compact'
        ? "p-6 w-full h-full flex items-center justify-center"
        : "p-10 min-h-[400px] w-full max-w-4xl mx-auto flex items-center justify-center";

    return (
        <div
            {...getRootProps()}
            className={cn(
                "border-2 border-dashed border-border rounded-xl text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5",
                variantClasses,
                isDragActive && "border-primary bg-primary/10",
                className
            )}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                <div className="bg-secondary p-4 rounded-full">
                    <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">
                        {isDragActive ? "Drop files here" : "Select PDF files"}
                    </h3>
                    <p className="text-gray-400 text-sm">
                        or drag and drop PDF files here
                    </p>
                </div>
                <Button variant="default" size="lg" className="mt-2 pointer-events-none">
                    Select PDF files
                </Button>
            </div>
        </div>
    );
}
