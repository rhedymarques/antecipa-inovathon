const assert=require('assert');const fs=require('fs');const {simulate,financialSnapshot,evaluateActions,diagnose,recommend}=require('../dist/engine.js');const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const near=(a,b,tol=1e-5)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const Q=['q2_5','q5','q25','q50','q75','q95','q97_5'];
for(const shop of data.shops){
 const base=simulate(shop,data);const advance=simulate(shop,data,{action:'advance',advance:3000});const negotiate=simulate(shop,data,{action:'negotiate'});const reduce=simulate(shop,data,{action:'reduce'});
 const mix=simulate(shop,data,{action:'mix',pixDiscount:3,maxInstall:6});
 near(advance.end,base.end-advance.fee);near(negotiate.end,base.end);near(reduce.end-base.end,shop.expenses.reduce((a,e)=>a+e.operating*.1,0));
 near(advance.daily[0].balance-base.daily[0].balance,advance.advanced-advance.fee);
 assert(simulate(shop,data,{shock:-40}).end<=base.end);
 const max=simulate(shop,data,{action:'advance',advance:1e6});near(max.advanced,shop.receivables.slice(1).reduce((a,b)=>a+b,0));
 // Ajustar o mix: custo = desconto no Pix (≥0); sem desconto e com o mesmo parcelamento não muda nada
 assert(mix.fee>=0&&Number.isFinite(mix.end));
 near(simulate(shop,data,{action:'mix',pixDiscount:0,maxInstall:3}).end,base.end);
 assert(simulate(shop,data,{action:'mix',pixDiscount:6,maxInstall:3}).fee>0,'desconto no Pix deveria ter custo');
 for(const scenario of [base,advance,negotiate,reduce,mix]){let previous=shop.balance;for(const d of scenario.daily){near(d.balance,previous+d.existing+d.newSales-d.expense);assert(Number.isFinite(d.balance));previous=d.balance;}}
 const f=financialSnapshot(shop,shop.balance,20);near(f.ncg,shop.finance.stock+shop.receivables.reduce((a,b)=>a+b,0)+(shop.receivablesBeyondWindow??0)+shop.finance.otherReceivables-shop.finance.operatingLiabilities);near(f.st,shop.balance-shop.finance.financialDebt);near(f.incremental,Math.max(0,f.ncg)*.2);assert(evaluateActions(shop,data).length===5);
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
 // recommend(): escolhe uma alternativa; antecipação recomendada nunca excede 1,5× o buraco
 for(const H of [30,60]){const rec=recommend(shop,data,{horizon:H});
  assert(['none','negotiate','reduce','advance','mix'].includes(rec.action));
  assert(rec.cost<=rec.buraco+1,`${shop.id}: custo recomendado (${rec.cost}) excede o buraco (${rec.buraco})`);
  if(rec.mode==='margem')assert(!['advance','credit'].includes(rec.action),`${shop.id}: modo MARGEM não pode recomendar antecipação ou crédito`);
  if(rec.action==='advance'){
   const hole=Math.max(0,-Math.min(...base.daily.slice(0,H).map(d=>d.balance)));
   assert(rec.params.advance<=hole*1.5,`${shop.id}: antecipação recomendada excede 1,5× o buraco`);
   const applied=simulate(shop,data,{action:rec.action,...rec.params});
   assert(Math.min(...applied.daily.slice(0,H).map(d=>d.balance))>=hole*.2-1e-8);
   assert(applied.fee<=hole);
  }
 }
 console.log(shop.name,JSON.stringify({minimum:Math.round(base.min),end:Math.round(base.end),mae:shop.metrics?.mae,baseline:shop.metrics?.baselineMae,diag60:shop.uncertainty.horizons['60'].diagnosis,probNeg60:shop.uncertainty.horizons['60'].probNegative}));
}
// Regras específicas do desafio: mercadinho é margem; antecipar não deve ser recomendado nele.
const merc=data.shops.find(s=>s.id==='mercadinho');
assert(diagnose(merc,data)==='margem','mercadinho deveria ser diagnosticado como margem');
assert(merc.uncertainty.horizons['60'].diagnosis==='margem','mercadinho deveria mostrar margem em 60 dias');
assert(!['advance','credit'].includes(recommend(merc,data,{horizon:60}).action),'margem não pode recomendar antecipação ou crédito');
assert(recommend(merc,data,{horizon:60}).justificativa.includes('o ajuste é estrutural'));
// Caso que realmente exige antecipação: mínimo em centavos e reprodução do valor recomendado.
const fixture={balance:0,mix:[1,0,0,0],rates:[0,0,0,0],delays:[0,1,30,30],
 forecast:Array(60).fill(0),receivables:Array(60).fill(0),
 expenses:Array.from({length:60},()=>({operating:0,supplier:0,fixed:0}))};
fixture.expenses[0].fixed=100;fixture.receivables[10]=1000;
// No teto (R$150), o custo cria outro aperto no fim; um valor menor cobre todos os dias.
fixture.expenses[59].fixed=878.9;
const rec=recommend(fixture,data,{horizon:60,advance:999999});
assert(rec.action==='advance','o teste deve exercitar uma antecipação recomendada');
near(rec.params.advance,121.01);
const applied=simulate(fixture,data,{action:rec.action,...rec.params});
assert(applied.min>=20&&rec.params.advance<=150);
near(applied.end,simulate(fixture,data).end-applied.fee);
assert(simulate(fixture,data,{action:'advance',advance:rec.params.advance-.01}).min<20,'um centavo a menos não deve cobrir a margem');
assert(simulate(fixture,data,{action:'advance',advance:150}).min<20,'o teto pode piorar o saldo futuro');
assert.deepStrictEqual(rec,recommend(fixture,data,{horizon:60,advance:0}),'recomendação deve independer do controle manual');
// FIFO: recebíveis anteriores ao buraco não resolvem o déficit; não recomendar excesso nem antecipação parcial.
const early=structuredClone(fixture);early.expenses.forEach(e=>e.fixed=0);
early.receivables[1]=160;early.expenses[2].fixed=260;
const blocked=recommend(early,data,{horizon:60});
assert(blocked.action!=='advance'&&blocked.partial,'sem antecipação suficiente dentro do teto, explicitar cobertura parcial');
assert(blocked.justificativa.includes('não fecha a conta sozinha'));
assert(recommend(data.shops.find(s=>s.id==='vestuario'),data,{horizon:30}).action==='none');
console.log('PASS: conservação de caixa, antecipação mínima, teto, reprodução, veto de margem, renegociação, redução, choques, diagnóstico e Monte Carlo.');
