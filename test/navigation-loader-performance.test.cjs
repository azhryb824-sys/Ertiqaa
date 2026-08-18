const fs=require('fs');
const assert=require('assert');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

assert.match(html,/id="pageLoader"[\s\S]*shumoos-logo\.png/,'loader must use the application logo');
assert.match(css,/@keyframes shumoosLogoFill/,'logo must visibly fill and empty');
assert.match(app,/function navigateToPage\(page\)[\s\S]*requestAnimationFrame\(\(\)=>requestAnimationFrame/,'navigation must yield two frames so the loader paints before heavy rendering');
assert.match(app,/side\.onclick=[\s\S]*navigateToPage\(b\.dataset\.page\)/,'sidebar navigation must use the loader');
assert.match(app,/data-page-link[\s\S]*navigateToPage\(page\.dataset\.pageLink\)/,'in-page navigation must use the loader');
assert.match(app,/dashboardEnhanceQueued[\s\S]*new MutationObserver\(scheduleDashboardEnhancements\)/,'dashboard enhancements must be coalesced to prevent observer storms');
assert.match(app,/const parsedStorageCache=new Map\(\)/,'large storage values must be parsed once and reused');
assert.match(app,/cv\.toBlob\([\s\S]*image\/jpeg/,'invoice image compression must encode asynchronously');
assert.doesNotMatch(app,/function financePage\(initial\)\{[^\n]*ensureAccountingAll/,'finance rendering must not run a full accounting reconciliation');
assert.doesNotMatch(app,/function finAccountingHTML\(\)\{[^\n]*ensureAccountingAll/,'hidden accounting markup must not reconcile the full ledger');
assert.match(app,/function refreshStaffPurchasesSection\(\)/,'saving an employee expense must support a targeted section refresh');
assert.match(app,/class EfficientMutationObserver extends NativeMutationObserver/,'broad mutation observers must be batched once per animation frame');
console.log('navigation loader and performance safeguards: ok');
