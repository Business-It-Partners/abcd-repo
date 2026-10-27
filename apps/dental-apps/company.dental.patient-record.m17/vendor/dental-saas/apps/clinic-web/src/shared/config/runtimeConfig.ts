export type AppFlavour = "local" | "staging" | "production";

const flavour = process.env.NEXT_PUBLIC_APP_FLAVOUR ?? "local";

if (flavour !== "local" && flavour !== "staging" && flavour !== "production") {
  throw new Error(`Unsupported Sajilo Dental SaaS flavour: ${flavour}`);
}

export const runtimeConfig = {
  flavour: flavour as AppFlavour,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787",
  usesFirebaseEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
  firebase: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-sajilo-dental-local",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "localhost",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "local-sajilo-dental-saas",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "local",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "local",
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "local-development-only",
  },
} as const;
