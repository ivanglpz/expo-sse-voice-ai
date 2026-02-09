import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Text,
  TouchableOpacity,
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
  iosCategory: "record",
  iosMode: "default",
  iosOptions: [],
});
const audioRecorder = new AudioRecorder();

const sampleRate = 16000;
const bufferLength = Math.floor(sampleRate * 0.02); // 20ms => 320 samples
const channelCount = 1;
const float32ToInt16 = (input: Float32Array) => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

const Index = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [isRecording, setIsRecording] = useState(false);
  if (!params.id) {
    return <Redirect href="/" />;
  }

  const LIST_SESSIONS = useAtomValue(CHATS_ATOM);
  const session = LIST_SESSIONS.find((s) => s.id === params.id);

  if (!session) {
    return <Redirect href="/" />;
  }

  const [text, setText] = useState("");
  const CREATE_MESSAGE = useSetAtom(CREATE_MESSAGE_ATOM);
  const DELETE_MESSAGE = useSetAtom(DELETE_MESSAGE_ATOM);
  const GET_CONTEXT = useSetAtom(GET_HISTORY_CHAT);
  const UPDATE_MESSAGE = useSetAtom(UPDATE_MESSAGE_ATOM);
  const flatListRef = useRef<FlatList<Message>>(null);

  const currentAIMessageId = useRef<string | null>(null);

  const { isStreaming, startStream } = useSSEStream({
    url: `${CONFIG.API_URL}/chat`,
    onMessage: (data) => {
      if (data.content && currentAIMessageId.current) {
        UPDATE_MESSAGE({
          sessionId: session.id,
          messageId: currentAIMessageId.current,
          newText: data.content,
        });

        flatListRef.current?.scrollToEnd({ animated: false });
      }
    },
    onError: (error) => {
      if (currentAIMessageId.current) {
        DELETE_MESSAGE({
          chatId: session.id,
          messageId: currentAIMessageId.current,
        });
        Alert.alert("Error", "Failed to get AI response");
      }

      currentAIMessageId.current = null;
    },
    onOpen: () => {
      console.log("SSE Connection opened");
    },
    onClose: () => {
      console.log("SSE connection closed");

      currentAIMessageId.current = null;
    },
    timeout: 3000,
  });

  const sendMessageWithStreaming = async (userText: string) => {
    if (!Boolean(userText?.trim())) {
      Alert.alert("Error", "Message cannot be empty");
      return;
    }

    setText("");
    const userMessageId = UUID();
    CREATE_MESSAGE({
      chatId: session.id,
      message: {
        id: userMessageId,
        type: "user",
        text: atom(userText),
        timestamp: Date.now(),
      },
    });
    flatListRef.current?.scrollToEnd({ animated: false });

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

    startStream({
      method: "POST",
      body: {
        message: userText,
        history: history,
      },
    });
  };

  const { send, disconnect, isConnected } = useSocketIO<Message>(
    CONFIG.API_URL,
    {
      autoConnect: true,
      onConnect: () =>
        console.log(`🟢 Socket.IO connected for ${CONFIG.API_URL}`),
      onDisconnect: (reason) => {},
      onError: (err) => {},
      onMessage: (event, data) => {
        if (event === "transcript:final") {
          const transcriptText =
            typeof data === "object" && data !== null && "text" in data
              ? String((data as any).text ?? "")
              : "";

          if (transcriptText.trim().length > 0) {
            console.log(
              `[VOICE] ✅ Transcripción completada para chat ${session.id}: "${transcriptText}"`,
            );
          } else {
            console.log(
              `[VOICE] ⚠️ Se recibió transcript:final pero llegó vacío para chat ${session.id}`,
            );
          }
        }
      },
    },
  );

  const handleStartCall = async () => {
    if (isRecording || !isConnected) return;

    const permissions = await AudioManager.requestRecordingPermissions();
    if (permissions !== "Granted") return;

    const success = await AudioManager.setAudioSessionActivity(true);
    if (!success) return;

    send("audio:start", {
      chatId: session.id,
      sampleRate: 16000,
      channels: 1,
      encoding: "pcm_s16le",
    });

    const result = audioRecorder.start();
    if (result.status === "error") return;

    setIsRecording(true);
  };

  const handleStopCall = async () => {
    if (!isRecording) return;

    audioRecorder.stop();
    send("audio:stop");
    setIsRecording(false);
    AudioManager.setAudioSessionActivity(false);
  };

  useEffect(() => {
    audioRecorder.onAudioReady(
      {
        sampleRate,
        bufferLength,
        channelCount,
      },
      ({ buffer }) => {
        if (!isRecording || !isConnected) return;
        const mono = buffer.getChannelData(0);
        const pcm16 = float32ToInt16(mono);
        send("audio:chunk", new Uint8Array(pcm16.buffer));
      },
    );

    return () => {
      audioRecorder.clearOnAudioReady();
    };
  }, [isRecording, isConnected]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: "white",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 22,
          }}
        >
          <View
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontWeight: "bold", fontSize: 18 }}>Chat</Text>
              <Text style={{ fontSize: 12, opacity: 0.5 }}>{session.id}</Text>
            </View>
            <View></View>
          </View>

          <FlatList
            data={session.messages}
            ref={flatListRef}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            renderItem={(props) => {
              return (
                <CardMessage item={props?.item} key={`chat-${props?.index}`} />
              );
            }}
          />

          {isStreaming && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 12, opacity: 0.6 }}>
                AI is thinking...
              </Text>
            </View>
          )}

          <ChatInput
            value={text}
            onChange={(e) => setText(e)}
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

export default Index;
