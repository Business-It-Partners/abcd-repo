import { createPublicKey, sign, type KeyObject } from 'node:crypto';
import { canonical, parseCanonical, sha256, type TrustPolicy } from '../packages/format';
import { verifyCatalogue, type Watermark } from './catalogue';
import { verifyUpdatePolicy } from './updatePolicy';

type RenewalInput = {
  catalogue: Buffer;
  updatePolicy: Buffer;
  watermarks: { catalogue: Watermark; updatePolicy: Watermark };
  catalogueSequence: number;
  policySequence: number;
  privateKey: KeyObject;
  trust: TrustPolicy;
  now: number;
  lifetimeMs?: number;
};

/** Offline preparation only. Never writes packages, publishes metadata or changes client watermarks. */
export function prepareMetadataRenewal(input: RenewalInput) {
  const lifetime = input.lifetimeMs ?? 86_400_000;
  if (!Number.isSafeInteger(input.now) || input.now < 1 || !Number.isSafeInteger(lifetime)
    || lifetime < 1 || lifetime > 86_400_000 || !Number.isSafeInteger(input.now + lifetime)
    || input.privateKey.type !== 'private' || input.privateKey.asymmetricKeyType !== 'ed25519') {
    throw Error('Invalid renewal clock, lifetime or signer');
  }
  const signer = createPublicKey(input.privateKey).export({ type: 'spki', format: 'pem' }).toString();
  const renew = (bytes: Buffer, field: 'catalogue' | 'policy', watermark: Watermark, sequence: number) => {
    if (!Number.isSafeInteger(watermark.sequence) || watermark.sequence < 0
      || !Number.isSafeInteger(watermark.observedAt) || watermark.observedAt < 0
      || (watermark.sequence === 0 ? watermark.digest !== '' : !/^[a-f0-9]{64}$/.test(watermark.digest))) {
      throw Error('Invalid recorded watermark');
    }
    if (!bytes.length || bytes.length > 65_536) throw Error('Renewal metadata size');
    const envelope = parseCanonical(bytes), current = envelope[field];
    if (!current || !Number.isSafeInteger(current.expiresAt)) throw Error('Invalid renewal baseline');
    const key = Object.hasOwn(input.trust.keys, envelope.keyId) ? input.trust.keys[envelope.keyId] : undefined;
    if (!key || key.publicKey !== signer) throw Error('Renewal must preserve the pinned signing key');
    if (!Number.isSafeInteger(sequence) || sequence <= Math.max(current.sequence, watermark.sequence)) {
      throw Error('Renewal sequence must exceed published and recorded sequences');
    }
    // An expired baseline must still pass its signature/schema/replay checks. The historical
    // clock is used only to authenticate offline input, never to launch or persist trust.
    const historicalNow = Math.min(input.now, current.expiresAt - 1);
    const historicalMark = { ...watermark, observedAt: Math.min(watermark.observedAt, historicalNow) };
    if (field === 'catalogue') verifyCatalogue(bytes, input.trust, historicalMark, historicalNow);
    else verifyUpdatePolicy(bytes, input.trust, historicalMark, historicalNow);
    const renewed = { ...current, sequence, issuedAt: input.now, expiresAt: input.now + lifetime };
    const signature = sign(null, Buffer.from(canonical({
      purpose: field === 'catalogue' ? 'dental-os-catalogue' : 'dental-os-update-policy',
      keyId: envelope.keyId, [field]: renewed,
    })), input.privateKey).toString('base64');
    const output = Buffer.from(canonical({ [field]: renewed, keyId: envelope.keyId, signature }));
    // Actual present-time validation uses the original watermark, including its clock fence.
    if (field === 'catalogue') verifyCatalogue(output, input.trust, watermark, input.now);
    else verifyUpdatePolicy(output, input.trust, watermark, input.now);
    const semantic = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value)
      .filter(([name]) => !['sequence', 'issuedAt', 'expiresAt'].includes(name)));
    const semanticHash = sha256(Buffer.from(canonical(semantic(current))));
    if (semanticHash !== sha256(Buffer.from(canonical(semantic(renewed))))) throw Error('Renewal changed authority');
    return { bytes: output, review: {
      keyId: envelope.keyId, previousSha256: sha256(bytes), renewedSha256: sha256(output), semanticSha256: semanticHash,
      previousSequence: current.sequence, recordedSequence: watermark.sequence, sequence,
      previousExpiresAt: current.expiresAt, issuedAt: input.now, expiresAt: renewed.expiresAt,
    } };
  };
  const catalogue = renew(input.catalogue, 'catalogue', input.watermarks.catalogue, input.catalogueSequence);
  const updatePolicy = renew(input.updatePolicy, 'policy', input.watermarks.updatePolicy, input.policySequence);
  return { catalogue: catalogue.bytes, updatePolicy: updatePolicy.bytes, review: {
    environment: 'cloudfare-staging', metadataOnly: true, packageWrites: 0,
    catalogue: catalogue.review, updatePolicy: updatePolicy.review,
  } };
}
