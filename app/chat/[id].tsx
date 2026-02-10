import Ionicons from "@expo/vector-icons/Ionicons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AudioManager, AudioRecorder } from "react-native-audio-api";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardMessage } from "../../components/CardMessage";
import { ChatInput } from "../../components/ChatInput";
import { CONFIG } from "../../config/config";
import { useSSEStream } from "../../hooks/useSSE";
import { useSocketIO } from "../../hooks/useWebSocket";
import {
  CHATS_ATOM,
  CREATE_MESSAGE_ATOM,
  DELETE_MESSAGE_ATOM,
  GET_HISTORY_CHAT,
  Message,
  UPDATE_MESSAGE_ATOM,
} from "../../state/chat";
import { UUID } from "../../utils/uuid";

AudioManager.setAudioSessionOptions({
  iosCategory: "playAndRecord",
  iosMode: "voiceChat", // mejor AEC que "default"
  iosOptions: [],
});

const audioRecorder = new AudioRecorder();

const sampleRate = 16000;
const bufferLength = Math.floor(sampleRate * 0.02);
const channelCount = 1;
const MIC_RESUME_COOLDOWN_MS = 350;

const ASSISTANT_VOICE_ERROR = "Error de voz";

const float32ToInt16 = (input: Float32Array) => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

const toUint8Array = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return new Uint8Array(value);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as { data: unknown }).data)
  ) {
    const raw = (value as { data: unknown[] }).data;
    if (raw.every((n) => typeof n === "number")) {
      return new Uint8Array(raw as number[]);
    }
  }
  return null;
};

const concatChunks = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const readStringField = (payload: unknown, key: string): string => {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return "";
  }
  return String((payload as Record<string, unknown>)[key] ?? "");
};

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState("");

  const LIST_SESSIONS = useAtomValue(CHATS_ATOM);
  const chatId = params.id;
  const session = useMemo(
    () => LIST_SESSIONS.find((candidate) => candidate.id === chatId),
    [LIST_SESSIONS, chatId],
  );

  const CREATE_MESSAGE = useSetAtom(CREATE_MESSAGE_ATOM);
  const DELETE_MESSAGE = useSetAtom(DELETE_MESSAGE_ATOM);
  const GET_CONTEXT = useSetAtom(GET_HISTORY_CHAT);
  const UPDATE_MESSAGE = useSetAtom(UPDATE_MESSAGE_ATOM);

  const flatListRef = useRef<FlatList<Message>>(null);
  const currentAIMessageId = useRef<string | null>(null);

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const currentAudioFileRef = useRef<File | null>(null);

  const incomingAudioChunksRef = useRef<Uint8Array[]>([]);
  const isAssistantSpeakingRef = useRef(false);
  const isAssistantPlaybackActiveRef = useRef(false);
  const resumeMicAtRef = useRef(0);
  const isRecordingRef = useRef(isRecording);
  const isConnectedRef = useRef(false);
  const sendRef = useRef<(event: string, data?: unknown) => void>(() => {});

  if (!chatId || !session) {
    return <Redirect href="/" />;
  }

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: false });
  }, []);

  const appendMessage = useCallback(
    (type: Message["type"], rawText: string) => {
      const messageText = rawText.trim();
      if (!messageText) return;

      CREATE_MESSAGE({
        chatId: session.id,
        message: {
          id: UUID(),
          type,
          text: atom(messageText),
          timestamp: Date.now(),
        },
      });
      scrollToBottom();
    },
    [CREATE_MESSAGE, scrollToBottom, session.id],
  );

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
    }).catch((e) => console.error("[AUDIO] setAudioModeAsync error", e));

    return () => {
      try {
        player.pause();
      } catch {}
      if (currentAudioFileRef.current?.exists) {
        currentAudioFileRef.current.delete();
      }
      currentAudioFileRef.current = null;
      incomingAudioChunksRef.current = [];
      isAssistantPlaybackActiveRef.current = false;
      isAssistantSpeakingRef.current = false;
    };
  }, [player]);

  useEffect(() => {
    if (!playerStatus?.didJustFinish) return;
    const finishedFile = currentAudioFileRef.current;
    if (finishedFile?.exists) {
      finishedFile.delete();
    }
    currentAudioFileRef.current = null;
    isAssistantPlaybackActiveRef.current = false;
    isAssistantSpeakingRef.current = false;
    resumeMicAtRef.current = Date.now() + MIC_RESUME_COOLDOWN_MS;
  }, [playerStatus?.didJustFinish]);

  const playAssistantAudio = useCallback(
    async (audioBytes: Uint8Array) => {
      try {
        isAssistantPlaybackActiveRef.current = true;
        isAssistantSpeakingRef.current = true;

        const nextFile = new File(Paths.cache, `assistant-${Date.now()}.mp3`);
        nextFile.create({ overwrite: true });
        nextFile.write(audioBytes);

        const previous = currentAudioFileRef.current;
        currentAudioFileRef.current = nextFile;

        player.replace(nextFile.uri);
        player.seekTo(0);
        player.play();

        if (previous?.exists) {
          previous.delete();
        }
      } catch (error) {
        isAssistantPlaybackActiveRef.current = false;
        isAssistantSpeakingRef.current = false;
        resumeMicAtRef.current = Date.now() + MIC_RESUME_COOLDOWN_MS;
        console.error("[VOICE] Error reproduciendo audio IA:", error);
      }
    },
    [player],
  );

  const onStreamMessage = useCallback(
    (data: { content?: string }) => {
      if (!data.content || !currentAIMessageId.current) {
        return;
      }
      UPDATE_MESSAGE({
        sessionId: session.id,
        messageId: currentAIMessageId.current,
        newText: data.content,
      });
      scrollToBottom();
    },
    [UPDATE_MESSAGE, scrollToBottom, session.id],
  );

  const onStreamError = useCallback(() => {
    if (currentAIMessageId.current) {
      DELETE_MESSAGE({
        chatId: session.id,
        messageId: currentAIMessageId.current,
      });
      Alert.alert("Error", "Failed to get AI response");
    }
    currentAIMessageId.current = null;
  }, [DELETE_MESSAGE, session.id]);

  const onStreamClose = useCallback(() => {
    currentAIMessageId.current = null;
  }, []);

  const { isStreaming, startStream } = useSSEStream({
    url: `${CONFIG.API_URL}/chat`,
    onMessage: onStreamMessage,
    onError: onStreamError,
    onOpen: () => console.log("SSE Connection opened"),
    onClose: onStreamClose,
    timeout: 3000,
  });

  const onSocketMessage = useCallback(
    async (event: string, data: unknown) => {
      if (event === "transcript:final") {
        appendMessage("user", readStringField(data, "text"));
        return;
      }

      if (event === "assistant:response") {
        appendMessage("ai", readStringField(data, "text"));
        return;
      }

      if (event === "assistant:audio:start") {
        isAssistantSpeakingRef.current = true;
        incomingAudioChunksRef.current = [];
        return;
      }

      if (event === "assistant:audio:chunk") {
        const chunk = toUint8Array(data);
        if (chunk && chunk.length > 0) {
          incomingAudioChunksRef.current.push(chunk);
        }
        return;
      }

      if (event === "assistant:audio:end") {
        const fullAudio = concatChunks(incomingAudioChunksRef.current);
        incomingAudioChunksRef.current = [];
        if (fullAudio.length > 0) {
          await playAssistantAudio(fullAudio);
          return;
        }
        isAssistantPlaybackActiveRef.current = false;
        isAssistantSpeakingRef.current = false;
        resumeMicAtRef.current = Date.now() + MIC_RESUME_COOLDOWN_MS;
      }

      if (event === "assistant:error") {
        incomingAudioChunksRef.current = [];
        isAssistantPlaybackActiveRef.current = false;
        isAssistantSpeakingRef.current = false;
        resumeMicAtRef.current = Date.now() + MIC_RESUME_COOLDOWN_MS;
        const message = readStringField(data, "message") || ASSISTANT_VOICE_ERROR;
        Alert.alert("Asistente", message);
      }
    },
    [appendMessage, playAssistantAudio],
  );

  const { send, disconnect, isConnected } = useSocketIO<unknown>(CONFIG.API_URL, {
    autoConnect: true,
    onConnect: () =>
      console.log(`🟢 Socket.IO connected for ${CONFIG.API_URL}`),
    onDisconnect: () => {},
    onError: () => {},
    onMessage: onSocketMessage,
  });

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    return () => {
      disconnect();
      audioRecorder.clearOnAudioReady();
    };
  }, [disconnect]);

  const sendMessageWithStreaming = useCallback(
    async (userText: string) => {
      const trimmedText = userText.trim();
      if (!trimmedText) {
        Alert.alert("Error", "Message cannot be empty");
        return;
      }

      setText("");
      appendMessage("user", trimmedText);

      const history = GET_CONTEXT(session.id);
      const aiMessageId = UUID();
      currentAIMessageId.current = aiMessageId;

      CREATE_MESSAGE({
        chatId: session.id,
        message: {
          id: aiMessageId,
          type: "ai",
          text: atom(""),
          timestamp: Date.now(),
        },
      });
      scrollToBottom();

      startStream({
        method: "POST",
        body: { message: trimmedText, history },
      });
    },
    [
      appendMessage,
      CREATE_MESSAGE,
      GET_CONTEXT,
      scrollToBottom,
      session.id,
      startStream,
    ],
  );

  const handleStartCall = useCallback(async () => {
    if (isRecordingRef.current || !isConnectedRef.current) return;

    const permissions = await AudioManager.requestRecordingPermissions();
    if (permissions !== "Granted") return;

    const success = await AudioManager.setAudioSessionActivity(true);
    if (!success) return;

    sendRef.current("audio:start", {
      chatId: session.id,
      sampleRate: 16000,
      channels: 1,
      encoding: "pcm_s16le",
    });

    const result = audioRecorder.start();
    if (result.status === "error") {
      AudioManager.setAudioSessionActivity(false);
      return;
    }

    setIsRecording(true);
  }, [session.id]);

  const handleStopCall = useCallback(async () => {
    if (!isRecordingRef.current) return;

    audioRecorder.stop();
    sendRef.current("audio:stop");
    setIsRecording(false);
    AudioManager.setAudioSessionActivity(false);
  }, []);

  useEffect(() => {
    audioRecorder.onAudioReady(
      { sampleRate, bufferLength, channelCount },
      ({ buffer }) => {
        if (!isRecordingRef.current || !isConnectedRef.current) return;
        if (
          isAssistantSpeakingRef.current ||
          isAssistantPlaybackActiveRef.current
        ) {
          return;
        }
        if (Date.now() < resumeMicAtRef.current) return;

        const mono = buffer.getChannelData(0);
        const pcm16 = float32ToInt16(mono);
        sendRef.current("audio:chunk", new Uint8Array(pcm16.buffer));
      },
    );

    return () => {
      audioRecorder.clearOnAudioReady();
    };
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <CardMessage item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardContainer}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerAction}>
              <Pressable onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="black" />
              </Pressable>
            </View>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>Chat</Text>
              <Text style={styles.subtitle}>{session.id}</Text>
            </View>
            <View style={styles.headerAction} />
          </View>

          <FlatList
            data={session.messages}
            ref={flatListRef}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToBottom}
            renderItem={renderMessage}
          />

          {isStreaming ? (
            <View style={styles.streamingBanner}>
              <Text style={styles.streamingText}>AI is thinking...</Text>
            </View>
          ) : null}

          <ChatInput
            value={text}
            onChange={setText}
            onSubmit={() => sendMessageWithStreaming(text)}
            isLoading={isStreaming}
            isRecording={isRecording}
            onStartAudio={handleStartCall}
            onStopAudio={handleStopCall}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "white",
    padding: 22,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerAction: {
    minWidth: 24,
    minHeight: 24,
  },
  headerTitle: {
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.5,
  },
  listContent: {
    paddingVertical: 12,
  },
  streamingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  streamingText: {
    fontSize: 12,
    opacity: 0.6,
  },
});

export default ChatScreen;
