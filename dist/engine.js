/* Deterministic cash accounting over forecasts trained in Python. */
function simulate(shop,data,options={}) {
 const opening=Number(options.balance??shop.balance), shock=Number(options.shock??0)/100;
 const action=options.action??'none';
 const days=data.dates.length;
 const incoming=Array(days).fill(0), expenses=shop.expenses.map(e=>e.operating+e.supplier+e.fixed);
 // Alavanca "ajustar o mix de venda": um desconto no Pix migra crédito -> Pix por uma elasticidade
 // declarada (6 p.p. de crédito por 1% de desconto) e o parcelamento máximo muda o número de parcelas
 // do crédito parcelado, alterando o prazo de liquidação. Hipóteses; não modela efeito sobre volume.
 let mix=shop.mix, maxInstall=3, pixDisc=0;
 if(action==='mix') {
  const d=Math.min(6,Math.max(0,Number(options.pixDiscount??0)));
  pixDisc=d/100; maxInstall=[3,4,6,12].includes(+options.maxInstall)?+options.maxInstall:3;
  const credit=shop.mix[2]+shop.mix[3], migr=Math.min(credit,0.06*d);
  mix=[...shop.mix];
  if(credit>0){mix[2]-=migr*shop.mix[2]/credit;mix[3]-=migr*shop.mix[3]/credit;mix[0]+=migr;}
 }
 shop.forecast.forEach((gross,i)=>mix.forEach((share,m)=>{
  const parts=m===3?maxInstall:1, net=gross*(1+shock)*share*(1-shop.rates[m])*(m===0?1-pixDisc:1);
  for(let p=0;p<parts;p++) { const due=i+shop.delays[m]+30*p; if(due<days) incoming[due]+=net/parts; }
 }));
 const receivables=[...shop.receivables]; let fee=0,advanced=0,shifted=0;
 if(action==='mix') shop.forecast.forEach(gross=>fee+=gross*(1+shock)*mix[0]*pixDisc); // custo = desconto concedido no Pix
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
// Classifica o problema antes de recomendar. Margem é estrutural (90 dias); timing e
// saudável dependem de a curva de saldo do horizonte cruzar ou não o zero.
function diagnose(shop,data,options={}) {
 const d=shop.diagnosis;
 if(d && d.entradas90-d.saidas90<=0) return 'margem';
 const r=simulate(shop,data,{...options,action:'none'});
 return r.daily.some(x=>x.balance<0)?'timing':'saudavel';
}
function evaluateActions(shop,data,options={}){
 return ['none','negotiate','reduce','advance','mix'].map(action=>{const r=simulate(shop,data,{...options,action});return {action,min:r.min,end:r.end,fee:r.fee,firstNegative:r.firstNegative,negativeDays:r.daily.filter(d=>d.balance<0).length};});
}
if(typeof module!=='undefined') module.exports={simulate,financialSnapshot,evaluateActions,diagnose};
