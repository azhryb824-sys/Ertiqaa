const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4194";
const member = {
  id: `STF-REFRESH-${Date.now()}`,
  companyOwnerId: "REFRESH-TEST",
  identity: "2123456790",
  name: "اختبار ثبات عضو الفريق",
  role: "technician",
  availability: "working",
  status: "مرتبط"
};

async function json(path, options) {
  const response = await fetch(base + path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body.error || "request failed"}`);
  return body;
}

async function save(value) {
  return json("/api/storage/batch", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({updates: [{key: "misadCompanyStaff", value}]})
  });
}

async function run() {
  const initial = await json("/api/storage?key=misadCompanyStaff");
  const original = initial.value ?? "[]";
  const team = JSON.parse(original || "[]");
  team.unshift(member);
  await save(JSON.stringify(team));

  for (let refresh = 1; refresh <= 10; refresh++) {
    const loaded = await json(`/api/storage?key=misadCompanyStaff&refresh=${refresh}`);
    const rows = JSON.parse(loaded.value || "[]");
    if (!rows.some(item => item.id === member.id)) throw new Error(`Team member disappeared after refresh ${refresh}`);
  }

  await save(original);
  console.log(JSON.stringify({ok: true, refreshes: 10, memberId: member.id}));
}

run().catch(error => {
  console.error(JSON.stringify({ok: false, error: error.message}));
  process.exitCode = 1;
});
