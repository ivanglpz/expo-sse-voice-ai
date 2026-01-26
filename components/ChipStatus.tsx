import { useAtomValue } from "jotai";
import { Animated, StyleSheet, Text, View } from "react-native";
import { statusAtom } from "../state/status";

type StatusResult = {
  color: string;
  label: string;
};

type StatusValue = "success" | "pending" | "error";

const Status = (
  isLoading: boolean,
  isError: boolean,
  status?: StatusValue,
): StatusResult => {
  if (isLoading) {
    return {
      color: "#FFC107",
      label: "Checking...",
    };
  }

  if (isError) {
    return {
      color: "#F44336",
      label: "Offline",
    };
  }

  if (status === "success") {
    return {
      color: "#37c73b",
      label: "Online",
    };
  }

  return {
    color: "#9E9E9E",
    label: "Unknown",
  };
};

export const ChipStatus = () => {
  const query = useAtomValue(statusAtom);

  const { color, label } = Status(query.isLoading, query.isError, query.status);

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          backgroundColor: "transparent",
          borderColor: color,
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
          backgroundColor: color,
          marginRight: 6,
        }}
      />
      <Text style={[styles.text, { color }]}>{label}</Text>
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
