import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import muhammara from 'muhammara';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const password = formData.get('password') as string;

        if (!file || !password) {
            return NextResponse.json(
                { error: 'Missing file or password' },
                { status: 400 }
            );
        }

        // 1. Convert to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Setup temp file paths
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
        const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);

        // 3. Write input file
        fs.writeFileSync(inputPath, buffer);

        // 4. Encrypt using muhammara
        try {
            const recipe = new muhammara.Recipe(inputPath, outputPath);

            recipe.encrypt({
                userPassword: password,
                ownerPassword: password,
                userProtectionFlag: 4, // Allow printing
            });

            recipe.endPDF();
        } catch (e) {
            console.error('Muhammara encryption failed:', e);
            throw new Error('Encryption failed');
        }

        // 5. Read encrypted file
        const encryptedBuffer = fs.readFileSync(outputPath);

        // 6. Cleanup temp files
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) {
            console.warn('Failed to cleanup temp files:', e);
        }

        // 7. Return response
        return new NextResponse(encryptedBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="protected_${file.name}"`,
            },
        });

    } catch (error) {
        console.error('PDF Encryption Error:', error);
        return NextResponse.json(
            { error: 'Failed to encrypt PDF' },
            { status: 500 }
        );
    }
}
