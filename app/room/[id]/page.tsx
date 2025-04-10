// app/room/[id]/page.tsx
export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Room ID: {params.id}</h1>
    </div>
  );
}
