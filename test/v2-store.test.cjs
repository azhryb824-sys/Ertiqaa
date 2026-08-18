"use strict";
const assert=require("node:assert/strict");
const {journalBalanced,normalizeData,validJournalTransition,ALLOWED_COLLECTIONS}=require("../src/v2/isolated-store.cjs");

assert.equal(journalBalanced({lines:[{side:"debit",amount:125},{side:"credit",amount:125}]}),true);
assert.equal(journalBalanced({lines:[{side:"debit",amount:125},{side:"credit",amount:120}]}),false);
assert.equal(journalBalanced({lines:[]}),false);
const normalized=normalizeData({misadContracts:[{id:"V2-C1"}],unknown:[{secret:true}],v2Settings:{isolated:true}});
assert.deepEqual(normalized.misadContracts,[{id:"V2-C1"}]);
assert.equal(Object.hasOwn(normalized,"unknown"),false);
assert.equal(normalized.v2Settings.isolated,true);
assert.ok(ALLOWED_COLLECTIONS.has("misadJournalEntries"));
assert.ok(ALLOWED_COLLECTIONS.has("v2WorkOrders"));
assert.ok(ALLOWED_COLLECTIONS.has("v2SupplierPayments"));
const original={id:"J1",date:"2026-08-18",lines:[{account:"1",side:"debit",amount:10},{account:"2",side:"credit",amount:10}]};
assert.equal(validJournalTransition(original,{...original,voidedAt:"2026-08-18T12:00:00Z",voidedBy:"U1",voidReason:"تصحيح",reversalJournalId:"J2"}),true);
assert.equal(validJournalTransition(original,{...original,date:"2026-08-19",voidedAt:"x",reversalJournalId:"J2"}),false);
console.log("v2 store checks passed");
