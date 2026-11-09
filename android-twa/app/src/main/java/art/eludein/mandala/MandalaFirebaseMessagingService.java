package art.eludein.mandala;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * FCM natif — canal mandala_alerts (son, badge, haute priorité).
 * Le token est stocké pour injection dans l’URL de lancement TWA.
 */
public class MandalaFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "mandala_alerts";
    public static final String PREFS = "mandala_fcm";
    public static final String KEY_TOKEN = "fcm_token";
    public static final String KEY_TOKEN_SENT = "fcm_token_sent";

    private static final String TAG = "MandalaFcm";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit().putString(KEY_TOKEN, token).putBoolean(KEY_TOKEN_SENT, false).apply();
        Log.i(TAG, "New FCM token stored");
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        ensureChannel(this);

        String title = "Mandala";
        String body = "Nouvelle notification";
        String urlPath = "/app?page=notifications";

        if (message.getNotification() != null) {
            if (message.getNotification().getTitle() != null) {
                title = message.getNotification().getTitle();
            }
            if (message.getNotification().getBody() != null) {
                body = message.getNotification().getBody();
            }
        }
        if (message.getData() != null) {
            if (message.getData().containsKey("title")) {
                title = message.getData().get("title");
            }
            if (message.getData().containsKey("body")) {
                body = message.getData().get("body");
            }
            if (message.getData().containsKey("url")) {
                urlPath = message.getData().get("url");
            }
        }

        Intent intent = new Intent(this, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        if (urlPath != null && !urlPath.isEmpty()) {
            String full = urlPath.startsWith("http")
                    ? urlPath
                    : "https://mandala.eludein.art" + (urlPath.startsWith("/") ? urlPath : "/" + urlPath);
            intent.setData(Uri.parse(full));
        }

        PendingIntent pending = PendingIntent.getActivity(
                this,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(sound)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setNumber(1)
                .setContentIntent(pending);

        NotificationManagerCompat.from(this).notify(
                Math.abs((title + body).hashCode()),
                builder.build()
        );
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Alertes Mandala",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Messages et alertes Mandala");
        channel.enableVibration(true);
        channel.setShowBadge(true);
        channel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                null
        );
        nm.createNotificationChannel(channel);
    }
}
