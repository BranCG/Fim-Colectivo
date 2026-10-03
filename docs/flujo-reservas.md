# Flujo de reservas y avisos

La aplicación comunica la elección de efectivo o RutPay y el acuse del conductor.
No cobra, no abre RutPay, no contiene pasarela y no muestra importes del viaje.
El pago se acuerda y realiza directamente entre las personas.

## Estados y cupos

| Acción | Estado persistido | Efecto en asientos ocupados |
| --- | --- | --- |
| Pasajero elige un conductor en línea y reserva con su GPS | `pendiente_chofer` | Sin cambio |
| Conductor acepta con «Sí» | `reservado` | Suma la cantidad reservada |
| Conductor indica «A bordo» | `abordado` | Sin cambio; el cupo sigue ocupado |
| Pasajero elige efectivo o RutPay | `pagando` | Sin cambio; se avisa al conductor |
| Conductor acepta el aviso con «Sí» | `pagado` | Sin cambio |
| Pasajero solicita parada | `parada_solicitada` | Resta inmediatamente la cantidad reservada |
| Conductor marca «Pasajero descendió» | `completado` | Sin cambio; el cupo ya estaba libre |

`pagando` y `pagado` son nombres heredados de la base de datos: aquí significan
aviso pendiente y aviso aceptado. No acreditan que se haya entregado dinero.
Se conservaron las columnas antiguas para evitar una migración destructiva;
la API oculta importes y datos bancarios en sus respuestas.

El vehículo continúa disponible si le quedan otros asientos libres. Los reintentos
no vuelven a sumar ni restar cupos. La aceptación y los cambios de cupos usan
transacciones serializables con reintento ante conflictos de PostgreSQL.
El contador manual no puede liberar asientos que todavía ocupan reservas activas.

## Pantallas y voz

- Tras la aceptación, el conductor ve el punto de recogida del pasajero.
- Tras «A bordo», el pasajero elige «Pagar en efectivo» o «Pagar con RutPay».
- El conductor escucha «[Nombre] paga con [método]. ¿Aceptas?».
- Tras su «Sí», se oculta el marcador del pasajero y su pantalla muestra el mapa
  siguiendo al conductor y el botón «Solicitar parada».
- Al solicitar parada, el conductor escucha «Deja a [Nombre] en la siguiente parada».
- Si hay varias personas esperando subir, «A bordo» pide seleccionar a cuál se refiere;
  no elige automáticamente a una persona equivocada.
- Se conservan botones como alternativa a la voz. Android usa el plugin local
  `VoiceRecognition` y solicita permiso de micrófono cuando se utiliza.
- La voz escucha en primer plano, evita actuar durante sus propias locuciones
  y vuelve a escuchar después de un silencio. Los avisos y estados se recuperan
  por consulta al servidor al reconectar o recargar.

## Verificaciones realizadas

- 12 pruebas de transiciones: ambos métodos, último cupo concurrente, reintentos,
  permisos por reserva, cancelación, GPS y contador manual.
- 4 pruebas de vigencia del GPS: conservar turno con actualizaciones nativas,
  vencer posiciones antiguas, evitar reconectar un turno terminado y carreras de actualización.
- 2 pruebas del parser de voz: comandos explícitos y rechazo de frases ambiguas.
- Dos recorridos de navegador con pasajero y conductor, uno por método: voz simulada,
  recuperación tras silencio, recarga, error de red al pedir parada y reintento.
  Incluyen la regresión de una lista vacía tras aceptar el método: el pasajero
  permanece en ruta, también al recargar y ante un fallo de la consulta de estado.
- Comprobación TypeScript de API, aplicación y administrador.
- Exportación web para Capacitor y compilación Android `assembleDebug` correctas,
  incluido el plugin nativo de voz.

Los tests de transacciones usan un doble de Prisma que simula conflictos de
serialización. Los recorridos de navegador usan respuestas API, GPS y micrófono
controlados; no prueban un servidor PostgreSQL real ni el hardware Android.

Comandos desde la raíz, con dependencias instaladas:

```powershell
npm run test --workspace=apps/api
npm run test:voice --workspace=apps/web
npx tsc --noEmit --incremental false -p apps/web/tsconfig.json
npx tsc --noEmit --incremental false -p apps/admin/tsconfig.json
```

El test de voz requiere Node 24 para cargar el parser TypeScript.
Para el recorrido de navegador, iniciar Next en el puerto 3010 con
`NEXT_PUBLIC_API_URL=http://127.0.0.1:4011` y `NEXT_EXPORT=false`, y ejecutar
`node apps/web/tests/reservation-flow.browser.cjs` con Playwright disponible.
Usa Edge instalado; no requiere que exista un servidor en el puerto 4011.
Las capturas se guardan en `apps/web/test-results/` y están excluidas de Git.

Una lista vacía de reservas no significa que el pasajero haya descendido.
La pantalla consulta `GET /colectivos/reservas/:id/estado`, que verifica que la
reserva pertenezca al pasajero autenticado, y solo cierra con un estado terminal
explícito o el evento de finalización de esa reserva. El aviso
`colectivo:pago-confirmado` también mantiene al pasajero en ruta en clientes
conectados a servidores que todavía utilizan ese evento.

## Android y puesta en servicio

Compilar primero la exportación web con `NEXT_EXPORT=true` y la URL de la API,
luego ejecutar `cap sync android` y `assembleDebug` desde el proyecto Android.
La sincronización debe ejecutarse en cada entorno para resolver sus dependencias.

Antes de distribuir esta APK hay que desplegar la API de esta misma versión y
actualizar ambos roles. Un servidor o cliente anterior no garantiza este flujo.
No se modificó la base de datos de producción ni se desplegaron estos cambios.

El despliegue de GitHub Actions se activa al integrar en `main`. La copia de EC2
en `/var/www/fim-colectivo` debe estar en `main` y sin cambios en archivos
versionados. El workflow valida compilación, tipos y pruebas de reservas, instala
el commit que pasó esa validación mediante avance rápido y comprueba API/BD y web.
Si la copia del servidor está en `BrandonC`, el despliegue se detiene para poder
revisar esa rama antes de cambiarla. No ejecuta migraciones ni scripts de semillas.
Una comprobación de salud fallida marca el despliegue como fallido; no revierte
automáticamente los contenedores. El log conserva el commit anterior para recuperación.

La prueba pendiente en dispositivos reales debe cubrir dos teléfonos: permisos
de micrófono/GPS, «Sí», «A bordo», ambos métodos, GPS del conductor, parada y
recuperación tras pérdida de conexión. Comprobar también el servicio de
reconocimiento instalado en cada Android.

## GPS del conductor al minimizar Android

La APK usa `DriverLocationService`, un servicio nativo de ubicación iniciado
con la app visible al estar en servicio. Muestra una notificación persistente,
recibe ubicaciones de Android y las envía cada 10 segundos mediante una petición
HTTPS autenticada a `/api/colectivos/conductor/ubicacion`. Así no depende de que
el JavaScript o el WebSocket del WebView continúen ejecutándose en segundo plano.
El token permanece en memoria y no se registra en logs.

El servicio requiere permiso de ubicación precisa y GPS activo. Se detiene al
desconectarse, cerrar sesión o quitar la app de las aplicaciones recientes.
No se inicia automáticamente tras un cierre forzoso. El servicio mantiene despierta
la CPU durante el turno y libera ese recurso al detenerse.
La implementación sigue los requisitos de los
[servicios de ubicación de Android](https://developer.android.com/develop/background-work/services/fgs/service-types#location).

El servidor no termina el turno cuando se desconecta el WebSocket. Comprueba la
última actualización GPS cada 30 segundos y marca fuera de servicio a quien lleve
más de 90 segundos sin enviar una posición válida. Una desconexión voluntaria
sigue siendo inmediata. Si se pierde el GPS, el pasajero conserva la última posición
del viaje y ve un aviso de que está esperando una actualización.

En la comprobación del servidor publicada el 2 de octubre de 2026, la ruta de
solicitar parada devolvía HTTP 404 antes de autenticar: aún no estaba desplegada.
La APK muestra ahora un mensaje específico para ese caso. El botón solo confirma
la parada cuando la API devuelve el estado persistido; nunca simula una liberación.
Las pruebas de navegador cubren ese 404, un error 500, reintento y conservación
del marcador aunque el conductor no figure en la lista de vehículos.

Después del pull, reconstruir API y web antes de probar la nueva APK. En un teléfono
real, iniciar el turno con la app abierta, verificar la notificación de GPS, minimizar
durante al menos dos minutos y comprobar desde el pasajero el movimiento, la parada
y la liberación única del asiento. Verificar que Desconectarme y Salir quiten la
notificación y detengan las actualizaciones. No hubo dispositivo ni emulador disponible
en esta revisión: la compilación nativa no sustituye esta prueba de hardware.
