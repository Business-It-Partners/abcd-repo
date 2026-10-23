import type { ClinicCapability } from "../permissions";

export type ClinicRole = "admin" | "doctor" | "reception";

export type ClinicSession = {
  clinicUser: {
    clinicUserId: string;
    displayName: string;
    role: ClinicRole;
    capabilities: ClinicCapability[];
  };
  clinic: {
    tenantId: string;
    displayName: string;
    timezone: string;
    currency: string;
    defaultBranchId: string | null;
    hasActiveTrial: boolean;
  };
  branches: Array<{
    branchId: string;
    branchCode: string;
    name: string;
  }>;
};

export type TreatmentScope = "tooth" | "arch" | "full_mouth";

export type ProtocolStage = {
  protocolStageId: string;
  stageOrder: number;
  stageName: string;
  price: number;
  active: boolean;
  rowVersion: number;
};

export type TreatmentProtocol = {
  protocolId: string;
  name: string;
  category: string;
  description: string | null;
  toothScope: TreatmentScope;
  recordsCanalMeasurements: boolean;
  usesMobilityGrade: boolean;
  active: boolean;
  starterTemplateCode: string | null;
  starterPackVersion: string | null;
  rowVersion: number;
  totalPrice: number;
  stages: ProtocolStage[];
};

export type TreatmentProtocolInput = {
  name: string;
  category: string;
  description: string | null;
  toothScope: TreatmentScope;
  recordsCanalMeasurements: boolean;
  usesMobilityGrade: boolean;
  active: boolean;
  stages: Array<{
    protocolStageId?: string;
    stageOrder: number;
    stageName: string;
    price: number;
    active: boolean;
  }>;
};
