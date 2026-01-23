import { useAtomValue } from "jotai";
import { Text, View } from "react-native";
import { Message } from "../state/chat";

export const CardMessage = ({ item }: { item: Message }) => {
  const isUser = item.type === "user";
  const text = useAtomValue(item.text);
  return (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: "100%",
        gap: 8,
      }}
    >
      <Text>{item.type === "user" ? "You" : "  Ivan assistant"}</Text>
      <View
        style={{
          maxWidth: "75%",
          backgroundColor: isUser ? "#000" : "#ECECEC",
          padding: 10,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: isUser ? "#ffffff" : "#333" }}>{text}</Text>
      </View>
      <Text style={{ fontSize: 12, opacity: 0.5 }}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );
};
