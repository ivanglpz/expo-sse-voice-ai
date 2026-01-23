import { useAtomValue } from "jotai";
import { Animated, StyleSheet, Text, View } from "react-native";
import { statusAtom } from "../state/status";

export const ChipStatus = () => {
  const query = useAtomValue(statusAtom);

  // ColouseEffect, res según estado
  const backgroundColor = query.isLoading
    ? "#FFC107"
    : query.isError
      ? "#F44336"
      : query.status === "success"
        ? "#37c73b"
        : "#9E9E9E"; // fallback

  const label = query.isLoading
    ? "Checking..."
    : query.isError
      ? "Offline"
      : query.status === "success"
        ? `Online`
        : "Unknown";

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          backgroundColor: "transparent",
          borderColor: backgroundColor,
          borderWidth: 1,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        },
      ]}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: backgroundColor,
          marginRight: 6,
        }}
      />
      <Text style={[styles.text, { color: backgroundColor }]}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 12,
  },
});
