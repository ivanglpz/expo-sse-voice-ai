import { memo } from "react";
import { Text, View } from "react-native";
import { MessageChat } from "../service/chats";

export const CardUserMessage = memo(({ item }: { item: MessageChat }) => {
  return (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        width: "100%",
        gap: 8,
      }}
    >
      <View
        style={{
          backgroundColor: "#000",
          padding: 10,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "#ffffff" }}>{item.content}</Text>
      </View>
    </View>
  );
});
