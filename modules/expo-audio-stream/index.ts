// Reexport the native module. On web, it will be resolved to ExpoAudioStreamModule.web.ts
// and on native platforms to ExpoAudioStreamModule.ts
export * from "./src/ExpoAudioStream.types";
export { default } from "./src/ExpoAudioStreamModule";
