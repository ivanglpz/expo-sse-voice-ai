import { memo } from "react";
import { Text, View } from "react-native";

export const CardAIThinking = memo(() => {
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
        <Text style={{ color: "#333" }}>AI is thinking...</Text>
      </View>
    </View>
  );
});
