/*
 * Copyright 2020 Google Inc. + Mandala FCM bridge.
 */
package art.eludein.mandala;

import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

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
        if (token == null || token.isEmpty()) {
            return uri;
        }
        // Toujours réinjecter : le 1er lancement est souvent avant login,
        // sinon le web tombe sur fcm_web / VAPID sans token natif.
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
