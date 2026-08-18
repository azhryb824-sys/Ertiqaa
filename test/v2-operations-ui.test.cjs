"use strict";
const assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),source=fs.readFileSync(path.join(__dirname,"../v2/v2.js"),"utf8");
for(const command of ["opportunity.create","quote.create","quote.approve","quote.convert","contract.activate","contract.renew","ticket.create","ticket.dispatch","work-order.close"])assert.match(source,new RegExp(command.replace(".","\\.")),`${command} must be reachable from V2 UI`);
for(const action of ["opportunity-create","quote-approve","contract-renew","ticket-dispatch","work-order-close"])assert.match(source,new RegExp(`data-action="${action}"`));
assert.match(source,/signatureDocumentId/);assert.match(source,/operationsForm/);
console.log("v2 operations UI wiring checks passed");
