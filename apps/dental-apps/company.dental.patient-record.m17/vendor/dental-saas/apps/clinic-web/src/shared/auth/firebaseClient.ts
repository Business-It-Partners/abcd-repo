"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { runtimeConfig } from "../config/runtimeConfig";

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({
    apiKey: runtimeConfig.firebase.apiKey,
    authDomain: runtimeConfig.firebase.authDomain,
    projectId: runtimeConfig.firebase.projectId,
    storageBucket: runtimeConfig.firebase.storageBucket,
    messagingSenderId: runtimeConfig.firebase.messagingSenderId,
    appId: runtimeConfig.firebase.appId,
  });

export const clinicAuth = getAuth(firebaseApp);

// Keep the clinic session in this browser across normal refreshes and local
// dev-server restarts.  A real sign-out remains the only normal way to clear it.
// Storage can be unavailable or blocked by the browser. Auth still works with Firebase's
// in-memory fallback in that case; do not leave the whole clinic on a permanent loading screen.
export const clinicAuthReady = setPersistence(clinicAuth, browserLocalPersistence).catch(() => undefined);

let emulatorConnected = false;

if (runtimeConfig.usesFirebaseEmulators && !emulatorConnected) {
  connectAuthEmulator(clinicAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  emulatorConnected = true;
}
