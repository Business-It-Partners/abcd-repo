import { BrowserClinicClient, BrowserClinicCommand, ClinicError } from '../../shell/browserClinicClient';
import type { ProtocolStage, TreatmentProtocol, TreatmentProtocolInput } from '../../shell/session/types';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const scopes = ['tooth', 'arch', 'full_mouth'] as const;
const integer = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function isProtocolStage(value: unknown): value is ProtocolStage {
  return record(value)
    && typeof value.protocolStageId === 'string' && uuid.test(value.protocolStageId)
    && integer(value.stageOrder, 1, 30)
    && typeof value.stageName === 'string' && value.stageName.trim().length > 0 && value.stageName.length <= 140
    && integer(value.price, 0, 100_000_000)
    && typeof value.active === 'boolean'
    && integer(value.rowVersion, 1, 1_000_000_000);
}

export function isTreatmentProtocol(value: unknown): value is TreatmentProtocol {
  if (!record(value)
    || typeof value.protocolId !== 'string' || !uuid.test(value.protocolId)
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 140
    || typeof value.category !== 'string' || !value.category.trim() || value.category.length > 80
    || !(value.description === null || (typeof value.description === 'string' && value.description.length <= 1000))
    || !scopes.includes(value.toothScope as (typeof scopes)[number])
    || typeof value.recordsCanalMeasurements !== 'boolean'
    || typeof value.usesMobilityGrade !== 'boolean'
    || typeof value.active !== 'boolean'
    || !(value.starterTemplateCode === null || typeof value.starterTemplateCode === 'string')
    || !(value.starterPackVersion === null || typeof value.starterPackVersion === 'string')
    || !integer(value.rowVersion, 1, 1_000_000_000)
    || !integer(value.totalPrice, 0, 3_000_000_000)
    || !Array.isArray(value.stages) || value.stages.length > 30 || !value.stages.every(isProtocolStage)) return false;

  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const stage of value.stages) {
    if (ids.has(stage.protocolStageId) || orders.has(stage.stageOrder)) return false;
    ids.add(stage.protocolStageId);
    orders.add(stage.stageOrder);
  }
  return true;
}

function protocolReceipt(value: unknown): value is { treatmentProtocol: TreatmentProtocol } {
  return record(value) && isTreatmentProtocol(value.treatmentProtocol);
}

export class TreatmentProtocolsApi {
  constructor(private readonly client: BrowserClinicClient) {}

  async list(): Promise<TreatmentProtocol[]> {
    const value: unknown = await this.client.read('/v1/treatment-protocols');
    if (!record(value) || !Array.isArray(value.treatmentProtocols) || value.treatmentProtocols.length > 500
      || !value.treatmentProtocols.every(isTreatmentProtocol)) {
      throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid treatment protocol list.');
    }
    return value.treatmentProtocols;
  }

  create(input: TreatmentProtocolInput): BrowserClinicCommand<{ treatmentProtocol: TreatmentProtocol }> {
    return this.client.command('POST', '/v1/treatment-protocols', input, protocolReceipt);
  }

  update(protocolId: string, input: TreatmentProtocolInput, rowVersion: number): BrowserClinicCommand<{ treatmentProtocol: TreatmentProtocol }> {
    if (!uuid.test(protocolId) || !integer(rowVersion, 1, 1_000_000_000)) {
      throw new ClinicError('INVALID_REQUEST', 'The treatment protocol update is invalid. Refresh the list and try again.');
    }
    return this.client.command('PUT', `/v1/treatment-protocols/${protocolId}`, { ...input, rowVersion }, protocolReceipt);
  }
}
