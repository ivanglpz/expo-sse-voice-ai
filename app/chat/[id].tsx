import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardMessage } from "../../components/CardMessage";
import { ChatInput } from "../../components/ChatInput";
import { DialogCall } from "../../components/DialogCall";
import { CONFIG } from "../../config/config";
import { useSSEStream } from "../../hooks/useSSE";
import AudioStream from "../../modules/expo-audio-stream";
import {
  CHATS_ATOM,
  CREATE_MESSAGE_ATOM,
  DELETE_MESSAGE_ATOM,
  GET_HISTORY_CHAT,
  Message,
  UPDATE_MESSAGE_ATOM,
} from "../../state/chat";
import { UUID } from "../../utils/uuid";

const Index = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [isCalling, setIsCalling] = useState(false);

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

  const handleStartCall = async () => {
    const hasPerm = await AudioStream.hasPermissions();
    if (!hasPerm.granted) {
      const req = await AudioStream.requestPermissions();
      if (!req.granted) {
        Alert.alert("Microphone permission required");
        return;
      }
    }
    setIsCalling(true);
    AudioStream.startStreaming();
  };

  const handleStopCall = async () => {
    AudioStream.stopStreaming();
    setIsCalling(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Modal visible={isCalling} animationType="slide">
          <SafeAreaView style={{ flex: 1 }}>
            <DialogCall chatId={session.id} onClose={handleStopCall} />
          </SafeAreaView>
        </Modal>
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
            <View>
              <TouchableOpacity onPress={handleStartCall}>
                <Ionicons name="call" size={20} color="black" />
              </TouchableOpacity>
            </View>
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
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Index;
