"use strict";
function createDemoData(companyOwnerId="demo-company") {
  const today="2026-08-18";
  const contracts=[
    {id:"V2-DEMO-C001",companyOwnerId,type:"صيانة",clientName:"شركة أفق المباني",clientCompanyName:"شركة أفق المباني",value:48000,startDate:"2026-01-01",endDate:"2026-12-31",status:"ساري",slaHours:4,demo:true},
    {id:"V2-DEMO-C002",companyOwnerId,type:"تركيب",clientName:"مركز الصفوة التجاري",clientCompanyName:"مركز الصفوة التجاري",value:285000,startDate:"2026-06-01",endDate:"2026-11-30",status:"قيد التنفيذ",demo:true},
    {id:"V2-DEMO-C003",companyOwnerId,type:"توريد وتركيب قطع غيار",clientName:"مجمع رواسي الأعمال",value:73500,startDate:"2026-08-01",endDate:"2026-09-15",status:"ساري",demo:true}
  ];
  const assets=[
    {id:"V2-DEMO-A001",companyOwnerId,clientName:"شركة أفق المباني",buildingName:"برج الأفق",brand:"KONE",capacity:"1000 كجم",status:"نشط",contractId:"V2-DEMO-C001",demo:true},
    {id:"V2-DEMO-A002",companyOwnerId,clientName:"شركة أفق المباني",buildingName:"برج الأفق",brand:"Otis",capacity:"800 كجم",status:"نشط",contractId:"V2-DEMO-C001",demo:true},
    {id:"V2-DEMO-A003",companyOwnerId,clientName:"مركز الصفوة التجاري",buildingName:"مركز الصفوة",brand:"Schindler",capacity:"1600 كجم",status:"تحت التركيب",contractId:"V2-DEMO-C002",demo:true}
  ];
  const staff=[
    {id:"V2-DEMO-E001",identity:"2000000001",companyOwnerId,name:"فني العرض الأول",role:"technician",baseSalary:5200,employmentStatus:"على رأس العمل",demo:true},
    {id:"V2-DEMO-E002",identity:"2000000002",companyOwnerId,name:"فني العرض الثاني",role:"technician",baseSalary:5500,employmentStatus:"على رأس العمل",demo:true},
    {id:"V2-DEMO-E003",identity:"2000000003",companyOwnerId,name:"مشرف عمليات العرض",role:"engineer",baseSalary:8500,employmentStatus:"على رأس العمل",demo:true}
  ];
  const visits=[
    {id:"V2-DEMO-WO001",companyOwnerId,contractId:"V2-DEMO-C001",clientName:"شركة أفق المباني",building:{name:"برج الأفق"},assignedTo:"2000000001",assignedName:"فني العرض الأول",scheduledAt:"2026-08-18T09:00:00+03:00",status:"مجدولة",priority:"عادي",demo:true},
    {id:"V2-DEMO-WO002",companyOwnerId,contractId:"V2-DEMO-C001",clientName:"شركة أفق المباني",building:{name:"برج الأفق"},assignedTo:"2000000002",assignedName:"فني العرض الثاني",scheduledAt:"2026-08-18T11:30:00+03:00",status:"قيد التنفيذ",priority:"عاجل",demo:true},
    {id:"V2-DEMO-WO003",companyOwnerId,contractId:"V2-DEMO-C003",clientName:"مجمع رواسي الأعمال",building:{name:"مبنى رواسي"},assignedName:"بانتظار الإسناد",scheduledAt:"2026-08-19T10:00:00+03:00",status:"بانتظار الإسناد",priority:"عادي",demo:true}
  ];
  const parts=[
    {id:"V2-DEMO-P001",companyOwnerId,name:"حساس باب",sku:"DOOR-SENSOR-01",qty:14,minQty:5,unitCost:185,demo:true},
    {id:"V2-DEMO-P002",companyOwnerId,name:"كونتاكتور",sku:"CONT-40A",qty:3,minQty:6,unitCost:240,demo:true},
    {id:"V2-DEMO-P003",companyOwnerId,name:"بطارية طوارئ",sku:"BAT-12V",qty:8,minQty:4,unitCost:130,demo:true}
  ];
  const suppliers=[{id:"V2-DEMO-S001",companyOwnerId,name:"شركة الإمداد التقني",phone:"0500000000",city:"مكة المكرمة",category:"قطع تحكم",rating:4.8,demo:true},{id:"V2-DEMO-S002",companyOwnerId,name:"مؤسسة حلول الرفع",phone:"0500000001",city:"جدة",category:"معدات وقطع ميكانيكية",rating:4.5,demo:true}];
  const invoices=[{id:"V2-DEMO-SI001",companyOwnerId,contractId:"V2-DEMO-C001",clientName:"شركة أفق المباني",date:today,total:12000,paid:8000,status:"مدفوعة جزئيًا",demo:true}];
  const purchaseInvoices=[{id:"V2-DEMO-PI001",companyOwnerId,supplierId:"V2-DEMO-S001",date:today,total:4250,paid:0,status:"مستحقة",demo:true}];
  const journals=[
    {id:"V2-DEMO-J001",companyOwnerId,date:today,description:"فاتورة صيانة تجريبية",refType:"customer-invoice",refId:"V2-DEMO-SI001",lines:[{account:"1320",side:"debit",amount:12000,refContractId:"V2-DEMO-C001"},{account:"4100",side:"credit",amount:12000,refContractId:"V2-DEMO-C001"}],debitTotal:12000,creditTotal:12000,createdAt:new Date().toISOString(),createdBy:"demo",demo:true},
    {id:"V2-DEMO-J002",companyOwnerId,date:today,description:"تحصيل تجريبي",refType:"receipt",refId:"V2-DEMO-R001",lines:[{account:"1200",side:"debit",amount:8000,refContractId:"V2-DEMO-C001"},{account:"1320",side:"credit",amount:8000,refContractId:"V2-DEMO-C001"}],debitTotal:8000,creditTotal:8000,createdAt:new Date().toISOString(),createdBy:"demo",demo:true},
    {id:"V2-DEMO-J003",companyOwnerId,date:today,description:"فاتورة شراء تجريبية",refType:"purchase-invoice",refId:"V2-DEMO-PI001",lines:[{account:"5200",side:"debit",amount:4250},{account:"2100",side:"credit",amount:4250,refSupplierId:"V2-DEMO-S001"}],debitTotal:4250,creditTotal:4250,createdAt:new Date().toISOString(),createdBy:"demo",demo:true}
  ];
  return {
    misadContracts:contracts,misadVisits:visits,misadTickets:[],misadCompanyStaff:staff,misadOwnerCompanies:[],misadElevatorAssets:assets,misadPartsInventory:parts,misadSuppliers:suppliers,misadPurchaseInvoices:purchaseInvoices,misadCustomerInvoices:invoices,misadReceipts:[{id:"V2-DEMO-R001",companyOwnerId,contractId:"V2-DEMO-C001",amount:8000,date:today,status:"مرحّل",demo:true}],misadClaims:[],misadPayrolls:[],misadCustodies:[],misadBankAccounts:[{id:"V2-DEMO-B001",companyOwnerId,bankName:"بنك العرض التجريبي",ledgerAccountId:"1200",demo:true}],misadJournalEntries:journals,misadFinanceAuditLog:[],misadContractExpenses:[],misadFinancialEntries:[],v2Customers:[],v2WorkOrders:[],v2PurchaseOrders:[],v2Warehouses:[{id:"V2-DEMO-WH001",companyOwnerId,name:"المستودع الرئيسي",demo:true}],v2StockMoves:[],v2StockReservations:[],v2StockTransfers:[],v2StockCounts:[],v2StockTraceability:[],v2AccountingPeriods:[],v2Approvals:[],v2Roles:[],v2Notifications:[],v2NotificationPreferences:[],v2PrivacyExports:[],v2Documents:[],v2Audit:[{id:"V2-DEMO-AUD001",action:"demo-seed",entity:"system",entityId:companyOwnerId,detail:"Synthetic market demo data created",userId:"demo",userName:"النظام",at:new Date().toISOString(),environment:"v2-demo"}],v2Settings:{isolated:true,sourceReadOnly:true,demo:true,environmentName:"عرض شموس V2",urgentSlaHours:4,purchaseApprovalLimit:5000}
  };
}
module.exports={createDemoData};
