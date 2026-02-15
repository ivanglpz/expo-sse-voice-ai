import { Text, TouchableOpacity } from "react-native";
import { Chat } from "../service/chats";

type ChatItemProps = {
  onPress: VoidFunction;
  item: Chat;
};
export const ChatItem = ({ onPress, item }: ChatItemProps) => {
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
        {item?.title || "New Chat"}
      </Text>

      <Text
        style={{
          marginTop: 8,
          color: "#6b7280",
        }}
      >
        ID: {item.id} · Messages: {item.createdAt}
      </Text>
    </TouchableOpacity>
  );
};
