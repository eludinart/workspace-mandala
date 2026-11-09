/*
 * Copyright 2020 Google Inc. + Mandala FCM bridge.
 */
package art.eludein.mandala;

import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.concurrent.TimeUnit;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String TAG = "MandalaLaunch";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri uri = super.getLaunchingUrl();
        SharedPreferences prefs = getSharedPreferences(
                MandalaFirebaseMessagingService.PREFS, MODE_PRIVATE);
        String token = prefs.getString(MandalaFirebaseMessagingService.KEY_TOKEN, null);
        // 1er lancement : le token FCM arrive souvent après onCreate — attendre un peu.
        if (token == null || token.isEmpty()) {
            try {
                token = Tasks.await(FirebaseMessaging.getInstance().getToken(), 4, TimeUnit.SECONDS);
                if (token != null && !token.isEmpty()) {
                    prefs.edit()
                            .putString(MandalaFirebaseMessagingService.KEY_TOKEN, token)
                            .putBoolean(MandalaFirebaseMessagingService.KEY_TOKEN_SENT, false)
                            .apply();
                }
            } catch (Exception e) {
                Log.w(TAG, "FCM token wait failed", e);
            }
        }
        if (token == null || token.isEmpty()) {
            return uri;
        }
        // Toujours réinjecter pour resync web (login, SW, etc.).
        Uri.Builder b = uri.buildUpon();
        b.clearQuery();
        for (String name : uri.getQueryParameterNames()) {
            if ("fcm_token".equals(name)) continue;
            for (String value : uri.getQueryParameters(name)) {
                b.appendQueryParameter(name, value);
            }
        }
        b.appendQueryParameter("fcm_token", token);
        prefs.edit()
                .putBoolean(MandalaFirebaseMessagingService.KEY_TOKEN_SENT, true)
                .putLong("fcm_token_bridged_at", System.currentTimeMillis())
                .apply();
        return b.build();
    }
}
