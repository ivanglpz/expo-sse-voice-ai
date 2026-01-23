import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatItem } from "../components/Chat";
import { CHATS_ATOM, CREATE_CHAT_ATOM } from "../state/chat";

const Index = () => {
  const listChats = useAtomValue(CHATS_ATOM);
  const createChat = useSetAtom(CREATE_CHAT_ATOM);
  const router = useRouter();

  const handleCreate = async () => {
    const newSessionId = await createChat();
    router.push(`/chat/${newSessionId}`);
  };

  if (listChats.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: "white",
            flex: 1,
            padding: 22,
          }}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "600",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              No chats yet
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: "#6b7280",
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Start your first conversation and keep all your chats organized in
              one place.
            </Text>

            <TouchableOpacity
              onPress={handleCreate}
              style={{
                backgroundColor: "#111827",
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 16,
                  fontWeight: "500",
                }}
              >
                Create your first chat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: "white",
          flex: 1,
          padding: 22,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontWeight: "bold", fontSize: 28 }}>Chats</Text>

          <TouchableOpacity
            onPress={handleCreate}
            style={{
              backgroundColor: "#e2e8f0",
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 12,
            }}
          >
            <Ionicons name="add" size={32} color="black" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={listChats}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 15 }} />}
          renderItem={({ item }) => {
            return (
              <ChatItem
                key={`chat-list-item-${item.id}`}
                item={item}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

export default Index;
