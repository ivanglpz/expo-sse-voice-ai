import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
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
};
export const ChatInput = ({
  onChange,
  value,
  onSubmit,
  isLoading,
}: InputProps) => {
  return (
    <View
      style={[
        {
          backgroundColor: "#f8f8f8",
          display: "flex",
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
      ]}
    >
      <TextInput
        editable
        multiline
        textAlignVertical="top"
        placeholder="Write something..."
        placeholderTextColor={"black"}
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
        style={[
          {
            color: "black",
            maxHeight: 80,
            flex: 1,
          },
        ]}
      >
        <Text>
          {value?.match(/(\S+\s*|\s+)/g)?.map((e, index) => {
            return <Text key={`words-${index}`}>{e}</Text>;
          })}
        </Text>
      </TextInput>
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {!Boolean(value) ? (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#ccc" : "black",
              padding: 8,
              borderRadius: 100,
              width: 40,
              height: 40,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Ionicons name="mic" color={"white"} size={18} />
            )}
          </TouchableOpacity>
        ) : null}
        {Boolean(value) ? (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#ccc" : "black",
              padding: 8,
              borderRadius: 100,
              width: 40,
              height: 40,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Ionicons name="arrow-up" color={"white"} size={18} />
              // <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              //   <Path
              //     d="M10.0001 14L21.0001 3M10.0001 14L13.5001 21C13.5439 21.0957 13.6144 21.1769 13.703 21.2338C13.7917 21.2906 13.8948 21.3209 14.0001 21.3209C14.1054 21.3209 14.2085 21.2906 14.2971 21.2338C14.3858 21.1769 14.4562 21.0957 14.5001 21L21.0001 3M10.0001 14L3.00007 10.5C2.90433 10.4561 2.8232 10.3857 2.76632 10.2971C2.70944 10.2084 2.6792 10.1053 2.6792 10C2.6792 9.89468 2.70944 9.79158 2.76632 9.70295C2.8232 9.61431 2.90433 9.54387 3.00007 9.5L21.0001 3"
              //     stroke="white"
              //     strokeWidth="1.5"
              //     strokeLinecap="round"
              //     strokeLinejoin="round"
              //   />
              // </Svg>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};
