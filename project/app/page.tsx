'use client';

import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { io } from 'socket.io-client';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initializeSocket = async () => {
    await fetch('/api/socket');
    socketRef.current = io({
      path: '/api/socket',
    });

    socketRef.current.on('user-connected', async () => {
      console.log('User connected to room');
      if (peerConnectionRef.current && streamRef.current) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('offer', { offer, roomId });
      }
    });

    socketRef.current.on('offer', async (offer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socketRef.current.emit('answer', { answer, roomId });
      }
    });

    socketRef.current.on('answer', async (answer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  };

  const initializePeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };

    peerConnectionRef.current = new RTCPeerConnection(configuration);

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId,
        });
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Add local tracks to the peer connection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        if (peerConnectionRef.current && streamRef.current) {
          peerConnectionRef.current.addTrack(track, streamRef.current);
        }
      });
    }
  };

  useEffect(() => {
    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setPermissionError(null);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        await initializeSocket();
        initializePeerConnection();

        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window) {
          const recognition = new (window as any).webkitSpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map(result => result.transcript)
              .join('');
            
            setSubtitle(transcript);
          };

          recognition.start();
        }
      } catch (error: any) {
        console.error('Error accessing media devices:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionError('Camera and microphone access is required for this app to work. Please enable permissions in your browser settings and refresh the page.');
        } else {
          setPermissionError('An error occurred while accessing your camera and microphone. Please make sure they are properly connected and try again.');
        }
      }
    };

    initWebRTC();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const createRoom = () => {
    const newRoomId = uuidv4();
    setRoomId(newRoomId);
    socketRef.current.emit('join-room', newRoomId);
    setIsConnected(true);
  };

  const joinRoom = () => {
    if (roomId) {
      socketRef.current.emit('join-room', roomId);
      setIsConnected(true);
    }
  };

  if (permissionError) {
    return (
      <main className="min-h-screen p-8 bg-gray-100 flex items-center justify-center">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-4 text-red-600">Permission Required</h1>
          <p className="text-gray-700 mb-4">{permissionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Video Chat Application</h1>
          {!isConnected ? (
            <div className="flex gap-4 justify-center mb-4">
              <button
                onClick={createRoom}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                  className="border rounded px-3 py-2"
                />
                <button
                  onClick={joinRoom}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Join Room
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-lg">Room ID: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{roomId}</span></p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg shadow-lg"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
              You
            </div>
          </div>
          <div className="relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg shadow-lg bg-gray-800"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
              Remote User
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Live Subtitles</h2>
          <div className="min-h-[60px] p-3 bg-gray-50 rounded">
            {subtitle || 'Waiting for speech...'}
          </div>
        </div>
      </div>
    </main>
  );
}