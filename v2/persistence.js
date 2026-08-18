"use strict";
window.V2Persistence=(()=>{
  let version=0, queue=Promise.resolve(), initialized=false, csrf="";
  const request=async(url,options={})=>{
    const response=await fetch(url,{cache:"no-store",credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(csrf?{"X-V2-CSRF":csrf}:{}),...(options.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(body.error||`فشل الطلب (${response.status})`);error.status=response.status;error.currentVersion=body.currentVersion;error.body=body;throw error}
    return body;
  };
  async function ensureSession(){if(csrf)return;const body=await request("../api/v2/session");csrf=String(body.csrf||"");if(!csrf)throw new Error("تعذر تهيئة جلسة V2")}
  async function load(){await ensureSession();const body=await request("../api/v2/state");version=Number(body.version||0);initialized=version>0;return body}
  async function bootstrap(force=false){await ensureSession();const body=await request("../api/v2/bootstrap",{method:"POST",body:JSON.stringify({force})});version=Number(body.version||0);initialized=true;return body}
  async function demo(){await ensureSession();const body=await request("../api/v2/demo",{method:"POST",body:"{}"});version=Number(body.version||0);initialized=true;return body}
  function command(type,input){const idempotencyKey=globalThis.crypto?.randomUUID?.()||`v2-${Date.now()}-${Math.random().toString(16).slice(2)}`,task=async()=>{await ensureSession();const body=await request("../api/v2/command",{method:"POST",headers:{"X-Idempotency-Key":idempotencyKey},body:JSON.stringify({version,type,input})});version=Number(body.version||version+1);return body};const result=queue.then(task);queue=result.catch(()=>{});return result}
  async function health(){return request("../api/v2/health")}
  async function report(type,filters={}){await ensureSession();const query=new URLSearchParams(filters).toString();return request(`../api/v2/report/${encodeURIComponent(type)}${query?`?${query}`:""}`)}
  async function authBootstrap(){return request("../api/v2/auth/bootstrap-session")}
  async function authEnroll(password,enrollCsrf){return request("../api/v2/auth/enroll",{method:"POST",headers:{"X-V2-Enroll-CSRF":enrollCsrf},body:JSON.stringify({password})})}
  async function authConfirm(code,enrollCsrf){return request("../api/v2/auth/confirm",{method:"POST",headers:{"X-V2-Enroll-CSRF":enrollCsrf},body:JSON.stringify({code})})}
  async function authLogin(userId,password,code){return request("../api/v2/auth/login",{method:"POST",body:JSON.stringify({userId,password,code})})}
  async function authLogout(){csrf="";return request("../api/v2/auth/logout",{method:"POST",body:"{}"})}
  return{load,bootstrap,demo,command,health,report,authBootstrap,authEnroll,authConfirm,authLogin,authLogout,get version(){return version},get initialized(){return initialized}};
})();
