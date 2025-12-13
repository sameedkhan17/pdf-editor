'use client';

import { useState, useCallback } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import {
    Trash2,
    RefreshCw,
    Download,
    RotateCw,
    RotateCcw,
    Layers,
    AlertCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-700 animate-pulse rounded" />
});

interface PageItem {
    id: string;
    pageIndex: number;
    rotation: number;
    deleted: boolean;
}

interface SortablePageProps {
    page: PageItem;
    file: File;
    onRotate: (id: string, direction: 'cw' | 'ccw') => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
}

const SortablePage = ({ page, file, onRotate, onDelete, onRestore }: SortablePageProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // If dragging, show placeholder
    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="relative aspect-[3/4] border-2 border-dashed border-primary bg-primary/5 rounded-xl"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative group cursor-grab active:cursor-grabbing touch-none ${page.deleted ? 'opacity-50' : ''}`}
        >
            <div className={`w-full bg-card border ${page.deleted ? 'border-red-500/50' : 'border-border'} rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary transition-all`}>
                {/* Page Number Badge */}
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {page.pageIndex + 1}
                </div>

                {/* Thumbnail Container */}
                <div
                    className="w-full aspect-[3/4] bg-secondary overflow-hidden"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                >
                    <PDFThumbnail
                        file={file}
                        pageIndex={page.pageIndex}
                        width={200}
                        className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Action Buttons - always visible on touch, hover on desktop */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onRotate(page.id, 'ccw'); }}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title="Rotate left"
                        >
                            <RotateCcw className="w-4 h-4 text-white" />
                        </button>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onRotate(page.id, 'cw'); }}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title="Rotate right"
                        >
                            <RotateCw className="w-4 h-4 text-white" />
                        </button>
                        {page.deleted ? (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onRestore(page.id); }}
                                className="p-2 bg-green-500/30 hover:bg-green-500/50 rounded-lg transition-colors"
                                title="Restore page"
                            >
                                <RefreshCw className="w-4 h-4 text-green-400" />
                            </button>
                        ) : (
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
                                className="p-2 bg-red-500/30 hover:bg-red-500/50 rounded-lg transition-colors"
                                title="Delete page"
                            >
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Deleted Overlay */}
                {page.deleted && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                            DELETED
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Drag Overlay Component - the "ghost" that follows cursor/finger
const PageOverlay = ({ page, file }: { page: PageItem; file: File }) => {
    return (
        <div className="w-32 cursor-grabbing">
            <div className="bg-card border border-primary rounded-xl overflow-hidden shadow-2xl scale-105 rotate-2">
                <div className="absolute top-2 left-2 z-10 bg-primary text-white text-xs px-2 py-1 rounded">
                    {page.pageIndex + 1}
                </div>
                <div
                    className="w-full aspect-[3/4] bg-secondary overflow-hidden"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                >
                    <PDFThumbnail
                        file={file}
                        pageIndex={page.pageIndex}
                        width={150}
                        className="w-full h-full object-contain"
                    />
                </div>
            </div>
        </div>
    );
};

const OrganizePDFPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Improved sensors with touch support for mobile
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleFileSelected = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            setFile(selectedFile);

            try {
                const buffer = await selectedFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(buffer);
                const pageCount = pdfDoc.getPageCount();

                const pageItems: PageItem[] = Array.from({ length: pageCount }, (_, i) => ({
                    id: `page-${i}`,
                    pageIndex: i,
                    rotation: 0,
                    deleted: false,
                }));

                setPages(pageItems);
            } catch (error) {
                console.error('Error loading PDF:', error);
                toast.error('Failed to load PDF');
                setFile(null);
            }
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }

        setActiveId(null);
    };

    const handleRotate = useCallback((id: string, direction: 'cw' | 'ccw') => {
        setPages((items) =>
            items.map((item) =>
                item.id === id
                    ? { ...item, rotation: (item.rotation + (direction === 'cw' ? 90 : -90)) % 360 }
                    : item
            )
        );
    }, []);

    const handleDelete = useCallback((id: string) => {
        setPages((items) =>
            items.map((item) =>
                item.id === id ? { ...item, deleted: true } : item
            )
        );
    }, []);

    const handleRestore = useCallback((id: string) => {
        setPages((items) =>
            items.map((item) =>
                item.id === id ? { ...item, deleted: false } : item
            )
        );
    }, []);

    const handleApplyChanges = async () => {
        if (!file) return;

        const activePages = pages.filter((p) => !p.deleted);
        if (activePages.length === 0) {
            toast.error('Cannot create a PDF with no pages');
            return;
        }

        setIsProcessing(true);

        try {
            const buffer = await file.arrayBuffer();
            const originalPdf = await PDFDocument.load(buffer);
            const newPdf = await PDFDocument.create();

            for (const page of activePages) {
                const [copiedPage] = await newPdf.copyPages(originalPdf, [page.pageIndex]);

                if (page.rotation !== 0) {
                    const currentRotation = copiedPage.getRotation().angle;
                    copiedPage.setRotation({ type: 'degrees', angle: (currentRotation + page.rotation) % 360 } as any);
                }

                newPdf.addPage(copiedPage);
            }

            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `organized_${file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('PDF organized successfully!');
        } catch (error) {
            console.error('Error organizing PDF:', error);
            toast.error('Failed to organize PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    const activePageCount = pages.filter((p) => !p.deleted).length;
    const deletedPageCount = pages.filter((p) => p.deleted).length;
    const activePage = pages.find(p => p.id === activeId);

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
        <div className="container mx-auto px-4 py-12 max-w-7xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Organize PDF</h1>
                <p className="text-gray-400 text-lg">
                    Reorder, rotate, and delete pages from your PDF. Drag and drop to rearrange.
                </p>
            </div>

            {!file ? (
                <FileUploader
                    onFilesSelected={handleFileSelected}
                    maxFiles={1}
                    className="min-h-[400px] flex items-center justify-center"
                />
            ) : (
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary" />
                                <span className="font-medium" title={file.name}>
                                    {truncateFileName(file.name, 40)}
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">
                                {activePageCount} pages
                                {deletedPageCount > 0 && (
                                    <span className="text-red-400 ml-2">
                                        ({deletedPageCount} deleted)
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={() => setFile(null)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Change File
                            </Button>
                            <Button
                                onClick={handleApplyChanges}
                                disabled={isProcessing || activePageCount === 0}
                            >
                                {isProcessing ? 'Processing...' : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" /> Apply & Download
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-200">
                            <p className="font-medium mb-1">How to organize your PDF</p>
                            <p className="text-xs">
                                • <strong>Drag and drop</strong> pages to reorder them (works on mobile too!)<br />
                                • Use the <strong>rotate buttons</strong> to adjust page orientation<br />
                                • Click <strong>delete</strong> to remove unwanted pages (can be restored)
                            </p>
                        </div>
                    </div>

                    {/* Pages Grid */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {pages.map((page) => (
                                    <SortablePage
                                        key={page.id}
                                        page={page}
                                        file={file}
                                        onRotate={handleRotate}
                                        onDelete={handleDelete}
                                        onRestore={handleRestore}
                                    />
                                ))}
                            </div>
                        </SortableContext>

                        {/* Drag Overlay - the floating ghost */}
                        <DragOverlay adjustScale={true}>
                            {activeId && activePage && file ? (
                                <PageOverlay page={activePage} file={file} />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}
        </div>
    );
};

export default OrganizePDFPage;
