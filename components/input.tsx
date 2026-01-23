import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { ChipStatus } from "./ChipStatus";

const loremText = `Lorem ipsum, dolor sit amet consectetur adipisicing elit. Doloremque non maxime tempora explicabo quae dolorem modi ratione illum. Est ducimus id quam nisi facere. Sint magnam quod adipisci neque voluptatibus?`;

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
};
export const InputAutoResizing = ({
  onChange,
  value,
  onSubmit,
  isLoading,
}: InputProps) => {
  return (
    <View style={[]}>
      <View
        style={[
          {
            backgroundColor: "#f8f8f8",
            display: "flex",
            flexDirection: "column",
            padding: 8,
            borderWidth: 1,
            borderColor: "#d7d7d7",
            borderRadius: 8,
            width: "100%",
            gap: 8,
            position: "relative",
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
              width: "100%",
              padding: 8,
              color: "black",
              maxHeight: 80,
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
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <ChipStatus />
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#ccc" : "black",
              padding: 8,
              borderRadius: 8,
              width: 38,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M10.0001 14L21.0001 3M10.0001 14L13.5001 21C13.5439 21.0957 13.6144 21.1769 13.703 21.2338C13.7917 21.2906 13.8948 21.3209 14.0001 21.3209C14.1054 21.3209 14.2085 21.2906 14.2971 21.2338C14.3858 21.1769 14.4562 21.0957 14.5001 21L21.0001 3M10.0001 14L3.00007 10.5C2.90433 10.4561 2.8232 10.3857 2.76632 10.2971C2.70944 10.2084 2.6792 10.1053 2.6792 10C2.6792 9.89468 2.70944 9.79158 2.76632 9.70295C2.8232 9.61431 2.90433 9.54387 3.00007 9.5L21.0001 3"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
