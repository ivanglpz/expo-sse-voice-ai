import * as Speech from "expo-speech";
import * as React from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { useWebSocket } from "./hooks/useWebSocket";
import AudioStream from "./modules/expo-audio-stream";

const WS_URL = "ws://192.168.0.7:8080/audio";

interface Message {
  type: "user" | "ai" | "transcription" | "ai_response" | "error";
  text: string;
  timestamp: number;
  message?: string;
}

export default function App() {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const { send, connect, disconnect, isConnected } = useWebSocket<Message>(
    WS_URL,
    {
      autoConnect: true,
      onMessage: (data) => {
        if (data.type === "ai_response") {
          speakText(data.text);
        } else if (data.type === "error") {
          Alert.alert("Error", data.message);
        }
      },
      onOpen: () => console.log("WebSocket connected"),
      onClose: () => console.log("WebSocket disconnected"),
      onError: (e) => console.error("WebSocket error", e),
    },
  );

  React.useEffect(() => {
    const chunkSub = AudioStream.addListener("onAudioChunk", ({ chunk }) => {
      if (!isConnected) return;
      send(Uint8Array.from(chunk).buffer);
    });

    const startSub = AudioStream.addListener("onStreamingStart", () =>
      setIsStreaming(true),
    );
    const stopSub = AudioStream.addListener("onStreamingStop", () =>
      setIsStreaming(false),
    );
    const errorSub = AudioStream.addListener("onAudioError", ({ error }) => {
      Alert.alert("Audio error", error);
      setIsStreaming(false);
    });

    return () => {
      chunkSub.remove();
      startSub.remove();
      stopSub.remove();
      errorSub.remove();
    };
  }, [isConnected, send]);

  // TTS
  const speakText = async (text: string) => {
    await Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: "es-ES",
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Iniciar streaming
  const handleStartStreaming = async () => {
    try {
      const hasPerm = await AudioStream.hasPermissions();
      if (!hasPerm.granted) {
        const req = await AudioStream.requestPermissions();
        if (!req.granted) {
          Alert.alert("Microphone permission required");
          return;
        }
      }
      await connect();
      await AudioStream.startStreaming();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleStopStreaming = async () => {
    try {
      AudioStream.stopStreaming();
      await Speech.stop();
      disconnect();
      setIsSpeaking(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleStopSpeaking = async () => {
    await Speech.stop();
    setIsSpeaking(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.status}>
          {isStreaming ? "🎤 Listening..." : "⏸️ Stopped"}
        </Text>
        {isSpeaking && <Text style={styles.speaking}>🔊 Speaking...</Text>}
      </View>

      <View style={styles.controls}>
        <Button
          title="Start Conversation"
          onPress={handleStartStreaming}
          disabled={isStreaming}
          color="#4CAF50"
        />

        <View style={styles.buttonSpacer} />

        <Button
          title="Stop Conversation"
          onPress={handleStopStreaming}
          disabled={!isStreaming}
          color="#f44336"
        />

        {isSpeaking && (
          <>
            <View style={styles.buttonSpacer} />
            <Button
              title="Stop Speaking"
              onPress={handleStopSpeaking}
              color="#FF9800"
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20, paddingTop: 60 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#fff",
  },
  statusContainer: { marginBottom: 20, alignItems: "center" },
  status: {
    fontSize: 18,
    textAlign: "center",
    color: "#4CAF50",
    fontWeight: "600",
  },
  speaking: {
    fontSize: 16,
    textAlign: "center",
    color: "#FF9800",
    marginTop: 5,
  },
  messagesContainer: { flex: 1, marginBottom: 20 },
  messagesContent: { paddingBottom: 10 },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: "85%",
  },
  userBubble: { backgroundColor: "#1E88E5", alignSelf: "flex-end" },
  aiBubble: { backgroundColor: "#424242", alignSelf: "flex-start" },
  messageLabel: {
    fontSize: 12,
    color: "#ccc",
    marginBottom: 4,
    fontWeight: "600",
  },
  messageText: { fontSize: 16, color: "#fff", lineHeight: 22 },
  controls: { gap: 10 },
  buttonSpacer: { height: 10 },
});
