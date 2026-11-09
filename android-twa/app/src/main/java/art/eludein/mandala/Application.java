/*
 * Copyright 2020 Google Inc. + Mandala FCM bootstrap.
 */
package art.eludein.mandala;

import android.content.SharedPreferences;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

public class Application extends android.app.Application {
  private static final String TAG = "MandalaApp";

  @Override
  public void onCreate() {
      super.onCreate();
      try {
          FirebaseApp.initializeApp(this);
          MandalaFirebaseMessagingService.ensureChannel(this);
          FirebaseMessaging.getInstance().getToken()
              .addOnSuccessListener(token -> {
                  if (token == null || token.isEmpty()) return;
                  SharedPreferences prefs = getSharedPreferences(
                      MandalaFirebaseMessagingService.PREFS, MODE_PRIVATE);
                  String prev = prefs.getString(MandalaFirebaseMessagingService.KEY_TOKEN, "");
                  SharedPreferences.Editor ed = prefs.edit()
                      .putString(MandalaFirebaseMessagingService.KEY_TOKEN, token);
                  if (!token.equals(prev)) {
                      ed.putBoolean(MandalaFirebaseMessagingService.KEY_TOKEN_SENT, false);
                  }
                  ed.apply();
                  Log.i(TAG, "FCM token ready");
              })
              .addOnFailureListener(err -> Log.w(TAG, "FCM token failed", err));
      } catch (Exception e) {
          Log.w(TAG, "Firebase init skipped", e);
      }
  }
}
