export type SpeechResultsEvent = {
  transcription: string;
  confidence?: number;
  isFinal: boolean;
};

export type SpeechErrorEvent = {
  error: string;
  code: number;
};

export type ExpoSpeechToTextModuleEvents = {
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onSpeechResults: (event: SpeechResultsEvent) => void;
  onSpeechPartialResults: (event: SpeechResultsEvent) => void;
  onSpeechError: (event: SpeechErrorEvent) => void;
};

export type PermissionResponse = {
  status: "granted" | "denied" | "undetermined";
  granted: boolean;
  canAskAgain: boolean;
};
