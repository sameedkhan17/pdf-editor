import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

type CompressionLevel = 'extreme' | 'recommended' | 'less';

/**
 * Build Ghostscript command based on compression level
 * 
 * Key insight: -dColorImageResolution only works if -dDownsampleColorImages=true
 * 
 * EXTREME: Forces downsampling to 72 DPI
 * RECOMMENDED: Forces downsampling to 150 DPI
 * LESS: NO downsampling, just PDF optimization
 */
/**
 * Build Ghostscript command based on compression level
 */
function buildGsCommand(
    gsPath: string,
    inputPath: string,
    outputPath: string,
    level: CompressionLevel
): string {
    // Base command parts
    const baseArgs = [
        gsPath,
        `-sOutputFile=${outputPath}`, // Output MUST be before -c (PostScript)
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dDetectDuplicateImages=true',
    ];

    // Level-specific settings
    let levelArgs: string[] = [];

    switch (level) {
        case 'extreme':
            // EXTREME: 72 DPI (Screen quality)
            // We removed the custom PostScript (-c) as it was causing crashes
            levelArgs = [
                '-dPDFSETTINGS=/screen',
                '-dDownsampleColorImages=true',
                '-dDownsampleGrayImages=true',
                '-dDownsampleMonoImages=true',
                '-dColorImageResolution=72',
                '-dGrayImageResolution=72',
                '-dMonoImageResolution=72',
                // Force JPEG encoding for maximum compression
                '-dAutoFilterColorImages=false',
                '-dColorImageFilter=/DCTEncode',
                '-dAutoFilterGrayImages=false',
                '-dGrayImageFilter=/DCTEncode',
            ];
            break;

        case 'recommended':
            // RECOMMENDED: 150 DPI (Ebook quality)
            levelArgs = [
                '-dPDFSETTINGS=/ebook',
                '-dDownsampleColorImages=true',
                '-dColorImageResolution=150',
                '-dGrayImageResolution=150',
                '-dMonoImageResolution=150',
            ];
            break;

        case 'less':
            // LESS: 300 DPI (Prepress quality) - Preserves more detail
            levelArgs = [
                '-dPDFSETTINGS=/prepress',
                // Only downsample if images are extremely huge (>300 DPI)
                '-dDownsampleColorImages=true',
                '-dColorImageResolution=300',
                '-dGrayImageResolution=300',
                '-dMonoImageResolution=1200',
                // Try to preserve original image data if possible
                '-dPassThroughJPEGImages=true',
            ];
            break;
    }

    // Input file must be last
    const fileArgs = [
        '-f', // Explicit file flag
        inputPath
    ];

    return [...baseArgs, ...levelArgs, ...fileArgs].join(' ');
}

export async function POST(req: NextRequest) {
    let inputPath = '';
    let outputPath = '';

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const level = (formData.get('level') as CompressionLevel) || 'recommended';

        if (!file) {
            return NextResponse.json(
                { error: 'Missing file' },
                { status: 400 }
            );
        }

        const validLevels: CompressionLevel[] = ['extreme', 'recommended', 'less'];
        if (!validLevels.includes(level)) {
            return NextResponse.json(
                { error: 'Invalid compression level' },
                { status: 400 }
            );
        }

        // 1. Convert to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Setup temp file paths
        const tempDir = os.tmpdir();
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        inputPath = path.join(tempDir, `input-${uniqueId}.pdf`);
        outputPath = path.join(tempDir, `output-${uniqueId}.pdf`);

        // 3. Write input file
        fs.writeFileSync(inputPath, buffer);

        // 4. Get Ghostscript path
        const gsPath = process.env.GHOSTSCRIPT_PATH || 'gs';

        // 5. Build and execute command
        const command = buildGsCommand(gsPath, inputPath, outputPath, level);
        console.log(`[${level.toUpperCase()}] Compressing PDF...`);

        try {
            await execAsync(command, { timeout: 180000 });
        } catch (e: any) {
            console.error('Ghostscript compression failed:', e.message);

            if (e.message?.includes('not found') || e.message?.includes('ENOENT')) {
                return NextResponse.json(
                    { error: 'Ghostscript not installed. Please install Ghostscript for PDF compression.' },
                    { status: 500 }
                );
            }

            throw new Error('Failed to compress PDF: ' + e.message);
        }

        // 6. Read compressed file
        if (!fs.existsSync(outputPath)) {
            throw new Error('Compression output file not created');
        }

        const compressedBuffer = fs.readFileSync(outputPath);
        const originalSize = buffer.length;
        const compressedSize = compressedBuffer.length;
        const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        console.log(`[${level.toUpperCase()}] ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${reduction}% reduction)`);

        // 7. Return response with size metadata
        return new NextResponse(compressedBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
                'X-Original-Size': String(originalSize),
                'X-Compressed-Size': String(compressedSize),
                'X-Compression-Level': level
            },
        });

    } catch (error) {
        console.error('PDF Compression Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to compress PDF' },
            { status: 500 }
        );
    } finally {
        // Cleanup temp files
        try {
            if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
            console.warn('Failed to cleanup temp files:', e);
        }
    }
}
