"use strict";
const assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),source=fs.readFileSync(path.join(__dirname,"../v2/v2.js"),"utf8");
for(const command of ["notification.preference","privacy.export","retention.apply"])assert.match(source,new RegExp(command.replace(".","\\.")));
for(const action of ["notification-preference","privacy-export","retention-apply"])assert.match(source,new RegExp(`data-action="${action}"`));
assert.match(source,/لا تحذف هذه العملية القيود أو المستندات المالية/);console.log("v2 lifecycle UI wiring checks passed");
