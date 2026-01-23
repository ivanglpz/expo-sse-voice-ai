// DialogCall.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Speech from "expo-speech";
import { atom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { Alert, Animated, Text, TouchableOpacity, View } from "react-native";
import { CONFIG } from "../config/config";
import { usePulseAnimation } from "../hooks/usePulseAnimation";

import { useSocketIO } from "../hooks/useWebSocket";
import AudioStream from "../modules/expo-audio-stream";
import { CREATE_MESSAGE_ATOM } from "../state/chat";
import { UUID } from "../utils/uuid";

export type IonicName = keyof typeof Ionicons.glyphMap;

type DialogCallProps = {
  chatId: string;
  onClose: () => void;
};

const optionsCall: IonicName[] = [
  "options",
  "videocam",
  "volume-high",
  "mic-off",
];

type Message = {
  type: "user" | "ai" | "transcription" | "ai_response" | "error";
  text: string;
  timestamp: number;
  message?: string;
  status?: "started" | "in_progress" | "finished";
};

export const DialogCall = ({ chatId, onClose }: DialogCallProps) => {
  const { scaleAnim, setMode } = usePulseAnimation();
  const WS_URL = `${CONFIG.API_URL}?chatId=${chatId}`;

  const CREATE_MESSAGE = useSetAtom(CREATE_MESSAGE_ATOM);
  const { send, disconnect, isConnected } = useSocketIO<Message>(WS_URL, {
    autoConnect: true,
    onConnect: () => console.log(`🟢 Socket.IO connected for chatId=${chatId}`),
    onDisconnect: (reason) =>
      console.log(
        `🔴 Socket.IO disconnected for chatId=${chatId}, reason=${reason}`,
      ),
    onError: (err) =>
      console.error(`⚠️ Socket.IO error for chatId=${chatId}:`, err),
    onMessage: (event, data) => {
      console.log(`📩 Received event=${event} for chatId=${chatId}`, data);
      if (event === "transcription") {
        CREATE_MESSAGE({
          chatId,
          message: {
            type: "user",
            text: atom(data.text),
            timestamp: data.timestamp,
            id: UUID(),
          },
        });
        console.log(`📝 User transcription added: "${data.text}"`);
      }
      if (event === "ai_response") {
        CREATE_MESSAGE({
          chatId,
          message: {
            type: "ai",
            text: atom(data.text),
            timestamp: data.timestamp,
            id: UUID(),
          },
        });
        console.log(`🤖 AI response added: "${data.text}"`);
        speakText(data.text);
      }
      if (event === "processing_status") {
        const status = data.status;
        // Actualiza animación según estado
        if (status === "started") setMode("started");
        else if (status === "in_progress") setMode("in_progress");
        else if (status === "finished") setMode("finished");
      }

      if (event === "error") {
        console.error(`❌ Error event: ${data.message}`);
        Alert.alert("Error", data.message);
      }
    },
  });

  // ✅ Estado de mute
  const [muted, setMuted] = useState(false);

  // ✅ Función toggle mute
  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    AudioStream.setMute(newMuted);
  };
  const handleClose = async () => {
    console.log(`📴 Closing dialog for chatId=${chatId}`);
    onClose();
    await Speech.stop();
    disconnect();
  };

  const speakText = async (text: string) => {
    console.log(`🔊 Speaking text: "${text}"`);
    await Speech.stop();
    setMode("speaking"); // pulso rápido mientras habla
    Speech.speak(text, {
      language: "es-ES",
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setMode("finished"),
      onStopped: () => setMode("finished"),
      onError: () => setMode("finished"),
    });
  };

  useEffect(() => {
    console.log(`🎧 Subscribing to audio chunks for chatId=${chatId}`);
    const chunkSub = AudioStream.addListener("onAudioChunk", ({ chunk }) => {
      if (!isConnected) {
        console.warn(`⚠️ Tried to send audio chunk, socket not connected`);
        return;
      }
      send("audio-chunk", Uint8Array.from(chunk).buffer);
    });

    return () => {
      console.log(`🛑 Removing audio chunk listener for chatId=${chatId}`);
      chunkSub.remove();
    };
  }, [isConnected, send]);

  return (
    <View
      style={{
        backgroundColor: "white",
        flex: 1,
        alignItems: "center",
        padding: 22,
      }}
    >
      <View style={{ justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontWeight: "bold", fontSize: 28 }}>
            Ivan Assistant
          </Text>
          <Text style={{ opacity: 0.5 }}>ID: {chatId}</Text>
        </View>
      </View>
      <View
        style={{ flex: 1, justifyContent: "center", alignContent: "center" }}
      >
        <Animated.View
          style={{
            height: 150,
            width: 150,
            borderRadius: 200,
            backgroundColor: "#2979FF", // azul eléctrico y alegre
            alignSelf: "center",
            transform: [{ scale: scaleAnim }],
          }}
        />
      </View>
      <View
        style={{
          backgroundColor: "#eeeeee",
          padding: 12,
          borderRadius: 28,
          marginTop: 16,
          flexDirection: "row",
          gap: 12,
          maxWidth: 280,
          height: 65,
        }}
      >
        {optionsCall.map((option) => {
          if (option === "mic-off") {
            // ✅ Botón toggle mute con background dinámico
            return (
              <TouchableOpacity
                key="mic-toggle"
                onPress={toggleMute}
                style={{
                  backgroundColor: muted ? "#e63434" : "#dbdbdb", // 🔴 rojo si mute, gris si activo
                  padding: 8,
                  borderRadius: 100,
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={muted ? "mic-off" : "mic"}
                  color={muted ? "white" : "black"} // cambia color del icono también
                />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={option}
              style={{
                backgroundColor: "#dbdbdb",
                padding: 8,
                borderRadius: 100,
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={option} color="#989898" />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={{
            backgroundColor: "#e63434",
            padding: 8,
            borderRadius: 100,
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleClose}
        >
          <Ionicons name="call" color={"white"} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
