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
console.log('navigation loader and performance safeguards: ok');
