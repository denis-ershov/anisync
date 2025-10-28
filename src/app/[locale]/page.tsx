import { Header } from "@/components/header";
import { ScheduleView } from "@/components/schedule-view";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { UserService } from '@/lib/services/user-service';

type HomeProps = {
  params: Promise<{
    locale: string;
  }>
}

export default async function Home({ params }: HomeProps) {
  const {locale} = await params;

  // Check if user is authenticated
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  const decoded = UserService.verifyToken(token);
  if (!decoded) {
    redirect('/login');
  }

  const user = UserService.getUserWithSettings(decoded.userId);
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <ScheduleView />
    </div>
  );
}
