import { NativeModule, requireNativeModule } from "expo";
import {
  ExpoSpeechToTextModuleEvents,
  PermissionResponse,
} from "./ExpoSpeechToText.types";

declare class ExpoSpeechToTextModule extends NativeModule<ExpoSpeechToTextModuleEvents> {
  requestPermissions(): Promise<PermissionResponse>;
  hasPermissions(): Promise<PermissionResponse>;
  startListening(locale?: string): void;
  stopListening(): void;
  isListening(): boolean;
  cancel(): void;
}

export default requireNativeModule<ExpoSpeechToTextModule>("ExpoSpeechToText");
