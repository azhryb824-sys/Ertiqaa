const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const storagePath = path.join(root, "storage.json");
const entrySecret = process.env.SECRET_ENTRY_TOKEN || crypto.randomBytes(32).toString("hex");
const entryCookie = "misad_entry";
const inviteCookie = "misad_invite";
const deviceCookie = "misad_device";
const entryCookieValue = crypto.createHash("sha256").update(entrySecret).digest("hex");
let storeCache = null;
let storeMtime = 0;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => {
    const index = part.indexOf("=");
    if (index === -1) return null;
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

function hasEntryAccess(req) {
  return parseCookies(req.headers.cookie)[entryCookie] === entryCookieValue;
}

function sign(value) {
  return crypto.createHmac("sha256", entrySecret).update(value).digest("hex");
}

function hasDeviceAccess(req) {
  const token = parseCookies(req.headers.cookie)[deviceCookie] || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, deviceId, sig] = parts;
  return Boolean(userId && deviceId && sig === sign(`${userId}:${deviceId}`));
}

function readStore() {
  try {
    const stat = fs.existsSync(storagePath) ? fs.statSync(storagePath) : null;
    const mtime = stat?.mtimeMs || 0;
    if (storeCache && mtime === storeMtime) return storeCache;
    storeCache = JSON.parse(fs.readFileSync(storagePath, "utf8") || "{}");
    storeMtime = mtime;
    return storeCache;
  } catch {
    storeCache = {};
    storeMtime = 0;
    return storeCache;
  }
}

function writeStore(store) {
  fs.writeFileSync(storagePath, JSON.stringify(store, null, 2), "utf8");
  storeCache = store;
  storeMtime = fs.statSync(storagePath).mtimeMs;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function publicOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const hostName = req.headers["x-forwarded-host"] || req.headers.host || `${host}:${port}`;
  return `${proto}://${hostName}`;
}

function inviteList(store) {
  try {
    return JSON.parse(store.misadEntryInvites || "[]");
  } catch {
    return [];
  }
}

function saveInvites(store, invites) {
  store.misadEntryInvites = JSON.stringify(invites.slice(0, 200));
  writeStore(store);
}

function createInvite(input = {}) {
  const maxUses = Math.max(1, Math.min(20, Number(input.maxUses || 1)));
  const minutes = Math.max(1, Math.min(1440, Number(input.minutes || 10)));
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  return {
    id: `INV-${now}`,
    token,
    label: String(input.label || "رابط دخول عميل").slice(0, 80),
    targetRole: String(input.targetRole || "client"),
    targetUserId: String(input.targetUserId || ""),
    createdBy: String(input.createdBy || ""),
    createdByName: String(input.createdByName || ""),
    createdAt: new Date(now).toISOString(),
    expiresAtMs: now + minutes * 60000,
    maxUses,
    used: 0,
    kind: String(input.kind || "device"),
    revoked: false
  };
}

function sendLocked(res) {
  res.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متاح</title><body style="font-family:Arial,Tahoma,sans-serif;background:#f7f3ec;color:#17231f;display:grid;min-height:100vh;place-items:center;margin:0"><main style="max-width:520px;padding:32px;text-align:center"><h1>الرابط غير متاح</h1><p>لا يمكن فتح النظام إلا من خلال رابط الدخول السري المرسل من المالك أو الإداري.</p></main></body></html>`);
}

function sendMobileAssociation(res, pathname) {
  const androidPackage = process.env.ANDROID_PACKAGE_NAME || "com.ertiqaa.app";
  const androidFingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "").split(",").map(x => x.trim()).filter(Boolean);
  const iosTeamId = process.env.IOS_TEAM_ID || "";
  const iosBundleId = process.env.IOS_BUNDLE_ID || "com.ertiqaa.app";
  if (pathname === "/.well-known/assetlinks.json") {
    sendJson(res, 200, androidFingerprints.length ? [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {namespace: "android_app", package_name: androidPackage, sha256_cert_fingerprints: androidFingerprints}
    }] : []);
    return true;
  }
  if (pathname === "/.well-known/apple-app-site-association") {
    res.writeHead(200, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
    res.end(JSON.stringify({applinks: {apps: [], details: iosTeamId ? [{appIDs: [`${iosTeamId}.${iosBundleId}`], components: [{"/": "/invite/*"}, {"/": "/dashboard.html"}, {"/": "/login.html"}]}] : []}}));
    return true;
  }
  return false;
}

function notificationList(store) {
  try { return JSON.parse(store.misadNotifications || "[]"); } catch { return []; }
}

function saveNotifications(store, notifications) {
  store.misadNotifications = JSON.stringify(notifications.slice(0, 500));
  writeStore(store);
}

function aiMemoryList(store) {
  try { return JSON.parse(store.misadAiMemory || "[]"); } catch { return []; }
}

function saveAiMemory(store, memory) {
  store.misadAiMemory = JSON.stringify(memory.slice(0, 500));
  writeStore(store);
}

function aiConversationList(store) {
  try { return JSON.parse(store.misadAiConversations || "[]"); } catch { return []; }
}

function saveAiConversations(store, conversations) {
  store.misadAiConversations = JSON.stringify(conversations.slice(0, 200));
  writeStore(store);
}

function getOrCreateConversation(store, userId, role) {
  const conversations = aiConversationList(store);
  let conversation = conversations.find(c => c.userId === userId && c.role === role && !c.endedAt);
  if (!conversation) {
    conversation = {
      id: `CONV-${Date.now()}`,
      userId,
      role,
      messages: [],
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      endedAt: null
    };
    conversations.unshift(conversation);
    saveAiConversations(store, conversations);
  }
  return conversation;
}

function addMessageToConversation(store, conversationId, role, content) {
  const conversations = aiConversationList(store);
  const conversation = conversations.find(c => c.id === conversationId);
  if (conversation) {
    conversation.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    conversation.lastActivityAt = new Date().toISOString();
    // Keep only last 20 messages to maintain context
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }
    saveAiConversations(store, conversations);
  }
  return conversation;
}

function endConversation(store, conversationId) {
  const conversations = aiConversationList(store);
  const conversation = conversations.find(c => c.id === conversationId);
  if (conversation) {
    conversation.endedAt = new Date().toISOString();
    saveAiConversations(store, conversations);
  }
}

function analyzeReportForQuote(report, store) {
  const findings = {
    needsSpareParts: false,
    needsInstallation: false,
    needsUpdate: false,
    needsReplacement: false,
    needsAdditionalWorks: false,
    requiredParts: [],
    recommendations: [],
    severity: "low"
  };
  
  const reportText = String(report.description || report.details || report.notes || "").toLowerCase();
  const reportType = String(report.type || report.visitType || "").toLowerCase();
  
  // Analyze report content for indicators
  const sparePartsKeywords = ["قطع غيار", "استبدال قطعة", "قطعة تالفة", "قطعة معطلة", "جزء تالف", "يحتاج قطعة", "قطعة جديدة", "تغيير قطعة", "spare part", "replacement part"];
  const installationKeywords = ["تركيب مصعد", "installation", "install elevator", "new elevator", "مصعد جديد"];
  const updateKeywords = ["تحديث", "upgrade", "modernization", "تحديث نظام", "تحديث تحكم"];
  const replacementKeywords = ["استبدال مصعد", "replace elevator", "مصعد قديم", "استبدال كامل"];
  const additionalWorksKeywords = ["أعمال إضافية", "additional work", "عمل إضافي", "تعديل", "إصلاح إضافي"];
  
  findings.needsSpareParts = sparePartsKeywords.some(kw => reportText.includes(kw));
  findings.needsInstallation = installationKeywords.some(kw => reportText.includes(kw));
  findings.needsUpdate = updateKeywords.some(kw => reportText.includes(kw));
  findings.needsReplacement = replacementKeywords.some(kw => reportText.includes(kw));
  findings.needsAdditionalWorks = additionalWorksKeywords.some(kw => reportText.includes(kw));
  
  // Determine severity based on keywords
  const criticalKeywords = ["خطر", "danger", "emergency", "طارئ", "خطير", "توقف كامل", "complete failure"];
  const highKeywords = ["عالي", "high priority", "مهم", "important", "أولوية عالية"];
  
  if (criticalKeywords.some(kw => reportText.includes(kw))) {
    findings.severity = "critical";
  } else if (highKeywords.some(kw => reportText.includes(kw))) {
    findings.severity = "high";
  } else if (findings.needsReplacement || findings.needsInstallation) {
    findings.severity = "high";
  } else if (findings.needsSpareParts || findings.needsUpdate) {
    findings.severity = "medium";
  }
  
  // Extract potential parts mentioned (simple extraction)
  const parts = parseStoredJson(store, "misadPartsInventory");
  const mentionedParts = parts.filter(p => reportText.includes(p.name.toLowerCase()) || reportText.includes(p.sku?.toLowerCase() || ""));
  findings.requiredParts = mentionedParts.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    suggestedQty: 1,
    unitCost: p.unitCost || 0
  }));
  
  // Generate recommendations
  if (findings.needsSpareParts) {
    findings.recommendations.push("يحتاج إلى توريد قطع غيار - يوصى بإصدار عرض سعر");
  }
  if (findings.needsInstallation) {
    findings.recommendations.push("يحتاج إلى تركيب مصعد جديد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsUpdate) {
    findings.recommendations.push("يحتاج إلى تحديث المصعد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsReplacement) {
    findings.recommendations.push("يحتاج إلى استبدال المصعد - يوصى بإصدار عرض سعر");
  }
  if (findings.needsAdditionalWorks) {
    findings.recommendations.push("يحتاج إلى أعمال إضافية - يوصى بإصدار عرض سعر");
  }
  
  return findings;
}

function findBestSupplierForParts(parts, store) {
  const suppliers = parseStoredJson(store, "misadSuppliers");
  const partsInventory = parseStoredJson(store, "misadPartsInventory");
  
  return parts.map(part => {
    const partInventory = partsInventory.find(p => p.id === part.id);
    const supplierId = partInventory?.supplier || "";
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // Find alternative suppliers with better prices
    const alternatives = suppliers
      .filter(s => s.category === part.category || !part.category)
      .map(s => ({
        id: s.id,
        name: s.name,
        rating: s.rating || 0,
        // In a real system, this would query supplier pricing
        estimatedPrice: part.unitCost * (1 - (s.rating || 0) * 0.05) // Simple estimation
      }))
      .sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    
    return {
      ...part,
      bestSupplier: alternatives[0] || supplier,
      alternatives: alternatives.slice(1, 3)
    };
  });
}

function generateAutoQuote(report, analysis, store, userId) {
  const contracts = parseStoredJson(store, "misadContracts");
  const contract = contracts.find(c => c.id === report.contractId);
  
  const quote = {
    id: `QTO-${Date.now()}`,
    title: `عرض سعر تلقائي بناءً على تقرير ${report.id}`,
    client: contract?.clientName || contract?.clientCompanyName || "غير محدد",
    clientId: contract?.clientId || "",
    clientCompanyUnifiedNumber: contract?.clientCompanyUnifiedNumber || "",
    contractId: report.contractId,
    reportId: report.id,
    value: 0,
    status: "بانتظار المراجعة والاعتماد",
    autoGenerated: true,
    analysis: analysis,
    items: [],
    customItems: [],
    elevatorInfo: contract?.elevatorInfo || {},
    details: `عرض سعر تم إنشاؤه تلقائياً بناءً على تحليل تقرير الزيارة ${report.id}. الشدة: ${analysis.severity}. التوصيات: ${analysis.recommendations.join("، ")}`,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now()
  };
  
  // Add parts to quote items
  const partsWithSuppliers = findBestSupplierForParts(analysis.requiredParts, store);
  let totalValue = 0;
  
  partsWithSuppliers.forEach(part => {
    const price = part.bestSupplier?.estimatedPrice || part.unitCost || 0;
    totalValue += price;
    quote.items.push({
      id: Date.now() + Math.random(),
      type: "spare_part",
      title: part.name,
      description: `قطعة غيار - ${part.category || "عام"} - المورد المفضل: ${part.bestSupplier?.name || "غير محدد"}`,
      price: price,
      supplier: part.bestSupplier?.name || "",
      partId: part.id
    });
  });
  
  // Add service fees based on severity
  const serviceFees = {
    critical: 500,
    high: 300,
    medium: 200,
    low: 100
  };
  
  if (analysis.needsInstallation) {
    quote.customItems.push({
      title: "رسوم تركيب المصعد",
      description: "خدمة تركيب مصعد جديد",
      price: serviceFees[analysis.severity] * 10
    });
    totalValue += serviceFees[analysis.severity] * 10;
  }
  
  if (analysis.needsUpdate) {
    quote.customItems.push({
      title: "رسوم تحديث المصعد",
      description: "خدمة تحديث نظام المصعد",
      price: serviceFees[analysis.severity] * 5
    });
    totalValue += serviceFees[analysis.severity] * 5;
  }
  
  if (analysis.needsReplacement) {
    quote.customItems.push({
      title: "رسوم استبدال المصعد",
      description: "خدمة استبدال المصعد القديم",
      price: serviceFees[analysis.severity] * 8
    });
    totalValue += serviceFees[analysis.severity] * 8;
  }
  
  quote.value = totalValue;
  
  return quote;
}

function optimizeQuotePrices(quote, targetValue, store) {
  const suppliers = parseStoredJson(store, "misadSuppliers");
  const partsInventory = parseStoredJson(store, "misadPartsInventory");
  
  const result = {
    originalValue: quote.value || 0,
    targetValue: targetValue,
    achievable: false,
    newValue: 0,
    changes: [],
    requiresApproval: false,
    approvalDetails: null
  };
  
  let currentValue = result.originalValue;
  
  // First, try to optimize parts prices
  quote.items.forEach(item => {
    if (item.type === "spare_part" && item.partId) {
      const part = partsInventory.find(p => p.id === item.partId);
      if (part) {
        const alternatives = suppliers
          .filter(s => s.category === part.category || !part.category)
          .map(s => ({
            id: s.id,
            name: s.name,
            rating: s.rating || 0,
            estimatedPrice: part.unitCost * (1 - (s.rating || 0) * 0.05)
          }))
          .sort((a, b) => a.estimatedPrice - b.estimatedPrice);
        
        if (alternatives.length > 0) {
          const bestAlternative = alternatives[0];
          const savings = item.price - bestAlternative.estimatedPrice;
          
          if (savings > 0) {
            result.changes.push({
              type: "part_price",
              itemName: item.title,
              originalPrice: item.price,
              newPrice: bestAlternative.estimatedPrice,
              savings: savings,
              newSupplier: bestAlternative.name
            });
            item.price = bestAlternative.estimatedPrice;
            item.supplier = bestAlternative.name;
            currentValue -= savings;
          }
        }
      }
    }
  });
  
  result.newValue = currentValue;
  
  // If still above target, check if we need to reduce service fees
  if (currentValue > targetValue) {
    const difference = currentValue - targetValue;
    const totalServiceFees = quote.customItems.reduce((sum, item) => sum + (item.price || 0), 0);
    
    if (totalServiceFees > 0 && difference <= totalServiceFees) {
      result.requiresApproval = true;
      result.approvalDetails = {
        type: "service_fee_reduction",
        currentTotal: totalServiceFees,
        proposedReduction: difference,
        newTotal: totalServiceFees - difference,
        impact: "تخفيض في رسوم الخدمة"
      };
      result.changes.push(result.approvalDetails);
      result.newValue = targetValue;
      result.achievable = true;
    } else if (totalServiceFees > 0) {
      // Can reduce all service fees but still won't reach target
      result.requiresApproval = true;
      result.approvalDetails = {
        type: "service_fee_reduction",
        currentTotal: totalServiceFees,
        proposedReduction: totalServiceFees,
        newTotal: 0,
        impact: "إلغاء جميع رسوم الخدمة",
        note: "حتى بعد إلغاء جميع رسوم الخدمة، لن يتم الوصول للقيمة المستهدفة"
      };
      result.changes.push(result.approvalDetails);
      result.newValue = currentValue - totalServiceFees;
      result.achievable = result.newValue <= targetValue;
    }
  } else {
    result.achievable = true;
  }
  
  return result;
}

function createQuoteVersion(originalQuote, changes, userId) {
  const newQuote = JSON.parse(JSON.stringify(originalQuote));
  newQuote.id = `QTO-${Date.now()}`;
  newQuote.parentId = originalQuote.id;
  newQuote.version = (originalQuote.version || 1) + 1;
  newQuote.status = "بانتظار المراجعة والاعتماد";
  newQuote.modifications = changes;
  newQuote.modifiedBy = userId;
  newQuote.modifiedAt = new Date().toISOString();
  newQuote.createdAt = new Date().toISOString();
  newQuote.createdAtMs = Date.now();
  
  // Recalculate value
  newQuote.value = newQuote.items.reduce((sum, item) => sum + (item.price || 0), 0) +
                   newQuote.customItems.reduce((sum, item) => sum + (item.price || 0), 0);
  
  return newQuote;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function analyzeTechnicianWorkload(technician, visits, store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const currentLocation = locations.find(l => l.identity === technician.identity);
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technician.identity);
  const now = Date.now();
  
  const upcomingVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled >= now;
  });
  
  const lateVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled < now && !v.reportId;
  });
  
  let totalDistance = 0;
  let lastLocation = currentLocation;
  
  upcomingVisits.sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  
  upcomingVisits.forEach(visit => {
    if (lastLocation && visit.building?.lat && visit.building?.lng) {
      totalDistance += calculateDistance(
        lastLocation.lat || 0,
        lastLocation.lng || 0,
        visit.building.lat,
        visit.building.lng
      );
      lastLocation = {lat: visit.building.lat, lng: visit.building.lng};
    }
  });
  
  return {
    technicianId: technician.identity,
    technicianName: technician.name,
    availability: technician.availability || "working",
    assignedVisits: assignedVisits.length,
    upcomingVisits: upcomingVisits.length,
    lateVisits: lateVisits.length,
    currentLocation: currentLocation ? {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      live: currentLocation.live,
      updatedAt: currentLocation.updatedAt
    } : null,
    estimatedTotalDistance: totalDistance,
    workloadScore: assignedVisits.length * 10 + lateVisits.length * 20
  };
}

function redistributeVisits(store, options = {}) {
  const visits = parseStoredJson(store, "misadVisits");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const locations = parseStoredJson(store, "misadStaffLocations");
  const tickets = parseStoredJson(store, "misadTickets");
  
  const availableTechnicians = staff.filter(s => 
    ["technician", "engineer"].includes(s.role) && 
    (s.availability || "working") === "working"
  );
  
  const unassignedVisits = visits.filter(v => !v.assignedTo || v.assignedTo === "");
  const redistributableVisits = options.redistributeAll ? visits : unassignedVisits;
  
  const analysis = {
    totalVisits: visits.length,
    unassignedVisits: unassignedVisits.length,
    redistributableVisits: redistributableVisits.length,
    availableTechnicians: availableTechnicians.length,
    workloadAnalysis: [],
    recommendations: [],
    proposedAssignments: [],
    metrics: {
      averageDistance: 0,
      totalDistance: 0,
      efficiencyScore: 0
    }
  };
  
  // Analyze each technician's current workload
  availableTechnicians.forEach(tech => {
    const workload = analyzeTechnicianWorkload(tech, visits, store);
    analysis.workloadAnalysis.push(workload);
  });
  
  // Sort technicians by workload (least busy first)
  const sortedTechnicians = analysis.workloadAnalysis
    .sort((a, b) => a.workloadScore - b.workloadScore);
  
  // Assign visits to technicians based on geographic proximity and workload
  redistributableVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    let bestTechnician = null;
    let bestScore = Infinity;
    
    sortedTechnicians.forEach(tech => {
      if (!tech.currentLocation) return;
      
      const distance = calculateDistance(
        tech.currentLocation.lat,
        tech.currentLocation.lng,
        visit.building.lat,
        visit.building.lng
      );
      
      // Score calculation: distance + workload penalty
      const score = distance + (tech.workloadScore * 0.1);
      
      if (score < bestScore) {
        bestScore = score;
        bestTechnician = tech;
      }
    });
    
    if (bestTechnician) {
      analysis.proposedAssignments.push({
        visitId: visit.id,
        visitIdDisplay: visit.id,
        clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
        currentAssignedTo: visit.assignedTo || "غير مسند",
        proposedTechnician: bestTechnician.technicianName,
        proposedTechnicianId: bestTechnician.technicianId,
        distance: bestScore,
        reasoning: `أقرب فني (${bestScore.toFixed(2)} كم) مع أقل عبء عمل (${bestTechnician.workloadScore})`
      });
    }
  });
  
  // Calculate metrics
  analysis.metrics.totalDistance = analysis.proposedAssignments.reduce((sum, a) => sum + a.distance, 0);
  analysis.metrics.averageDistance = analysis.proposedAssignments.length > 0 
    ? analysis.metrics.totalDistance / analysis.proposedAssignments.length 
    : 0;
  analysis.metrics.efficiencyScore = analysis.proposedAssignments.length > 0
    ? (1 / (analysis.metrics.averageDistance + 1)) * 100
    : 0;
  
  // Generate recommendations
  if (analysis.unassignedVisits.length > 0) {
    analysis.recommendations.push(`يوجد ${analysis.unassignedVisits.length} زيارة غير مسندة - يوصى بإسنادها فوراً`);
  }
  
  const overloadedTechnicians = analysis.workloadAnalysis.filter(t => t.workloadScore > 50);
  if (overloadedTechnicians.length > 0) {
    analysis.recommendations.push(`${overloadedTechnicians.length} فنيين لديهم عبء عمل عالي - يوصى بإعادة توزيع الزيارات`);
  }
  
  const idleTechnicians = analysis.workloadAnalysis.filter(t => t.assignedVisits === 0);
  if (idleTechnicians.length > 0) {
    analysis.recommendations.push(`${idleTechnicians.length} فنيين متفرغين - يمكن إسناد زيارات إضافية لهم`);
  }
  
  return analysis;
}

function analyzeTechnicianLocation(technicianId, store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const visits = parseStoredJson(store, "misadVisits");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  
  const currentLocation = locations.find(l => l.identity === technicianId);
  const technician = staff.find(s => s.identity === technicianId);
  
  if (!currentLocation || !technician) {
    return {error: "Technician location or data not found"};
  }
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technicianId);
  const now = Date.now();
  
  const insights = {
    technicianId,
    technicianName: technician.name,
    currentLocation: {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      live: currentLocation.live,
      updatedAt: currentLocation.updatedAt,
      updatedAtIso: currentLocation.updatedAtIso
    },
    assignedVisits: assignedVisits.length,
    locationInsights: [],
    alerts: [],
    routeOptimization: []
  };
  
  // Check for route deviations and delays
  assignedVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    const scheduledTime = visit.scheduledAt ? new Date(visit.scheduledAt).getTime() : 0;
    const distanceToVisit = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      visit.building.lat,
      visit.building.lng
    );
    
    // Estimate travel time (assuming 40 km/h average speed in urban areas)
    const estimatedTravelTime = distanceToVisit / 40 * 60; // in minutes
    const estimatedArrival = now + (estimatedTravelTime * 60 * 1000);
    
    if (scheduledTime > 0) {
      const delayMinutes = (estimatedArrival - scheduledTime) / (60 * 1000);
      
      if (delayMinutes > 30) {
        insights.alerts.push({
          type: "delay_expected",
          severity: "high",
          visitId: visit.id,
          clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
          scheduledTime: visit.scheduledAt,
          estimatedArrival: new Date(estimatedArrival).toISOString(),
      expectedDelay: Math.round(delayMinutes),
          message: `تأخر متوقع ${Math.round(delayMinutes)} دقيقة للوصول إلى ${visit.clientName || visit.clientCompanyName}`
        });
      } else if (delayMinutes > 15) {
        insights.alerts.push({
          type: "delay_expected",
          severity: "medium",
          visitId: visit.id,
          clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
          scheduledTime: visit.scheduledAt,
          estimatedArrival: new Date(estimatedArrival).toISOString(),
          expectedDelay: Math.round(delayMinutes),
          message: `تأخر متوقع ${Math.round(delayMinutes)} دقيقة للوصول إلى ${visit.clientName || visit.clientCompanyName}`
        });
      }
    }
    
    insights.locationInsights.push({
      visitId: visit.id,
      clientName: visit.clientName || visit.clientCompanyName || "غير محدد",
      distance: distanceToVisit.toFixed(2),
      estimatedTravelTime: Math.round(estimatedTravelTime),
      scheduledTime: visit.scheduledAt
    });
  });
  
  // Check for closer technicians to nearby visits
  const otherTechnicians = staff.filter(s => 
    s.identity !== technicianId && 
    ["technician", "engineer"].includes(s.role) &&
    (s.availability || "working") === "working"
  );
  
  const otherLocations = locations.filter(l => 
    otherTechnicians.some(t => t.identity === l.identity)
  );
  
  assignedVisits.forEach(visit => {
    if (!visit.building?.lat || !visit.building?.lng) return;
    
    const currentTechDistance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      visit.building.lat,
      visit.building.lng
    );
    
    otherLocations.forEach(otherLoc => {
      const otherTechDistance = calculateDistance(
        otherLoc.lat,
        otherLoc.lng,
        visit.building.lat,
        visit.building.lng
      );
      
      // If another technician is significantly closer (at least 2 km closer)
      if (otherTechDistance < currentTechDistance - 2) {
        const otherTech = otherTechnicians.find(t => t.identity === otherLoc.identity);
        insights.routeOptimization.push({
          type: "closer_technician",
          visitId: visit.id,
          visitClient: visit.clientName || visit.clientCompanyName || "غير محدد",
          currentTechnician: technician.name,
          currentDistance: currentTechDistance.toFixed(2),
          closerTechnician: otherTech?.name || "غير محدد",
          closerDistance: otherTechDistance.toFixed(2),
          savings: (currentTechDistance - otherTechDistance).toFixed(2),
          recommendation: `فني أقرب (${otherTech?.name}) على بعد ${otherTechDistance.toFixed(2)} كم مقارنة بـ ${currentTechDistance.toFixed(2)} كم`
        });
      }
    });
  });
  
  // Check for visit merging opportunities
  if (assignedVisits.length >= 2) {
    for (let i = 0; i < assignedVisits.length - 1; i++) {
      for (let j = i + 1; j < assignedVisits.length; j++) {
        const visit1 = assignedVisits[i];
        const visit2 = assignedVisits[j];
        
        if (!visit1.building?.lat || !visit1.building?.lng || 
            !visit2.building?.lat || !visit2.building?.lng) continue;
        
        const distanceBetweenVisits = calculateDistance(
          visit1.building.lat,
          visit1.building.lng,
          visit2.building.lat,
          visit2.building.lng
        );
        
        // If visits are very close (less than 1 km apart)
        if (distanceBetweenVisits < 1) {
          insights.routeOptimization.push({
            type: "visit_merge_opportunity",
            visit1Id: visit1.id,
            visit2Id: visit2.id,
            visit1Client: visit1.clientName || visit1.clientCompanyName || "غير محدد",
            visit2Client: visit2.clientName || visit2.clientCompanyName || "غير محدد",
            distance: distanceBetweenVisits.toFixed(2),
            recommendation: `يمكن دمج زيارتين متقاربتين (${distanceBetweenVisits.toFixed(2)} كم) في زيارة واحدة`
          });
        }
      }
    }
  }
  
  return insights;
}

function detectRouteDeviations(store) {
  const locations = parseStoredJson(store, "misadStaffLocations");
  const visits = parseStoredJson(store, "misadVisits");
  
  const deviations = [];
  
  locations.forEach(location => {
    if (!location.live) return;
    
    const assignedVisits = visits.filter(v => String(v.assignedTo) === location.identity);
    const now = Date.now();
    
    assignedVisits.forEach(visit => {
      if (!visit.building?.lat || !visit.building?.lng) return;
      
      const scheduledTime = visit.scheduledAt ? new Date(visit.scheduledAt).getTime() : 0;
      
      // Only check visits scheduled within the next 2 hours
      if (scheduledTime > 0 && scheduledTime > now && scheduledTime < now + (2 * 60 * 60 * 1000)) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          visit.building.lat,
          visit.building.lng
        );
        
        // If technician is far from upcoming visit (more than 10 km)
        if (distance > 10) {
          deviations.push({
            technicianId: location.identity,
            technicianName: location.name,
            visitId: visit.id,
            visitClient: visit.clientName || visit.clientCompanyName || "غير محدد",
            currentDistance: distance.toFixed(2),
            scheduledTime: visit.scheduledAt,
            deviationType: "far_from_upcoming_visit",
            message: `الفني ${location.name} بعيد (${distance.toFixed(2)} كم) عن زيارة قريبة ${visit.clientName || visit.clientCompanyName}`
          });
        }
      }
    });
  });
  
  return deviations;
}

function generateSmartNotifications(store) {
  const notifications = [];
  const contracts = parseStoredJson(store, "misadContracts");
  const visits = parseStoredJson(store, "misadVisits");
  const tickets = parseStoredJson(store, "misadTickets");
  const parts = parseStoredJson(store, "misadPartsInventory");
  const quotes = parseStoredJson(store, "misadQuotes");
  const reports = parseStoredJson(store, "misadVisitReports");
  const now = Date.now();
  
  // Check for expiring contracts (within 30 days)
  contracts.forEach(contract => {
    if (contract.endDate) {
      const endDate = new Date(contract.endDate).getTime();
      const daysUntilExpiry = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
      
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 30 && contract.status === "ساري") {
        notifications.push({
          type: "contract_expiring",
          priority: daysUntilExpiry <= 7 ? "high" : "medium",
          title: "عقد قارب على الانتهاء",
          body: `عقد ${contract.id} للعميل ${contract.clientName || contract.clientCompanyName} ينتهي خلال ${daysUntilExpiry} يوم`,
          url: "/dashboard.html#contracts",
          roles: ["owner", "company_admin", "admin"],
          data: {contractId: contract.id, daysUntilExpiry}
        });
      }
    }
  });
  
  // Check for low inventory
  parts.forEach(part => {
    const qty = Number(part.qty || 0);
    const minQty = Number(part.minQty || 0);
    
    if (qty <= minQty && minQty > 0) {
      notifications.push({
        type: "low_inventory",
        priority: qty === 0 ? "critical" : "high",
        title: "نقص في المخزون",
        body: `قطعة ${part.name} وصلت للحد الأدنى (${qty} من ${minQty})`,
        url: "/dashboard.html#inventory",
        roles: ["owner", "company_admin", "admin"],
        data: {partId: part.id, partName: part.name, qty, minQty}
      });
    }
  });
  
  // Check for pending documents awaiting approval
  const pendingQuotes = quotes.filter(q => q.status === "بانتظار المراجعة والاعتماد" || q.status === "pending");
  if (pendingQuotes.length > 0) {
    notifications.push({
      type: "pending_approval",
      priority: "high",
      title: "عروض أسعار تنتظر الاعتماد",
      body: `يوجد ${pendingQuotes.length} عرض سعر يحتاج مراجعة واعتماد`,
      url: "/dashboard.html#quotes",
      roles: ["owner", "company_admin", "admin"],
      data: {count: pendingQuotes.length}
    });
  }
  
  // Check for overdue visits without reports
  const overdueVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled < now && !reports.some(r => r.visitId === v.id);
  });
  
  if (overdueVisits.length > 0) {
    notifications.push({
      type: "overdue_visits",
      priority: "high",
      title: "زيارات متأخرة بدون تقارير",
      body: `يوجد ${overdueVisits.length} زيارة متأخرة لم يتم رفع تقريرها`,
      url: "/dashboard.html#visits",
      roles: ["owner", "company_admin", "admin", "technician", "engineer"],
      data: {count: overdueVisits.length, visitIds: overdueVisits.map(v => v.id)}
    });
  }
  
  // Check for performance issues (high ticket reopen rate)
  const reopenedTickets = tickets.filter(t => t.status === "مفتوح" && t.reopenedCount > 0);
  if (reopenedTickets.length >= 3) {
    notifications.push({
      type: "performance_alert",
      priority: "medium",
      title: "معدل إعادة فتح البلاغات مرتفع",
      body: `يوجد ${reopenedTickets.length} بلاغ تم إعادة فتحها - قد يشير لاحتياج تدريب أو مراجعة`,
      url: "/dashboard.html#tickets",
      roles: ["owner", "company_admin", "admin"],
      data: {count: reopenedTickets.length}
    });
  }
  
  // Check for idle technicians
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const idleTechnicians = staff.filter(s => {
    if (!["technician", "engineer"].includes(s.role)) return false;
    const assignedVisits = visits.filter(v => String(v.assignedTo) === s.identity);
    const upcomingVisits = assignedVisits.filter(v => {
      const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
      return scheduled >= now;
    });
    return upcomingVisits.length === 0 && (s.availability || "working") === "working";
  });
  
  if (idleTechnicians.length > 0) {
    notifications.push({
      type: "idle_technicians",
      priority: "low",
      title: "فنيين متفرغين",
      body: `يوجد ${idleTechnicians.length} فني متفرغ يمكن إسناد زيارات لهم`,
      url: "/dashboard.html#visits",
      roles: ["owner", "company_admin", "admin"],
      data: {count: idleTechnicians.length, technicians: idleTechnicians.map(t => t.name)}
    });
  }
  
  return notifications;
}

function createSmartNotification(store, notification) {
  const notifications = notificationList(store);
  
  // Check if similar notification already exists (within last hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const exists = notifications.some(n => 
    n.type === notification.type &&
    n.createdAtMs > oneHourAgo &&
    JSON.stringify(n.data) === JSON.stringify(notification.data)
  );
  
  if (exists) return null; // Don't create duplicate notifications
  
  const newNotification = {
    id: `NTF-${Date.now()}`,
    ...notification,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    readBy: [],
    smart: true
  };
  
  notifications.unshift(newNotification);
  saveNotifications(store, notifications);
  
  // Send push notification
  const tokens = pushTokenList(store).filter(t => 
    !notification.userId || t.userId === notification.userId || notification.roles?.includes(t.role)
  );
  sendNativePush(tokens, newNotification);
  
  return newNotification;
}

function checkAiPermission(user, action, resource = null) {
  const role = String(user.role || "");
  const permissions = user.permissions || [];
  
  // Define permission matrix
  const permissionMatrix = {
    // Voice chat and conversation
    "ai.chat": ["owner", "company_admin", "admin", "technician", "engineer", "client"],
    "ai.conversation.manage": ["owner", "company_admin", "admin"],
    
    // Report analysis and quote generation
    "ai.analyze.report": ["owner", "company_admin", "admin", "technician", "engineer"],
    "ai.generate.quote": ["owner", "company_admin", "admin"],
    
    // Quote modification
    "ai.modify.quote": ["owner", "company_admin", "admin"],
    "ai.optimize.quote": ["owner", "company_admin", "admin"],
    
    // Visit redistribution
    "ai.redistribute.visits": ["owner", "company_admin", "admin"],
    "ai.analyze.workload": ["owner", "company_admin", "admin"],
    
    // Location tracking
    "ai.track.location": ["owner", "company_admin", "admin"],
    "ai.analyze.location": ["owner", "company_admin", "admin", "technician", "engineer"],
    
    // Smart notifications
    "ai.generate.notifications": ["owner", "company_admin", "admin"],
    "ai.manage.notifications": ["owner", "company_admin", "admin"],
    
    // Professional profiles
    "ai.view.profiles": ["owner", "company_admin", "admin"],
    "ai.analyze.performance": ["owner", "company_admin", "admin"],
    
    // Document workflow
    "ai.review.documents": ["owner", "company_admin", "admin"],
    "ai.approve.documents": ["owner", "company_admin", "admin"],
    
    // System logs
    "ai.view.logs": ["owner", "company_admin", "admin"],
    "ai.export.logs": ["owner", "company_admin"]
  };
  
  const allowedRoles = permissionMatrix[action] || [];
  
  // Check if role is allowed
  if (!allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' is not allowed to perform action '${action}'`
    };
  }
  
  // Check custom permissions if they exist
  if (permissions.length > 0) {
    // If permissions include "*", allow everything
    if (permissions.includes("*")) {
      return {allowed: true};
    }
    
    // If specific permission is granted
    if (permissions.includes(action)) {
      return {allowed: true};
    }
    
    // If permission is explicitly denied
    if (permissions.includes(`!${action}`)) {
      return {
        allowed: false,
        reason: `Permission '${action}' is explicitly denied for this user`
      };
    }
  }
  
  // Resource-level checks (if resource is provided)
  if (resource) {
    // Check if user has access to the specific resource
    if (resource.companyOwnerId && role !== "admin") {
      if (resource.companyOwnerId !== user.id && resource.companyOwnerId !== user.companyOwnerId) {
        return {
          allowed: false,
          reason: "User does not have access to this company's resources"
        };
      }
    }
  }
  
  return {allowed: true};
}

function filterSensitiveData(data, user) {
  const role = String(user.role || "");
  const filtered = JSON.parse(JSON.stringify(data));
  
  // Define sensitive fields by role
  const sensitiveFields = {
    client: ["financialData", "contractDetails", "internalNotes", "supplierPricing"],
    technician: ["allTechnicianSalaries", "companyFinancials", "strategicPlans"],
    engineer: ["allTechnicianSalaries", "companyFinancials"],
    company_admin: ["companyFinancials"],
    admin: [], // Admins see everything
    owner: [] // Owners see everything
  };
  
  const fieldsToHide = sensitiveFields[role] || [];
  
  function filterObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => filterObject(item));
    }
    
    const result = {};
    for (const key in obj) {
      if (fieldsToHide.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        result[key] = filterObject(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }
  
  return filterObject(filtered);
}

function aiLogList(store) {
  try { return JSON.parse(store.misadAiLogs || "[]"); } catch { return []; }
}

function saveAiLogs(store, logs) {
  store.misadAiLogs = JSON.stringify(logs.slice(0, 1000));
  writeStore(store);
}

function logAiOperation(store, operation, user, details = {}) {
  const logs = aiLogList(store);
  
  const logEntry = {
    id: `AIL-${Date.now()}`,
    operation,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    details,
    ipAddress: "",
    userAgent: ""
  };
  
  logs.unshift(logEntry);
  saveAiLogs(store, logs);
  
  return logEntry;
}

function getAiLogs(store, filters = {}) {
  const logs = aiLogList(store);
  let filtered = logs;
  
  if (filters.userId) {
    filtered = filtered.filter(log => log.userId === filters.userId);
  }
  
  if (filters.operation) {
    filtered = filtered.filter(log => log.operation === filters.operation);
  }
  
  if (filters.userRole) {
    filtered = filtered.filter(log => log.userRole === filters.userRole);
  }
  
  if (filters.startDate) {
    const startDate = new Date(filters.startDate).getTime();
    filtered = filtered.filter(log => log.timestampMs >= startDate);
  }
  
  if (filters.endDate) {
    const endDate = new Date(filters.endDate).getTime();
    filtered = filtered.filter(log => log.timestampMs <= endDate);
  }
  
  return filtered.slice(0, 100);
}

function generateRecommendationReport(store, options = {}) {
  const contracts = parseStoredJson(store, "misadContracts");
  const visits = parseStoredJson(store, "misadVisits");
  const tickets = parseStoredJson(store, "misadTickets");
  const parts = parseStoredJson(store, "misadPartsInventory");
  const quotes = parseStoredJson(store, "misadQuotes");
  const reports = parseStoredJson(store, "misadVisitReports");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const now = Date.now();
  
  const report = {
    id: `REC-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    summary: "",
    findings: [],
    recommendations: [],
    metrics: {},
    priority: "medium"
  };
  
  // Analyze contract status
  const activeContracts = contracts.filter(c => c.status === "ساري");
  const expiringContracts = activeContracts.filter(c => {
    const endDate = c.endDate ? new Date(c.endDate).getTime() : 0;
    const daysUntilExpiry = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });
  
  if (expiringContracts.length > 0) {
    report.findings.push({
      category: "contracts",
      type: "expiring_soon",
      severity: "high",
      description: `${expiringContracts.length} عقود تنتهي خلال 30 يوم`,
      data: expiringContracts.map(c => ({
        id: c.id,
        client: c.clientName || c.clientCompanyName,
        endDate: c.endDate
      }))
    });
    report.recommendations.push({
      priority: "high",
      category: "contracts",
      action: "contact_clients",
      description: "تواصل مع العملاء لتجديد العقود قبل انتهائها",
      expectedImpact: "الحفاظ على الإيرادات وتجنب انقطاع الخدمة"
    });
  }
  
  // Analyze ticket performance
  const openTickets = tickets.filter(t => t.status !== "مغلق" && t.status !== "منتهي");
  const highPriorityTickets = openTickets.filter(t => t.priority === "urgent" || t.priority === "high");
  
  if (highPriorityTickets.length > 5) {
    report.findings.push({
      category: "tickets",
      type: "high_volume_high_priority",
      severity: "critical",
      description: `${highPriorityTickets.length} بلاغ أولوية عالية مفتوح`,
      data: {count: highPriorityTickets.length}
    });
    report.recommendations.push({
      priority: "critical",
      category: "tickets",
      action: "allocate_resources",
      description: "خصص موارد إضافية للتعامل مع البلاغات عالية الأولوية",
      expectedImpact: "تحسين رضا العملاء وتقليل أوقات الاستجابة"
    });
  }
  
  // Analyze inventory
  const lowStockParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 0));
  const outOfStockParts = lowStockParts.filter(p => Number(p.qty || 0) === 0);
  
  if (outOfStockParts.length > 0) {
    report.findings.push({
      category: "inventory",
      type: "out_of_stock",
      severity: "critical",
      description: `${outOfStockParts.length} قطع غيار نفذت من المخزون`,
      data: outOfStockParts.map(p => ({name: p.name, sku: p.sku}))
    });
    report.recommendations.push({
      priority: "critical",
      category: "inventory",
      action: "reorder_immediately",
      description: "أعد طلب القطع النافذة فوراً من الموردين",
      expectedImpact: "تجنب تأخير الصيانة بسبب نقص القطع"
    });
  }
  
  // Analyze technician performance
  const technicians = staff.filter(s => ["technician", "engineer"].includes(s.role));
  const technicianPerformance = technicians.map(tech => {
    const assignedVisits = visits.filter(v => String(v.assignedTo) === tech.identity);
    const completedVisits = assignedVisits.filter(v => reports.some(r => r.visitId === v.id));
    const completionRate = assignedVisits.length > 0 ? (completedVisits.length / assignedVisits.length) * 100 : 0;
    
    return {
      id: tech.identity,
      name: tech.name,
      assignedVisits: assignedVisits.length,
      completedVisits: completedVisits.length,
      completionRate: completionRate.toFixed(1)
    };
  });
  
  const lowPerformers = technicianPerformance.filter(t => parseFloat(t.completionRate) < 70);
  if (lowPerformers.length > 0) {
    report.findings.push({
      category: "performance",
      type: "low_completion_rate",
      severity: "medium",
      description: `${lowPerformers.length} فنيين لديهم معدل إتمام أقل من 70%`,
      data: lowPerformers
    });
    report.recommendations.push({
      priority: "medium",
      category: "performance",
      action: "provide_training",
      description: "قدم تدريباً إضافياً للفنيين ذوي الأداء المنخفض",
      expectedImpact: "تحسين جودة الخدمة ومعدلات الإنجاز"
    });
  }
  
  // Analyze quote conversion
  const pendingQuotes = quotes.filter(q => q.status === "بانتظار الرد" || q.status === "pending");
  const approvedQuotes = quotes.filter(q => q.status === "معتمد" || q.status === "مقبول");
  const conversionRate = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;
  
  report.metrics = {
    totalContracts: activeContracts.length,
    expiringContracts: expiringContracts.length,
    openTickets: openTickets.length,
    highPriorityTickets: highPriorityTickets.length,
    lowStockItems: lowStockParts.length,
    outOfStockItems: outOfStockParts.length,
    totalTechnicians: technicians.length,
    quoteConversionRate: conversionRate.toFixed(1)
  };
  
  // Set overall priority based on findings
  const criticalFindings = report.findings.filter(f => f.severity === "critical").length;
  const highFindings = report.findings.filter(f => f.severity === "high").length;
  
  if (criticalFindings > 0) {
    report.priority = "critical";
  } else if (highFindings > 0) {
    report.priority = "high";
  }
  
  // Generate summary
  report.summary = `تقرير التحليل الذكي: يوجد ${report.findings.length} ملاحظة و ${report.recommendations.length} توصية. الأولوية: ${report.priority === "critical" ? "حرجة" : report.priority === "high" ? "عالية" : "متوسطة"}.`;
  
  return report;
}

function buildTechnicianProfile(technicianId, store) {
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const visits = parseStoredJson(store, "misadVisits");
  const reports = parseStoredJson(store, "misadVisitReports");
  const tickets = parseStoredJson(store, "misadTickets");
  
  const technician = staff.find(s => s.identity === technicianId);
  if (!technician) return {error: "Technician not found"};
  
  const assignedVisits = visits.filter(v => String(v.assignedTo) === technicianId);
  const completedVisits = assignedVisits.filter(v => reports.some(r => r.visitId === v.id));
  const visitReports = reports.filter(r => r.technicianId === technicianId);
  
  // Calculate performance metrics
  const completionRate = assignedVisits.length > 0 ? (completedVisits.length / assignedVisits.length) * 100 : 0;
  
  // Calculate average response time (from ticket assignment to visit completion)
  const relatedTickets = tickets.filter(t => t.assignedTo === technicianId);
  let totalResponseTime = 0;
  let responseTimeCount = 0;
  
  relatedTickets.forEach(ticket => {
    const relatedVisit = visits.find(v => v.ticketId === ticket.id);
    if (relatedVisit && relatedVisit.completedAt) {
      const createdTime = ticket.createdAt ? new Date(ticket.createdAt).getTime() : 0;
      const completedTime = new Date(relatedVisit.completedAt).getTime();
      if (createdTime > 0 && completedTime > createdTime) {
        totalResponseTime += (completedTime - createdTime);
        responseTimeCount++;
      }
    }
  });
  
  const avgResponseHours = responseTimeCount > 0 ? (totalResponseTime / responseTimeCount) / (60 * 60 * 1000) : 0;
  
  // Calculate customer satisfaction (from reports)
  let totalRating = 0;
  let ratingCount = 0;
  
  visitReports.forEach(report => {
    if (report.customerRating) {
      totalRating += Number(report.customerRating);
      ratingCount++;
    }
  });
  
  const avgCustomerRating = ratingCount > 0 ? totalRating / ratingCount : 0;
  
  // Identify skills from reports
  const mentionedSkills = new Set();
  visitReports.forEach(report => {
    if (report.skillsUsed && Array.isArray(report.skillsUsed)) {
      report.skillsUsed.forEach(skill => mentionedSkills.add(skill));
    }
  });
  
  // Calculate workload trends
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const recentVisits = assignedVisits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled >= thirtyDaysAgo;
  });
  
  const profile = {
    technicianId,
    technicianName: technician.name,
    role: technician.role,
    updatedAt: new Date().toISOString(),
    performance: {
      totalVisits: assignedVisits.length,
      completedVisits: completedVisits.length,
      completionRate: completionRate.toFixed(1),
      avgResponseTimeHours: avgResponseHours.toFixed(1),
      customerRating: avgCustomerRating.toFixed(1),
      ratingCount: ratingCount
    },
    skills: Array.from(mentionedSkills),
    workload: {
      totalAssigned: assignedVisits.length,
      recentVisits: recentVisits.length,
      availability: technician.availability || "working"
    },
    strengths: [],
    areasForImprovement: [],
    recommendations: []
  };
  
  // Generate strengths and areas for improvement
  if (completionRate >= 90) {
    profile.strengths.push("معدل إتمام عالي للزيارات");
  } else if (completionRate < 70) {
    profile.areasForImprovement.push("يحتاج تحسين معدل إتمام الزيارات");
    profile.recommendations.push("قدم دعماً إضافياً لتحسين معدل الإنجاز");
  }
  
  if (avgCustomerRating >= 4) {
    profile.strengths.push("رضا عملاء مرتفع");
  } else if (avgCustomerRating > 0 && avgCustomerRating < 3) {
    profile.areasForImprovement.push("يحتاج تحسين رضا العملاء");
    profile.recommendations.push("قدم تدريباً على خدمة العملاء");
  }
  
  if (avgResponseHours > 0 && avgResponseHours < 24) {
    profile.strengths.push("استجابة سريعة للبلاغات");
  } else if (avgResponseHours > 48) {
    profile.areasForImprovement.push("يحتاج تحسين سرعة الاستجابة");
    profile.recommendations.push("راجع إدارة الوقت وتوزيع المهام");
  }
  
  if (profile.skills.length > 0) {
    profile.strengths.push(`مهارات متعددة: ${profile.skills.slice(0, 3).join(", ")}`);
  }
  
  return profile;
}

function updateAllTechnicianProfiles(store) {
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const technicians = staff.filter(s => ["technician", "engineer"].includes(s.role));
  
  const profiles = technicians.map(tech => buildTechnicianProfile(tech.identity, store));
  
  store.misadTechnicianProfiles = JSON.stringify(profiles);
  writeStore(store);
  
  return profiles;
}

function initiateDocumentWorkflow(store, documentId, documentType, userId, role) {
  const documents = parseStoredJson(store, "misadDocuments");
  const document = documents.find(d => d.id === documentId);
  
  if (!document) return {error: "Document not found"};
  
  const workflow = {
    id: `WF-${Date.now()}`,
    documentId,
    documentType,
    documentTitle: document.title || document.name || "غير محدد",
    initiatedBy: userId,
    initiatedAt: new Date().toISOString(),
    status: "pending_review",
    steps: [
      {
        step: 1,
        name: "مراجعة أولية",
        assignedTo: role === "owner" ? "owner" : "admin",
        status: "pending",
        completedAt: null,
        comments: []
      },
      {
        step: 2,
        name: "اعتماد نهائي",
        assignedTo: "owner",
        status: "pending",
        completedAt: null,
        comments: []
      }
    ],
    currentStep: 1,
    history: []
  };
  
  workflow.history.push({
    action: "workflow_initiated",
    userId,
    timestamp: new Date().toISOString(),
    details: "تم بدء سير عمل المراجعة والاعتماد"
  });
  
  return workflow;
}

function approveDocumentStep(store, workflowId, stepNumber, userId, role, approved, comments = "") {
  const workflows = parseStoredJson(store, "misadDocumentWorkflows");
  const workflow = workflows.find(w => w.id === workflowId);
  
  if (!workflow) return {error: "Workflow not found"};
  
  const step = workflow.steps.find(s => s.step === stepNumber);
  if (!step) return {error: "Step not found"};
  
  // Check if user is authorized for this step
  if (step.assignedTo !== role && role !== "owner") {
    return {error: "Not authorized to approve this step"};
  }
  
  step.status = approved ? "approved" : "rejected";
  step.completedAt = new Date().toISOString();
  step.approvedBy = userId;
  step.comments.push({
    userId,
    comment: comments,
    timestamp: new Date().toISOString()
  });
  
  workflow.history.push({
    action: approved ? "step_approved" : "step_rejected",
    userId,
    stepNumber,
    timestamp: new Date().toISOString(),
    details: comments || (approved ? "تم اعتماد الخطوة" : "تم رفض الخطوة")
  });
  
  // If rejected, mark workflow as rejected
  if (!approved) {
    workflow.status = "rejected";
  } else if (stepNumber < workflow.steps.length) {
    // Move to next step
    workflow.currentStep = stepNumber + 1;
    workflow.status = "pending_review";
  } else {
    // All steps approved
    workflow.status = "approved";
    workflow.completedAt = new Date().toISOString();
    
    // Update document status
    const documents = parseStoredJson(store, "misadDocuments");
    const docIndex = documents.findIndex(d => d.id === workflow.documentId);
    if (docIndex !== -1) {
      documents[docIndex].status = "معتمد";
      documents[docIndex].approvedAt = new Date().toISOString();
      documents[docIndex].approvedBy = userId;
      store.misadDocuments = JSON.stringify(documents);
    }
  }
  
  return workflow;
}

function analyzeDocumentForApproval(store, documentId, documentType) {
  const documents = parseStoredJson(store, "misadDocuments");
  const quotes = parseStoredJson(store, "misadQuotes");
  const contracts = parseStoredJson(store, "misadContracts");
  
  let document = null;
  if (documentType === "quote") {
    document = quotes.find(q => q.id === documentId);
  } else if (documentType === "contract") {
    document = contracts.find(c => c.id === documentId);
  } else {
    document = documents.find(d => d.id === documentId);
  }
  
  if (!document) return {error: "Document not found"};
  
  const analysis = {
    documentId,
    documentType,
    title: document.title || document.name || "غير محدد",
    value: document.value || 0,
    risks: [],
    recommendations: [],
    approvalCriteria: {
      valueCheck: true,
      completenessCheck: true,
      policyCompliance: true
    }
  };
  
  // Check value thresholds
  if (document.value > 50000) {
    analysis.risks.push({
      type: "high_value",
      severity: "medium",
      description: "قيمة عالية تتطلب مراجعة إضافية"
    });
    analysis.recommendations.push("تأكد من مراجعة التفاصيل المالية بعناية");
  }
  
  // Check completeness
  if (!document.clientName && !document.clientCompanyName) {
    analysis.risks.push({
      type: "missing_client",
      severity: "high",
      description: "معلومات العميل مفقودة"
    });
    analysis.approvalCriteria.completenessCheck = false;
    analysis.recommendations.push("أكمل معلومات العميل قبل الاعتماد");
  }
  
  // Check for required fields based on document type
  if (documentType === "quote") {
    if (!document.items || document.items.length === 0) {
      analysis.risks.push({
        type: "missing_items",
        severity: "high",
        description: "لا توجد بنود في عرض السعر"
      });
      analysis.approvalCriteria.completenessCheck = false;
    }
    
    if (document.autoGenerated) {
      analysis.recommendations.push("عرض سعر تم إنشاؤه تلقائياً - راجع التوصيات والأسعار");
    }
  }
  
  return analysis;
}

function elevatorKnowledgeBase() {
  return {
    domain: "elevator-company-operations",
    languagePolicy: "Arabic first, Saudi dialect friendly, professional tone",
    modules: [
      "maintenance_contracts", "installation_contracts", "quotes", "periodic_visits",
      "corrective_maintenance", "tickets", "technicians", "engineers", "inventory",
      "spare_parts", "suppliers", "reports", "certificates", "payments", "pdf_documents",
      "customer_approvals", "location_tracking", "visit_reassignment"
    ],
    operatingRules: [
      "تحقق من صلاحية المستخدم قبل اقتراح أي تنفيذ.",
      "لا تطلب بيانات موجودة في سياق النظام.",
      "اطلب أقل قدر لازم من البيانات الناقصة.",
      "فرّق بين التوصية والتنفيذ، ولا تنفذ إلا عبر أدوات النظام وبموافقة المستخدم.",
      "اعتمد على الحمل الحالي للفنيين وموقع الزيارة وحالة المصعد عند اقتراح الإسناد.",
      "راقب العقود المنتظرة والبلاغات المفتوحة والزيارات المتأخرة ونقص المخزون.",
      "إذا قال المستخدم 'باسم X' فإن X هو اسم العميل. استخدمه في clientName."
    ],
    intents: {
      create_contract: ["عقد", "صيانة", "تركيب", "أنشئ عقد", "سوي عقد", "اعمل عقد", "عمل عقد"],
      create_quote: ["عرض سعر", "تسعير", "قطع غيار", "سوي عرض", "اعمل عرض", "سعر"],
      assign_visit: ["اسند", "انقل زيارة", "فني", "سوي زيارة"],
      redistribute_visits: ["إعادة توزيع", "وزع الزيارات", "أقل تكلفة"],
      analyze_operations: ["حلل", "أولويات", "مخاطر", "تشغيل"],
      field_voice_cleanup: ["نظف النص", "إدخال صوتي", "قيمة الحقل"]
    }
  };
}

function inferAiPlan(question, context, user = {}) {
  const q = String(question || "");
  const role = String(user.role || "");
  const canManage = ["owner", "company_admin", "admin"].includes(role);
  const plan = {intent: "answer", action: null, data: {}, allowed: true, needsApproval: false, missing: [], suggestions: []};

  // --- Intent Detection (ordered by specificity) ---
  if (/حلل|تحليل|تقرير|مؤشرات|إحصائيات|إحصاءات|stats|analysis|analytics/i.test(q)) {
    if (/مخزون|قطع|غيار|مستودع/i.test(q)) plan.intent = "analyze_inventory";
    else if (/فني|technician|engineer|موظف/i.test(q)) plan.intent = "analyze_staff";
    else plan.intent = "analyze_operations";
  }
  if (/توزيع|إعادة توزيع|وزع|وزع.الكل|redistribute/i.test(q)) plan.intent = "redistribute_visits";
  if (/إسناد|اسند|انقل|assign/i.test(q) && /زيارة|visit/i.test(q)) plan.intent = "assign_visit";
  if (/إشعار|notification|أرسل.إشعار|نبه/i.test(q)) plan.intent = "create_notification";
  if (/تحسين|تسعير|optimize|أمثل/i.test(q) && /عرض سعر|quote/i.test(q)) plan.intent = "optimize_quote";
  if (/تقرير|report/i.test(q) && /تحليل|analyze/i.test(q)) plan.intent = "analyze_report";

  // Creation intents
  if (/عقد|contract/i.test(q) || /سوي.عقد|عمل.عقد|اعمل.عقد|جدول.عقد|إنشاء.عقد/i.test(q))
    plan.intent = /تركيب|توريد|install/i.test(q) ? "create_installation_contract" : "create_maintenance_contract";
  if (/عرض سعر|عرض.{0,3}سعر|quotation|quote/i.test(q) || /سوي.عرض|عمل.عرض|اعمل.عرض/i.test(q))
    plan.intent = "create_quote";
  if (/بلاغ|ticket/i.test(q) || /سوي.بلاغ|عمل.بلاغ|اعمل.بلاغ|إنشاء.بلاغ|أضف.بلاغ/i.test(q))
    plan.intent = "create_ticket";
  if ((/زيارة.{0,5}كشف|كشف|معاينة/i.test(q) && !/إسناد|assign/i.test(q)) || /سوي.زيارة|عمل.زيارة|إنشاء.زيارة/i.test(q))
    plan.intent = "create_visit";
  if (/فني|technician/i.test(q) && !/زيارة|visit/i.test(q)) plan.intent = "add_staff";
  if (/مهندس|engineer/i.test(q) && !/زيارة|visit/i.test(q)) plan.intent = "add_staff";
  if (/مورد|supplier/i.test(q)) plan.intent = "create_supplier";
  if (/قطعة.{0,3}غيار|part|inventory|مخزون/i.test(q) && /أضف|إنشاء|سوي|عمل|اعمل/i.test(q)) plan.intent = "create_part";

  // Multi-action detection (generate schedule etc.)
  if (/جدول|schedule|برنامج/i.test(q) && /زيارات|visits/i.test(q)) plan.intent = "redistribute_visits";

  // --- Data Extraction ---
  const extract = {};

  // Client/Company name: بعد "لـ", "لمؤسسة", "لشركة", "لكتاب", "للشركة", "للمؤسسة", "باسم"
  const clientPatterns = [
    /(?:لـ|لمؤسسة|لشركة|لكتاب|للشركة|للمؤسسة|لعميل)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ|قيمته|مدة|لمدة|عقد|صيانة|تركيب)/i,
    /(?:مؤسسة|شركة|مكتب|مجموعة)\s*[""]?([^"",\d]{2,40}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ|قيمته)/i,
    /باسم\s*[""]?([^"",\d]{3,50}?)[""]?\s*(?:,|\.|$|بقيمة|بمبلغ)/i
  ];
  for (const pattern of clientPatterns) {
    const m = q.match(pattern);
    if (m) { extract.clientName = m[1].trim(); break; }
  }

  // Title for tickets
  const titlePatterns = [
    /(?:عنوانه|عنوان|بلاغ)\s*[""]?([^"",\d]{3,60}?)[""]?\s*(?:,|\.|$|أولوية|في|بـ)/i,
    /(?:عطل|مشكلة|خلل)\s*(.{3,60}?)(?:,|\.|$|أولوية|في|بـ)/i
  ];
  for (const pattern of titlePatterns) {
    const m = q.match(pattern);
    if (m) { extract.title = m[1].trim(); break; }
  }

  // Building name for visits
  const buildingMatch = q.match(/(?:مبنى|عمارة|موقع|في)\s*[""]?([^"",\d]{3,30}?)[""]?\s*(?:,|\.|$|يوم|بتاريخ|الساعة)/i);
  if (buildingMatch) extract.building = {name: buildingMatch[1].trim(), district: "", mapUrl: ""};

  // Staff name and identity
  const staffNameMatch = q.match(/(?:اسمه|اسم|فني|مهندس)\s*[""]?([^"",\d]{3,25}?)[""]?\s*(?:,|\.|$|هوية|رقم)/i);
  if (staffNameMatch) extract.name = staffNameMatch[1].trim();
  const identityMatch = q.match(/(?:هوية|رقم)\s*(\d{8,10})/i);
  if (identityMatch) extract.identity = identityMatch[1];
  const roleMatch = q.match(/مهندس|engineer/i);
  if (roleMatch) extract.role = "engineer";
  // also check if the word "فني" alone means technician
  if (/فني/i.test(q) && !extract.name) extract.role = "technician";

  // Supplier name
  if (!extract.name) {
    const suppMatch = q.match(/مورد\s*[""]?([^"",\d]{3,30}?)[""]?\s*(?:,|\.|$|جوال|في|تخصص)/i);
    if (suppMatch) extract.name = suppMatch[1].trim();
  }

  // Value/Amount
  const valueMatch = q.match(/(?:بقيمة|قيمة|بمبلغ|مبلغ|سعر|تكلفة|بـ)\s*([\d,]+(?:\.[\d]+)?)/i);
  if (valueMatch) extract.value = Number(valueMatch[1].replace(/,/g, ""));
  const directValue = q.match(/([\d,]+(?:\.[\d]+)?)\s*(?:ريال|ر\.س|SAR)/i);
  if (directValue && !extract.value) extract.value = Number(directValue[1].replace(/,/g, ""));

  // Contract type
  if (/تركيب|توريد.{0,5}تركيب/i.test(q)) extract.type = "تركيب";
  else if (/صيانة|صيانة.{0,5}دورية/i.test(q)) extract.type = "صيانة";

  // Duration (سنوات)
  const durationMatch = q.match(/(\d+)\s*(سنة|سنوات|سنين|عام|أعوام)/i);
  if (durationMatch) extract.contractYears = Number(durationMatch[1]);

  // Priority
  if (/طارئ|طارئة|urgent|عاجل/i.test(q)) extract.priority = "urgent";
  else if (/عالية|عالي|high/i.test(q)) extract.priority = "high";
  else if (/منخفضة|منخفض|low/i.test(q)) extract.priority = "low";
  else if (/متوسطة|medium/i.test(q)) extract.priority = "medium";

  // Date/Time
  const dateMatch = q.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) extract.scheduledAt = dateMatch[1];
  const timeMatch = q.match(/(?:الساعة|ساعة)\s*(\d{1,2}):(\d{2})/i);
  if (timeMatch && extract.scheduledAt) extract.scheduledAt += `T${timeMatch[1]}:${timeMatch[2]}`;

  // Technician name for assignment
  const techMatch = q.match(/(?:لـ|للفني|للمهندس|إلى|لـ)\s*[""]?([^"",\d]{3,20}?)[""]?\s*(?:,|\.|$|في|زيارة)/i);
  if (techMatch) extract.technicianName = techMatch[1].trim();

  // Visit ID for assignment
  const visitIdMatch = q.match(/(VIS-[\w-]+|زيارة\s*(\S+))/i);
  if (visitIdMatch) extract.visitId = visitIdMatch[1];

  // Supplier fields
  const phoneMatch = q.match(/(05\d{8})/);
  if (phoneMatch) extract.phone = phoneMatch[1];
  const cityMatch = q.match(/(?:في|بـ|من)\s*(الرياض|جدة|مكة|المدينة|الدمام|الخبر|القصيم|تبوك|أبها|حائل|نجران|جيزان|الحدود الشمالية|الجبيل|ينبع|بريدة|عنيزة|سكاكا|عرعر)/i);
  if (cityMatch) extract.city = cityMatch[1];

  // Supplier category
  if (/كهرباء|تحكم|electric/i.test(q)) extract.category = "قطع كهرباء وتحكم";
  else if (/أبواب|door/i.test(q)) extract.category = "أبواب ومداخل";
  else if (/محرك|motor|مكينة/i.test(q)) extract.category = "محركات ومكائن";
  else if (/حساس|sensor/i.test(q)) extract.category = "حساسات وأنظمة أمان";
  else if (/زيت|مستهلكات/i.test(q)) extract.category = "زيوت ومستهلكات";

  // --- Validation ---
  plan.data = extract;

  if (plan.intent !== "answer") {
    plan.needsApproval = true;
    plan.action = plan.intent; // will be mapped later
    if (!canManage) {
      plan.allowed = false;
      plan.suggestions.push("المستخدم لا يملك صلاحية تنفيذ العمليات الإدارية.");
    }
  }

  // Context suggestions
  const counts = context.counts || {};
  if (counts.lateVisitsWithoutReport) plan.suggestions.push(`يوجد ${counts.lateVisitsWithoutReport} زيارة متأخرة دون تقرير.`);
  if (counts.openTickets) plan.suggestions.push(`يوجد ${counts.openTickets} بلاغ مفتوح يحتاج متابعة.`);
  if (counts.lowParts) plan.suggestions.push(`يوجد ${counts.lowParts} صنف مخزون عند حد الطلب أو أقل.`);

  // If nothing detected, try to figure out from context
  if (plan.intent === "answer" && canManage) {
    if (/إدارة|تشغيل|عمليات/i.test(q)) plan.intent = "analyze_operations";
    else if (/مخزون|قطع|غيار/i.test(q)) plan.intent = "analyze_inventory";
  }

  return plan;
}

function pushTokenList(store) {
  try { return JSON.parse(store.misadPushTokens || "[]"); } catch { return []; }
}

function savePushTokens(store, tokens) {
  store.misadPushTokens = JSON.stringify(tokens.slice(0, 1000));
  writeStore(store);
}

function sendNativePush(tokens, notification) {
  const key = process.env.FCM_SERVER_KEY || "";
  if (!key || !tokens.length || typeof fetch !== "function") return;
  const body = {
    registration_ids: tokens.map(x => x.token),
    notification: {title: notification.title, body: notification.body},
    data: {url: notification.url || "/dashboard.html", notificationId: notification.id}
  };
  fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": `key=${key}`},
    body: JSON.stringify(body)
  }).catch(() => {});
}

function parseStoredJson(store, key) {
  try {
    return JSON.parse(store[key] || "[]");
  } catch {
    return [];
  }
}

function compactRows(rows, fields, limit = 20) {
  return rows.slice(0, limit).map(row => Object.fromEntries(fields.map(field => [field, row?.[field] ?? ""])));
}

function buildAiContext(store) {
  const contracts = parseStoredJson(store, "misadContracts");
  const visits = parseStoredJson(store, "misadVisits");
  const tickets = parseStoredJson(store, "misadTickets");
  const reports = parseStoredJson(store, "misadVisitReports");
  const quotes = parseStoredJson(store, "misadQuotes");
  const parts = parseStoredJson(store, "misadPartsInventory");
  const suppliers = parseStoredJson(store, "misadSuppliers");
  const claims = parseStoredJson(store, "misadClaims");
  const staff = parseStoredJson(store, "misadCompanyStaff");
  const locations = parseStoredJson(store, "misadStaffLocations");
  const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
  const clientCompanies = parseStoredJson(store, "misadClientCompanies");
  const docs = parseStoredJson(store, "misadCompanyDocs");
  const now = Date.now();
  const statusText = x => String(x?.status || "");
  const includesAny = (value, words) => words.some(word => value.toLowerCase().includes(word.toLowerCase()));
  const pendingWords = ["pending", "waiting", "review", "approval", "\u0627\u0646\u062a\u0638\u0627\u0631", "\u0628\u0627\u0646\u062a\u0638\u0627\u0631", "\u0645\u0648\u0627\u0641\u0642\u0629", "\u0627\u0639\u062a\u0645\u0627\u062f"];
  const closedWords = ["closed", "done", "finished", "complete", "cancel", "\u0645\u063a\u0644\u0642", "\u0645\u0646\u062a\u0647\u064a", "\u0645\u0643\u062a\u0645\u0644", "\u0645\u062d\u0630\u0648\u0641", "\u0645\u0644\u063a\u064a"];
  const lowParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 0));
  const pendingContracts = contracts.filter(c => includesAny(statusText(c), pendingWords));
  const openTickets = tickets.filter(t => !includesAny(statusText(t), closedWords));
  const pendingReports = reports.filter(r => includesAny(statusText(r), pendingWords));
  const reportVisitIds = new Set(reports.map(r => String(r.visitId || "")));
  const lateVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled && scheduled < now && !reportVisitIds.has(String(v.id || ""));
  });
  const upcomingVisits = visits.filter(v => {
    const scheduled = v.scheduledAt ? new Date(v.scheduledAt).getTime() : 0;
    return scheduled && scheduled >= now;
  }).sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  const staffWorkload = staff.map(member => {
    const identity = String(member.identity || member.id || "");
    const assignedVisits = visits.filter(v => String(v.assignedTo || "") === identity);
    const openAssignedTickets = openTickets.filter(t => String(t.assignedTo || "") === identity);
    const liveLocation = locations.find(l => String(l.identity || "") === identity);
    return {
      identity,
      name: member.name || "",
      role: member.role || "",
      availability: member.availability || member.status || "",
      assignedVisits: assignedVisits.length,
      upcomingVisits: assignedVisits.filter(v => new Date(v.scheduledAt || 0).getTime() >= now).length,
      lateVisitsWithoutReport: assignedVisits.filter(v => lateVisits.some(x => String(x.id || "") === String(v.id || ""))).length,
      openTickets: openAssignedTickets.length,
      lastLocationAt: liveLocation?.updatedAt || liveLocation?.updatedAtIso || "",
      liveLocation: Boolean(liveLocation?.live)
    };
  }).sort((a, b) => (b.lateVisitsWithoutReport - a.lateVisitsWithoutReport) || (b.openTickets - a.openTickets) || (b.upcomingVisits - a.upcomingVisits));
  return {
    generatedAt: new Date().toISOString(),
    capabilities: {
      canAnswerSystemQuestions: true,
      canAnalyzeTechnicians: true,
      canAnalyzeVisits: true,
      canRecommendAssignments: true,
      canExecuteChanges: true,
      note: "The assistant can now directly execute operational actions through the system APIs."
    },
    counts: {
      contracts: contracts.length,
      visits: visits.length,
      tickets: tickets.length,
      reports: reports.length,
      quotes: quotes.length,
      parts: parts.length,
      suppliers: suppliers.length,
      claims: claims.length,
      staff: staff.length,
      ownerCompanies: ownerCompanies.length,
      clientCompanies: clientCompanies.length,
      documents: docs.length,
      lowParts: lowParts.length,
      pendingContracts: pendingContracts.length,
      openTickets: openTickets.length,
      pendingReports: pendingReports.length,
      lateVisitsWithoutReport: lateVisits.length,
      upcomingVisits: upcomingVisits.length
    },
    systemInfo: {
      ownerCompanies: compactRows(ownerCompanies, ["id", "name", "commercialNumber", "taxNumber", "phone", "address"], 5),
      clientCompanies: compactRows(clientCompanies, ["id", "name", "unifiedNumber", "taxNumber", "ownerId"], 20),
      expiringDocuments: compactRows(docs.filter(d => d.expiresAt), ["id", "partyName", "type", "name", "expiresAt"], 20)
    },
    staffWorkload: staffWorkload.slice(0, 40),
    pendingContracts: compactRows(pendingContracts, ["id", "type", "status", "clientName", "clientCompanyName", "value", "startDate", "endDate"], 20),
    openTickets: compactRows(openTickets, ["id", "title", "priority", "status", "clientName", "clientCompanyName", "assignedTo", "createdAt"], 25),
    lowParts: compactRows(lowParts, ["id", "name", "sku", "category", "qty", "minQty", "unitCost", "supplier"], 25),
    suppliers: compactRows(suppliers, ["id", "name", "phone", "city", "category", "rating"], 25),
    recentQuotes: compactRows(quotes, ["id", "title", "client", "value", "status", "createdAt"], 20),
    lateVisits: compactRows(lateVisits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName", "contractId"], 25),
    upcomingVisits: compactRows(upcomingVisits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName", "contractId"], 25),
    recentVisits: compactRows(visits, ["id", "visitType", "status", "assignedTo", "assignedName", "scheduledAt", "clientName", "clientCompanyName"], 25)
  };
}
function nextContractId(contracts) {
  let maxNum = 0;
  contracts.forEach(c => {
    const m = String(c.id || "").match(/^CONT(\d{4})$/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  });
  return `CONT${String(maxNum + 1).padStart(4, "0")}`;
}

function arabicLocaleDate() {
  return new Date().toLocaleString("ar-SA");
}

function defaultMaintenanceChecklist() {
  const sections = [
    {section: "غرفة المصعد", items:["فحص زيت المحرك والتأكد من سيره الطبيعي.","فحص قماش الفرامل.","فحص عمل الفرامل وتضبيطه وتشحيم المحاور.","فحص السيور والتأكد من سلامتها.","فحص سلكتور والطوابق.","فحص جهاز الهبوط الاضطراري.","فحص منظم السرعة وضبطه.","تنظيف أرضية الغرفة.","التأكد من سلامة التمديدات الكهربائية بالغرفة.","التأكد من عدم وجود تهريب مياه بالغرفة.","التأكد من عدم وجود أي تخزين بالغرفة.","التأكد من وجود التكييف بحالة سليمة."]},
    {section: "بئر المصعد", items:["فحص التوصيلات الكهربائية أعلى الصاعدة والتأكد من سلامتها.","فحص جهاز الريفيزيون في حالة الصعود والهبوط والتوقف.","فحص حبال الجر وشدادات الحبال.","فحص بكرات الحبال والتأكد من سلامتها.","تزييت وتشحيم أدلة سير الصاعدة والثقل.","فحص قواطع نهاية المشوار.","فحص مغناطيس الأدوار.","الكشف على مروحة الصاعدة."]},
    {section: "داخل المصعد", items:["الكشف على أزرار التحكم والتشغيل.","الكشف عن الإنارة والجرس والانتركوم.","تنظيف مجاري الأبواب."]},
    {section: "أبواب الطوابق", items:["فحص أبواب الأدوار وضبطها.","فحص محركات الأبواب.","فحص وتنظيف الشوك والكوالين.","فحص مفصلات الأبواب.","فحص الكابلات والمؤشرات والمبينات وضبط الإضاءة."]},
    {section: "حفرة البئر", items:["الكشف على بكرة منظم السرعة.","تنظيف وفحص قواطع نهاية المشوار.","فحص التوصيلات الكهربائية أسفل الصاعدة والتأكد من سلامتها.","تنظيف الحفرة."]}
  ];
  return sections.flatMap(sec => sec.items.map((title, i) => ({
    id: `${sec.section}-${i}`, section: sec.section, title, status: "مطلوب", checked: false, note: ""
  })));
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + Number(years || 1));
  d.setDate(d.getDate() - 1);
  return d;
}

function dateVal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function executeAiAction(actionData, store) {
  const result = {executed: false, action: actionData.action, message: ""};
  const ownerCompanies = parseStoredJson(store, "misadOwnerCompanies");
  const owner = ownerCompanies[0] || {id: "", name: "شركة غير محددة"};
  try {
    switch (actionData.action) {
      case "create_contract": {
        const contracts = parseStoredJson(store, "misadContracts");
        const d = actionData.data || {};
        const startDate = d.startDate || new Date().toISOString().split("T")[0];
        const years = Number(d.contractYears || 1);
        const endDate = d.endDate || dateVal(addYears(new Date(`${startDate}T00:00`), years));
        const isInstall = d.type === "تركيب";
        const user = parseStoredJson(store, "misadUsers").find(u => u.id === actionData.userId);
        const r = user ? {id: user.id, name: user.name} : {id: actionData.userId || "ai", name: "الذكاء الاصطناعي"};
        const contract = {
          id: nextContractId(contracts),
          companyOwnerId: d.companyOwnerId || actionData.userId || "ai",
          companyId: d.companyId || owner.id || "",
          type: d.type || "صيانة",
          targetType: d.targetType || "client",
          clientId: d.clientId || "",
          clientName: d.clientName || "",
          clientCompanyUnifiedNumber: d.clientCompanyUnifiedNumber || "",
          clientCompanyName: d.clientCompanyName || "",
          value: Number(d.value || 0),
          elevatorInfo: Object.assign({count: "", brand: "", age: "", capacity: "", doorType: "", usage: ""}, d.elevatorInfo || {}),
          installationInfo: isInstall ? Object.assign({stops: "", entrances: "", battery: "", doorOpening: "", shaftSize: "", motor: "", controller: "", outerDoors: "", safetyDoor: "", cabin: "", power: "", speed: "", warranty: "", note: ""}, d.installationInfo || {}) : {},
          maintenanceChecklist: d.maintenanceChecklist && d.maintenanceChecklist.length ? d.maintenanceChecklist : defaultMaintenanceChecklist(),
          buildings: d.buildings && d.buildings.length ? d.buildings : [{name: "", district: "", mapUrl: "", guardMobile: ""}],
          items: d.items || [],
          customItems: d.customItems || [],
          details: isInstall ? "" : (d.details || ""),
          status: "بانتظار موافقة العميل",
          startDate: startDate,
          contractYears: years,
          endDate: endDate,
          createdAt: arabicLocaleDate(),
          createdAtMs: Date.now(),
          createdBy: r.id,
          company: {name: owner.name || "شركة غير محددة"}
        };
        contracts.unshift(contract);
        store.misadContracts = JSON.stringify(contracts.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء العقد ${contract.id} بنجاح`;
        result.contract = contract;
        break;
      }
      case "create_quote": {
        const quotes = parseStoredJson(store, "misadQuotes");
        const d = actionData.data || {};
        const baseValue = Number(d.value || 0);
        const itemsTotal = (d.items || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const customTotal = (d.customItems || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const partsTotal = (d.partsItems || []).reduce((s, i) => s + Number(i.price || 0), 0);
        const subtotal = baseValue + itemsTotal + customTotal + partsTotal;
        const taxRate = 0.15;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        const clientName = d.clientName || "";
        const companyName = d.clientCompanyName || "";
        const quote = {
          id: `QTO-${Date.now()}`,
          companyOwnerId: d.companyOwnerId || actionData.userId || "ai",
          clientId: d.clientId || "",
          clientName: clientName,
          clientCompanyUnifiedNumber: d.clientCompanyUnifiedNumber || "",
          clientCompanyName: companyName,
          client: d.client || companyName || clientName || "عميل",
          title: d.title || "عرض سعر",
          value: total,
          subtotal: subtotal,
          taxRate: taxRate,
          taxAmount: taxAmount,
          totalWithTax: total,
          status: "بانتظار المراجعة والاعتماد",
          reportId: d.reportId || "",
          elevatorInfo: Object.assign({count: "", brand: "", age: "", capacity: "", doorType: "", usage: ""}, d.elevatorInfo || {}),
          maintenanceChecklist: d.maintenanceChecklist && d.maintenanceChecklist.length ? d.maintenanceChecklist : [],
          items: d.items || [],
          partsItems: d.partsItems || [],
          customItems: d.customItems || [],
          details: d.details || "",
          createdAt: arabicLocaleDate(),
          createdBy: actionData.userId || "ai"
        };
        quotes.unshift(quote);
        store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء عرض السعر ${quote.id} بنجاح بقيمة ${total.toFixed(2)} ريال`;
        result.quote = quote;
        break;
      }
      case "create_ticket": {
        const tickets = parseStoredJson(store, "misadTickets");
        const ticket = {
          id: `TCK-${Date.now()}`,
          title: actionData.data.title || "بلاغ",
          description: actionData.data.description || "",
          priority: actionData.data.priority || "medium",
          status: "مفتوح",
          clientName: actionData.data.clientName || "",
          clientId: actionData.data.clientId || "",
          clientCompanyName: actionData.data.clientCompanyName || "",
          clientCompanyUnifiedNumber: actionData.data.clientCompanyUnifiedNumber || "",
          contractId: actionData.data.contractId || "",
          building: actionData.data.building || {},
          assignedTo: actionData.data.assignedTo || "",
          createdBy: actionData.userId || "ai",
          createdAt: new Date().toISOString(),
          createdAtMs: Date.now()
        };
        tickets.unshift(ticket);
        store.misadTickets = JSON.stringify(tickets.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء البلاغ ${ticket.id} بنجاح`;
        result.ticket = ticket;
        break;
      }
      case "create_visit": {
        const visits = parseStoredJson(store, "misadVisits");
        const visit = {
          id: `VIS-${Date.now()}`,
          visitType: actionData.data.visitType || "صيانة دورية",
          status: "مجدولة",
          clientName: actionData.data.clientName || "",
          clientId: actionData.data.clientId || "",
          clientCompanyName: actionData.data.clientCompanyName || "",
          clientCompanyUnifiedNumber: actionData.data.clientCompanyUnifiedNumber || "",
          contractId: actionData.data.contractId || "",
          building: actionData.data.building || {},
          scheduledAt: actionData.data.scheduledAt || new Date().toISOString(),
          assignedTo: actionData.data.assignedTo || "",
          assignedName: actionData.data.assignedName || "",
          createdBy: actionData.userId || "ai",
          createdAt: new Date().toISOString()
        };
        visits.unshift(visit);
        store.misadVisits = JSON.stringify(visits.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء الزيارة ${visit.id} بنجاح`;
        result.visit = visit;
        break;
      }
      case "assign_visit": {
        const visits = parseStoredJson(store, "misadVisits");
        const visitIndex = visits.findIndex(v => v.id === actionData.data.visitId);
        if (visitIndex === -1) {
          result.message = "الزيارة غير موجودة";
          break;
        }
        visits[visitIndex].assignedTo = actionData.data.technicianId || "";
        visits[visitIndex].assignedName = actionData.data.technicianName || "";
        visits[visitIndex].assignedAt = new Date().toISOString();
        store.misadVisits = JSON.stringify(visits);
        writeStore(store);
        result.executed = true;
        result.message = `تم إسناد الزيارة ${actionData.data.visitId} إلى ${actionData.data.technicianName}`;
        break;
      }
      case "redistribute_visits": {
        const redistributeAll = actionData.data.redistributeAll === true;
        const analysis = redistributeVisits(store, {redistributeAll});
        if (analysis.proposedAssignments.length > 0) {
          const visits = parseStoredJson(store, "misadVisits");
          analysis.proposedAssignments.forEach(assignment => {
            const idx = visits.findIndex(v => v.id === assignment.visitId);
            if (idx !== -1) {
              visits[idx].assignedTo = assignment.proposedTechnicianId;
              visits[idx].assignedName = assignment.proposedTechnician;
              visits[idx].rebalancedAt = new Date().toISOString();
              visits[idx].rebalancedBy = actionData.userId || "ai";
            }
          });
          store.misadVisits = JSON.stringify(visits);
          writeStore(store);
        }
        result.executed = true;
        result.message = `تم إعادة توزيع ${analysis.proposedAssignments.length} زيارة`;
        result.redistribution = analysis;
        break;
      }
      case "create_supplier": {
        const suppliers = parseStoredJson(store, "misadSuppliers");
        const supplier = {
          id: `SUP-${Date.now()}`,
          name: actionData.data.name || "مورد جديد",
          phone: actionData.data.phone || "",
          email: actionData.data.email || "",
          city: actionData.data.city || "",
          category: actionData.data.category || "توريد شامل",
          rating: actionData.data.rating || "تحت التجربة",
          notes: actionData.data.notes || "أنشئ بواسطة الذكاء الاصطناعي",
          createdAt: new Date().toISOString(),
          createdBy: actionData.userId || "ai"
        };
        suppliers.unshift(supplier);
        store.misadSuppliers = JSON.stringify(suppliers.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إنشاء المورد ${supplier.name} بنجاح`;
        result.supplier = supplier;
        break;
      }
      case "add_staff": {
        const staff = parseStoredJson(store, "misadCompanyStaff");
        const member = {
          id: `STF-${Date.now()}`,
          identity: actionData.data.identity || "",
          name: actionData.data.name || "فني جديد",
          role: actionData.data.role || "technician",
          availability: actionData.data.availability || "working",
          status: actionData.data.status || "مرتبط",
          phone: actionData.data.phone || "",
          createdAt: new Date().toISOString(),
          createdBy: actionData.userId || "ai"
        };
        staff.unshift(member);
        store.misadCompanyStaff = JSON.stringify(staff.slice(0, 200));
        writeStore(store);
        result.executed = true;
        result.message = `تم إضافة ${member.name} إلى فريق العمل`;
        result.staff = member;
        break;
      }
      case "create_notification": {
        const notifications = notificationList(store);
        const notification = {
          id: `NTF-${Date.now()}`,
          title: actionData.data.title || "إشعار ذكي",
          body: actionData.data.body || "",
          userId: actionData.data.userId || "",
          roles: actionData.data.roles || [],
          url: actionData.data.url || "/dashboard.html",
          createdAt: new Date().toISOString(),
          readBy: []
        };
        notifications.unshift(notification);
        saveNotifications(store, notifications);
        const tokens = pushTokenList(store).filter(t => !notification.userId || t.userId === notification.userId);
        sendNativePush(tokens, notification);
        result.executed = true;
        result.message = `تم إنشاء الإشعار بنجاح`;
        result.notification = notification;
        break;
      }
      case "analyze_report": {
        const reports = parseStoredJson(store, "misadVisitReports");
        const report = reports.find(r => r.id === actionData.data.reportId);
        if (!report) {
          result.message = "التقرير غير موجود";
          break;
        }
        const analysis = analyzeReportForQuote(report, store);
        const autoGenerateQuote = actionData.data.autoGenerateQuote !== false;
        let quote = null;
        if (autoGenerateQuote && (analysis.needsSpareParts || analysis.needsInstallation || analysis.needsUpdate || analysis.needsReplacement || analysis.needsAdditionalWorks)) {
          quote = generateAutoQuote(report, analysis, store, actionData.userId || "ai");
          const quotes = parseStoredJson(store, "misadQuotes");
          quotes.unshift(quote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
        }
        result.executed = true;
        result.message = `تم تحليل التقرير ${actionData.data.reportId}` + (quote ? ` وإنشاء عرض السعر ${quote.id}` : "");
        result.analysis = analysis;
        result.quote = quote;
        break;
      }
      case "optimize_quote": {
        const quotes = parseStoredJson(store, "misadQuotes");
        const quoteIndex = quotes.findIndex(q => q.id === actionData.data.quoteId);
        if (quoteIndex === -1) {
          result.message = "عرض السعر غير موجود";
          break;
        }
        const targetValue = Number(actionData.data.targetValue || 0);
        const quoteCopy = JSON.parse(JSON.stringify(quotes[quoteIndex]));
        const optimization = optimizeQuotePrices(quoteCopy, targetValue, store);
        let newQuote = null;
        if (optimization.achievable) {
          newQuote = createQuoteVersion(quoteCopy, optimization.changes, actionData.userId || "ai");
          quotes.unshift(newQuote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
        }
        result.executed = true;
        result.message = optimization.achievable ? `تم تحسين عرض السعر. القيمة الجديدة: ${optimization.newValue}` : "تعذر تحسين عرض السعر للقيمة المطلوبة";
        result.optimization = optimization;
        result.newQuote = newQuote;
        break;
      }
      default:
        result.message = `الإجراء ${actionData.action} غير مدعوم`;
    }
  } catch (err) {
    result.message = `خطأ في التنفيذ: ${err.message}`;
  }
  return result;
}

async function askGroq(question, context, user = {}, conversationId = null) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) return {error: "GROQ_API_KEY is not configured"};
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const knowledge = elevatorKnowledgeBase();
  const plan = inferAiPlan(question, context, user);
  
  // Build conversation history if conversationId is provided
  let conversationHistory = [];
  if (conversationId) {
    const store = readStore();
    const conversation = aiConversationList(store).find(c => c.id === conversationId);
    if (conversation && conversation.messages) {
      conversationHistory = conversation.messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
    }
  }
  
   const systemPrompt = `You are the Shumoos elevator management AI agent. You are not a generic chatbot; you are specialized in elevator company operations.
Answer in Arabic with a Saudi-friendly professional style. Use the provided system summary, knowledge base, and local agent plan. You can answer questions about the system, summarize records, analyze technician workload, review visits, find delayed visits, suggest technician assignment priorities, support voice chat, and help convert spoken Arabic into clean form-field values across the system. When the user explicitly asks to convert spoken text for a form field, return only the final field value without explanation.
IMPORTANT: You CAN now directly execute commands. To execute an action, include a JSON block in your response like these examples:
For a maintenance or installation contract (عقد صيانة / عقد تركيب): [EXECUTE:{"action":"create_contract","data":{"type":"صيانة","clientName":"...","value":0}}]
For a price quote (عرض سعر): [EXECUTE:{"action":"create_quote","data":{"clientName":"...","value":0,"details":"..."}}]
Always distinguish between contracts (عقود) and quotes (عروض سعر). If the user says "سوي عرض سعر" or "عرض سعر", use create_quote. If the user says "عقد صيانة" or "عقد", use create_contract.
If the user says "باسم X" or "للعميل X", the client name is X.
The system will execute the action automatically. For supported actions, immediately execute instead of just explaining.
Supported actions:
- create_contract (لإنشاء عقود الصيانة والتركيب): type, clientName, clientId, clientCompanyName, clientCompanyUnifiedNumber, startDate, endDate, value, details, buildings, elevatorInfo
- create_quote (لإنشاء عروض الأسعار): clientName, clientId, value, details, items
- create_ticket: title, description, clientName, clientId, priority, contractId
- create_visit: clientName, clientId, contractId, scheduledAt, building, assignedTo
- assign_visit: visitId, technicianId, technicianName
- redistribute_visits: redistributeAll (true/false)
- create_supplier: name, phone, city, category
- add_staff: name, identity, role
- create_notification: title, body, userId, roles
- analyze_report: reportId, autoGenerateQuote
- optimize_quote: quoteId, targetValue
If data is missing, ask only for the minimum missing data.
Do not ask for secrets or passwords. Do not claim that you performed the action unless you include the EXECUTE block.
Focus on contracts, visits, tickets, suppliers, spare parts, quotes, inventory, and operational risks.
Respect permissions. If the local plan says the action is not allowed, refuse execution and offer safe alternatives.
Maintain conversation context. Remember previous questions and answers. Do not repeat information already provided. Ask only for missing essential information, prioritizing required data over optional data. Execute operations as soon as all required data is available.

User: ${JSON.stringify(user)}
Knowledge base: ${JSON.stringify(knowledge)}
Local agent plan: ${JSON.stringify(plan)}
System summary: ${JSON.stringify(context)}`;
  
  const messages = [
    {role: "system", content: systemPrompt},
    ...conversationHistory,
    {role: "user", content: question}
  ];
  
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`},
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1500
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return {error: data.error?.message || "Groq request failed"};
  const answer = data.choices?.[0]?.message?.content?.trim() || "No answer was returned from Groq.";
  return {answer, model, plan};
}
http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  if (sendMobileAssociation(res, pathname)) return;
  if (pathname === "/health" || pathname === "/api/health") return sendJson(res, 200, {ok: true, at: new Date().toISOString()});
  const invitePrefix = "/invite/";
  if (pathname.startsWith(invitePrefix)) {
    const token = pathname.slice(invitePrefix.length);
    const store = readStore();
    const invites = inviteList(store);
    const invite = invites.find(x => x.token === token);
    const now = Date.now();
    if (!invite || invite.revoked || Number(invite.expiresAtMs || 0) < now || Number(invite.used || 0) >= Number(invite.maxUses || 1)) return sendLocked(res);
    res.writeHead(302, {
      "Set-Cookie": [`${entryCookie}=${entryCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`, `${inviteCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`],
      "Location": "/login.html",
      "Cache-Control": "no-store"
    });
    res.end();
    return;
  }

  if (!hasEntryAccess(req) && !hasDeviceAccess(req)) return sendLocked(res);

  if (req.url.startsWith("/api/push/register") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        if (!input.userId || !input.token) return sendJson(res, 400, {error: "Missing push token"});
        const store = readStore();
        const tokens = pushTokenList(store).filter(x => x.token !== input.token);
        tokens.unshift({userId: String(input.userId), role: String(input.role || ""), token: String(input.token), platform: String(input.platform || "web"), updatedAt: new Date().toISOString()});
        savePushTokens(store, tokens);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications")) {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const userId = url.searchParams.get("userId") || "";
      const role = url.searchParams.get("role") || "";
      const items = notificationList(readStore()).filter(n => !n.userId || n.userId === userId || (n.roles || []).includes(role)).slice(0, 80);
      return sendJson(res, 200, {notifications: items});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const store = readStore();
          const notifications = notificationList(store);
          const n = {id: `NTF-${Date.now()}`, title: String(input.title || "إشعار"), body: String(input.body || ""), userId: String(input.userId || ""), roles: Array.isArray(input.roles) ? input.roles : [], url: String(input.url || "/dashboard.html"), createdAt: new Date().toISOString(), readBy: []};
          notifications.unshift(n);
          saveNotifications(store, notifications);
          const tokens = pushTokenList(store).filter(t => !n.userId && !n.roles.length ? true : t.userId === n.userId || n.roles.includes(t.role));
          sendNativePush(tokens, n);
          sendJson(res, 200, {ok: true, notification: n});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
  }

  if (req.url.startsWith("/api/ai/admin") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const input = JSON.parse(body || "{}");
        const question = String(input.question || "").trim().slice(0, 2000);
        if (!question) return sendJson(res, 400, {error: "Missing question"});
        const role = String(input.role || "");
        const userId = String(input.userId || "");
        const userName = String(input.name || "");
        
        // Check AI chat permission
        const permissionCheck = checkAiPermission({id: userId, role, name: userName, permissions: input.permissions}, "ai.chat");
        if (!permissionCheck.allowed) {
          return sendJson(res, 403, {error: permissionCheck.reason});
        }
        
        const store = readStore();
        const context = buildAiContext(store);
        
        // Filter sensitive data from context based on user role
        const filteredContext = filterSensitiveData(context, {id: userId, role, permissions: input.permissions});
        
        // Get or create conversation for context retention
        const conversation = getOrCreateConversation(store, userId, role);
        const conversationId = conversation.id;
        
        // Add user message to conversation
        addMessageToConversation(store, conversationId, "user", question);
        
        const result = await askGroq(question, filteredContext, {id: userId, role, name: userName}, conversationId);
        if (result.error) return sendJson(res, result.error.includes("configured") ? 503 : 502, result);
        
        // Parse and execute [EXECUTE:...] blocks from the AI response
        const executions = [];
        let cleanAnswer = result.answer;
        const execStartTag = "[EXECUTE:";
        let execIdx = cleanAnswer.indexOf(execStartTag);
        while (execIdx !== -1) {
          const jsonStart = execIdx + execStartTag.length;
          let braceDepth = 0;
          let jsonEnd = jsonStart;
          for (; jsonEnd < cleanAnswer.length; jsonEnd++) {
            if (cleanAnswer[jsonEnd] === "{") braceDepth++;
            else if (cleanAnswer[jsonEnd] === "}") {
              braceDepth--;
              if (braceDepth === 0) { jsonEnd++; break; }
            }
          }
          if (braceDepth === 0 && jsonEnd > jsonStart) {
            try {
              const jsonStr = cleanAnswer.slice(jsonStart, jsonEnd);
              const actionData = JSON.parse(jsonStr);
              actionData.userId = userId;
              const execResult = executeAiAction(actionData, store);
              executions.push(execResult);
              logAiOperation(store, actionData.action,
                {id: userId, name: userName, role},
                {action: actionData.action, data: actionData.data, result: execResult.message}
              );
            } catch (parseErr) {
              executions.push({executed: false, error: `Failed to parse action: ${parseErr.message}`});
            }
            const blockEnd = cleanAnswer.indexOf("]", jsonEnd) + 1;
            const fullBlock = cleanAnswer.slice(execIdx, blockEnd || jsonEnd);
            cleanAnswer = cleanAnswer.replace(fullBlock, "");
          } else {
            cleanAnswer = cleanAnswer.replace(execStartTag, "");
          }
          execIdx = cleanAnswer.indexOf(execStartTag);
        }
        cleanAnswer = cleanAnswer.trim();
        
        // Use the plan from inferAiPlan to also auto-execute if Groq didn't include EXECUTE block
        const plan = result.plan || inferAiPlan(question, filteredContext, {id: userId, role, name: userName});
        if (plan.allowed && plan.needsApproval && executions.length === 0 && !cleanAnswer.includes("[EXECUTE")) {
          // If the plan detects an action intent but Groq didn't execute, try direct execution
          let autoExecute = null;
          if (plan.intent === "create_maintenance_contract" || plan.intent === "create_installation_contract") {
            autoExecute = {action: "create_contract", data: {type: plan.intent === "create_installation_contract" ? "تركيب" : "صيانة", details: question}};
          } else if (plan.intent === "create_quote") {
            autoExecute = {action: "create_quote", data: {details: question}};
          } else if (plan.intent === "assign_visit" && /زيارة\s*(\S+)/i.test(question)) {
            autoExecute = {action: "assign_visit", data: {visitId: RegExp.$1}};
          } else if (plan.intent === "redistribute_visits") {
            autoExecute = {action: "redistribute_visits", data: {redistributeAll: /الكل|جميع|all/i.test(question)}};
          }
          if (autoExecute) {
            autoExecute.userId = userId;
            const execResult = executeAiAction(autoExecute, store);
            if (execResult.executed) {
              executions.push(execResult);
              logAiOperation(store, autoExecute.action,
                {id: userId, name: userName, role},
                {action: autoExecute.action, data: autoExecute.data, result: execResult.message}
              );
              cleanAnswer += `\n\n✅ ${execResult.message}`;
            }
          }
        }
        
        // Add AI response to conversation (with EXECUTE blocks removed)
        addMessageToConversation(store, conversationId, "assistant", cleanAnswer);
        
        const memory = aiMemoryList(store);
        memory.unshift({id: `AIM-${Date.now()}`, userId, role, question, answer: cleanAnswer, plan, model: result.model, conversationId, executions, createdAt: new Date().toISOString(), rating: "unrated"});
        saveAiMemory(store, memory);
        sendJson(res, 200, {...result, answer: cleanAnswer, conversationId, contextCounts: filteredContext.counts, executions});
      } catch {
        sendJson(res, 400, {error: "Invalid AI request"});
      }
    });
    return;
  }

  if (req.url === "/api/ai/execute" && req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const input = JSON.parse(body);
        const question = String(input.question || "").trim();
        const userId = input.userId || "ai";
        const role = input.role || "admin";
        const userName = input.name || "AI";
        if (!question) return sendJson(res, 400, {executed: false, message: "السؤال فارغ"});

        const store = readStore();
        const context = buildAiContext(store);
        const plan = inferAiPlan(question, context, {id: userId, role, name: userName});

        if (!plan.allowed) return sendJson(res, 403, {executed: false, message: "لا تملك صلاحية التنفيذ"});

        // Action mapping
        const actionMap = {
          create_maintenance_contract: "create_contract",
          create_installation_contract: "create_contract",
          create_quote: "create_quote",
          create_ticket: "create_ticket",
          create_visit: "create_visit",
          assign_visit: "assign_visit",
          redistribute_visits: "redistribute_visits",
          add_staff: "add_staff",
          create_supplier: "create_supplier",
          create_notification: "create_notification",
          create_part: "add_staff", // placeholder - would need separate handler
          optimize_quote: "optimize_quote",
          analyze_report: "analyze_report",
          analyze_operations: "analyze_operations",
          analyze_inventory: "analyze_inventory",
          analyze_staff: "analyze_staff"
        };

        const action = actionMap[plan.intent];
        if (!action) return sendJson(res, 200, {executed: false, message: "لم يتم التعرف على أمر قابل للتنفيذ. استخدم النموذج الأول للإدارة الذكية للاستفسارات العامة."});

        // Build data from plan extraction
        const d = Object.assign({}, plan.data, {details: question, userId});
        const actionData = {action, data: d, userId};

        // Define required fields per action with Arabic labels
        const requiredFields = {
          create_contract: [
            {key: "clientName", label: "اسم العميل أو المنشأة", hint: "مثال: مؤسسة الأفق للتجارة"},
            {key: "value", label: "قيمة العقد", hint: "مثال: بقيمة 15000 ريال"}
          ],
          create_quote: [
            {key: "clientName", label: "اسم العميل", hint: "مثال: لشركة الأفق"},
            {key: "value", label: "قيمة عرض السعر", hint: "مثال: بقيمة 5000 ريال"}
          ],
          create_ticket: [
            {key: "title", label: "عنوان البلاغ", hint: "مثال: عطل في المصعد"}
          ],
          create_visit: [
            {key: "clientName", label: "اسم العميل أو المنشأة", hint: "مثال: لمؤسسة الأفق"}
          ],
          add_staff: [
            {key: "name", label: "اسم الفني", hint: "مثال: محمد أحمد"},
            {key: "identity", label: "رقم الهوية", hint: "مثال: 1234567890"}
          ],
          create_supplier: [
            {key: "name", label: "اسم المورد", hint: "مثال: شركة التقنية"}
          ],
          assign_visit: [
            {key: "visitId", label: "رقم الزيارة", hint: "مثال: VIS-12345"},
            {key: "technicianName", label: "اسم الفني", hint: "مثال: لـ أحمد"}
          ]
        };

        // Validation: check for missing required fields
        const needs = requiredFields[action] || [];
        const missing = needs.filter(f => !d[f.key] || String(d[f.key]).trim() === "");
        if (missing.length > 0) {
          const fieldHints = missing.map(f => `• ${f.label}: ${f.hint}`).join("\n");
          return sendJson(res, 200, {
            executed: false,
            message: `⚠️ معلومات ناقصة. يرجى إضافة:\n\n${fieldHints}\n\n📝 مثال كامل: ${actionExamples[action] || ""}`,
            missing: missing.map(f => f.key),
            partial: d
          });
        }

        // Action examples for user guidance
        const actionExamples = {
          create_contract: "أنشئ عقد صيانة لمؤسسة الأفق للتجارة بقيمة 15000 ريال لمدة سنتين",
          create_quote: "أنشئ عرض سعر لشركة الأفق بقيمة 5000 ريال",
          create_ticket: "أنشئ بلاغ عطل في مصعد مبنى الإدارة أولوية عالية",
          create_visit: "أنشئ زيارة كشفية لمؤسسة الأفق يوم 2026-07-15",
          add_staff: "أضف فني محمد أحمد هوية 1234567890",
          create_supplier: "أضف مورد شركة التقنية جوال 0551234567 الرياض",
          assign_visit: "أسند زيارة VIS-12345 إلى فني أحمد"
        };

        // --- Local analysis (no Groq needed) ---
        if (action === "analyze_operations") {
          const counts = context.counts || {};
          const tickets = parseStoredJson(store, "misadTickets");
          const visits = parseStoredJson(store, "misadVisits");
          const reports = parseStoredJson(store, "misadVisitReports");
          const staff = parseStoredJson(store, "misadCompanyStaff");
          const parts = parseStoredJson(store, "misadParts");
          const contracts = parseStoredJson(store, "misadContracts");
          const openTickets = tickets.filter(t => t.status !== "مغلق" && t.status !== "closed");
          const lateVisits = visits.filter(v => new Date(v.scheduledAt) < new Date() && !reports.find(r => r.visitId === v.id));
          const lowParts = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
          const activeTechs = staff.filter(s => s.availability === "working" || s.availability === "available");
          const expiringContracts = contracts.filter(c => c.endDate && new Date(c.endDate) > new Date() && new Date(c.endDate) < new Date(Date.now() + 30*86400000));

          const analysis = {
            openTickets: {count: openTickets.length, urgent: openTickets.filter(t => t.priority === "urgent").length},
            lateVisits: lateVisits.length,
            lowParts: lowParts.length,
            activeStaff: activeTechs.length,
            totalStaff: staff.length,
            expiringContracts: expiringContracts.length,
            totalContracts: contracts.length
          };

          let msg = `📊 تحليل النظام:\n• ${analysis.openTickets.count} بلاغ مفتوح (${analysis.openTickets.urgent} طارئ)\n• ${analysis.lateVisits} زيارة متأخرة دون تقرير\n• ${analysis.lowParts} صنف مخزون عند حد الطلب\n• ${analysis.activeStaff}/${analysis.totalStaff} فنيين نشطين\n• ${analysis.expiringContracts} عقد ينتهي خلال 30 يوم\n• ${analysis.totalContracts} عقد إجمالاً`;
          if (analysis.openTickets.urgent > 0) msg += `\n\n⚠️ يوجد ${analysis.openTickets.urgent} بلاغ طارئ يحتاج استجابة فورية.`;
          if (analysis.expiringContracts > 0) msg += `\n\n⚠️ ${analysis.expiringContracts} عقد على وشك الانتهاء - يوصى بالتواصل مع العملاء للتجديد.`;
          if (analysis.lateVisits > 0) msg += `\n\n📋 يوصى بإعادة توزيع الزيارات المتأخرة على الفنيين المتفرغين.`;
          if (analysis.lowParts > 0) msg += `\n\n📦 يوصى بمراجعة المخزون وطلب القطع الناقصة.`;

          return sendJson(res, 200, {executed: true, message: msg, action, data: analysis});
        }

        if (action === "analyze_inventory") {
          const parts = parseStoredJson(store, "misadParts");
          const suppliers = parseStoredJson(store, "misadSuppliers");
          const low = parts.filter(p => Number(p.qty || 0) <= Number(p.minQty || 1));
          const outOfStock = parts.filter(p => Number(p.qty || 0) === 0);
          let msg = `📦 تحليل المخزون:\n• ${parts.length} قطعة غيار مسجلة\n• ${low.length} أصناف عند حد الطلب أو أقل\n• ${outOfStock.length} أصناف نفدت بالكامل\n• ${suppliers.length} مورد\n`;
          if (low.length > 0) {
            msg += `\n⚠️ الأصناف التي تحتاج إعادة طلب:\n`;
            low.slice(0, 10).forEach(p => { msg += `• ${p.name || p.title || "قطعة"}: الكمية ${p.qty || 0} (الحد: ${p.minQty || 1})\n`; });
          }
          return sendJson(res, 200, {executed: true, message: msg, action, data: {total: parts.length, lowStock: low.length, outOfStock: outOfStock.length}});
        }

        if (action === "analyze_staff") {
          const staff = parseStoredJson(store, "misadCompanyStaff");
          const visits = parseStoredJson(store, "misadVisits");
          const reports = parseStoredJson(store, "misadVisitReports");
          const analysis = staff.map(s => {
            const assigned = visits.filter(v => v.assignedTo === s.identity);
            const completed = assigned.filter(v => reports.find(r => r.visitId === v.id));
            const late = assigned.filter(v => new Date(v.scheduledAt) < new Date() && !reports.find(r => r.visitId === v.id));
            return {name: s.name, role: s.role, total: assigned.length, completed: completed.length, late: late.length, availability: s.availability || "working"};
          });
          let msg = `👥 تحليل فريق العمل:\n`;
          analysis.forEach(a => {
            const status = a.availability === "working" ? "نشط" : a.availability === "idle" ? "متفرغ" : a.availability === "vacation" ? "إجازة" : a.availability || "غير محدد";
            msg += `• ${a.name} (${a.role === "engineer" ? "مهندس" : "فني"}) - ${status}: ${a.completed}/${a.total} زيارات مكتملة${a.late > 0 ? `, ${a.late} متأخرة ⚠️` : ""}\n`;
          });
          return sendJson(res, 200, {executed: true, message: msg, action, data: analysis});
        }

        // --- Execute via executeAiAction ---
        const execResult = executeAiAction(actionData, store);

        // Build rich response message
        let msg = execResult.message;
        if (execResult.executed) {
          if (execResult.contract) {
            const c = execResult.contract;
            msg = `✅ تم إنشاء العقد بنجاح\n\n📋 رقم العقد: ${c.id}\n👤 العميل: ${c.clientName || c.clientCompanyName || "غير محدد"}\n💰 القيمة: ${Number(c.value).toFixed(2)} ريال\n📄 النوع: ${c.type}\n📅 البداية: ${c.startDate}\n📅 النهاية: ${c.endDate}\n🔄 الحالة: ${c.status}\n\nيمكنك الاطلاع على العقد في صفحة العقود.`;
          } else if (execResult.quote) {
            const qr = execResult.quote;
            msg = `✅ تم إنشاء عرض السعر بنجاح\n\n📋 رقم العرض: ${qr.id}\n👤 العميل: ${qr.client}\n💰 القيمة: ${Number(qr.value).toFixed(2)} ريال (شامل الضريبة)\n🔄 الحالة: ${qr.status}\n\nيمكنك الاطلاع على العرض في صفحة عروض الأسعار.`;
          } else if (execResult.ticket) {
            const t = execResult.ticket;
            msg = `✅ تم إنشاء البلاغ بنجاح\n\n📋 رقم البلاغ: ${t.id}\n📌 العنوان: ${t.title}\n🔄 الأولوية: ${t.priority}\n🔄 الحالة: ${t.status}\n\nيمكنك متابعة البلاغ في صفحة البلاغات.`;
          } else if (execResult.visit) {
            const v = execResult.visit;
            msg = `✅ تم إنشاء الزيارة بنجاح\n\n📋 رقم الزيارة: ${v.id}\n🏢 الموقع: ${v.building?.name || "غير محدد"}\n📅 الموعد: ${v.scheduledAt}\n👤 المسند إليه: ${v.assignedName || "غير مسند"}\n🔄 الحالة: ${v.status}`;
          } else if (execResult.supplier) {
            const s = execResult.supplier;
            msg = `✅ تم إضافة المورد بنجاح\n\n📋 اسم المورد: ${s.name}\n📞 الجوال: ${s.phone || "غير محدد"}\n🏙️ المدينة: ${s.city || "غير محدد"}\n📂 التصنيف: ${s.category}\n⭐ التقييم: ${s.rating}`;
          } else if (execResult.staff) {
            const s = execResult.staff;
            msg = `✅ تم إضافة عضو الفريق بنجاح\n\n📋 الاسم: ${s.name}\n🆔 الهوية: ${s.identity}\n👤 الدور: ${s.role === "engineer" ? "مهندس" : "فني"}\n🔄 الحالة: ${s.status}`;
          } else if (execResult.notification) {
            msg = `✅ تم إنشاء الإشعار بنجاح\n📌 العنوان: ${execResult.notification.title}`;
          } else if (execResult.redistribution) {
            msg = `✅ تم إعادة توزيع ${execResult.redistribution.proposedAssignments?.length || 0} زيارة`;
          }
        }

        logAiOperation(store, action, {id: userId, name: userName, role}, {action, data: d, result: execResult.message});
        sendJson(res, 200, {executed: execResult.executed, message: msg, action, data: execResult});

      } catch (e) {
        sendJson(res, 500, {executed: false, message: "خطأ في التنفيذ: " + e.message});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/agent/status") && req.method === "GET") {
    const store = readStore();
    const memory = aiMemoryList(store);
    return sendJson(res, 200, {
      knowledge: elevatorKnowledgeBase(),
      memoryCount: memory.length,
      recentMemory: memory.slice(0, 12).map(x => ({id: x.id, role: x.role, intent: x.plan?.intent || "answer", allowed: x.plan?.allowed !== false, createdAt: x.createdAt, rating: x.rating || "unrated"})),
      contextCounts: buildAiContext(store).counts
    });
  }

  if (req.url.startsWith("/api/ai/conversation") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    if (!userId || !role) return sendJson(res, 400, {error: "Missing userId or role"});
    const store = readStore();
    const conversation = getOrCreateConversation(store, userId, role);
    return sendJson(res, 200, {conversation});
  }

  if (req.url.startsWith("/api/ai/conversation/end") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const conversationId = String(input.conversationId || "");
        if (!conversationId) return sendJson(res, 400, {error: "Missing conversationId"});
        const store = readStore();
        endConversation(store, conversationId);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/conversation/history") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const userId = url.searchParams.get("userId") || "";
    const role = url.searchParams.get("role") || "";
    if (!userId || !role) return sendJson(res, 400, {error: "Missing userId or role"});
    const store = readStore();
    const conversations = aiConversationList(store).filter(c => c.userId === userId && c.role === role).slice(0, 20);
    return sendJson(res, 200, {conversations});
  }

  if (req.url.startsWith("/api/ai/analyze-report") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const reportId = String(input.reportId || "");
        const userId = String(input.userId || "");
        const autoGenerateQuote = input.autoGenerateQuote !== false;
        
        if (!reportId) return sendJson(res, 400, {error: "Missing reportId"});
        
        const store = readStore();
        const reports = parseStoredJson(store, "misadVisitReports");
        const report = reports.find(r => r.id === reportId);
        
        if (!report) return sendJson(res, 404, {error: "Report not found"});
        
        const analysis = analyzeReportForQuote(report, store);
        
        let quote = null;
        if (autoGenerateQuote && (analysis.needsSpareParts || analysis.needsInstallation || analysis.needsUpdate || analysis.needsReplacement || analysis.needsAdditionalWorks)) {
          quote = generateAutoQuote(report, analysis, store, userId);
          const quotes = parseStoredJson(store, "misadQuotes");
          quotes.unshift(quote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
          
          // Create notification for quote review
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "عرض سعر تلقائي جديد",
            body: `تم إنشاء عرض سعر تلقائي ${quote.id} بناءً على تقرير ${reportId}. يحتاج مراجعة واعتماد.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#quotes`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {analysis, quote, reportId});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/optimize-quote") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const quoteId = String(input.quoteId || "");
        const targetValue = Number(input.targetValue || 0);
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const applyChanges = input.applyChanges === true;
        
        if (!quoteId || !targetValue) return sendJson(res, 400, {error: "Missing quoteId or targetValue"});
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to modify quotes"});
        }
        
        const store = readStore();
        const quotes = parseStoredJson(store, "misadQuotes");
        const quoteIndex = quotes.findIndex(q => q.id === quoteId);
        
        if (quoteIndex === -1) return sendJson(res, 404, {error: "Quote not found"});
        
        const originalQuote = quotes[quoteIndex];
        const quoteCopy = JSON.parse(JSON.stringify(originalQuote));
        const optimization = optimizeQuotePrices(quoteCopy, targetValue, store);
        
        let newQuote = null;
        if (applyChanges && optimization.achievable) {
          newQuote = createQuoteVersion(quoteCopy, optimization.changes, userId);
          quotes.unshift(newQuote);
          store.misadQuotes = JSON.stringify(quotes.slice(0, 200));
          writeStore(store);
          
          // Create notification for new quote version
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "إصدار جديد من عرض السعر",
            body: `تم إنشاء إصدار جديد ${newQuote.id} من عرض السعر ${quoteId} بعد التعديل الذكي.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#quotes`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {optimization, newQuote, originalQuoteId: quoteId});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/redistribute-visits") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const redistributeAll = input.redistributeAll === true;
        const applyChanges = input.applyChanges === true;
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to redistribute visits"});
        }
        
        const store = readStore();
        const analysis = redistributeVisits(store, {redistributeAll});
        
        let appliedChanges = [];
        if (applyChanges && analysis.proposedAssignments.length > 0) {
          const visits = parseStoredJson(store, "misadVisits");
          
          analysis.proposedAssignments.forEach(assignment => {
            const visitIndex = visits.findIndex(v => v.id === assignment.visitId);
            if (visitIndex !== -1) {
              const oldTechnician = visits[visitIndex].assignedTo;
              visits[visitIndex].assignedTo = assignment.proposedTechnicianId;
              visits[visitIndex].assignedName = assignment.proposedTechnician;
              visits[visitIndex].rebalancedAt = new Date().toISOString();
              visits[visitIndex].rebalancedBy = userId;
              
              appliedChanges.push({
                visitId: assignment.visitId,
                oldTechnician: oldTechnician || "غير مسند",
                newTechnician: assignment.proposedTechnicianId,
                newTechnicianName: assignment.proposedTechnician
              });
            }
          });
          
          store.misadVisits = JSON.stringify(visits);
          store["misadLastVisitRebalance:" + (userId || "platform")] = Date.now();
          writeStore(store);
          
          // Create notification for redistribution
          const notifications = notificationList(store);
          notifications.unshift({
            id: `NTF-${Date.now()}`,
            title: "إعادة توزيع الزيارات",
            body: `تم إعادة توزيع ${appliedChanges.length} زيارة بناءً على التحليل الجغرافي وتوزيع عبء العمل.`,
            userId: userId,
            roles: ["owner", "company_admin", "admin"],
            url: `/dashboard.html#visits`,
            createdAt: new Date().toISOString(),
            readBy: []
          });
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {analysis, appliedChanges});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/technician-location") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const technicianId = url.searchParams.get("technicianId") || "";
    
    if (!technicianId) return sendJson(res, 400, {error: "Missing technicianId"});
    
    const store = readStore();
    const insights = analyzeTechnicianLocation(technicianId, store);
    sendJson(res, 200, insights);
  }

  if (req.url.startsWith("/api/ai/route-deviations") && req.method === "GET") {
    const store = readStore();
    const deviations = detectRouteDeviations(store);
    sendJson(res, 200, {deviations, count: deviations.length});
  }

  if (req.url.startsWith("/api/ai/smart-notifications") && req.method === "GET") {
    const store = readStore();
    const notifications = generateSmartNotifications(store);
    sendJson(res, 200, {notifications, count: notifications.length});
  }

  if (req.url.startsWith("/api/ai/smart-notifications/generate") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const role = String(input.role || "");
        
        // Check permissions
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to generate smart notifications"});
        }
        
        const store = readStore();
        const potentialNotifications = generateSmartNotifications(store);
        const createdNotifications = [];
        
        potentialNotifications.forEach(notification => {
          const created = createSmartNotification(store, notification);
          if (created) createdNotifications.push(created);
        });
        
        sendJson(res, 200, {
          generated: createdNotifications.length,
          skipped: potentialNotifications.length - createdNotifications.length,
          notifications: createdNotifications
        });
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications/mark-read") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const notificationId = String(input.notificationId || input.id || "");
        const userId = String(input.userId || "");
        
        if (!notificationId || !userId) return sendJson(res, 400, {error: "Missing notificationId or userId"});
        
        const store = readStore();
        const notifications = notificationList(store);
        const notification = notifications.find(n => n.id === notificationId);
        
        if (notification) {
          if (!notification.readBy) notification.readBy = [];
          if (!notification.readBy.includes(userId)) {
            notification.readBy.push(userId);
          }
          if (input.archived) {
            if (!notification.archivedBy) notification.archivedBy = [];
            if (!notification.archivedBy.includes(userId)) notification.archivedBy.push(userId);
          }
          saveNotifications(store, notifications);
        }
        
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/notifications/mark-all-read") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "");
        
        if (!userId) return sendJson(res, 400, {error: "Missing userId"});
        
        const store = readStore();
        const notifications = notificationList(store);
        
        notifications.forEach(n => {
          if (!n.readBy) n.readBy = [];
          if (!n.readBy.includes(userId)) {
            n.readBy.push(userId);
          }
        });
        
        saveNotifications(store, notifications);
        sendJson(res, 200, {ok: true});
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/logs") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || "";
    const userId = url.searchParams.get("userId") || "";
    const operation = url.searchParams.get("operation") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    
    // Check permission to view logs
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view AI logs"});
    }
    
    const store = readStore();
    const filters = {};
    if (userId) filters.userId = userId;
    if (operation) filters.operation = operation;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = getAiLogs(store, filters);
    sendJson(res, 200, {logs, count: logs.length});
  }

  if (req.url.startsWith("/api/ai/recommendations") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || "";
    
    // Check permission to view recommendations
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view recommendations"});
    }
    
    const store = readStore();
    const report = generateRecommendationReport(store);
    sendJson(res, 200, report);
  }

  if (req.url.startsWith("/api/ai/technician-profile") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const technicianId = url.searchParams.get("technicianId") || "";
    const role = url.searchParams.get("role") || "";
    
    if (!technicianId) return sendJson(res, 400, {error: "Missing technicianId"});
    
    // Check permission to view profiles
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to view technician profiles"});
    }
    
    const store = readStore();
    const profile = buildTechnicianProfile(technicianId, store);
    sendJson(res, 200, profile);
  }

  if (req.url.startsWith("/api/ai/technician-profiles/update") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const role = String(input.role || "");
        
        // Check permission to update profiles
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to update technician profiles"});
        }
        
        const store = readStore();
        const profiles = updateAllTechnicianProfiles(store);
        sendJson(res, 200, {updated: profiles.length, profiles});
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-workflow/initiate") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const documentId = String(input.documentId || "");
        const documentType = String(input.documentType || "");
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        
        if (!documentId || !documentType) return sendJson(res, 400, {error: "Missing documentId or documentType"});
        
        // Check permission
        if (!["owner", "company_admin", "admin"].includes(role)) {
          return sendJson(res, 403, {error: "Not authorized to initiate document workflow"});
        }
        
        const store = readStore();
        const workflow = initiateDocumentWorkflow(store, documentId, documentType, userId, role);
        
        // Save workflow
        const workflows = parseStoredJson(store, "misadDocumentWorkflows");
        workflows.unshift(workflow);
        store.misadDocumentWorkflows = JSON.stringify(workflows.slice(0, 200));
        writeStore(store);
        
        sendJson(res, 200, workflow);
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-workflow/approve") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const workflowId = String(input.workflowId || "");
        const stepNumber = Number(input.stepNumber || 1);
        const userId = String(input.userId || "");
        const role = String(input.role || "");
        const approved = input.approved === true;
        const comments = String(input.comments || "");
        
        if (!workflowId) return sendJson(res, 400, {error: "Missing workflowId"});
        
        const store = readStore();
        const workflow = approveDocumentStep(store, workflowId, stepNumber, userId, role, approved, comments);
        
        if (workflow.error) return sendJson(res, 400, workflow);
        
        // Save updated workflow
        const workflows = parseStoredJson(store, "misadDocumentWorkflows");
        const index = workflows.findIndex(w => w.id === workflowId);
        if (index !== -1) {
          workflows[index] = workflow;
          store.misadDocumentWorkflows = JSON.stringify(workflows);
          writeStore(store);
        }
        
        sendJson(res, 200, workflow);
      } catch (err) {
        sendJson(res, 400, {error: "Invalid request: " + (err.message || "Unknown error")});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/ai/document-analyze") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const documentId = url.searchParams.get("documentId") || "";
    const documentType = url.searchParams.get("documentType") || "";
    const role = url.searchParams.get("role") || "";
    
    if (!documentId || !documentType) return sendJson(res, 400, {error: "Missing documentId or documentType"});
    
    // Check permission
    if (!["owner", "company_admin", "admin"].includes(role)) {
      return sendJson(res, 403, {error: "Not authorized to analyze documents"});
    }
    
    const store = readStore();
    const analysis = analyzeDocumentForApproval(store, documentId, documentType);
    sendJson(res, 200, analysis);
  }

  if (req.url.startsWith("/api/invite/current")) {
    const token = parseCookies(req.headers.cookie)[inviteCookie];
    const invite = inviteList(readStore()).find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
    return sendJson(res, 200, invite ? {invite: {targetRole: invite.targetRole, targetUserId: invite.targetUserId, label: invite.label}} : {invite: null});
  }

  if (req.url.startsWith("/api/device/authorize") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(body || "{}");
        const userId = String(input.userId || "").replace(/\D/g, "");
        const role = String(input.role || "");
        const deviceId = String(input.deviceId || "");
        if (!userId || !role || !deviceId) return sendJson(res, 400, {error: "Missing device data"});
        const store = readStore();
        const invites = inviteList(store);
        const token = parseCookies(req.headers.cookie)[inviteCookie];
        const invite = invites.find(x => x.token === token && !x.revoked && Number(x.expiresAtMs || 0) > Date.now() && Number(x.used || 0) < Number(x.maxUses || 1));
        const adminBootstrap = role === "admin" && userId === "2572280689" && hasEntryAccess(req);
        const roleAllowed = invite && (!invite.targetRole || invite.targetRole === role || invite.targetRole === "any");
        const userAllowed = invite && (!invite.targetUserId || invite.targetUserId === userId);
        if (!adminBootstrap && (!roleAllowed || !userAllowed)) return sendJson(res, 403, {error: "Invite does not match this user"});
        if (invite) {
          invite.used = Number(invite.used || 0) + 1;
          invite.lastUsedAt = new Date().toISOString();
          invite.boundUserId = userId;
          invite.boundRole = role;
        }
        saveInvites(store, invites);
        const deviceValue = `${userId}.${deviceId}.${sign(`${userId}:${deviceId}`)}`;
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": [`${deviceCookie}=${deviceValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`, `${entryCookie}=; Path=/; Max-Age=0`, `${inviteCookie}=; Path=/; Max-Age=0`]
        });
        res.end(JSON.stringify({ok: true}));
      } catch {
        sendJson(res, 400, {error: "Invalid JSON"});
      }
    });
    return;
  }

  if (req.url.startsWith("/api/invites")) {
    if (req.method === "GET") {
      const invites = inviteList(readStore()).map(({token, ...invite}) => ({...invite, url: `${publicOrigin(req)}/invite/${token}`}));
      return sendJson(res, 200, {invites});
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const input = JSON.parse(body || "{}");
          const now = Date.now();
          const creatorRole = String(input.createdByRole || "");
          const targetRole = String(input.targetRole || "client");
          const allowed = creatorRole === "admin" ? ["owner", "company_admin"] : ["owner", "company_admin"].includes(creatorRole) ? ["client"] : [];
          if (!allowed.includes(targetRole)) return sendJson(res, 403, {error: "Role is not allowed to create this invite"});
          const invite = createInvite(input);
          const store = readStore();
          const invites = inviteList(store).filter(x => Number(x.expiresAtMs || 0) > now && !x.revoked);
          invites.unshift(invite);
          saveInvites(store, invites);
          sendJson(res, 200, {...invite, url: `${publicOrigin(req)}/invite/${invite.token}`});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      const store = readStore();
      const invites = inviteList(store);
      const invite = invites.find(x => x.id === id);
      if (invite) invite.revoked = true;
      saveInvites(store, invites);
      return sendJson(res, 200, {ok: true});
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }

  if (req.url.startsWith("/api/storage")) {
    if (req.method === "GET") {
      const key = new URL(req.url, "http://localhost").searchParams.get("key");
      const store = readStore();
      if (key) return sendJson(res, 200, Object.prototype.hasOwnProperty.call(store, key) ? {key, value: store[key]} : {});
      return sendJson(res, 200, store);
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const {key, value, remove} = JSON.parse(body || "{}");
          if (!key) return sendJson(res, 400, {error: "Missing key"});
          const store = readStore();
          if (remove) delete store[key];
          else store[key] = value;
          writeStore(store);
          sendJson(res, 200, {ok: true});
        } catch {
          sendJson(res, 400, {error: "Invalid JSON"});
        }
      });
      return;
    }
    return sendJson(res, 405, {error: "Method not allowed"});
  }
  let urlPath = pathname;
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
}).listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
  const store = readStore();
  const invites = inviteList(store);
  const invite = createInvite({label: "رابط تسجيل جهاز المشرف", targetRole: "admin", createdBy: "system", createdByName: "system", minutes: 10, maxUses: 1});
  invites.unshift(invite);
  saveInvites(store, invites);
  console.log(`Startup generated entry link: /invite/${invite.token}`);
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.PUBLIC_URL || "";
  if (keepAliveUrl) {
    setInterval(() => {
      fetch(`${keepAliveUrl.replace(/\/$/, "")}/health`).catch(() => {});
    }, 5 * 60 * 1000).unref?.();
    console.log(`Keep-alive health ping enabled for ${keepAliveUrl}`);
  }
  if (!process.env.SECRET_ENTRY_TOKEN) {
    console.log("Set SECRET_ENTRY_TOKEN on Render to keep entry sessions valid across restarts.");
  }
});
