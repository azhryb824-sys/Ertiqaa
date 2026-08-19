"use strict";
const assert=require("node:assert/strict"),{createDemoData}=require("../src/v2/demo-data.cjs"),{journalBalanced}=require("../src/v2/isolated-store.cjs"),{inspect}=require("../src/v2/assurance.cjs");
const data=createDemoData("T1");
assert.ok(data.misadContracts.length>=3);assert.ok(data.misadElevatorAssets.length>=3);assert.ok(data.misadVisits.length>=3);
assert.ok(data.misadJournalEntries.every(journalBalanced));assert.ok(Object.values(data).flatMap(v=>Array.isArray(v)?v:[]).every(row=>!row.companyOwnerId||row.companyOwnerId==="T1"));
assert.equal(inspect(data).ok,true,"demo data must pass continuous accounting assurance");
assert.equal(JSON.stringify(data).includes("شموس للمصاعد"),false);
console.log("v2 demo data checks passed");
