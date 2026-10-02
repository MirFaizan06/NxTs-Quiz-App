import './globals.css';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { getUser } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { Background } from '@/components/Background';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'NxT Quiz';

export const metadata: Metadata = {
  title: { default: `${appName} - live quizzes for STEM classrooms`, template: `%s · ${appName}` },
  description: 'Run live programming, maths and physics quizzes in your classroom. Room codes, speed-based scoring and a real-time leaderboard.',
  openGraph: { title: appName, description: 'Live quizzes for STEM classrooms.', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#070914', colorScheme: 'dark' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, supabase } = await getUser();
  let role = 'student';
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = data?.role ?? 'student';
  }
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Background />
        <Navbar signedIn={!!user} isAdmin={role === 'admin'} appName={appName} />
        <main>{children}</main>
      </body>
    </html>
  );
}
