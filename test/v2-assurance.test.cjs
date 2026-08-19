"use strict";
const assert=require("node:assert/strict"),tx=require("../src/v2/transactions.cjs"),{inspect}=require("../src/v2/assurance.cjs");
const ctx={userId:"U1",role:"owner",tenantId:"C1"},state={misadJournalEntries:[],v2AccountingPeriods:[],v2Audit:[]};
assert.equal(tx.createSalesInvoice(state,{id:"SI1",clientId:"C1",date:"2026-08-18",net:100},ctx).ok,true);assert.equal(tx.receivePayment(state,{id:"R1",invoiceId:"SI1",date:"2026-08-18",amount:40},ctx).ok,true);
assert.equal(tx.createPurchaseInvoice(state,{id:"PI1",supplierId:"S1",date:"2026-08-18",net:50},ctx).ok,true);assert.equal(tx.paySupplier(state,{id:"SP1",invoiceId:"PI1",date:"2026-08-18",amount:20},ctx).ok,true);
let report=inspect(state);assert.equal(report.ok,true);assert.equal(report.metrics.receivables,60);assert.equal(report.metrics.glReceivables,60);assert.equal(report.metrics.payables,30);assert.equal(report.metrics.glPayables,30);
state.misadCustomerInvoices[0].balance=59;report=inspect(state);assert.equal(report.ok,false);assert.equal(report.checks.receivablesReconciled,false);assert.equal(report.issues.receivablesDifference,-1);
console.log("v2 continuous accounting assurance checks passed");
