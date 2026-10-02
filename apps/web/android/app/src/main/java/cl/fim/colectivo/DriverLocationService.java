package cl.fim.colectivo;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

// Vive fuera del WebView: minimizar no detiene GPS ni la transmisión autenticada.
// El usuario ve la notificación del turno y lo detiene con Desconectarme/Salir.
public class DriverLocationService extends Service implements LocationListener {
    static volatile boolean running = false;
    static volatile Location latest;
    static volatile String lastError = "";
    private static final String CHANNEL = "fim_driver_location";
    private static final int NOTICE = 233;
    private LocationManager locations;
    private PowerManager.WakeLock wakeLock;
    private ScheduledExecutorService sender;
    private volatile boolean active;
    private volatile String endpoint = "", token = "";

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        endpoint = intent.getStringExtra("endpoint"); token = intent.getStringExtra("token");
        if (endpoint == null || token == null) { stopSelf(); return START_NOT_STICKY; }
        if (running) return START_NOT_STICKY;
        try {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(new NotificationChannel(CHANNEL, "GPS del turno", NotificationManager.IMPORTANCE_LOW));
            }
            Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notice = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_driver_location).setContentTitle("Fim Colectivo en servicio")
                .setContentText("Compartiendo tu GPS con los pasajeros. Abre la app para terminar el turno.")
                .setContentIntent(pending).setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build();
            ServiceCompat.startForeground(this, NOTICE, notice,
                Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
            locations = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean enabled = false;
            for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                if (locations.isProviderEnabled(provider)) {
                    enabled = true;
                    locations.requestLocationUpdates(provider, 5000L, 5f, this, Looper.getMainLooper());
                    Location previous = locations.getLastKnownLocation(provider);
                    if (isFresh(previous)) onLocationChanged(previous);
                }
            }
            if (!enabled) throw new IllegalStateException("GPS desactivado");
            wakeLock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FimColectivo:DriverGPS");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
            active = true; running = true; lastError = "";
            sender = Executors.newSingleThreadScheduledExecutor();
            sender.scheduleWithFixedDelay(this::sendLatest, 0, 10, TimeUnit.SECONDS);
        } catch (Exception error) {
            lastError = "No se pudo mantener el GPS. Revisa el permiso de ubicación y activa el GPS.";
            stopSelf();
        }
        // No reiniciar a escondidas después de cerrar forzosamente o terminar la app.
        return START_NOT_STICKY;
    }

    private static boolean isFresh(Location location) {
        return location != null && (SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos()) / 1_000_000L < 60_000L;
    }

    @Override public void onLocationChanged(Location location) {
        Location previous = latest;
        if (previous == null || location.getElapsedRealtimeNanos() >= previous.getElapsedRealtimeNanos()) latest = new Location(location);
    }
    @Override public void onProviderDisabled(String provider) { lastError = "Revisa que el GPS siga activado."; }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }

    private void sendLatest() {
        if (!active) return;
        Location location = latest;
        if (!isFresh(location)) { lastError = "Esperando una ubicación GPS reciente."; return; }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setConnectTimeout(8000); connection.setReadTimeout(8000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json");
            byte[] body = new JSONObject().put("lat", location.getLatitude()).put("lng", location.getLongitude())
                .put("capturedAt", location.getTime()).toString().getBytes(StandardCharsets.UTF_8);
            try (java.io.OutputStream stream = connection.getOutputStream()) { stream.write(body); }
            int status = connection.getResponseCode();
            if (!active) return;
            if (status >= 200 && status < 300) lastError = "";
            else if (status == 401 || status == 403 || status == 409) {
                lastError = "La sesión o el turno terminaron. Abre la app para volver a conectarte.";
                stopSelf();
            } else if (status == 404) lastError = "Actualiza la API del servidor para habilitar el GPS en segundo plano.";
            else lastError = "No se pudo transmitir el GPS. Reintentando conexión.";
        } catch (Exception error) { if (active) lastError = "Sin conexión para transmitir el GPS. Reintentando."; }
        finally { if (connection != null) connection.disconnect(); }
    }

    @Override public void onDestroy() {
        active = false; running = false;
        if (sender != null) sender.shutdownNow();
        if (locations != null) locations.removeUpdates(this);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        token = ""; endpoint = ""; latest = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
