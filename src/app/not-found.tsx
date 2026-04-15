import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto flex flex-col items-center py-24 px-4 text-center">
        <span className="text-6xl font-bold text-gray-200 mb-4">404</span>
        <h1 className="text-2xl font-bold">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-gray-500">요청하신 페이지가 존재하지 않습니다.</p>
        <Link
          href="/"
          className="mt-6 px-6 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          홈으로 돌아가기
        </Link>
      </main>
    </>
  );
}
