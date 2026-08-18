"use strict";

const crypto=require("crypto");
const clone=value=>JSON.parse(JSON.stringify(value));
const id=()=>`V2-APR-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const rows=state=>Array.isArray(state.v2Approvals)?state.v2Approvals:(state.v2Approvals=[]);
function threshold(state,type){const settings=state.v2Settings||{};if(type==="purchase-invoice.create")return Number(settings.purchaseApprovalLimit||5000);if(type==="payroll.accrue")return Number(settings.payrollApprovalLimit||0);return Infinity}
function commandAmount(type,input){if(type==="purchase-invoice.create")return Number(input.net??input.amount??input.total??0);if(type==="payroll.accrue")return (input.rows||[]).reduce((sum,row)=>sum+Number(row.base||0)+Number(row.allowances||0)-Number(row.deductions||0),0);return 0}
function needsApproval(state,type,input,ctx){return !["owner","admin"].includes(ctx.role)&&commandAmount(type,input)>threshold(state,type)}
function requestApproval(state,type,input,ctx){const record={id:id(),companyOwnerId:ctx.tenantId,status:"pending",commandType:type,commandInput:clone(input),amount:commandAmount(type,input),requestedBy:ctx.userId,requestedByName:ctx.name||"",requestedAt:new Date().toISOString()};rows(state).unshift(record);return record}
function approve(state,approvalId,ctx,execute){if(!["owner","admin","company_admin"].includes(ctx.role))throw Object.assign(new Error("Approval permission required"),{status:403});const record=rows(state).find(row=>String(row.id)===String(approvalId)&&row.companyOwnerId===ctx.tenantId);if(!record)throw new Error("Approval request not found");if(record.status!=="pending")throw new Error("Approval request is not pending");if(String(record.requestedBy)===String(ctx.userId))throw Object.assign(new Error("Maker cannot approve own request"),{status:409});const result=execute(record.commandType,clone(record.commandInput));if(!result.ok)throw Object.assign(new Error(result.error),{status:result.status||400});record.status="approved";record.approvedBy=ctx.userId;record.approvedAt=new Date().toISOString();record.resultId=result.record?.id||"";delete record.commandInput;return{approval:record,result}}
module.exports={threshold,commandAmount,needsApproval,requestApproval,approve};
