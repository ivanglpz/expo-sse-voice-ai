package expo.modules.audiostream

import android.Manifest
import android.content.Context
import android.media.*
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.interfaces.permissions.Permissions
import android.media.audiofx.NoiseSuppressor
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.AcousticEchoCanceler
class ExpoAudioStreamModule : Module() {
    private var audioRecord: AudioRecord? = null
    private var isStreaming = false
    private var isMuted = false // ✅ variable de mute
    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val encoding = AudioFormat.ENCODING_PCM_16BIT
    private val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, encoding)
    private val bufferSize = minBufferSize * 2

    private var streamingThread: HandlerThread? = null
    private var streamingHandler: Handler? = null

    private var noiseSuppressor: NoiseSuppressor? = null
    private var agc: AutomaticGainControl? = null
    private var aec: AcousticEchoCanceler? = null

    override fun definition() = ModuleDefinition {
        Name("ExpoAudioStream")
        Events("onAudioChunk", "onStreamingStart", "onStreamingStop", "onAudioError")

        AsyncFunction("requestPermissions") { promise: Promise ->
            Permissions.askForPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }

        AsyncFunction("hasPermissions") { promise: Promise ->
            Permissions.getPermissionsWithPermissionsManager(
                appContext.permissions,
                promise,
                Manifest.permission.RECORD_AUDIO
            )
        }

        Function("startStreaming") {
            if (isStreaming) throw Exception("Ya está transmitiendo")
            isStreaming = true

            val mainHandler = Handler(Looper.getMainLooper())

            streamingThread = HandlerThread("AudioStreamingThread").apply { start() }
            streamingHandler = Handler(streamingThread!!.looper)

            streamingHandler?.post {
                try {
                    releaseAudioResources()

                    audioRecord = AudioRecord(
                        MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                        sampleRate,
                        channelConfig,
                        encoding,
                        bufferSize
                    )

                    if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                        throw Exception("No se pudo inicializar AudioRecord")
                    }

                    audioRecord?.audioSessionId?.let { sessionId ->
                        if (NoiseSuppressor.isAvailable()) {
                            noiseSuppressor = NoiseSuppressor.create(sessionId)
                            noiseSuppressor?.enabled = true
                        }
                        if (AutomaticGainControl.isAvailable()) {
                            agc = AutomaticGainControl.create(sessionId)
                            agc?.enabled = true
                        }
                        if (AcousticEchoCanceler.isAvailable()) {
                            aec = AcousticEchoCanceler.create(sessionId)
                            aec?.enabled = true
                        }
                    }

                    audioRecord?.startRecording()

                    mainHandler.post {
                        sendEvent("onStreamingStart", bundleOf())
                    }

                    val buffer = ByteArray(bufferSize)

                    while (isStreaming) {
                        val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0

                        if (read > 0 && !isMuted) { // ✅ solo enviar si no está mute
                            val chunk = buffer.copyOfRange(0, read)
                            mainHandler.post {
                                sendEvent("onAudioChunk", bundleOf("chunk" to chunk))
                            }
                        } else if (read < 0) {
                            val errorMsg = when (read) {
                                AudioRecord.ERROR_INVALID_OPERATION -> "Operación inválida"
                                AudioRecord.ERROR_BAD_VALUE -> "Valor incorrecto"
                                AudioRecord.ERROR_DEAD_OBJECT -> "Objeto muerto"
                                AudioRecord.ERROR -> "Error desconocido"
                                else -> "Error de lectura: $read"
                            }
                            mainHandler.post {
                                sendEvent("onAudioError", bundleOf("error" to errorMsg))
                            }
                            break
                        }
                    }

                } catch (e: Exception) {
                    mainHandler.post {
                        sendEvent("onAudioError", bundleOf("error" to e.message))
                    }
                } finally {
                    isStreaming = false
                    releaseAudioResources()
                    mainHandler.post {
                        sendEvent("onStreamingStop", bundleOf())
                    }
                }
            }

            null
        }

        Function("stopStreaming") {
            if (!isStreaming) return@Function null
            isStreaming = false

            streamingHandler?.post {
                releaseAudioResources()
            }

            streamingHandler?.removeCallbacksAndMessages(null)
            streamingThread?.quitSafely()
            streamingThread = null
            streamingHandler = null

            null
        }

        Function("isStreaming") {
            isStreaming as Any?
        }

        // ✅ NUEVAS funciones para mute
        Function("setMute") { mute: Boolean ->
            isMuted = mute
            null
        }

        Function("isMuted") {
            isMuted
        }

        Function("getAudioConfig") {
            mapOf(
                "sampleRate" to sampleRate,
                "channels" to 1,
                "encoding" to "pcm_s16le",
                "bitDepth" to 16
            )
        }

        OnDestroy {
            isStreaming = false
            streamingHandler?.removeCallbacksAndMessages(null)
            streamingThread?.quitSafely()
            streamingThread = null
            streamingHandler = null
            releaseAudioResources()
        }
    }

    private fun releaseAudioResources() {
        noiseSuppressor?.release()
        noiseSuppressor = null

        agc?.release()
        agc = null

        aec?.release()
        aec = null

        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
    }
}