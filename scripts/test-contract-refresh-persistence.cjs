const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4193";
const contract = {
  id: `REFRESH-${Date.now()}`,
  companyOwnerId: "REFRESH-TEST",
  type: "صيانة",
  clientName: "اختبار ثبات العقود",
  status: "بانتظار موافقة العميل",
  startDate: "2026-07-16"
};

async function json(path, options) {
  const response = await fetch(base + path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body.error || "request failed"}`);
  return body;
}

async function run() {
  const initial = await json("/api/storage?key=misadContracts");
  const original = initial.value ?? "[]";
  const contracts = JSON.parse(original || "[]");
  contracts.unshift(contract);
  await json("/api/storage/batch", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({updates: [{key: "misadContracts", value: JSON.stringify(contracts)}]})
  });

  for (let refresh = 1; refresh <= 10; refresh++) {
    const loaded = await json(`/api/storage?key=misadContracts&refresh=${refresh}`);
    const rows = JSON.parse(loaded.value || "[]");
    if (!rows.some(item => item.id === contract.id)) throw new Error(`Contract disappeared after refresh ${refresh}`);
  }

  await json("/api/storage/batch", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({updates: [{key: "misadContracts", value: original}]})
  });
  console.log(JSON.stringify({ok: true, refreshes: 10, contractId: contract.id}));
}

run().catch(error => {
  console.error(JSON.stringify({ok: false, error: error.message}));
  process.exitCode = 1;
});
