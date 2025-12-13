import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import {
  Merge,
  Split,
  Minimize2,
  FileType,
  FileText,
  Image,
  Lock,
  Unlock,
  RotateCw,
  PenTool,
  ArrowRight,
  Layers,
  Stamp,
  Hash,
  Crop
} from 'lucide-react';

const tools = [
  {
    icon: Merge,
    title: "Merge PDF",
    description: "Combine multiple PDFs into one unified document.",
    href: "/merge-pdf",
    color: "bg-red-500/10 text-red-500"
  },
  {
    icon: Split,
    title: "Split PDF",
    description: "Extract pages or split your PDF into multiple files.",
    href: "/split-pdf",
    color: "bg-orange-500/10 text-orange-500"
  },
  {
    icon: Minimize2,
    title: "Compress PDF",
    description: "Reduce file size while maintaining the best quality.",
    href: "/compress-pdf",
    color: "bg-green-500/10 text-green-500"
  },
  {
    icon: FileType,
    title: "PDF to Word",
    description: "Convert your PDF to editable Word documents.",
    href: "/pdf-to-word",
    color: "bg-blue-500/10 text-blue-500"
  },
  {
    icon: FileText,
    title: "Word to PDF",
    description: "Make DOC and DOCX files easy to read by converting them to PDF.",
    href: "/word-to-pdf",
    color: "bg-blue-600/10 text-blue-600"
  },
  {
    icon: Image,
    title: "PDF to JPG",
    description: "Extract images from your PDF or save each page as a separate image.",
    href: "/pdf-to-jpg",
    color: "bg-yellow-500/10 text-yellow-500"
  },
  {
    icon: RotateCw,
    title: "Rotate PDF",
    description: "Rotate your PDF pages properly.",
    href: "/rotate-pdf",
    color: "bg-purple-500/10 text-purple-500"
  },
  {
    icon: Lock,
    title: "Protect PDF",
    description: "Encrypt your PDF with a password.",
    href: "/protect-pdf",
    color: "bg-pink-500/10 text-pink-500"
  },
  {
    icon: Unlock,
    title: "Unlock PDF",
    description: "Remove password security from PDF.",
    href: "/unlock-pdf",
    color: "bg-gray-500/10 text-gray-500"
  },
  {
    icon: Layers,
    title: "Organize PDF",
    description: "Reorder, rotate, and delete pages. Drag and drop to rearrange.",
    href: "/organize-pdf",
    color: "bg-teal-500/10 text-teal-500"
  },
  {
    icon: PenTool,
    title: "Edit PDF",
    description: "Add text, shapes, comments and highlights to your PDF file.",
    href: "/edit-pdf",
    color: "bg-indigo-500/10 text-indigo-500"
  },
  {
    icon: Stamp,
    title: "Watermark PDF",
    description: "Stamp an image or text over your PDF in seconds.",
    href: "/watermark-pdf",
    color: "bg-cyan-500/10 text-cyan-500"
  },
  {
    icon: Hash,
    title: "Page Numbers",
    description: "Add page numbers into your PDF document.",
    href: "/page-numbers",
    color: "bg-lime-500/10 text-lime-500"
  },
  {
    icon: Crop,
    title: "Crop PDF",
    description: "Visually crop your PDF pages to remove unwanted areas.",
    href: "/crop-pdf",
    color: "bg-amber-500/10 text-amber-500"
  }
];

const Home = () => {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 flex flex-col items-center text-center px-4 bg-gradient-to-b from-background to-card">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl">
          Every tool you need to work with PDFs in one place
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl">
          Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use! Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
        </p>
        <div className="flex gap-4">
          <Link
            href="/merge-pdf"
            className="bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105 flex items-center gap-2"
          >
            Start Merging <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#tools"
            className="bg-card hover:bg-secondary text-white border border-border px-8 py-4 rounded-lg font-semibold text-lg transition-all"
          >
            Explore All Tools
          </Link>
        </div>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="w-full max-w-7xl px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="group bg-card hover:bg-secondary border border-border p-6 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 flex flex-col gap-4"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tool.color} transition-transform group-hover:scale-110`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{tool.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="w-full py-20 bg-card border-y border-border text-center px-4">
        <h2 className="text-3xl font-bold mb-12">Trusted by students and professionals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-50">
          {/* Placeholders for logos */}
          <div className="text-2xl font-bold">Company 1</div>
          <div className="text-2xl font-bold">Company 2</div>
          <div className="text-2xl font-bold">Company 3</div>
          <div className="text-2xl font-bold">Company 4</div>
        </div>
      </section>

      {/* Footer - Only on home page */}
      <Footer />
    </div>
  );
}

export default Home;
