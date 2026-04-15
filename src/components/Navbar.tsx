import Link from 'next/link';
import { SearchIcon, HeartIcon } from './Icons';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/">
          <img src="/logo-light.png" alt="다있어" className="h-9 object-contain" />
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/search" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><SearchIcon /></Link>
          <Link href="/favorites" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><HeartIcon /></Link>
        </div>
      </div>
    </nav>
  );
}
