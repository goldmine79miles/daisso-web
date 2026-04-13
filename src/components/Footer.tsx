import { COUPANG_DISCLAIMER } from '@/lib/coupang';

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 mt-12">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="text-lg font-extrabold" style={{ color: 'var(--accent)' }}>다있어</p>
            <p className="mt-1 text-sm text-gray-500">가성비 꿀템만 모아놨어요</p>
          </div>
          <div className="text-xs text-gray-400 leading-relaxed max-w-md">
            <p>{COUPANG_DISCLAIMER}</p>
            <p className="mt-2">© 2026 다있어. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
