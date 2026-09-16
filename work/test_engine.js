const assert=require('assert');const fs=require('fs');const {simulate,financialSnapshot,evaluateActions}=require('../dist/engine.js');const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
for(const shop of data.shops){
 const base=simulate(shop,data);const advance=simulate(shop,data,{action:'advance',advance:3000});const negotiate=simulate(shop,data,{action:'negotiate'});const reduce=simulate(shop,data,{action:'reduce'});
 const near=(a,b)=>assert(Math.abs(a-b)<.00001,`${a} != ${b}`);
 near(advance.end,base.end-advance.fee);near(negotiate.end,base.end);near(reduce.end-base.end,shop.expenses.reduce((a,e)=>a+e.operating*.1,0));
 near(advance.daily[0].balance-base.daily[0].balance,advance.advanced-advance.fee);
 assert(simulate(shop,data,{shock:-40}).end<=base.end);
 const max=simulate(shop,data,{action:'advance',advance:1e6});near(max.advanced,shop.receivables.slice(1).reduce((a,b)=>a+b,0));
 for(const scenario of [base,advance,negotiate,reduce]){let previous=shop.balance;for(const d of scenario.daily){near(d.balance,previous+d.existing+d.newSales-d.expense);assert(Number.isFinite(d.balance));previous=d.balance;}}
 const f=financialSnapshot(shop,shop.balance,20);near(f.ncg,shop.finance.stock+shop.receivables.reduce((a,b)=>a+b,0)+(shop.receivablesBeyondWindow??0)+shop.finance.otherReceivables-shop.finance.operatingLiabilities);near(f.st,shop.balance-shop.finance.financialDebt);near(f.incremental,Math.max(0,f.ncg)*.2);assert(evaluateActions(shop,data).length===4);
 if(shop.coldStart){assert(shop.history.length===14);assert(shop.metrics===null);assert(shop.peerCount===18);}
 console.log(shop.name,JSON.stringify({minimum:Math.round(base.min),end:Math.round(base.end),mae:shop.metrics?.mae,baseline:shop.metrics?.baselineMae}));
}
console.log('PASS: conservation of cash, fees, repayment timing, reductions, scenario shocks and eligibility caps.');
