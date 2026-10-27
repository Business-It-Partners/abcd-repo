export type TreatmentScope = 'tooth' | 'arch' | 'full_mouth';

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
