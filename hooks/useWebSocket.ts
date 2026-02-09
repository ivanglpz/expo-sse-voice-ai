// hooks/useSocketIO.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type SocketMessage<T = any> = T;

export type UseSocketIOOptions<T = any> = {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (err: any) => void;
  onMessage?: (event: string, data: SocketMessage<T>) => void;
  autoConnect?: boolean;
};

export type UseSocketIOReturn<T = any> = {
  socket: Socket | null;
  isConnected: boolean;
  send: (event: string, data?: any) => void;
  connect: () => void;
  disconnect: () => void;
};

export function useSocketIO<T = any>(
  url: string,
  options: UseSocketIOOptions<T> = {},
): UseSocketIOReturn<T> {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current) return;

    console.log(`🔗 Connecting to Socket.IO server at ${url}`);
    const socket = io(url, { transports: ["websocket"], autoConnect: false });

    socket.on("connect", () => {
      console.log(`🟢 Socket.IO connected to server`);
      setIsConnected(true);
      options.onConnect?.();
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket.IO disconnected from server, reason=${reason}`);
      setIsConnected(false);
      options.onDisconnect?.(reason);
      socketRef.current = null;
    });

    socket.on("connect_error", (err) => {
      console.error(`⚠️ Socket.IO connect error:`, err);
      options.onError?.(err);
    });

    socket.onAny((event, data) => {
      console.log(`📥 Received event=${event}`, data);
      options.onMessage?.(event, data);
    });

    socketRef.current = socket;
    socket.connect();
  }, [url]);

  const disconnect = useCallback(() => {
    console.log(`📴 Disconnecting Socket.IO`);
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback(
    (event: string, data: any) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      } else {
        console.warn("⚠️ Socket.IO is not connected. Message not sent.");
      }
    },
    [isConnected],
  );

  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [options.autoConnect]);

  return { socket: socketRef.current, isConnected, send, connect, disconnect };
}
