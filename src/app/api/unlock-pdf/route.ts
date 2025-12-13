import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import muhammara from 'muhammara';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
    let inputPath = '';
    let outputPath = '';

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const password = formData.get('password') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'Missing file' },
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

        // 4. Decrypt using muhammara
        try {
            // Create a new PDF writer (output will be unencrypted)
            const pdfWriter = muhammara.createWriter(outputPath);

            // Append all pages from the encrypted PDF with password
            const appendOptions: any = {};
            if (password) {
                appendOptions.password = password;
            }

            pdfWriter.appendPDFPagesFromPDF(inputPath, appendOptions);
            pdfWriter.end();

        } catch (e: any) {
            console.error('Muhammara decryption failed:', e);

            // Check for password-related errors
            const errorMessage = String(e?.message || e || '').toLowerCase();
            if (errorMessage.includes('password') ||
                errorMessage.includes('decrypt') ||
                errorMessage.includes('encrypted') ||
                errorMessage.includes('unable to read')) {
                return NextResponse.json(
                    { error: 'Incorrect password or unable to decrypt PDF' },
                    { status: 401 }
                );
            }

            throw new Error('Failed to unlock PDF');
        }

        // 5. Read decrypted file
        const decryptedBuffer = fs.readFileSync(outputPath);

        // 6. Return response
        return new NextResponse(decryptedBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="unlocked_${file.name}"`,
            },
        });

    } catch (error) {
        console.error('PDF Decryption Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to unlock PDF' },
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
