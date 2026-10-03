package cl.fim.colectivo;

import android.Manifest;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.net.URI;

@CapacitorPlugin(name = "DriverLocation", permissions = @Permission(alias = "location", strings = {
    Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
}))
public class DriverLocationPlugin extends Plugin {
    private int generation = 0;

    @PluginMethod public void start(PluginCall call) {
        call.getData().put("generation", ++generation);
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermission");
        } else begin(call);
    }

    @PermissionCallback private void locationPermission(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Permite la ubicación precisa para compartir el GPS durante el turno.");
            return;
        }
        begin(call);
    }

    private void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (call.getInt("generation", -1) != generation) { call.reject("Inicio cancelado."); return; }
            if (!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED)) {
                call.reject("Abre la app para iniciar el GPS del turno."); return;
            }
            String endpoint = call.getString("endpoint", "");
            String token = call.getString("token", "");
            try {
                URI uri = new URI(endpoint);
                if (!"https".equals(uri.getScheme()) || uri.getHost() == null || token.isEmpty()) {
                    call.reject("La sesión o la conexión segura no están disponibles."); return;
                }
                Intent intent = new Intent(getContext(), DriverLocationService.class);
                intent.putExtra("endpoint", endpoint);
                intent.putExtra("token", token);
                ContextCompat.startForegroundService(getContext(), intent);
                call.resolve();
            } catch (Exception error) { call.reject("No se pudo iniciar el GPS del turno.", error); }
        });
    }

    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", DriverLocationService.running);
        result.put("error", DriverLocationService.lastError);
        android.location.Location location = DriverLocationService.latest;
        if (location != null) {
            result.put("lat", location.getLatitude()); result.put("lng", location.getLongitude());
            result.put("capturedAt", location.getTime());
        }
        call.resolve(result);
    }

    @PluginMethod public void stop(PluginCall call) {
        generation++;
        getContext().stopService(new Intent(getContext(), DriverLocationService.class));
        call.resolve();
    }
}
