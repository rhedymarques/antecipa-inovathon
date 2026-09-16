const assert=require('assert');const fs=require('fs');const {simulate,financialSnapshot,evaluateActions,diagnose}=require('../dist/engine.js');const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const near=(a,b,tol=1e-5)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const Q=['q2_5','q5','q25','q50','q75','q95','q97_5'];
for(const shop of data.shops){
 const base=simulate(shop,data);const advance=simulate(shop,data,{action:'advance',advance:3000});const negotiate=simulate(shop,data,{action:'negotiate'});const reduce=simulate(shop,data,{action:'reduce'});
 near(advance.end,base.end-advance.fee);near(negotiate.end,base.end);near(reduce.end-base.end,shop.expenses.reduce((a,e)=>a+e.operating*.1,0));
 near(advance.daily[0].balance-base.daily[0].balance,advance.advanced-advance.fee);
 assert(simulate(shop,data,{shock:-40}).end<=base.end);
 const max=simulate(shop,data,{action:'advance',advance:1e6});near(max.advanced,shop.receivables.slice(1).reduce((a,b)=>a+b,0));
 for(const scenario of [base,advance,negotiate,reduce]){let previous=shop.balance;for(const d of scenario.daily){near(d.balance,previous+d.existing+d.newSales-d.expense);assert(Number.isFinite(d.balance));previous=d.balance;}}
 const f=financialSnapshot(shop,shop.balance,20);near(f.ncg,shop.finance.stock+shop.receivables.reduce((a,b)=>a+b,0)+(shop.receivablesBeyondWindow??0)+shop.finance.otherReceivables-shop.finance.operatingLiabilities);near(f.st,shop.balance-shop.finance.financialDebt);near(f.incremental,Math.max(0,f.ncg)*.2);assert(evaluateActions(shop,data).length===4);
 if(shop.coldStart){assert(shop.history.length===14);assert(shop.metrics===null);assert(shop.peerCount===18);}
 // Diagnóstico timing vs margem (Tarefa 3)
 assert(['margem','timing','saudavel'].includes(diagnose(shop,data)),'diagnose inválido');
 assert(shop.diagnosis&&Number.isFinite(shop.diagnosis.entradas90)&&Number.isFinite(shop.diagnosis.saidas90));
 // Monte Carlo / incerteza (Tarefa 2 revisada)
 const u=shop.uncertainty;assert(u&&u.scenarios===2000,'uncertainty ausente ou n≠2000');
 for(const k of Q)assert(Array.isArray(u.quantiles[k])&&u.quantiles[k].length===data.dates.length,`quantil ${k} com tamanho errado`);
 for(let i=0;i<data.dates.length;i++){const col=Q.map(k=>u.quantiles[k][i]);for(let j=1;j<col.length;j++)assert(col[j]>=col[j-1]-1e-6,`quantis não monotônicos no dia ${i}`);}
 for(const H of ['30','60']){const hz=u.horizons[H];assert(hz,`horizonte ${H} ausente`);
  assert(['margem','timing','saudavel'].includes(hz.diagnosis));
  near(hz.diagnosisFreq.margem+hz.diagnosisFreq.timing+hz.diagnosisFreq.saudavel,1,0.02);
  assert(hz.diagnosisFreq[hz.diagnosis]>=hz.diagnosisFreq.margem&&hz.diagnosisFreq[hz.diagnosis]>=hz.diagnosisFreq.timing&&hz.diagnosisFreq[hz.diagnosis]>=hz.diagnosisFreq.saudavel,'diagnosis não é o mais frequente');
  for(const p of [hz.probPositiveClose,hz.probNegative])assert(p>=0&&p<=1,'probabilidade fora de [0,1]');
  assert(hz.firstNegativeDist.length===Number(H),'firstNegativeDist com tamanho errado');
  assert(hz.medianHole<=0&&hz.p95Hole<=hz.medianHole+1e-6,'buraco: p95 deve ser ≤ mediana ≤ 0');
 }
 console.log(shop.name,JSON.stringify({minimum:Math.round(base.min),end:Math.round(base.end),mae:shop.metrics?.mae,baseline:shop.metrics?.baselineMae,diag60:shop.uncertainty.horizons['60'].diagnosis,probNeg60:shop.uncertainty.horizons['60'].probNegative}));
}
// Regras específicas do desafio: mercadinho é margem; antecipar não deve ser recomendado nele.
const merc=data.shops.find(s=>s.id==='mercadinho');
assert(diagnose(merc,data)==='margem','mercadinho deveria ser diagnosticado como margem');
assert(merc.uncertainty.horizons['60'].diagnosis==='margem','mercadinho deveria mostrar margem em 60 dias');
console.log('PASS: conservação de caixa, antecipação, renegociação, redução, choques, limites, diagnóstico e Monte Carlo (quantis, horizontes, probabilidades).');
