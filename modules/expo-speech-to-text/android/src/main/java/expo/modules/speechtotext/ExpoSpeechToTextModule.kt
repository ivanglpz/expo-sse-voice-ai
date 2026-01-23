package expo.modules.speechtotext

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.interfaces.permissions.Permissions

class ExpoSpeechToTextModule : Module() {
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false

    override fun definition() = ModuleDefinition {
        Name("ExpoSpeechToText")

        Events(
            "onSpeechStart",
            "onSpeechEnd",
            "onSpeechResults",
            "onSpeechPartialResults",
            "onSpeechError"
        )

        // Solicitar permisos
        AsyncFunction("requestPermissions") { promise: Promise ->
            Permissions.askForPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }

        // Verificar permisos
        AsyncFunction("hasPermissions") { promise: Promise ->
            Permissions.getPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }

        // Iniciar reconocimiento de voz
        Function("startListening") { locale: String? ->
            val context = appContext.reactContext ?: throw Exception("Context no disponible")
            if (isListening) throw Exception("Ya está escuchando")
            if (!SpeechRecognizer.isRecognitionAvailable(context)) throw Exception("Reconocimiento de voz no disponible")

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale ?: "es-ES")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }

            val mainHandler = Handler(Looper.getMainLooper())
            mainHandler.post {
                // Destruir instancia anterior si existe
                speechRecognizer?.destroy()

                // Crear nueva instancia EN HILO PRINCIPAL
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)

                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        isListening = true
                        sendEvent("onSpeechStart", bundleOf())
                    }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {
                        isListening = false
                        sendEvent("onSpeechEnd", bundleOf())
                    }
                    override fun onError(error: Int) {
                        isListening = false
                        val errorMessage = when (error) {
                            SpeechRecognizer.ERROR_AUDIO -> "Error de audio"
                            SpeechRecognizer.ERROR_CLIENT -> "Error del cliente"
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permisos de micrófono insuficientes"
                            SpeechRecognizer.ERROR_NETWORK -> "Error de red"
                            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Tiempo de espera de red agotado"
                            SpeechRecognizer.ERROR_NO_MATCH -> "No se detectó voz"
                            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Reconocedor ocupado"
                            SpeechRecognizer.ERROR_SERVER -> "Error del servidor"
                            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No se detectó voz (timeout)"
                            else -> "Error desconocido: $error"
                        }
                        sendEvent("onSpeechError", bundleOf("error" to errorMessage, "code" to error))
                    }
                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val confidences = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
                        if (!matches.isNullOrEmpty()) {
                            val transcription = matches[0]
                            val confidence = confidences?.getOrNull(0) ?: 0f
                            sendEvent("onSpeechResults", bundleOf(
                                "transcription" to transcription,
                                "confidence" to confidence,
                                "isFinal" to true
                            ))
                        }
                        isListening = false
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (!matches.isNullOrEmpty()) {
                            val transcription = matches[0]
                            sendEvent("onSpeechPartialResults", bundleOf(
                                "transcription" to transcription,
                                "isFinal" to false
                            ))
                        }
                    }
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                // Iniciar reconocimiento EN HILO PRINCIPAL
                speechRecognizer?.startListening(intent)
            }

            return@Function null
        }

        // Detener reconocimiento
        Function("stopListening") {
            if (isListening) {
                Handler(Looper.getMainLooper()).post {
                    speechRecognizer?.stopListening()
                }
                isListening = false
            }
            return@Function null
        }

        // Verificar si está escuchando
        Function("isListening") { return@Function isListening }

        // Cancelar reconocimiento
        Function("cancel") {
            Handler(Looper.getMainLooper()).post {
                speechRecognizer?.cancel()
            }
            isListening = false
            return@Function null
        }

        // Limpiar recursos al destruir módulo
        OnDestroy {
            speechRecognizer?.destroy()
            speechRecognizer = null
            isListening = false
        }
    }
}
