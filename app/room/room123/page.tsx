// app/room/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id;

  return (
    <div>
      <h1>Room ID: {roomId}</h1>
    </div>
  );
}
