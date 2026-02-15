import { useCallback, useRef, useState } from "react";
import EventSource from "react-native-sse";

interface UseSSEStreamOptions {
  url: string;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  timeout?: number;
}

interface SSEStreamParams {
  body?: any;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
}

export const useSSEStream = (options: UseSSEStreamOptions) => {
  const { url, onMessage, onError, onOpen, onClose, timeout = 3000 } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.removeAllEventListeners();
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    clearStreamTimeout();
    setIsStreaming(false);
    onClose?.();
  }, []);

  const startStream = useCallback(
    (params?: SSEStreamParams) => {
      if (eventSourceRef.current) {
        closeConnection();
      }

      setIsStreaming(true);

      try {
        const es = new EventSource(url, {
          method: params?.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...(params?.headers || {}),
          },
          body: params?.body ? JSON.stringify(params.body) : undefined,
          pollingInterval: 0,
        });

        eventSourceRef.current = es;

        es.addEventListener("open", () => {
          onOpen?.();
        });

        es.addEventListener("message", (event) => {
          try {
            if (!event.data) return;

            if (event.data === "[DONE]") {
              closeConnection();
              return;
            }

            const data = JSON.parse(event.data);
            onMessage?.(data);

            clearStreamTimeout();
            timeoutRef.current = setTimeout(() => {
              closeConnection();
            }, timeout);
          } catch (e) {
            console.error("Error parsing SSE data:", e);
          }
        });

        es.addEventListener("error", (event) => {
          if (event.type === "error") {
            console.error("SSE connection error:", event.message);
          } else if (event.type === "exception") {
            console.error("SSE exception:", event.message, event.error);
          }

          onError?.(event);
          closeConnection();
        });

        es.addEventListener("close", () => {
          closeConnection();
        });
      } catch (error) {
        console.error("Failed to create SSE connection:", error);
        setIsStreaming(false);
        onError?.(error);
      }
    },
    [url, timeout],
  );

  const stopStream = useCallback(() => {
    closeConnection();
  }, []);

  return {
    isStreaming,
    startStream,
    stopStream,
  };
};
