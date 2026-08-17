const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const server = fs.readFileSync('server.cjs', 'utf8');

assert.match(app, /s\.role==="technician"&&\(s\.availability\|\|"working"\)==="working"/);
assert.match(app, /enforceTechnicianVisitAssignments/);
assert.match(app, /assignmentCorrection="non-technician-removed"/);
assert.doesNotMatch(app.match(/function availableStaff\(\)[\s\S]*?\n/)[0], /engineer/);

const redistribution = server.slice(server.indexOf('function redistributeVisits'), server.indexOf('function analyzeTechnicianLocation'));
assert.match(redistribution, /s\.role === "technician"/);
assert.doesNotMatch(redistribution, /\["technician", "engineer"\]\.includes/);
assert.match(server, /لا يمكن إسناد الزيارة إلا إلى موظف مسجل كفني/);
assert.match(server, /requestedTechnician\?\.identity/);

console.log('Technician-only visit assignment tests passed.');
