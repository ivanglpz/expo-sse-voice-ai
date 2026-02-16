import Ionicons from "@expo/vector-icons/Ionicons";
import { LegendList, LegendListRef } from "@legendapp/list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  MessageChat,
  fetchChatMetadata,
  fetchListMessagesFromChat,
} from "../../service/chats";
import { UUID } from "../../utils/uuid";
import { concatChunks, float32ToInt16, toUint8Array } from "./utils/audio";
import { readStringField } from "./utils/payload";

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
const ASSISTANT_AUDIO_MIN_SEGMENT_BYTES = 24 * 1024;

const ASSISTANT_VOICE_ERROR = "Error de voz";
const DEFAULT_MESSAGES_LIMIT = 20;

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState("");

  const chatId = typeof params.id === "string" ? params.id : "";
  const queryMeta = useQuery({
    queryKey: ["chat-messages-meta", chatId],

    queryFn: async () => await fetchChatMetadata(chatId),
  });
  const totalPages = queryMeta.data?.totalPages ?? 0;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["chat-messages", chatId],
    queryFn: async ({ pageParam }) =>
      await fetchListMessagesFromChat(chatId, {
        page: pageParam,
        limit: DEFAULT_MESSAGES_LIMIT,
        order: "asc",
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < totalPages ? lastPage.page + 1 : undefined,
    enabled: chatId.length > 0,
  });
  const messages = Array.isArray(messagesQuery.data?.pages)
    ? messagesQuery.data?.pages?.flatMap((e) => e?.messages)
    : [];

  const flatListRef = useRef<LegendListRef>(null);
  const currentAIMessageId = useRef<string | null>(null);

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const currentAudioFileRef = useRef<File | null>(null);

  const incomingAudioChunksRef = useRef<Uint8Array[]>([]);
  const incomingAudioBytesRef = useRef(0);
  const assistantAudioQueueRef = useRef<Uint8Array[]>([]);
  const isAssistantAudioStreamOpenRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);
  const isAssistantPlaybackActiveRef = useRef(false);
  const resumeMicAtRef = useRef(0);
  const isRecordingRef = useRef(isRecording);
  const isConnectedRef = useRef(false);
  const sendRef = useRef<(event: string, data?: unknown) => void>(() => {});

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, []);

  const appendMessage = useCallback(
    (type: MessageChat["type"], rawText: string) => {
      const messageText = rawText.trim();
      if (!messageText) return;

      // CREATE_MESSAGE({
      //   chatId: session.id,
      //   message: {
      //     id: UUID(),
      //     type,
      //     text: atom(messageText),
      //     timestamp: Date.now(),
      //   },
      // });
      scrollToBottom();
    },
    // [CREATE_MESSAGE, scrollToBottom, session.id],
    [],
  );

  const finishAssistantTurn = useCallback(() => {
    isAssistantPlaybackActiveRef.current = false;
    isAssistantSpeakingRef.current = false;
    resumeMicAtRef.current = Date.now() + MIC_RESUME_COOLDOWN_MS;
  }, []);

  const resetAssistantAudioPipeline = useCallback(() => {
    incomingAudioChunksRef.current = [];
    incomingAudioBytesRef.current = 0;
    assistantAudioQueueRef.current = [];
    isAssistantAudioStreamOpenRef.current = false;
  }, []);

  const stopAssistantPlayback = useCallback(
    (applyCooldown = true) => {
      // player.pause();
      if (currentAudioFileRef.current?.exists) {
        currentAudioFileRef.current.delete();
      }
      currentAudioFileRef.current = null;
      resetAssistantAudioPipeline();

      if (applyCooldown) {
        finishAssistantTurn();
        return;
      }

      isAssistantPlaybackActiveRef.current = false;
      isAssistantSpeakingRef.current = false;
    },
    [finishAssistantTurn, player, resetAssistantAudioPipeline],
  );

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
    }).catch((e) => console.error("[AUDIO] setAudioModeAsync error", e));

    return () => {
      stopAssistantPlayback(true);
    };
  }, [stopAssistantPlayback]);

  const playAssistantAudio = useCallback(
    (audioBytes: Uint8Array) => {
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
        return true;
      } catch (error) {
        isAssistantPlaybackActiveRef.current = false;
        console.error("[VOICE] Error reproduciendo audio IA:", error);
        return false;
      }
    },
    [player],
  );

  const tryPlayNextAssistantSegment = useCallback(() => {
    if (isAssistantPlaybackActiveRef.current) return;

    while (assistantAudioQueueRef.current.length > 0) {
      const nextSegment = assistantAudioQueueRef.current.shift();
      if (!nextSegment || nextSegment.length === 0) {
        continue;
      }
      const started = playAssistantAudio(nextSegment);
      if (started) {
        return;
      }
    }

    if (!isAssistantAudioStreamOpenRef.current) {
      finishAssistantTurn();
    }
  }, [finishAssistantTurn, playAssistantAudio]);

  const flushIncomingAudioBuffer = useCallback(
    (force = false) => {
      if (incomingAudioBytesRef.current === 0) return;
      if (
        !force &&
        incomingAudioBytesRef.current < ASSISTANT_AUDIO_MIN_SEGMENT_BYTES
      ) {
        return;
      }

      const segment = concatChunks(incomingAudioChunksRef.current);
      incomingAudioChunksRef.current = [];
      incomingAudioBytesRef.current = 0;

      if (segment.length === 0) return;
      assistantAudioQueueRef.current.push(segment);
      tryPlayNextAssistantSegment();
    },
    [tryPlayNextAssistantSegment],
  );

  useEffect(() => {
    if (!playerStatus?.didJustFinish) return;
    const finishedFile = currentAudioFileRef.current;
    if (finishedFile?.exists) {
      finishedFile.delete();
    }
    currentAudioFileRef.current = null;
    isAssistantPlaybackActiveRef.current = false;
    tryPlayNextAssistantSegment();
  }, [playerStatus?.didJustFinish, tryPlayNextAssistantSegment]);

  const onStreamMessage = useCallback(
    (data: { content?: string }) => {
      if (!data.content || !currentAIMessageId.current) {
        return;
      }
      // UPDATE_MESSAGE({
      //   sessionId: session.id,
      //   messageId: currentAIMessageId.current,
      //   newText: data.content,
      // });
      // scrollToBottom();
    },
    // [UPDATE_MESSAGE, scrollToBottom, session.id],
    [],
  );

  const onStreamError = useCallback(() => {
    console.log("error en el chat sse");

    if (currentAIMessageId.current) {
      // DELETE_MESSAGE({
      //   chatId: session.id,
      //   messageId: currentAIMessageId.current,
      // });
      Alert.alert("Error", "Failed to get AI response");
    }
    currentAIMessageId.current = null;
    // }, [DELETE_MESSAGE, session.id]);
  }, []);

  const onStreamClose = useCallback(() => {
    console.log("SSE Connection closed");
    currentAIMessageId.current = null;
  }, []);

  const { isStreaming, startStream } = useSSEStream({
    url: `${CONFIG.API_URL}/chats/${chatId}/stream`,
    onMessage: onStreamMessage,
    onError: onStreamError,
    onOpen: () => console.log("SSE Connection opened"),
    onClose: onStreamClose,
    timeout: 3000,
  });

  const onSocketMessage = useCallback(
    (event: string, data: unknown) => {
      if (event === "transcript:final") {
        appendMessage("user", readStringField(data, "text"));
        return;
      }

      if (event === "assistant:response") {
        appendMessage("ai", readStringField(data, "text"));
        return;
      }

      if (event === "assistant:audio:start") {
        stopAssistantPlayback(false);
        isAssistantAudioStreamOpenRef.current = true;
        isAssistantSpeakingRef.current = true;
        return;
      }

      if (event === "assistant:audio:chunk") {
        const chunk = toUint8Array(data);
        if (chunk && chunk.length > 0) {
          incomingAudioChunksRef.current.push(chunk);
          incomingAudioBytesRef.current += chunk.length;
          flushIncomingAudioBuffer(false);
        }
        return;
      }

      if (event === "assistant:audio:end") {
        isAssistantAudioStreamOpenRef.current = false;
        flushIncomingAudioBuffer(true);
        tryPlayNextAssistantSegment();
        return;
      }

      if (event === "assistant:error") {
        resetAssistantAudioPipeline();
        finishAssistantTurn();
        const message =
          readStringField(data, "message") || ASSISTANT_VOICE_ERROR;
        Alert.alert("Asistente", message);
      }
    },
    [
      appendMessage,
      finishAssistantTurn,
      flushIncomingAudioBuffer,
      stopAssistantPlayback,
      tryPlayNextAssistantSegment,
    ],
  );

  // const { send, disconnect, isConnected } = useSocketIO<unknown>(
  //   CONFIG.API_URL,
  //   {
  //     autoConnect: true,
  //     onConnect: () =>
  //       console.log(`🟢 Socket.IO connected for ${CONFIG.API_URL}`),
  //     onDisconnect: () => {},
  //     onError: () => {},
  //     onMessage: onSocketMessage,
  //   },
  // );

  // useEffect(() => {
  //   isRecordingRef.current = isRecording;
  // }, [isRecording]);

  // useEffect(() => {
  //   isConnectedRef.current = isConnected;
  // }, [isConnected]);

  // useEffect(() => {
  //   sendRef.current = send;
  // }, [send]);

  // useEffect(() => {
  //   return () => {
  //     disconnect();
  //     audioRecorder.clearOnAudioReady();
  //   };
  // }, [disconnect]);

  const sendMessageWithStreaming = useCallback(
    async (userText: string) => {
      const trimmedText = userText.trim();
      if (!trimmedText) {
        Alert.alert("Error", "Message cannot be empty");
        return;
      }

      setText("");
      appendMessage("user", trimmedText);

      // const history = GET_CONTEXT(chatId);
      const aiMessageId = UUID();
      currentAIMessageId.current = aiMessageId;

      // CREATE_MESSAGE({
      //   chatId: session.id,
      //   message: {
      //     id: aiMessageId,
      //     type: "ai",
      //     text: atom(""),
      //     timestamp: Date.now(),
      //   },
      // });
      scrollToBottom();

      startStream({
        method: "POST",
        body: { message: trimmedText, history },
      });
    },
    // [
    //   appendMessage,
    //   CREATE_MESSAGE,
    //   GET_CONTEXT,
    //   scrollToBottom,
    //   session.id,
    //   startStream,
    // ],
    [appendMessage, chatId, scrollToBottom, startStream],
  );

  const handleStartCall = useCallback(async () => {
    if (isRecordingRef.current || !isConnectedRef.current) return;

    const permissions = await AudioManager.requestRecordingPermissions();
    if (permissions !== "Granted") return;

    const success = await AudioManager.setAudioSessionActivity(true);
    if (!success) return;

    // sendRef.current("audio:start", {
    //   chatId: session.id,
    //   sampleRate: 16000,
    //   channels: 1,
    //   encoding: "pcm_s16le",
    // });

    const result = audioRecorder.start();
    if (result.status === "error") {
      AudioManager.setAudioSessionActivity(false);
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    // }, [session.id]);
  }, []);

  const handleStopCall = useCallback(() => {
    if (isRecordingRef.current) {
      audioRecorder.stop();
      sendRef.current("audio:stop");
      isRecordingRef.current = false;
      setIsRecording(false);
      AudioManager.setAudioSessionActivity(false);
    }

    stopAssistantPlayback(true);
  }, [stopAssistantPlayback]);

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

  const keyExtractor = useCallback((item: MessageChat) => item.id, []);

  const renderMessage = useCallback(
    ({ item }: { item: MessageChat }) => <CardMessage item={item} />,
    [],
  );

  const handleSubmitText = useCallback(() => {
    sendMessageWithStreaming(text);
  }, [sendMessageWithStreaming, text]);

  const handleLoadMoreMessages = useCallback(() => {
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return;
    }
    messagesQuery.fetchNextPage();
  }, [
    messagesQuery.fetchNextPage,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
  ]);

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
              <Text style={styles.subtitle}>{chatId}</Text>
            </View>
            <View style={styles.headerAction} />
          </View>
          <LegendList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            recycleItems
            onStartReached={handleLoadMoreMessages}
            onStartReachedThreshold={0.5}
            onEndReached={handleLoadMoreMessages}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              messagesQuery.isFetchingNextPage ? (
                <View style={styles.paginationLoader}>
                  <ActivityIndicator size="small" />
                </View>
              ) : null
            }
          />
          {isStreaming ? (
            <View style={styles.streamingBanner}>
              <Text style={styles.streamingText}>AI is thinking...</Text>
            </View>
          ) : null}

          <ChatInput
            value={text}
            onChange={setText}
            onSubmit={handleSubmitText}
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
  paginationLoader: {
    paddingVertical: 12,
    alignItems: "center",
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
