/* Deterministic cash accounting over forecasts trained in Python. */
function simulate(shop,data,options={}) {
 const opening=Number(options.balance??shop.balance), shock=Number(options.shock??0)/100;
 const action=options.action??'none';
 const days=data.dates.length;
 const incoming=Array(days).fill(0), expenses=shop.expenses.map(e=>e.operating+e.supplier+e.fixed);
 shop.forecast.forEach((gross,i)=>shop.mix.forEach((share,m)=>{
  const parts=m===3?3:1;
  for(let p=0;p<parts;p++) { const due=i+shop.delays[m]+30*p; if(due<days) incoming[due]+=gross*(1+shock)*share*(1-shop.rates[m])/parts; }
 }));
 const receivables=[...shop.receivables]; let fee=0,advanced=0,shifted=0;
 if(action==='negotiate') {
  const i=shop.expenses.findIndex(e=>e.supplier>0);
  if(i>=0 && i+7<days){shifted=shop.expenses[i].supplier;expenses[i]-=shifted;expenses[i+7]+=shifted;}
 }
 if(action==='reduce') shop.expenses.forEach((e,i)=>expenses[i]-=e.operating*.1);
 if(action==='advance') {
  let remaining=Math.max(0,Number(options.advance??3000));
  for(let i=1;i<days&&remaining>0;i++) {const amount=Math.min(remaining,receivables[i]);receivables[i]-=amount;advanced+=amount;fee+=amount*.025*(i/30);remaining-=amount;}
  receivables[0]+=advanced-fee;
 }
 let balance=opening;
 const daily=data.dates.map((date,i)=>{balance+=receivables[i]+incoming[i]-expenses[i];return {date,existing:receivables[i],newSales:incoming[i],expense:expenses[i],balance};});
 return {daily,fee,advanced,shifted,min:Math.min(...daily.map(d=>d.balance)),end:balance,firstNegative:daily.find(d=>d.balance<0)?.date??null};
}
function financialSnapshot(shop,opening,growth=0) {
 const f=shop.finance;
 const pmr=shop.mix.reduce((sum,share,m)=>sum+share*(m===3?60:shop.delays[m]),0);
 // Include existing installments beyond the chart's 60-day window in NCG.
 const receivables=shop.receivables.reduce((a,b)=>a+b,0)+(shop.receivablesBeyondWindow??0)+f.otherReceivables;
 const ncg=f.stock+receivables-f.operatingLiabilities;
 return {pmr,cycle:f.pme+pmr-f.pmp,ncg,st:opening-f.financialDebt,receivables,incremental:Math.max(0,ncg)*growth/100};
}
function evaluateActions(shop,data,options={}){
 return ['none','negotiate','reduce','advance'].map(action=>{const r=simulate(shop,data,{...options,action});return {action,min:r.min,end:r.end,fee:r.fee,firstNegative:r.firstNegative,negativeDays:r.daily.filter(d=>d.balance<0).length};});
}
if(typeof module!=='undefined') module.exports={simulate,financialSnapshot,evaluateActions};
