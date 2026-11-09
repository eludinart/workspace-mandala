/*
 * Copyright 2020 Google Inc. + Mandala FCM bootstrap.
 */
package art.eludein.mandala;

import android.content.SharedPreferences;
import android.util.Log;
import android.webkit.CookieManager;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

public class Application extends android.app.Application {
  private static final String TAG = "MandalaApp";
  private static final String COOKIE_HOST = "https://mandala.eludein.art";
  private static final String COOKIE_NAME = "mdl_fcm_token";

  /** Expose le token au web TWA (plus fiable que ?fcm_token= seul). */
  public static void bridgeTokenToWeb(String token) {
      if (token == null || token.isEmpty()) return;
      try {
          CookieManager cm = CookieManager.getInstance();
          cm.setAcceptCookie(true);
          // Max-Age 30j — resync à chaque lancement via getToken.
          String cookie = COOKIE_NAME + "=" + token
                  + "; Path=/; Secure; SameSite=Lax; Max-Age=2592000";
          cm.setCookie(COOKIE_HOST, cookie);
          cm.flush();
          Log.i(TAG, "FCM token cookie bridged");
      } catch (Exception e) {
          Log.w(TAG, "FCM cookie bridge failed", e);
      }
  }

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
                  bridgeTokenToWeb(token);
                  Log.i(TAG, "FCM token ready");
              })
              .addOnFailureListener(err -> Log.w(TAG, "FCM token failed", err));
      } catch (Exception e) {
          Log.w(TAG, "Firebase init skipped", e);
      }
  }
}
