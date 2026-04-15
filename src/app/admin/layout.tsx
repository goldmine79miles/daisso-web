import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '다있어 Admin',
  icons: {
    icon: '/logo-dark.png',
    apple: '/logo-dark.png',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
