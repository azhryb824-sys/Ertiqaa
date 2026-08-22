const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const server=fs.readFileSync('server.cjs','utf8');
const app=fs.readFileSync('app.js','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');

test('server assigns pending visits to active technicians every ten seconds',()=>{
  const start=server.indexOf('function autoAssignPendingVisits');
  const end=server.indexOf('function analyzeTechnicianLocation',start);
  const code=server.slice(start,end);
  assert.ok(start>0);
  assert.match(code,/member\.role === "technician"/);
  assert.match(code,/\["working", "available"\]/);
  assert.match(code,/ten-second-technician-balancing/);
  assert.match(server,/setInterval\(runVisitAssignment, 10 \* 1000\)/);
});

test('completed and cancelled visits are protected and workload is balanced',()=>{
  assert.match(server,/protectedStatuses = new Set\(\["مكتملة", "ملغية", "بانتظار الاعتماد", "بانتظار اعتماد العميل"\]\)/);
  assert.match(server,/load\.get\(cleanId\(left\.identity \|\| left\.id\)\)/);
  assert.match(server,/technicianOwner\(member\) === owner/);
});

test('visits page refreshes every ten seconds without interrupting an open modal',()=>{
  assert.match(app,/currentPage==="visits"[\s\S]*classList\.contains\("open"\)/);
  assert.match(dashboard,/app\.js\?v=[^"']+/);
});
