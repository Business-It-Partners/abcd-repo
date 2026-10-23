import { describe, expect, it, vi } from 'vitest';
import { ClinicClient } from '../packages/app-sdk/src/clinicClient';
import { TreatmentProtocolsApi, isTreatmentProtocol } from '../apps/dental-apps/company.dental.m17.treatment-protocols/src/features/treatment-protocols/api';

const protocol = {
  protocolId: '11111111-1111-4111-8111-111111111111',
  name: 'Root canal', category: 'Endodontics', description: null, toothScope: 'tooth' as const,
  recordsCanalMeasurements: true, usesMobilityGrade: false, active: true,
  starterTemplateCode: null, starterPackVersion: null, rowVersion: 2, totalPrice: 2500,
  stages: [
    { protocolStageId: '22222222-2222-4222-8222-222222222222', stageOrder: 1, stageName: 'Clean and shape', price: 1500, active: true, rowVersion: 1 },
    { protocolStageId: '33333333-3333-4333-8333-333333333333', stageOrder: 2, stageName: 'Fill canals', price: 1000, active: true, rowVersion: 1 },
  ],
};

describe('M17 Treatment Protocols API contract', () => {
  it('accepts a bounded canonical protocol and rejects duplicate stage order or identity', () => {
    expect(isTreatmentProtocol(protocol)).toBe(true);
    expect(isTreatmentProtocol({ ...protocol, stages: [...protocol.stages, { ...protocol.stages[1], stageOrder: 1 }] })).toBe(false);
    expect(isTreatmentProtocol({ ...protocol, stages: [...protocol.stages, { ...protocol.stages[0], stageOrder: 3 }] })).toBe(false);
    expect(isTreatmentProtocol({ ...protocol, totalPrice: Number.MAX_SAFE_INTEGER })).toBe(false);
  });

  it('reads only the SaaS route contract and rejects malformed or unbounded lists', async () => {
    const client = { read: vi.fn().mockResolvedValue({ treatmentProtocols: [protocol] }) } as unknown as ClinicClient;
    const api = new TreatmentProtocolsApi(client);
    await expect(api.list()).resolves.toEqual([protocol]);
    expect(client.read).toHaveBeenCalledWith('/v1/treatment-protocols');
    client.read = vi.fn().mockResolvedValue({ treatmentProtocols: Array(501).fill(protocol) });
    await expect(api.list()).rejects.toThrow(/invalid treatment protocol list/i);
  });

  it('builds stable write commands for the exact SaaS POST and PUT routes', () => {
    const calls: unknown[][] = [];
    const client = { command: (...args: unknown[]) => { calls.push(args); return { execute: vi.fn() }; } } as unknown as ClinicClient;
    const api = new TreatmentProtocolsApi(client);
    api.create({ name: 'Root canal', category: 'Endodontics', description: null, toothScope: 'tooth', recordsCanalMeasurements: true, usesMobilityGrade: false, active: true, stages: [] });
    api.update(protocol.protocolId, { name: protocol.name, category: protocol.category, description: null, toothScope: 'tooth', recordsCanalMeasurements: true, usesMobilityGrade: false, active: true, stages: [] }, 2);
    expect(calls[0]?.slice(0, 2)).toEqual(['POST', '/v1/treatment-protocols']);
    expect(calls[1]?.slice(0, 2)).toEqual(['PUT', `/v1/treatment-protocols/${protocol.protocolId}`]);
    expect(calls[1]?.[2]).toMatchObject({ rowVersion: 2 });
    expect(typeof calls[0]?.[3]).toBe('function');
  });
});
