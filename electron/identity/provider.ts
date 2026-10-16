import { safeStorage } from 'electron';
import { adequateStorage, type SecretProvider } from './storage';
export const systemSecretProvider:SecretProvider={
  available:()=>adequateStorage(process.platform,safeStorage.isEncryptionAvailable(),process.platform==='linux'?safeStorage.getSelectedStorageBackend():'os-protected'),
  encrypt:async value=>safeStorage.encryptString(value),
  decrypt:async value=>safeStorage.decryptString(value),
};
