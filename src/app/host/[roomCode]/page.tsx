import { HostDashboard } from '@/components/host/HostDashboard';

interface HostPageProps {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ token?: string; refresh?: string }>;
}

export default async function HostPage({ params, searchParams }: HostPageProps) {
  const { roomCode } = await params;
  const { token } = await searchParams;

  return <HostDashboard roomCode={roomCode} initialToken={token} />;
}
