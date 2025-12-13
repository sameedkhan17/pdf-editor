import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="border-t border-border bg-card mt-auto">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold">ihatepdf</h3>
                        <p className="text-sm text-gray-400">
                            The only PDF tool you'll ever need. Fast, secure, and completely free.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">Product</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="/merge-pdf" className="hover:text-primary">Merge PDF</Link></li>
                            <li><Link href="/split-pdf" className="hover:text-primary">Split PDF</Link></li>
                            <li><Link href="/compress-pdf" className="hover:text-primary">Compress PDF</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">Company</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="/about" className="hover:text-primary">About</Link></li>
                            <li><Link href="/blog" className="hover:text-primary">Blog</Link></li>
                            <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link href="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-primary">Terms of Service</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        © {new Date().getFullYear()} ihatepdf. All rights reserved.
                    </p>
                    <div className="flex gap-4">
                        <Link href="#" className="text-gray-400 hover:text-primary"><Twitter className="w-5 h-5" /></Link>
                        <Link href="#" className="text-gray-400 hover:text-primary"><Github className="w-5 h-5" /></Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
