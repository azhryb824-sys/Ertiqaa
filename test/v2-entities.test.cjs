"use strict";
const assert=require("node:assert/strict"),entities=require("../src/v2/entities.cjs");
const ctx={userId:"O1",name:"مالك",role:"owner",tenantId:"C1"},state={v2Audit:[],misadJournalEntries:[]};
let result=entities.create(state,{entity:"supplier",data:{id:"S1",name:"مورد الاختبار",phone:"0500000000"}},ctx);assert.equal(result.ok,true);assert.equal(state.misadSuppliers[0].companyOwnerId,"C1");
result=entities.update(state,{entity:"supplier",id:"S1",data:{name:"المورد المعدل",phone:"0511111111",city:"مكة"}},ctx);assert.equal(result.ok,true);assert.equal(result.record.name,"المورد المعدل");
result=entities.archive(state,{entity:"supplier",id:"S1",reason:"إيقاف التعامل"},ctx);assert.equal(result.ok,true);assert.ok(result.record.archivedAt);assert.equal(state.misadSuppliers.length,1,"archive must not delete");
const contract=entities.create(state,{entity:"contract",data:{id:"C01",clientName:"عميل",type:"صيانة",description:"عقد",startDate:"2026-08-18"}},ctx);assert.equal(contract.ok,true);state.misadCustomerInvoices=[{id:"I1",companyOwnerId:"C1",contractId:"C01"}];result=entities.archive(state,{entity:"contract",id:"C01",reason:"إلغاء"},ctx);assert.equal(result.ok,false);assert.equal(result.status,409);assert.equal(state.misadContracts[0].archivedAt,undefined);
const denied=entities.create(state,{entity:"employee",data:{name:"فني",identity:"1",role:"technician",baseSalary:1}},{...ctx,role:"technician"});assert.equal(denied.ok,false);assert.equal(denied.status,403);
console.log("v2 entity command checks passed");
