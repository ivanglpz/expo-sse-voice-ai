import { useAtomValue } from "jotai";
import { Text, TouchableOpacity } from "react-native";
import { Session } from "../state/chat";

type ChatItemProps = {
  onPress: VoidFunction;
  item: Session;
};
export const ChatItem = ({ onPress, item }: ChatItemProps) => {
  const messageAtom = item.messages[0];
  if (!messageAtom) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor: "#e2e8f0",
          borderRadius: 12,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "500" }}>New Chat</Text>

        <Text
          style={{
            marginTop: 8,
            color: "#6b7280",
          }}
        >
          ID: {item.id} · Messages: {item.messages.length}
        </Text>
      </TouchableOpacity>
    );
  }
  const text = useAtomValue(messageAtom.text);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "500" }}>
        {text || "New Chat"}
      </Text>

      <Text
        style={{
          marginTop: 8,
          color: "#6b7280",
        }}
      >
        ID: {item.id} · Messages: {item.messages.length}
      </Text>
    </TouchableOpacity>
  );
};
