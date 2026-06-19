import { PlayClient } from "@/components/PlayClient";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function PlayPage({ params }: PageProps) {
  const { gameId } = await params;
  return <PlayClient gameId={gameId} />;
}
