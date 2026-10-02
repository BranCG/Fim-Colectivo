package cl.fim.colectivo;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "VoiceRecognition", permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }))
public class VoiceRecognitionPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private String session;
    private final Set<String> cancelled = new HashSet<>();

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("not-allowed"); return; }
        begin(call);
    }

    private void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String id = call.getString("sessionId");
            if (id == null || cancelled.remove(id)) { call.reject("cancelled"); return; }
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("service-not-allowed"); return; }
            destroyRecognizer();
            session = id;
            try {
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    public void onReadyForSpeech(Bundle params) { emit(id, "start", null, false, null); }
                    public void onBeginningOfSpeech() { }
                    public void onRmsChanged(float rms) { }
                    public void onBufferReceived(byte[] buffer) { }
                    public void onEndOfSpeech() { }
                    public void onError(int error) {
                        String name = error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "not-allowed"
                            : error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ? "no-speech"
                            : error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "network" : "audio-capture";
                        emit(id, "error", null, false, name);
                        finish(id);
                    }
                    public void onResults(Bundle data) { emit(id, "result", data, true, null); finish(id); }
                    public void onPartialResults(Bundle data) { emit(id, "result", data, false, null); }
                    public void onEvent(int type, Bundle data) { }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-CL");
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                recognizer.startListening(intent);
                call.resolve();
            } catch (Exception error) { destroyRecognizer(); call.reject("audio-capture", error); }
        });
    }

    private void emit(String id, String type, Bundle bundle, boolean isFinal, String error) {
        if (!id.equals(session)) return;
        JSObject event = new JSObject();
        event.put("sessionId", id); event.put("type", type); event.put("isFinal", isFinal);
        if (bundle != null) {
            ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            event.put("matches", matches == null ? new JSArray() : new JSArray(matches));
        }
        if (error != null) event.put("error", error);
        notifyListeners("speech", event);
    }

    private void finish(String id) {
        if (!id.equals(session)) return;
        emit(id, "end", null, false, null);
        destroyRecognizer();
    }

    private void destroyRecognizer() {
        SpeechRecognizer old = recognizer;
        recognizer = null; session = null;
        if (old != null) { old.cancel(); old.destroy(); }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String id = call.getString("sessionId");
            if (id != null && id.equals(session)) destroyRecognizer();
            else if (id != null) { if (cancelled.size() > 100) cancelled.clear(); cancelled.add(id); }
            call.resolve();
        });
    }

    @Override protected void handleOnPause() { getActivity().runOnUiThread(() -> { if (session != null) finish(session); }); }
    @Override protected void handleOnDestroy() { getActivity().runOnUiThread(this::destroyRecognizer); }
}
