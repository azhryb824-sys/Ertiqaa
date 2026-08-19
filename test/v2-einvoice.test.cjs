"use strict";
const assert=require("node:assert/strict"),einvoice=require("../src/v2/einvoice.cjs");
const seller={name:"شركة الاختبار",vatNumber:"310000000000003",address:"مكة"},buyer={name:"عميل الأعمال",vatRegistered:true,vatNumber:"310000000000011"},invoice={id:"SI-1",type:"standard",issueDateTime:"2026-08-18T12:00:00+03:00",net:100,tax:15,total:115,taxRate:15};
const result=einvoice.prepare(invoice,seller,buyer);assert.equal(result.ok,true);assert.equal(result.document.currency,"SAR");assert.ok(Buffer.from(result.document.qr,"base64").length>20);assert.equal(result.document.complianceStatus,"preflight-only");assert.equal(result.document.requiresZatcaSdkValidation,true);
const bad=einvoice.validate({...invoice,total:114},seller,buyer);assert.equal(bad.ok,false);assert.ok(bad.errors.some(error=>/reconcile/.test(error)));assert.equal(einvoice.validate(invoice,{...seller,vatNumber:"123"},buyer).ok,false);
console.log("v2 e-invoice preflight checks passed");
