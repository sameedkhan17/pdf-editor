import Link from 'next/link';
import { FileText } from 'lucide-react';

export const Navbar = () => {
    return (
        <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-primary p-1.5 rounded-md group-hover:bg-primary-hover transition-colors">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">ihatepdf</span>
                </Link>

                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                    <Link href="/merge-pdf" className="hover:text-primary transition-colors">Merge PDF</Link>
                    <Link href="/split-pdf" className="hover:text-primary transition-colors">Split PDF</Link>
                    <Link href="/compress-pdf" className="hover:text-primary transition-colors">Compress PDF</Link>
                    <Link href="/convert-pdf" className="hover:text-primary transition-colors">Convert PDF</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="text-sm font-medium hover:text-primary transition-colors"
                    >
                        Log in
                    </Link>
                    <Link
                        href="/signup"
                        className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Sign up
                    </Link>
                </div>
            </div>
        </nav>
    );
}
