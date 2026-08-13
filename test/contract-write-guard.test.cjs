"use strict";

const assert = require("node:assert/strict");
const {validateContractWrite} = require("../contract-write-guard.cjs");
const userId = "1010389102";
const original = [{id: "CONT0001", startDate: "2026-01-01", endDate: "2026-12-31", status: "ساري"}];
const check = next => validateContractWrite(JSON.stringify(original), JSON.stringify(next), userId);

assert.equal(check(original).ok, true);
assert.equal(check([]).ok, false);
assert.equal(check([{...original[0], status: "منتهيا"}]).ok, false, "a future contract cannot expire");
const expired = [{id: "CONT0001", startDate: "2024-01-01", endDate: "2024-12-31", status: "ساري"}];
assert.equal(validateContractWrite(JSON.stringify(expired), JSON.stringify([{...expired[0], status: "منتهيا"}]), userId).ok, true, "a past contract expires regardless of its previous status");
assert.equal(check([{...original[0], startDate: "2026-02-01", endDate: "2027-01-31"}]).ok, false);
assert.equal(check([{...original[0], startDate: "2026-02-01", endDate: "2027-01-31", updatedAt: "2026-08-13T08:00:00Z", updatedBy: userId}]).ok, true);
assert.equal(check([{...original[0], endDate: "2027-12-31", renewedAt: "2026-08-13T08:01:00Z"}]).ok, true);
assert.equal(check([{id: "CONT0002", startDate: "2026-08-13", endDate: "2027-08-12", status: "بانتظار موافقة العميل"}, ...original]).ok, true);
console.log("contract write guard tests passed");
