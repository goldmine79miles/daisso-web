import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '다있어 - 가성비 꿀템만 모아놨어요',
  description: '가성비 좋은 꿀템만 모아서 보여드리는 쇼핑 큐레이션 서비스. 생활용품부터 식품, 전자기기, 패션, 뷰티까지 카테고리별 최저가 할인 상품을 한눈에 확인하세요.',
  keywords: ['가성비', '꿀템', '쇼핑', '할인', '최저가', '쿠팡', '추천', '다있어'],
  openGraph: {
    title: '다있어 - 가성비 꿀템만 모아놨어요',
    description: '카테고리별 최저가 할인 상품을 한눈에! 가성비 쇼핑 큐레이션',
    type: 'website',
    locale: 'ko_KR',
    siteName: '다있어',
  },
  twitter: {
    card: 'summary_large_image',
    title: '다있어 - 가성비 꿀템만 모아놨어요',
    description: '카테고리별 최저가 할인 상품을 한눈에!',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
