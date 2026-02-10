import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isRecording: boolean;
  onStartAudio?: () => void;
  onStopAudio?: () => void;
};
export const ChatInput = (props: InputProps) => {
  const {
    onChange,
    value,
    onSubmit,
    isLoading,
    isRecording,
    onStartAudio,
    onStopAudio,
  } = props;

  const hasValue = Boolean(value);
  const isBusy = isLoading && !isRecording;
  const handleAudioPress = isRecording ? onStopAudio : onStartAudio;
  const isAudioActionDisabled = isBusy || !handleAudioPress;
  const buttonStyle = [
    styles.actionButton,
    isBusy && styles.actionButtonDisabled,
  ];
  const audioButtonStyle = [
    styles.actionButton,
    isRecording ? styles.actionButtonDanger : null,
    (isBusy || !handleAudioPress) && styles.actionButtonDisabled,
  ];

  return (
    <View style={styles.container}>
      <TextInput
        editable
        multiline
        textAlignVertical="top"
        placeholder="Type a message..."
        placeholderTextColor="black"
        scrollEnabled
        onChangeText={(v) => {
          if (v === value) {
            return;
          }
          onChange(v);
        }}
        autoCorrect={false}
        autoComplete="off" // desactiva autocomplete
        spellCheck={false}
        keyboardType="default"
        textContentType="none"
        importantForAutofill="no"
        style={styles.input}
      >
        <Text>
          {value?.match(/(\S+\s*|\s+)/g)?.map((e, index) => {
            return <Text key={`words-${index}`}>{e}</Text>;
          })}
        </Text>
      </TextInput>
      <View style={styles.actionsContainer}>
        {!hasValue ? (
          <TouchableOpacity
            onPress={handleAudioPress}
            disabled={isAudioActionDisabled}
            style={audioButtonStyle}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={18}
                color="white"
              />
            )}
          </TouchableOpacity>
        ) : null}
        {hasValue ? (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isBusy}
            style={buttonStyle}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="arrow-up" color="white" size={18} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f8f8",
    flexDirection: "row",
    padding: 8,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    borderRadius: 28,
    width: "100%",
    gap: 8,
    position: "relative",
    alignItems: "flex-end",
  },
  input: {
    color: "black",
    maxHeight: 80,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    backgroundColor: "#207de6",
    padding: 8,
    borderRadius: 100,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonDisabled: {
    backgroundColor: "#ccc",
  },
  actionButtonDanger: {
    backgroundColor: "#dc2626",
  },
});
