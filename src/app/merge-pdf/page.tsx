'use client';

import { useState, useCallback } from 'react';
import { FileUploader } from '@/components/ui/file-uploader';
import { Button } from '@/components/ui/button';
import { PDFDocument } from 'pdf-lib';
import { X, ArrowDown } from 'lucide-react';
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
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Dynamic import for the thumbnail
const PDFThumbnail = dynamic(() => import('@/components/pdf/PDFThumbnail').then(mod => mod.PDFThumbnail), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
});

// --- Types ---
// We need a stable ID for dnd-kit, so we wrap the File object
type PDFItem = {
    id: string;
    file: File;
};

// --- Sub-Component: The Sortable Item ---
interface SortableItemProps {
    id: string;
    item: PDFItem;
    index: number;
    onRemove: (id: string) => void;
}

const SortableItem = ({ id, item, index, onRemove }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // 1. IF DRAGGING: Render the Red Placeholder Box
    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="relative w-48 flex-shrink-0 aspect-[3/4] border-2 border-dashed border-primary bg-primary/5 rounded-xl z-0"
            />
        );
    }

    // 2. NORMAL STATE: Render the Card
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative w-48 flex-shrink-0 group cursor-grab active:cursor-grabbing touch-none"
        >
            <div className="w-full bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary transition-all h-full">
                <div className="aspect-[3/4] bg-secondary relative">
                    <PDFThumbnail
                        file={item.file}
                        pageIndex={0}
                        width={200}
                        className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="p-3 bg-card border-t border-border">
                    <p className="text-sm font-medium truncate" title={item.file.name}>
                        {item.file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                </div>
            </div>

            <button
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on click
                onClick={() => onRemove(id)}
                className="absolute top-1 right-1 bg-destructive text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
                aria-label={`Remove ${item.file.name}`}
            >
                <X className="w-4 h-4" />
            </button>

            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-10">
                {index + 1}
            </div>
        </div>
    );
};

// --- Sub-Component: The Drag Overlay (The "Ghost" following cursor) ---
const ItemOverlay = ({ item, index }: { item: PDFItem; index: number }) => {
    return (
        <div className="w-48 cursor-grabbing">
            <div className="bg-card border border-primary rounded-xl overflow-hidden shadow-2xl scale-105 rotate-2">
                <div className="aspect-[3/4] bg-secondary relative">
                    <PDFThumbnail
                        file={item.file}
                        pageIndex={0}
                        width={200}
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className="p-3 bg-card border-t border-border">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                </div>
                {/* Badge showing original index */}
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-sm">
                    {index + 1}
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const MergePDFPage = () => {
    // State now stores PDFItem objects (with IDs), not just Files
    const [items, setItems] = useState<PDFItem[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Sensors for drag detection with touch support for mobile
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required to start drag (prevents accidental drags on clicks)
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200, // 200ms delay before drag starts on touch
                tolerance: 5, // 5px tolerance for touch movement
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleFilesSelected = (newFiles: File[]) => {
        const newItems = newFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9), // Simple unique ID
            file
        }));
        setItems((prev) => [...prev, ...newItems]);
    };

    const removeFile = (idToRemove: string) => {
        setItems((prev) => prev.filter((item) => item.id !== idToRemove));
    };

    const handleMerge = async () => {
        if (items.length < 2) return;
        setIsMerging(true);

        try {
            const mergedPdf = await PDFDocument.create();

            for (const item of items) {
                const fileBuffer = await item.file.arrayBuffer();
                const pdf = await PDFDocument.load(fileBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'merged_documents.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Files merged successfully!");
        } catch (error) {
            console.error('Error merging PDFs:', error);
            toast.error('Failed to merge PDFs. Please try again.');
        } finally {
            setIsMerging(false);
        }
    };

    // DnD Logic
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }

        setActiveId(null);
    };

    const activeItem = items.find(item => item.id === activeId);
    const activeIndex = items.findIndex(item => item.id === activeId);

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Merge PDF files</h1>
                <p className="text-gray-400 text-lg">
                    Drag and drop to reorder your PDFs.
                </p>
            </div>

            {items.length === 0 ? (
                <FileUploader
                    onFilesSelected={handleFilesSelected}
                    maxFiles={20}
                    className="min-h-[400px] flex items-center justify-center max-w-4xl mx-auto"
                />
            ) : (
                <div className="space-y-12">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">
                            {items.length} PDF files selected
                        </h2>
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setItems([])}>
                                Clear All
                            </Button>
                            <Button
                                onClick={handleMerge}
                                disabled={items.length < 2 || isMerging}
                                className="min-w-[150px]"
                            >
                                {isMerging ? 'Merging...' : (
                                    <>
                                        Merge PDFs <ArrowDown className="ml-2 w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* SCROLL CONTAINER */}
                    <div className="overflow-x-auto pb-12">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="flex gap-6 min-w-max px-4">
                                <SortableContext
                                    items={items.map(i => i.id)}
                                    strategy={horizontalListSortingStrategy}
                                >
                                    {items.map((item, index) => (
                                        <SortableItem
                                            key={item.id}
                                            id={item.id}
                                            item={item}
                                            index={index}
                                            onRemove={removeFile}
                                        />
                                    ))}
                                </SortableContext>

                                {/* The "Add More" button remains static at the end */}
                                <div className="w-48 aspect-[3/4] flex-shrink-0">
                                    <FileUploader
                                        onFilesSelected={handleFilesSelected}
                                        maxFiles={20}
                                        variant="compact"
                                        className="w-full h-full border-dashed border-2 flex flex-col items-center justify-center gap-2 p-4 hover:bg-secondary/50 transition-colors rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* THE FLOATING GHOST ITEM */}
                            <DragOverlay adjustScale={true}>
                                {activeId && activeItem ? (
                                    <ItemOverlay item={activeItem} index={activeIndex} />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MergePDFPage;