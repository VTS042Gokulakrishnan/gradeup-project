import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  ConnectionState,
  LocalAudioTrack,
} from "livekit-client";

interface UseDebateLivekitOptions {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  enabled: boolean;
  localStream: MediaStream | null;
  apiBase: string;
  startMuted?: boolean;
}

interface UseDebateLivekitReturn {
  connected: boolean;
  error: string | null;
  isMuted: boolean;
  muteLocalAudio: () => void;
  unmuteLocalAudio: () => void;
  disconnect: () => void;
}

export function useDebateLivekit({
  sessionId,
  candidateId,
  candidateName,
  enabled,
  localStream,
  apiBase,
  startMuted = true,
}: UseDebateLivekitOptions): UseDebateLivekitReturn {
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(startMuted);

  const muteLocalAudio = useCallback(() => {
    roomRef.current?.localParticipant?.setMicrophoneEnabled(false);
    setIsMuted(true);
    console.log("[LIVEKIT] local audio muted");
  }, []);

  const unmuteLocalAudio = useCallback(() => {
    roomRef.current?.localParticipant?.setMicrophoneEnabled(true);
    setIsMuted(false);
    console.log("[LIVEKIT] local audio unmuted");
  }, []);

  // Clean up all audio elements we created
  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      try { el.pause(); el.srcObject = null; el.remove(); } catch {}
    });
    audioElementsRef.current = [];
    console.log("[LIVEKIT] audio elements cleaned up");
  }, []);

  const disconnect = useCallback(() => {
    cleanupAudioElements();
    roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
    console.log("[LIVEKIT] disconnected");
  }, [cleanupAudioElements]);

  useEffect(() => {
    if (!enabled || !sessionId || !candidateId || !localStream) return;

    let cancelled = false;

    async function connect() {
      try {
        console.log("[LIVEKIT] fetching token", { sessionId, candidateId });
        const response = await fetch(`${apiBase}/api/v1/debate/room/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, candidateId, candidateName }),
        });
        const data = await response.json();
        if (!data?.data?.token) {
          throw new Error("Failed to get Livekit token");
        }
        if (cancelled) return;
        console.log("[LIVEKIT] token received, connecting to room", {
          sessionId,
          livekitUrl: data.data.livekitUrl,
        });

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Audio) {
              console.log("[LIVEKIT] remote audio track subscribed", {
                participantId: participant.identity,
                participantName: participant.name,
              });
              const audioEl = track.attach();
              audioEl.style.display = "none";
              audioEl.autoplay = true;
              document.body.appendChild(audioEl);
              // Track so we can clean up on disconnect
              audioElementsRef.current.push(audioEl);
            }
          }
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            const detached = track.detach();
            detached.forEach((el) => {
              el.remove();
              audioElementsRef.current = audioElementsRef.current.filter((a) => a !== el);
            });
            console.log("[LIVEKIT] remote audio track unsubscribed and removed");
          }
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          console.log("[LIVEKIT] connection state changed", { state, sessionId });
          if (state === ConnectionState.Connected) setConnected(true);
          if (state === ConnectionState.Disconnected || state === ConnectionState.Failed) {
            setConnected(false);
          }
        });

        await room.connect(data.data.livekitUrl, data.data.token, {
          autoSubscribe: true,
        });

        if (!cancelled) {
          // Publish caller's existing audio track instead of letting Livekit
          // call getUserMedia() again, which creates a duplicate capture.
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            console.log("[LIVEKIT] publishing existing localStream track", {
              sessionId,
              trackId: audioTrack.id,
              readyState: audioTrack.readyState,
              enabled: audioTrack.enabled,
              startMuted,
            });
            // Set initial muted state BEFORE publishing
            audioTrack.enabled = !startMuted;
            const livekitTrack = new LocalAudioTrack(audioTrack, undefined, false);
            await room.localParticipant.publishTrack(livekitTrack);
            console.log("[LIVEKIT] track published, startMuted =", startMuted);
          } else {
            console.warn("[LIVEKIT] no audio track found in localStream", { sessionId });
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[LIVEKIT] connection failed", { sessionId, error: err?.message });
          setError(err?.message || "Livekit connection failed");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      cleanupAudioElements();
      roomRef.current?.disconnect();
      roomRef.current = null;
      setConnected(false);
      console.log("[LIVEKIT] effect cleanup — disconnected", { sessionId });
    };
  }, [enabled, sessionId, candidateId, localStream]);

  return { connected, error, isMuted, muteLocalAudio, unmuteLocalAudio, disconnect };
}