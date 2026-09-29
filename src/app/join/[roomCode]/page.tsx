import { GuestView } from '@/components/guest/GuestView';

interface GuestPageProps {
  params: Promise<{ roomCode: string }>;
}

export default async function GuestPage({ params }: GuestPageProps) {
  const { roomCode } = await params;

  return <GuestView roomCode={roomCode} />;
}
