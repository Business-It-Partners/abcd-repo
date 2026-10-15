export const labStages = ['pending_assignment', 'sent', 'received', 'fitted', 'cancelled'] as const;
export type LabStage = typeof labStages[number];
export const stageLabels: Record<LabStage, string> = { pending_assignment: 'Awaiting assignment', sent: 'Sent', received: 'Received', fitted: 'Fitted', cancelled: 'Cancelled' };
export type LabSupplier = { id: string; name: string; contact: string; phone: string; email: string; address: string; active: boolean };
export type LabOrder = { id: string; patient: string; patientNumber: string; caseName: string; work: string; tooth: string; shade: string; supplierId: string | null; supplierName: string | null; requested: string; sent: string; received: string; fitted: string; stage: LabStage; clinicalNote: string; receptionNote: string; version: number; history: { label: string; date: string; note: string }[] };
export const labWorkOptions = ['Zirconia Crown', 'PFM Crown', 'E-max Crown', 'Bridge (3-unit)', 'Complete Denture', 'Partial Denture', 'Retainers', 'Night Guard', 'Sports Guard', 'Post & Core'];
export const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const demoSuppliers: LabSupplier[] = [
 { id:'lab-1',name:'Himal Dental Laboratory',contact:'Suman Joshi',phone:'9801001101',email:'himal@example.com',address:'Jawalakhel, Lalitpur',active:true },
 { id:'lab-2',name:'Precision Dental Lab',contact:'Mina Adhikari',phone:'9801001102',email:'precision@example.com',address:'Baneshwor, Kathmandu',active:true },
 { id:'lab-3',name:'Valley Dental Crafts',contact:'Rajan Shrestha',phone:'9801001103',email:'valley@example.com',address:'Bhaktapur',active:false },
];
export const demoOrders: LabOrder[] = ['Kalpana Shrestha','Ramesh Adhikari','Sita Tamang','Bikash Thapa','Anita Maharjan','Prakash Karki','Mina Rai','Sunil Gurung'].map((patient,index) => {
 const stage: LabStage = ['pending_assignment','sent','received','fitted','sent','pending_assignment','cancelled','received'][index] as LabStage;
 const assigned = stage !== 'pending_assignment', supplier = demoSuppliers[index % 2];
 const requested = `2026-10-${String(5+index).padStart(2,'0')}`, sent = assigned ? requested : '', received = ['received','fitted'].includes(stage) ? `2026-10-${String(6+index).padStart(2,'0')}` : '', fitted = stage === 'fitted' ? '2026-10-12' : '';
 return {id:`LAB-${String(index+1).padStart(3,'0')}`,patient,patientNumber:`P-${1001+index}`,caseName:['Upper molar restoration','Missing lower teeth','Anterior crown'][index%3],work:labWorkOptions[index],tooth:['16','36, 37','11'][index%3],shade:['A2','A3','B1'][index%3],supplierId:assigned?supplier.id:null,supplierName:assigned?supplier.name:null,requested,sent,received,fitted,stage,clinicalNote:'Please verify fit and shade before final finishing.',receptionNote:assigned?'Courier handoff recorded.':'',version:1,history:[{label:'Requested',date:requested,note:'Clinical request recorded.'},...(sent?[{label:'Sent',date:sent,note:`Assigned to ${supplier.name}.`}]:[]),...(received?[{label:'Received',date:received,note:'Returned to clinic.'}]:[]),...(fitted?[{label:'Fitted',date:fitted,note:'Fit completed.'}]:[]),...(stage==='cancelled'?[{label:'Cancelled',date:'2026-10-13',note:'Treatment plan changed; history retained.'}]:[])]};
});
