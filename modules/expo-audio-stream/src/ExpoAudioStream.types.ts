export type ExpoAudioStreamModuleEvents = {
  onAudioChunk: (params: { chunk: number[] }) => void;
  onStreamingStart: () => void;
  onStreamingStop: () => void;
  onAudioError: (params: { error: string }) => void;
  onTranscriptionReady: (params: { text: string }) => void; // NUEVO
};
