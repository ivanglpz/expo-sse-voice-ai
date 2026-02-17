import Ionicons from "@expo/vector-icons/Ionicons";
import {
  InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { CardAIMessage } from "../../components/CardAIMessage";
import { CardAIThinking } from "../../components/CardAIThinking";
import { CardUserMessage } from "../../components/CardUserMessage";
import { ChatInput } from "../../components/ChatInput";
import { CONFIG } from "../../config/config";
import { useSSEStream } from "../../hooks/useSSE";
import {
  ListMessagesPagination,
  MessageChat,
  fetchListMessagesFromChat,
} from "../../service/chats";
import { UUID } from "../../utils/uuid";
import { concatChunks, float32ToInt16, toUint8Array } from "./utils/audio";
import { readStringField } from "./utils/payload";

AudioManager.setAudioSessionOptions({
  iosCategory: "playAndRecord",
  iosMode: "voiceChat",
  iosOptions: [],
});

const audioRecorder = new AudioRecorder();

const sampleRate = 16000;
const bufferLength = Math.floor(sampleRate * 0.02);
const channelCount = 1;
const MIC_RESUME_COOLDOWN_MS = 350;
const ASSISTANT_AUDIO_MIN_SEGMENT_BYTES = 24 * 1024;

const ASSISTANT_VOICE_ERROR = "Error de voz";
const DEFAULT_MESSAGES_LIMIT = 5;

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState("");

  const chatId = typeof params.id === "string" ? params.id : "";

  const messagesQuery = useInfiniteQuery({
    queryKey: ["chat-messages", chatId],
    queryFn: async ({ pageParam }) =>
      await fetchListMessagesFromChat(chatId, {
        page: pageParam,
        limit: DEFAULT_MESSAGES_LIMIT,
        order: "desc",
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const newPage = lastPage.page + 1;
      return newPage > lastPage.totalPages ? undefined : newPage;
    },
    enabled: chatId.length > 0,
  });

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages;
    if (!Array.isArray(pages)) {
      return [];
    }
    return pages?.flatMap((e) => e.messages);
  }, [messagesQuery.data?.pages]);

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  const flatListRef = useRef<FlatList<MessageChat>>(null);
  const currentAIMessageId = useRef<string | null>(null);
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
    (type: MessageChat["type"], rawText: string, id = UUID()) => {
      const messageText = rawText.trim();
      if (!messageText) return;

      queryClient.setQueryData<InfiniteData<ListMessagesPagination>>(
        ["chat-messages", chatId],
        (current) => {
          const newMessage: MessageChat = {
            id,
            chatId,
            type,
            content: messageText,
            createdAt: new Date().toISOString(),
          };

          if (!current?.pages?.length) {
            return {
              pages: [
                {
                  messages: [newMessage],
                  page: 1,
                  limit: DEFAULT_MESSAGES_LIMIT,
                  total: 1,
                  totalPages: 1,
                },
              ],
              pageParams: [1],
            };
          }

          const nextPages = [...current.pages];
          const firstPage = nextPages[0];
          nextPages[0] = {
            ...firstPage,
            messages: [newMessage, ...firstPage.messages],
          };

          return {
            ...current,
            pages: nextPages,
          };
        },
      );
      scrollToBottom();
    },
    [chatId, queryClient, scrollToBottom],
  );

  const upsertFirstPageAssistantMessage = useCallback(
    (rawText: string) => {
      const assistantId = currentAIMessageId.current;
      const nextText = rawText;
      if (!assistantId || !nextText) return;

      queryClient.setQueryData<InfiniteData<ListMessagesPagination>>(
        ["chat-messages", chatId],
        (current) => {
          if (!current?.pages?.length) {
            const message: MessageChat = {
              id: assistantId,
              chatId,
              type: "ai_response",
              content: nextText,
              createdAt: new Date().toISOString(),
            };

            return {
              pages: [
                {
                  messages: [message],
                  page: 1,
                  limit: DEFAULT_MESSAGES_LIMIT,
                  total: 1,
                  totalPages: 1,
                },
              ],
              pageParams: [1],
            };
          }

          const nextPages = [...current.pages];
          const firstPage = nextPages[0];
          const firstPageMessages = [...firstPage.messages];
          const currentMessage = firstPageMessages.find(
            (m) => m.id === assistantId,
          );

          if (!currentMessage) {
            const message: MessageChat = {
              id: assistantId,
              chatId,
              type: "ai_response",
              content: nextText,
              createdAt: new Date().toISOString(),
            };

            nextPages[0] = {
              ...firstPage,
              messages: [message, ...firstPageMessages],
            };

            return {
              ...current,
              pages: nextPages,
            };
          }

          const previous = currentMessage.content ?? "";
          const merged = nextText.startsWith(previous)
            ? nextText
            : `${previous}${nextText}`;

          nextPages[0] = {
            ...firstPage,
            messages: firstPageMessages.map((message) =>
              message.id === assistantId
                ? { ...message, type: "ai_response", content: merged }
                : message,
            ),
          };

          return {
            ...current,
            pages: nextPages,
          };
        },
      );
      scrollToBottom();
    },
    [chatId, queryClient, scrollToBottom],
  );

  const ensureAssistantResponseType = useCallback(() => {
    const assistantId = currentAIMessageId.current;
    if (!assistantId) return;

    queryClient.setQueryData<InfiniteData<ListMessagesPagination>>(
      ["chat-messages", chatId],
      (current) => {
        if (!current?.pages?.length) return current;

        const nextPages = [...current.pages];
        const firstPage = nextPages[0];
        nextPages[0] = {
          ...firstPage,
          messages: firstPage.messages.map((message) =>
            message.id === assistantId && message.type === "ai_thinking"
              ? { ...message, type: "ai_response" }
              : message,
          ),
        };

        return {
          ...current,
          pages: nextPages,
        };
      },
    );
  }, [chatId, queryClient]);

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
    [finishAssistantTurn, resetAssistantAudioPipeline],
  );

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

  const onStreamMessage = useCallback(
    (data: { content?: string; message?: string; text?: string }) => {
      if (!currentAIMessageId.current) {
        return;
      }

      const chunk =
        readStringField(data, "content") ||
        readStringField(data, "message") ||
        readStringField(data, "text");

      if (!chunk) {
        ensureAssistantResponseType();
        return;
      }

      upsertFirstPageAssistantMessage(chunk);
    },
    [ensureAssistantResponseType, upsertFirstPageAssistantMessage],
  );

  const onStreamError = useCallback(() => {
    console.log("error en el chat sse");

    if (currentAIMessageId.current) {
      ensureAssistantResponseType();
      Alert.alert("Error", "Failed to get AI response");
    }
    currentAIMessageId.current = null;
  }, [ensureAssistantResponseType]);

  const onStreamClose = useCallback(() => {
    console.log("SSE Connection closed");
    ensureAssistantResponseType();
    currentAIMessageId.current = null;
  }, [ensureAssistantResponseType]);

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

  const sendMessageWithStreaming = useCallback(
    (userText: string) => {
      const trimmedText = userText.trim();
      if (!trimmedText) {
        Alert.alert("Error", "Message cannot be empty");
        return;
      }

      setText("");
      appendMessage("user", trimmedText);

      const aiMessageId = UUID();
      currentAIMessageId.current = aiMessageId;
      appendMessage("ai_thinking", "", aiMessageId);

      scrollToBottom();

      startStream({
        method: "POST",
        body: { message: trimmedText, history: [] },
      });
    },
    [appendMessage, scrollToBottom, startStream],
  );

  const handleStartCall = useCallback(async () => {
    if (isRecordingRef.current || !isConnectedRef.current) return;

    const permissions = await AudioManager.requestRecordingPermissions();
    if (permissions !== "Granted") return;

    const success = await AudioManager.setAudioSessionActivity(true);
    if (!success) return;

    const result = audioRecorder.start();
    if (result.status === "error") {
      AudioManager.setAudioSessionActivity(false);
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
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

  const keyExtractor = useCallback((item: MessageChat) => item.id, []);

  const handleSubmitText = useCallback(() => {
    sendMessageWithStreaming(text);
  }, [sendMessageWithStreaming, text]);

  const handleLoadMoreMessages = useCallback(() => {
    console.log("loadmoremessages");

    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return;
    }
    messagesQuery.fetchNextPage();
  }, [
    messagesQuery.fetchNextPage,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
  ]);

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
          <FlatList
            inverted
            ref={flatListRef}
            data={messages}
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={9}
            removeClippedSubviews
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            renderItem={({ item }) => {
              if (item.type === "user") {
                return <CardUserMessage item={item} />;
              }
              if (item.type === "ai_response") {
                return <CardAIMessage item={item} />;
              }
              if (item.type === "ai_thinking") {
                return <CardAIThinking />;
              }
              return null;
            }}
            keyExtractor={keyExtractor}
            onEndReached={handleLoadMoreMessages}
            onEndReachedThreshold={0.2}
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
