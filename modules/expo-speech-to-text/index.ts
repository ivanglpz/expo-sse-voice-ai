import { EventSubscription } from "expo-modules-core";
import {
  PermissionResponse,
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "./src/ExpoSpeechToText.types";
import ExpoSpeechToTextModule from "./src/ExpoSpeechToTextModule";

/**
 * Solicitar permisos del micrófono
 */
export async function requestPermissions(): Promise<PermissionResponse> {
  return await ExpoSpeechToTextModule.requestPermissions();
}

/**
 * Verificar si tiene permisos del micrófono
 */
export async function hasPermissions(): Promise<PermissionResponse> {
  return await ExpoSpeechToTextModule.hasPermissions();
}

/**
 * Iniciar reconocimiento de voz
 * @param locale Idioma (ej: "es-ES", "en-US"). Por defecto "es-ES"
 */
export function startListening(locale: string = "es-ES"): void {
  ExpoSpeechToTextModule.startListening(locale);
}

/**
 * Detener reconocimiento de voz
 */
export function stopListening(): void {
  ExpoSpeechToTextModule.stopListening();
}

/**
 * Verificar si está escuchando actualmente
 */
export function isListening(): boolean {
  return ExpoSpeechToTextModule.isListening();
}

/**
 * Cancelar reconocimiento de voz
 */
export function cancel(): void {
  ExpoSpeechToTextModule.cancel();
}

/**
 * Escuchar cuando inicia el reconocimiento
 */
export function addSpeechStartListener(
  listener: () => void,
): EventSubscription {
  return ExpoSpeechToTextModule.addListener("onSpeechStart", listener);
}

/**
 * Escuchar cuando termina el reconocimiento
 */
export function addSpeechEndListener(listener: () => void): EventSubscription {
  return ExpoSpeechToTextModule.addListener("onSpeechEnd", listener);
}

/**
 * Escuchar resultados finales de transcripción
 */
export function addSpeechResultsListener(
  listener: (event: SpeechResultsEvent) => void,
): EventSubscription {
  return ExpoSpeechToTextModule.addListener("onSpeechResults", listener);
}

/**
 * Escuchar resultados parciales de transcripción (en tiempo real)
 */
export function addSpeechPartialResultsListener(
  listener: (event: SpeechResultsEvent) => void,
): EventSubscription {
  return ExpoSpeechToTextModule.addListener("onSpeechPartialResults", listener);
}

/**
 * Escuchar errores
 */
export function addSpeechErrorListener(
  listener: (event: SpeechErrorEvent) => void,
): EventSubscription {
  return ExpoSpeechToTextModule.addListener("onSpeechError", listener);
}
