import { memo } from "react";
import { View } from "react-native";

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
        <View
          style={{
            backgroundColor: "black",
            borderRadius: 100,
            width: 20,
            height: 20,
          }}
        />
      </View>
    </View>
  );
});
