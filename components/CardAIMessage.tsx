import { memo } from "react";
import { Text, View } from "react-native";
import { MessageChat } from "../service/chats";

export const CardAIMessage = memo(({ item }: { item: MessageChat }) => {
  return (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
        gap: 8,
      }}
    >
      <View
        style={{
          padding: 10,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "#333" }}>{item.content}</Text>
      </View>
    </View>
  );
});
