const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const testRoot = process.env.SAJILO_DENTAL_SAFE_STORAGE_ROOT;
const validTestRoot = typeof testRoot === 'string'
  && path.dirname(path.resolve(testRoot)) === path.resolve(os.tmpdir())
  && /^sajilo-dental-safe-storage-[a-z0-9]+$/i.test(path.basename(testRoot));

if (process.platform !== 'win32' || !process.versions.electron || !validTestRoot) {
  console.error('This smoke check must run in Electron on Windows with a unique temporary profile supplied by its runner.');
  process.exitCode = 2;
  app.quit();
} else {
  const repository = path.resolve(__dirname, '../../..');
  const userData = path.join(testRoot, 'profile');
  app.setPath('userData', userData);

  app.whenReady().then(async () => {
    try {
      const { CredentialStore } = require(path.join(repository, 'dist-electron/identity/storage.js'));
      const { systemSecretProvider } = require(path.join(repository, 'dist-electron/identity/provider.js'));
      const token = 'm20-synthetic-windows-safe-storage-check';
      const store = new CredentialStore(path.join(userData, 'identity'), systemSecretProvider);
      if (!store.available()) throw new Error('Windows safeStorage reports encryption unavailable.');
      await store.save(token);
      const encryptedFile = fs.readFileSync(path.join(userData, 'identity', 'refresh.enc'));
      if (encryptedFile.includes(Buffer.from(token))) throw new Error('The synthetic token is present in plaintext on disk.');
      if (await store.load() !== token) throw new Error('The protected credential did not round-trip.');
      await store.clear();
      if (await store.load() !== null) throw new Error('CredentialStore.clear() did not remove the protected credential.');
      console.log(JSON.stringify({ platform: process.platform, electron: process.versions.electron, safeStorageAvailable: true, encryptedAtRest: true, roundTrip: true, clear: true }));
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Windows safeStorage smoke check failed.');
      process.exitCode = 1;
    } finally {
      app.quit();
    }
  });
}
