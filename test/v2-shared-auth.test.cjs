"use strict";
const assert=require("node:assert/strict"),fs=require("fs"),os=require("os"),path=require("path"),{Readable}=require("stream");
const {createV2Api}=require("../src/v2/isolated-store.cjs");

const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"v2-shared-auth-"));
const sendJson=(res,status,body)=>Object.assign(res,{status,body});
const api=createV2Api({
  dataDir,
  sharedAuthOnly:true,
  strictAuth:false,
  authStore:{identity:()=>({userId:"WRONG",tenantId:"WRONG",role:"admin"})},
  authToken:()=>"independent-v2-token",
  authCookieName:"v2_session",
  authIdentity:req=>req.userId||"",
  readSource:()=>({misadUsers:JSON.stringify([{id:"OWNER",role:"owner",name:"المالك"}])}),
  parseArray:(source,key)=>JSON.parse(source[key]||"[]"),
  cleanId:String,
  systemUsers:[],
  sign:value=>`signed:${value}`,
  sendJson,
  backup:{},
  backupKey:"test"
});

async function call(method,pathname,userId="OWNER"){
  const req=Readable.from([]);req.method=method;req.userId=userId;req.headers={};
  const headers={},res={setHeader:(key,value)=>headers[key]=value};
  assert.equal(await api.handle(req,res,pathname),true);
  return res;
}

(async()=>{
  let res=await call("GET","/api/v2/session");
  assert.equal(res.status,200);
  assert.equal(res.body.authentication,"shared-system-session");
  assert.equal(res.body.tenant,"OWNER");
  res=await call("POST","/api/v2/auth/login");
  assert.equal(res.status,410);
  res=await call("GET","/api/v2/session",null);
  assert.equal(res.status,401);
  fs.rmSync(dataDir,{recursive:true,force:true});
  console.log("v2 shared authentication checks passed");
})().catch(error=>{console.error(error);process.exitCode=1});
