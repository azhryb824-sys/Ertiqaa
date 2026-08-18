"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_COLLECTIONS = new Set([
  "misadContracts", "misadVisits", "misadTickets", "misadCompanyStaff", "misadOwnerCompanies",
  "misadElevatorAssets", "misadPartsInventory", "misadSuppliers", "misadPurchaseInvoices",
  "misadCustomerInvoices", "misadReceipts", "misadClaims", "misadPayrolls", "misadCustodies",
  "misadBankAccounts", "misadJournalEntries", "misadFinanceAuditLog", "misadContractExpenses",
  "misadFinancialEntries", "v2Customers", "v2WorkOrders", "v2PurchaseOrders", "v2Warehouses",
  "v2StockMoves", "v2AccountingPeriods", "v2Approvals", "v2Roles", "v2Notifications",
  "v2Documents", "v2Audit", "v2Settings", "v2SupplierPayments", "v2GoodsReceipts",
  "v2StaffAdvances", "v2StaffExpenses", "v2PayrollPayments", "v2BankStatements",
  "v2Opportunities", "v2Quotes", "v2AssetEvents", "v2Contacts", "v2SlaEvents",
  "v2NotificationPreferences", "v2PrivacyExports", "v2StockReservations", "v2StockTransfers",
  "v2StockCounts", "v2StockTraceability"
]);
const FINANCE_COLLECTIONS = new Set([
  "misadPurchaseInvoices", "misadCustomerInvoices", "misadReceipts", "misadClaims", "misadPayrolls",
  "misadCustodies", "misadBankAccounts", "misadJournalEntries", "misadFinanceAuditLog",
  "misadContractExpenses", "misadFinancialEntries", "v2AccountingPeriods", "v2SupplierPayments",
  "v2StaffAdvances", "v2StaffExpenses", "v2PayrollPayments"
]);
const SOURCE_KEYS = [...ALLOWED_COLLECTIONS].filter(key => key.startsWith("misad"));
const MAX_BODY = 20 * 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function now() { return new Date().toISOString(); }
function safeTenant(value) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80); }
function sameRecord(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function journalBalanced(entry) {
  const lines = asArray(entry && entry.lines);
  const debit = lines.reduce((sum, line) => sum + (line.side === "debit" ? Number(line.amount || 0) : 0), 0);
  const credit = lines.reduce((sum, line) => sum + (line.side === "credit" ? Number(line.amount || 0) : 0), 0);
  return debit > 0 && Number.isFinite(debit) && Number.isFinite(credit) && Math.abs(debit - credit) <= 0.01;
}
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value), {encoding: "utf8", mode: 0o600});
  fs.renameSync(temp, file);
}
function readFile(file) {
  if (!fs.existsSync(file)) return {schemaVersion: 1, tenants: {}};
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value) || !value.tenants) throw new Error("V2 storage is invalid");
  return value;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    req.setEncoding("utf8"); let body = "", size = 0, stopped = false;
    req.on("data", chunk => {
      if (stopped) return; size += Buffer.byteLength(chunk);
      if (size > MAX_BODY) { stopped = true; reject(Object.assign(new Error("Payload too large"), {status: 413})); return; }
      body += chunk;
    });
    req.on("end", () => {
      if (stopped) return;
      try { resolve(JSON.parse(body || "{}")); } catch { reject(Object.assign(new Error("Invalid JSON"), {status: 400})); }
    });
    req.on("error", reject);
  });
}
function normalizeData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Invalid V2 data"), {status: 400});
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_COLLECTIONS.has(key)) continue;
    output[key] = key === "v2Settings" ? (value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {}) : clone(asArray(value));
  }
  return output;
}
function validJournalTransition(oldRow, nextRow) {
  if (!oldRow || !nextRow || oldRow.voidedAt || !nextRow.voidedAt) return false;
  const permitted = new Set(["voidedAt", "voidedBy", "voidReason", "reversalJournalId"]), oldCore = {}, nextCore = {};
  for (const [key, value] of Object.entries(oldRow)) if (!permitted.has(key)) oldCore[key] = value;
  for (const [key, value] of Object.entries(nextRow)) if (!permitted.has(key)) nextCore[key] = value;
  return sameRecord(oldCore, nextCore) && Boolean(nextRow.reversalJournalId);
}
function validateAppendOnly(previous, next, key) {
  const oldRows = asArray(previous[key]), nextRows = asArray(next[key]), byId = new Map(nextRows.map(row => [String(row && row.id || ""), row]));
  for (const old of oldRows) {
    const id = String(old && old.id || "");
    if (!id || !byId.has(id)) throw Object.assign(new Error(`${key} is append-only; record removal refused`), {status: 409});
    if (!sameRecord(old, byId.get(id)) && !(key === "misadJournalEntries" && validJournalTransition(old, byId.get(id)))) throw Object.assign(new Error(`${key} is append-only; record rewrite refused`), {status: 409});
  }
}
function validateState(previous, next, role) {
  if (role === "technician" || role === "client") {
    if ([...FINANCE_COLLECTIONS].some(key => !sameRecord(previous[key] || [], next[key] || []))) {
      throw Object.assign(new Error("Finance write permission required"), {status: 403});
    }
  }
  validateAppendOnly(previous, next, "misadJournalEntries");
  validateAppendOnly(previous, next, "v2Audit");
  for (const entry of asArray(next.misadJournalEntries)) {
    if (!entry.voidedAt && !journalBalanced(entry)) throw Object.assign(new Error(`Unbalanced journal ${entry.id || "without id"}`), {status: 409});
  }
}
function createV2Api(options) {
  const storageFile = path.join(options.dataDir, "v2", "storage.json");
  const backupDir = path.join(options.dataDir, "v2", "backups");
  const authCookieSecurity=options.secureCookies?"; Secure":"";
  let queue = Promise.resolve();
  const rateBuckets = new Map();
  const send = options.sendJson;
  const resolveLegacyContext = req => {
    const userId = options.authIdentity(req);
    if (!userId) return null;
    const source = options.readSource();
    const users = options.parseArray(source, "misadUsers");
    const user = users.find(item => options.cleanId(item.id) === options.cleanId(userId)) || options.systemUsers.find(item => options.cleanId(item.id) === options.cleanId(userId)) || options.authProfile?.(userId);
    if (!user) return null;
    const role = String(user.role || "");
    const tenantId = safeTenant(role === "owner" ? userId : (user.companyOwnerId || userId));
    return {userId: String(userId), role, tenantId, name: user.name || ""};
  };
  const resolveContext = req => options.sharedAuthOnly
    ? resolveLegacyContext(req)
    : options.authStore.identity(options.authToken(req)) || (options.strictAuth ? null : resolveLegacyContext(req));
  const enqueue = task => {
    const result = queue.catch(() => {}).then(task); queue = result.catch(() => {}); return result;
  };
  function tenantState(root, ctx) {
    return root.tenants[ctx.tenantId] || {version: 0, data: {}, createdAt: now(), updatedAt: now()};
  }
  function backup(root, label) {
    options.backup.writeBackup(backupDir, label, root, options.backupKey);
    const files = fs.readdirSync(backupDir).filter(name => name.endsWith(".v2bak")).sort();
    files.slice(0, Math.max(0, files.length - 30)).forEach(name => fs.unlinkSync(path.join(backupDir, name)));
  }
  async function handle(req, res, pathname) {
    if (!pathname.startsWith("/api/v2/")) return false;
    if(typeof res.setHeader==="function"){res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("Pragma","no-cache");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")}
    try{
      if(options.sharedAuthOnly&&pathname.startsWith("/api/v2/auth/")){send(res,410,{error:"V2 uses the shared system login"});return true}
      if(pathname==="/api/v2/auth/login"&&req.method==="POST"){const input=await readBody(req),session=options.authStore.login(input.userId,input.password,input.code);if(typeof res.setHeader==="function")res.setHeader("Set-Cookie",`${options.authCookieName}=${session.token}; Path=/api/v2; HttpOnly${authCookieSecurity}; SameSite=Strict; Max-Age=1800`);send(res,200,{ok:true,expiresAt:session.expiresAt,identity:session.identity});return true}
      if(pathname==="/api/v2/auth/logout"&&req.method==="POST"){options.authStore.logout(options.authToken(req));if(typeof res.setHeader==="function")res.setHeader("Set-Cookie",`${options.authCookieName}=; Path=/api/v2; HttpOnly${authCookieSecurity}; SameSite=Strict; Max-Age=0`);send(res,200,{ok:true});return true}
      const legacy=resolveLegacyContext(req);
      if(pathname==="/api/v2/auth/bootstrap-session"&&req.method==="GET"){if(!legacy){send(res,401,{error:"Existing authenticated account required"});return true}send(res,200,{ok:true,csrf:options.sign(`v2-enroll:${legacy.userId}:${legacy.tenantId}`),identity:legacy});return true}
      if((pathname==="/api/v2/auth/enroll"||pathname==="/api/v2/auth/confirm")&&req.method==="POST"){if(!legacy){send(res,401,{error:"Existing authenticated account required"});return true}if(String(req.headers["x-v2-enroll-csrf"]||"")!==options.sign(`v2-enroll:${legacy.userId}:${legacy.tenantId}`)){send(res,403,{error:"Invalid enrollment token"});return true}const input=await readBody(req);if(pathname.endsWith("/enroll")){send(res,201,{ok:true,...options.authStore.enroll(legacy,input.password)});return true}const session=options.authStore.confirm(legacy.userId,input.code);if(typeof res.setHeader==="function")res.setHeader("Set-Cookie",`${options.authCookieName}=${session.token}; Path=/api/v2; HttpOnly${authCookieSecurity}; SameSite=Strict; Max-Age=1800`);send(res,200,{ok:true,expiresAt:session.expiresAt,identity:session.identity});return true}
    }catch(error){send(res,error.status||500,{error:error.message||"V2 authentication failed"});return true}
    const ctx = resolveContext(req);
    if (!ctx) { send(res, 401, {error: "Authentication required"}); return true; }
    try {
      const windowId=Math.floor(Date.now()/60000),bucketKey=`${ctx.userId}:${windowId}:${req.method==="GET"?"read":"write"}`,limit=req.method==="GET"?300:120,count=(rateBuckets.get(bucketKey)||0)+1;rateBuckets.set(bucketKey,count);if(rateBuckets.size>10000)for(const key of rateBuckets.keys())if(!key.includes(`:${windowId}:`))rateBuckets.delete(key);if(count>limit){if(typeof res.setHeader==="function")res.setHeader("Retry-After","60");throw Object.assign(new Error("V2 request rate limit exceeded"),{status:429})}
      const csrf = options.sign(`v2:${ctx.userId}:${ctx.tenantId}`);
      if (pathname === "/api/v2/session" && req.method === "GET") {
        send(res, 200, {ok: true, csrf, role: ctx.role, tenant: ctx.tenantId, isolated: true, authentication: options.sharedAuthOnly?"shared-system-session":options.strictAuth?"v2-mfa":"legacy-preview"}); return true;
      }
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && String(req.headers["x-v2-csrf"] || "") !== csrf) {
        send(res, 403, {error: "Invalid V2 request token"}); return true;
      }
      if (pathname === "/api/v2/state" && req.method === "GET") {
        const root = readFile(storageFile), tenant = tenantState(root, ctx);
        send(res, 200, {ok: true, version: tenant.version, data: tenant.data, updatedAt: tenant.updatedAt, isolated: true}); return true;
      }
      if (pathname.startsWith("/api/v2/report/") && req.method === "GET") {
        if (!["owner","admin","company_admin","accountant"].includes(ctx.role)) { send(res,403,{error:"Report permission required"}); return true; }
        const type=pathname.slice("/api/v2/report/".length),url=new URL(req.url||pathname,"http://v2.local"),filters=Object.fromEntries(url.searchParams.entries()),root=readFile(storageFile),tenant=tenantState(root,ctx),report=options.reporting.generate(tenant.data||{},type,filters);
        send(res,200,{ok:true,generatedAt:now(),version:tenant.version,report});return true;
      }
      if (pathname === "/api/v2/bootstrap" && req.method === "POST") {
        if (!["owner", "company_admin", "admin"].includes(ctx.role)) { send(res, 403, {error: "Bootstrap permission required"}); return true; }
        const input = await readBody(req);
        await enqueue(async () => {
          const root = readFile(storageFile), existing = tenantState(root, ctx);
          if (existing.version > 0 && !input.force) throw Object.assign(new Error("V2 tenant already initialized"), {status: 409});
          const source = options.readSource(), data = {};
          for (const key of SOURCE_KEYS) {
            const all = options.parseArray(source, key);
            data[key] = all.filter(record => ctx.role === "admin" || !record || !record.companyOwnerId || String(record.companyOwnerId) === ctx.tenantId);
          }
          data.v2Audit = [{id: `V2-AUD-${Date.now()}`, action: "bootstrap", entity: "system", entityId: ctx.tenantId, detail: "Read-only source snapshot created", userId: ctx.userId, userName: ctx.name, at: now(), environment: "v2"}];
          data.v2Settings = {isolated: true, sourceReadOnly: true, initializedAt: now()};
          if (fs.existsSync(storageFile)) backup(root, "before-bootstrap");
          root.tenants[ctx.tenantId] = {version: existing.version + 1, data, createdAt: existing.createdAt || now(), updatedAt: now(), updatedBy: ctx.userId};
          atomicWrite(storageFile, root);
        });
        const root = readFile(storageFile), tenant = tenantState(root, ctx);
        send(res, 201, {ok: true, version: tenant.version, data: tenant.data, isolated: true}); return true;
      }
      if (pathname === "/api/v2/demo" && req.method === "POST") {
        if (!["owner", "company_admin", "admin"].includes(ctx.role)) { send(res, 403, {error: "Demo permission required"}); return true; }
        await readBody(req);
        await enqueue(async () => {
          const root = readFile(storageFile), existing = tenantState(root, ctx), data = options.createDemoData(ctx.tenantId);
          if (fs.existsSync(storageFile)) backup(root, "before-demo");
          root.tenants[ctx.tenantId] = {version: existing.version + 1, data, history: asArray(existing.history), createdAt: existing.createdAt || now(), updatedAt: now(), updatedBy: ctx.userId, demo: true};
          atomicWrite(storageFile, root);
        });
        const root = readFile(storageFile), tenant = tenantState(root, ctx);
        send(res, 201, {ok: true, version: tenant.version, data: tenant.data, isolated: true, demo: true}); return true;
      }
      if (pathname === "/api/v2/state" && req.method === "PUT") {
        send(res, 405, {error: "Bulk state writes are disabled; use audited V2 commands"}); return true;
      }
      if (pathname === "/api/v2/command" && req.method === "POST") {
        const input = await readBody(req), expectedVersion = Number(input.version), idempotencyKey=String(req.headers["x-idempotency-key"]||"").trim(), handlers = {
          "sales-invoice.create": options.transactions.createSalesInvoice,
          "receipt.create": options.transactions.receivePayment,
          "purchase-invoice.create": options.transactions.createPurchaseInvoice,
          "supplier-payment.create": options.transactions.paySupplier,
          "payroll.accrue": options.transactions.accruePayroll,
          "staff-advance.issue": options.transactions.issueStaffAdvance,
          "staff-expense.create": options.transactions.recordStaffExpense,
          "payroll.pay": options.transactions.payPayroll,
          "journal.create": options.transactions.createManualJournal,
          "entity.create": options.entities.create,
          "entity.update": options.entities.update,
          "entity.archive": options.entities.archive,
          "settings.update": options.entities.settings,
          "purchase-order.approve": options.procurement.approvePurchaseOrder,
          "goods-receipt.create": options.procurement.receiveGoods,
          "purchase-invoice.match": options.procurement.matchPurchaseInvoice,
          "stock.issue": options.procurement.issueStock,
          "stock.reserve": options.procurement.reserveStock,
          "stock.reservation.release": options.procurement.releaseReservation,
          "stock.transfer": options.procurement.transferStock,
          "stock.count": options.procurement.countStock,
          "stock.traceability.register": options.procurement.registerTraceability,
          "document.upload": (state, commandInput, commandCtx) => options.documents.upload(state, commandInput, commandCtx, path.join(options.dataDir,"v2","documents")),
          "bank-account.create": options.treasury.createBankAccount,
          "bank-statement.import": options.treasury.importStatement,
          "bank-line.reconcile": options.treasury.reconcileLine,
          "period.close": (state, commandInput, commandCtx) => options.treasury.closePeriod(state, commandInput, commandCtx, options.assurance),
          "period.reopen": options.treasury.reopenPeriod,
          "opportunity.create": options.operations.createOpportunity,
          "quote.create": options.operations.createQuote,
          "quote.approve": options.operations.approveQuote,
          "quote.convert": options.operations.convertQuote,
          "contract.activate": options.operations.activateContract,
          "contract.renew": options.operations.renewContract,
          "ticket.create": options.operations.createTicket,
          "ticket.dispatch": options.operations.dispatchTicket,
          "work-order.close": options.operations.closeWorkOrder,
          "notification.preference": options.lifecycle.setPreference,
          "notification.delivery": options.lifecycle.recordDelivery,
          "privacy.export": options.lifecycle.exportSubject,
          "retention.apply": options.lifecycle.applyRetention,
          "document.cancel": options.transactions.cancelPostedDocument
          ,"document.correct": options.transactions.correctPostedDocument
        };
        const isApproval = input.type === "approval.approve", handler = handlers[input.type];
        if (!handler && !isApproval) throw Object.assign(new Error("Unknown V2 command"), {status: 400});
        options.permissions.authorize(ctx.role,input.type);
        if (!/^[a-zA-Z0-9._:-]{12,160}$/.test(idempotencyKey)) throw Object.assign(new Error("Valid idempotency key is required"),{status:400});
        let commandResult, replayed=false;
        await enqueue(async () => {
          const root = readFile(storageFile), previous = tenantState(root, ctx), data = clone(previous.data || {});
          const prior=asArray(previous.history).find(item=>item.idempotencyKey===idempotencyKey);
          if(prior){replayed=true;commandResult={ok:true,replayed:true,resultId:prior.resultId||""};return}
          if (expectedVersion !== previous.version) throw Object.assign(new Error("V2 data changed; reload before posting"), {status: 409, currentVersion: previous.version});
          if (isApproval) {
            commandResult = options.governance.approve(data, input.input?.approvalId, ctx, (type, commandInput) => {
              const approvedHandler = handlers[type];
              return approvedHandler ? approvedHandler(data, commandInput, ctx) : {ok: false, error: "Approved command is unavailable"};
            });
            data.v2Audit=asArray(data.v2Audit);data.v2Audit.unshift({id:`V2-AUD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,action:"approval-executed",entity:commandResult.approval.commandType,entityId:commandResult.approval.id,detail:`Approved by ${ctx.userId}`,userId:ctx.userId,userName:ctx.name,at:now(),environment:"v2"});
            commandResult = {ok: true, ...commandResult};
          } else if (options.governance.needsApproval(data, input.type, input.input || {}, ctx)) {
            const approval = options.governance.requestApproval(data, input.type, input.input || {}, ctx);
            data.v2Audit = asArray(data.v2Audit); data.v2Audit.unshift({id:`V2-AUD-${Date.now()}`,action:"approval-request",entity:input.type,entityId:approval.id,detail:`Amount ${approval.amount}`,userId:ctx.userId,userName:ctx.name,at:now(),environment:"v2"});
            commandResult = {ok: true, pendingApproval: true, approval};
          } else {
            commandResult = handler(data, input.input || {}, ctx);
            if (!commandResult.ok) throw Object.assign(new Error(commandResult.error || "Financial command failed"), {status: commandResult.status || 400});
          }
          validateState(previous.data || {}, data, ctx.role);
          if (fs.existsSync(storageFile)) backup(root, `before-${String(input.type).replace(/[^a-z0-9-]/gi, "-")}`);
          const history = asArray(previous.history).slice(0, 199);
          history.unshift({id: `V2-CMD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, type: input.type, idempotencyKey, resultId:commandResult.record?.id||commandResult.approval?.id||"", version: previous.version + 1, userId: ctx.userId, at: now()});
          root.tenants[ctx.tenantId] = {version: previous.version + 1, data, history, createdAt: previous.createdAt || now(), updatedAt: now(), updatedBy: ctx.userId};
          atomicWrite(storageFile, root);
        });
        const root = readFile(storageFile), tenant = tenantState(root, ctx);
        send(res, replayed?200:201, {ok: true, replayed, version: tenant.version, updatedAt: tenant.updatedAt, data: tenant.data, result: commandResult}); return true;
      }
      if (pathname === "/api/v2/health" && req.method === "GET") {
        const root = readFile(storageFile), tenant = tenantState(root, ctx);
        const accounting = options.assurance.inspect(tenant.data || {});
        const backups = options.backup.verifyLatest(backupDir, options.backupKey),security={strictAuthentication:options.strictAuth,mfa:true,shortSessionMinutes:30,rateLimited:true},readiness=options.readiness.evaluate({strictAuth:options.strictAuth,accountingOk:accounting.ok,backupOk:backups.ok}),ok = accounting.ok && backups.ok && security.strictAuthentication;
        send(res, ok ? 200 : 409, {ok, isolated: true, tenant: ctx.tenantId, version: tenant.version, storage: "v2-only", accounting, backups,security,readiness}); return true;
      }
      if (pathname === "/api/v2/restore-drill" && req.method === "POST") {
        if (!['owner','admin'].includes(ctx.role)) { send(res, 403, {error:"Restore drill permission required"}); return true; }
        await readBody(req); const result = options.backup.verifyLatest(backupDir, options.backupKey);
        send(res, result.ok ? 200 : 409, {ok:result.ok, dryRun:true, applied:false, ...result}); return true;
      }
      send(res, 405, {error: "Method not allowed"}); return true;
    } catch (error) {
      send(res, error.status || 500, {error: error.message || "V2 operation failed", currentVersion: error.currentVersion}); return true;
    }
  }
  return {handle, storageFile};
}

module.exports = {createV2Api, journalBalanced, normalizeData, validateState, validJournalTransition, ALLOWED_COLLECTIONS};
