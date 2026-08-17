(function(){
  'use strict';
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const DAYS=['أحد','اثن','ثلا','أرب','خمس','جمع','سبت'];
  let active=null,view=new Date(),picker=null;
  const pad=n=>String(n).padStart(2,'0');
  const dateValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  const parseDate=v=>validDate(v)?new Date(Number(v.slice(0,4)),Number(v.slice(5,7))-1,Number(v.slice(8,10))):new Date();
  const sameDay=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

  function ensurePicker(){
    if(picker)return picker;
    picker=document.createElement('div');
    picker.className='themed-date-picker';
    picker.dir='rtl';
    picker.setAttribute('role','dialog');
    picker.setAttribute('aria-label','اختيار التاريخ');
    document.body.appendChild(picker);
    picker.addEventListener('click',onPickerClick);
    return picker;
  }
  function position(){
    if(!active||!picker)return;
    const r=active.getBoundingClientRect(),gap=8,w=Math.min(330,window.innerWidth-20);
    let top=r.bottom+gap,left=Math.max(10,Math.min(r.right-w,window.innerWidth-w-10));
    if(top+390>window.innerHeight&&r.top>390)top=Math.max(10,r.top-378);
    picker.style.width=w+'px';picker.style.top=top+'px';picker.style.left=left+'px';
  }
  function render(){
    const isMonth=active?.type==='month';
    if(isMonth){renderMonths();return;}
    const selected=parseDate(active?.value),today=new Date(),year=view.getFullYear(),month=view.getMonth();
    const first=new Date(year,month,1),days=new Date(year,month+1,0).getDate(),offset=first.getDay();
    let cells='';
    for(let i=0;i<offset;i++)cells+='<span class="calendar-empty"></span>';
    for(let day=1;day<=days;day++){
      const d=new Date(year,month,day),classes=['calendar-day'];
      if(sameDay(d,today))classes.push('is-today');
      if(validDate(active.value)&&sameDay(d,selected))classes.push('is-selected');
      cells+=`<button type="button" class="${classes.join(' ')}" data-date="${dateValue(d)}" aria-label="${day} ${MONTHS[month]} ${year}">${day}</button>`;
    }
    picker.innerHTML=`<div class="calendar-head"><button type="button" data-cal-next aria-label="الشهر التالي">‹</button><strong>${MONTHS[month]} ${year}</strong><button type="button" data-cal-prev aria-label="الشهر السابق">›</button></div><div class="calendar-week">${DAYS.map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-days">${cells}</div><div class="calendar-foot"><button type="button" data-cal-today>اليوم</button><button type="button" data-cal-close>إلغاء</button></div>`;
    position();
  }
  function renderMonths(){
    const now=new Date(),selected=/^\d{4}-\d{2}$/.test(active?.value||'')?active.value:'';
    const year=view.getFullYear();
    picker.innerHTML=`<div class="calendar-head"><button type="button" data-year-next aria-label="السنة التالية">‹</button><strong>${year}</strong><button type="button" data-year-prev aria-label="السنة السابقة">›</button></div><div class="calendar-months">${MONTHS.map((name,i)=>{const val=`${year}-${pad(i+1)}`,cls=['calendar-month'];if(val===selected)cls.push('is-selected');if(year===now.getFullYear()&&i===now.getMonth())cls.push('is-today');return `<button type="button" class="${cls.join(' ')}" data-month="${val}">${name}</button>`}).join('')}</div><div class="calendar-foot"><button type="button" data-cal-today>هذا الشهر</button><button type="button" data-cal-close>إلغاء</button></div>`;
    position();
  }
  function commit(value){
    if(!active)return;
    active.value=value;
    active.dispatchEvent(new Event('input',{bubbles:true}));
    active.dispatchEvent(new Event('change',{bubbles:true}));
    close();
  }
  function onPickerClick(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.date)commit(b.dataset.date);
    else if(b.dataset.month)commit(b.dataset.month);
    else if(b.hasAttribute('data-cal-prev')){view.setMonth(view.getMonth()-1);render();}
    else if(b.hasAttribute('data-cal-next')){view.setMonth(view.getMonth()+1);render();}
    else if(b.hasAttribute('data-year-prev')){view.setFullYear(view.getFullYear()-1);render();}
    else if(b.hasAttribute('data-year-next')){view.setFullYear(view.getFullYear()+1);render();}
    else if(b.hasAttribute('data-cal-today'))commit(active.type==='month'?dateValue(new Date()).slice(0,7):dateValue(new Date()));
    else if(b.hasAttribute('data-cal-close'))close();
  }
  function open(input){
    active=input;ensurePicker();
    const base=input.type==='month'&&/^\d{4}-\d{2}$/.test(input.value)?new Date(Number(input.value.slice(0,4)),Number(input.value.slice(5,7))-1,1):parseDate(input.value);
    view=new Date(base.getFullYear(),base.getMonth(),1);
    picker.classList.add('open');input.classList.add('date-picker-active');input.setAttribute('aria-expanded','true');render();
  }
  function close(){
    if(active){active.classList.remove('date-picker-active');active.setAttribute('aria-expanded','false');}
    picker?.classList.remove('open');active=null;
  }
  function enhance(root=document){
    const selector='input[type="date"],input[type="month"]';
    const inputs=[...(root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];
    inputs.forEach(input=>{
      if(input.dataset.themedDate)return;
      input.dataset.themedDate='true';input.readOnly=true;input.setAttribute('aria-haspopup','dialog');input.setAttribute('aria-expanded','false');
    });
  }
  document.addEventListener('click',e=>{
    const input=e.target.closest?.('input[data-themed-date="true"]');
    if(input){e.preventDefault();open(input);return;}
    if(picker?.classList.contains('open')&&!e.target.closest('.themed-date-picker'))close();
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('input[data-themed-date="true"]')){e.preventDefault();open(e.target);}});
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  const start=()=>{enhance();new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>n.nodeType===1&&enhance(n)))).observe(document.body,{childList:true,subtree:true});};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
