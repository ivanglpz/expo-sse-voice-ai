import { NativeModule, requireNativeModule } from "expo";
import { ExpoAudioStreamModuleEvents } from "./ExpoAudioStream.types";

declare class ExpoAudioStreamModule extends NativeModule<ExpoAudioStreamModuleEvents> {
  startStreaming(): void;
  stopStreaming(): void;
  isStreaming(): boolean;
  requestPermissions(): Promise<{ granted: boolean }>;
  hasPermissions(): Promise<{ granted: boolean }>;

  // ✅ Métodos de mute
  setMute(mute: boolean): void;
  isMuted(): boolean;
}

export default requireNativeModule<ExpoAudioStreamModule>("ExpoAudioStream");
