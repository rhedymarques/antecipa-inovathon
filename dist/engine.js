/* Deterministic cash accounting over forecasts trained in Python. */
const round2=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
const avg=a=>a.length?a.reduce((s,v)=>s+Number(v||0),0)/a.length:0;

// Product-level promotions are a transparent what-if layer. Product histories,
// elasticity, participation and cannibalization are synthetic assumptions; they
// are not learned by the sales model and do not reuse its probabilistic band.
function promotionCandidates(shop){
 const c=shop.commercial,p=c&&Array.isArray(c.products)?c.products:[];
 if(!c||!p.length)return [];
 if(shop.id==='bar'){
  const drinks=p.filter(x=>x.category==='bebida'),snacks=p.filter(x=>x.category==='petisco'),out=[];
  for(const d of drinks)for(const s of snacks)out.push({id:`combo_${d.id}_${s.id}`,kind:'combo',products:[d,s],name:`Combo ${d.name} + ${s.name}`});
  return out;
 }
 if(shop.id==='vestuario'){
  const old=p.filter(x=>(x.tags||[]).includes('colecao_anterior'));
  return [...old.map(x=>({id:`liquidacao_${x.id}`,kind:'clearance',products:[x],name:`Liquidação: ${x.name}`})),
   ...(old.length>1?[{id:'liquidacao_colecao_anterior',kind:'clearance',products:old,name:'Liquidação da coleção anterior'}]:[])];
 }
 return [];
}
function recentRate(product){return avg((product.history||[]).slice(-28).map(x=>x.units));}
function buildPromotionPlan(shop,data,candidate,discountPct,horizon){
 const c=shop.commercial,a=c.assumptions,H=Math.min(horizon||60,data.dates.length),days=Math.min(a.campaignDays,H);
 const discount=Math.max(0,Number(discountPct))/100,uplift=Math.min(a.maxUplift,Number(discountPct)*a.upliftPerDiscountPoint);
 const rawWeights=shop.forecast.slice(0,days).map(v=>Math.max(0,v));
 const weights=rawWeights.some(v=>v>0)?rawWeights:Array(days).fill(1),weightSum=weights.reduce((s,v)=>s+v,0);
 const dailyGrossDelta=Array(data.dates.length).fill(0),items=[];
 const isCombo=candidate.kind==='combo';
 const rates=candidate.products.map(recentRate);
 const bundleRate=isCombo?Math.min(...rates):null;
 let nominalDiscount=0,baselineDiscount=0,cannibalizedRevenue=0,cogsMoved=0,incrementalCogs=0,marginImpact=0;
 for(const [idx,p] of candidate.products.entries()){
  const natural=Math.min(Number(p.stock),days*(isCombo?bundleRate:rates[idx]));
  const promotedBase=natural*a.participationRate;
  const surplus=Math.max(0,Number(p.stock)-natural);
  const wantedExtra=promotedBase*uplift;
  const extra=Math.min(surplus,wantedExtra);
  const promoUnits=promotedBase+extra,price=Number(p.price),cost=Number(p.cost),promoPrice=price*(1-discount);
  const discountAll=promoUnits*price*discount,discountOnBase=promotedBase*price*discount;
  const displaced=extra*promoPrice*a.cannibalizationRate;
  const grossDelta=extra*promoPrice-discountOnBase-displaced;
  const itemMargin=extra*(promoPrice-cost)-discountOnBase-displaced;
  nominalDiscount+=discountAll;baselineDiscount+=discountOnBase;cannibalizedRevenue+=displaced;
  cogsMoved+=promoUnits*cost;incrementalCogs+=extra*cost;marginImpact+=itemMargin;
  for(let i=0;i<days;i++)dailyGrossDelta[i]+=grossDelta*weights[i]/weightSum;
  items.push({id:p.id,name:p.name,category:p.category,price:round2(price),cost:round2(cost),promoPrice:round2(promoPrice),
   stockAvailable:Number(p.stock),recentUnitsPerDay:round2(rates[idx]),expectedBaseUnits:round2(natural),
   promotedBaseUnits:round2(promotedBase),incrementalUnits:round2(extra),promotionUnits:round2(promoUnits),
   stockConsumed:round2(natural+extra),stockRemaining:round2(Math.max(0,Number(p.stock)-natural-extra)),
   collection:p.collection||null,validUntil:p.validUntil||null});
 }
 const dailySettlement=Array(data.dates.length).fill(0),mix=a.paymentMix||shop.mix;
 for(let i=0;i<days;i++)for(let m=0;m<mix.length;m++){
  const parts=m===3?(shop.installments??4):1,net=dailyGrossDelta[i]*mix[m]*(1-shop.rates[m]);
  for(let part=0;part<parts;part++){const due=i+shop.delays[m]+30*part;if(due<dailySettlement.length)dailySettlement[due]+=net/parts;}
 }
 const grossDelta=dailyGrossDelta.reduce((s,v)=>s+v,0),cashInH=dailySettlement.slice(0,H).reduce((s,v)=>s+v,0);
 const feasible=items.every(x=>x.promoPrice>=x.cost)&&grossDelta>0&&marginImpact>0&&items.some(x=>x.incrementalUnits>0);
 const proposal=isCombo?`${candidate.name} com ${discountPct}% de desconto`:`${candidate.name} com até ${discountPct}% de desconto`;
 return {id:candidate.id,kind:candidate.kind,name:candidate.name,proposal,eligible:feasible,
  reason:feasible?'Campanha tem estoque, margem incremental positiva e efeito de caixa estimável.':
   (items.some(x=>x.promoPrice<x.cost)?'O desconto leva ao menos um produto abaixo do custo.':grossDelta<=0?'O desconto e a substituição de vendas superam a receita adicional.':'Não há estoque excedente ou margem incremental suficiente.'),
  params:{discountPct:Number(discountPct),campaignDays:days,horizon:H},products:items,
  assumptions:{synthetic:true,source:c.source,historyScope:c.historyScope,participationRate:a.participationRate,
   upliftPerDiscountPoint:a.upliftPerDiscountPoint,maxUplift:a.maxUplift,cannibalizationRate:a.cannibalizationRate,paymentMix:mix},
  totals:{grossCashDelta:round2(grossDelta),cashInHorizon:round2(cashInH),nominalDiscount:round2(nominalDiscount),
   baselineDiscount:round2(baselineDiscount),cannibalizedRevenue:round2(cannibalizedRevenue),cogsMoved:round2(cogsMoved),
   incrementalCogs:round2(incrementalCogs),marginImpact:round2(marginImpact)},
  economicCost:round2(baselineDiscount+cannibalizedRevenue),dailyGrossDelta,dailySettlement,
  uncertainty:{recalculated:false,note:'Estimativa pontual por hipóteses de adesão, elasticidade e canibalização; a faixa probabilística do cenário-base não foi recalculada.'}};
}
function allPromotionPlans(shop,data,options={}){
 const c=shop.commercial;if(!c)return [];
 const candidates=promotionCandidates(shop),grid=options.discountPct!=null?[Number(options.discountPct)]:(c.assumptions.discountGridPct||[]);
 return candidates.flatMap(candidate=>grid.map(d=>buildPromotionPlan(shop,data,candidate,d,options.horizon??60)))
  .filter(plan=>options.promotionId==null||plan.id===options.promotionId);
}
function simulate(shop,data,options={}) {
 const opening=Number(options.balance??shop.balance), shock=Number(options.shock??0)/100;
 const action=options.action??'none';
 const days=data.dates.length;
 const incoming=Array(days).fill(0), expenses=shop.expenses.map(e=>e.operating+e.supplier+e.fixed);
 const baseParts=shop.installments??4;   // nº de parcelas do crédito parcelado vem dos dados (credito_4x = 4)
 // Alavanca "ajustar o mix de venda" (hipóteses declaradas, não valores estimados):
 //  - desconto no Pix migra crédito -> Pix por uma curva que satura: migr = credito*TETO*(1-e^(-K*d)).
 //    Há teto (~40% do crédito) e rendimento decrescente — quem parcela nem sempre tem à vista.
 //  - perda de conversão: PERDA (20%) do volume que migraria é venda que não acontece (some do fluxo).
 //  - parcelamento (2,3,4,6,12) muda o prazo; reduzir parcelas perde 8% de volume por parcela abaixo da base.
 const TETO=0.40, K=0.4, PERDA=0.20;
 let mix=shop.mix, parcels=baseParts, pixDisc=0, volFactor=1, lostShare=0;
 if(action==='mix') {
  const d=Math.min(6,Math.max(0,Number(options.pixDiscount??0)));
  pixDisc=d/100; parcels=[2,3,4,6,12].includes(+options.maxInstall)?+options.maxInstall:baseParts;
  volFactor=Math.max(0,1-0.08*Math.max(0,baseParts-parcels));
  const credit=shop.mix[2]+shop.mix[3], migr=credit*TETO*(1-Math.exp(-K*d));
  lostShare=migr*PERDA;                                           // volume migrado que não converte
  mix=[...shop.mix];
  if(credit>0){mix[2]-=migr*shop.mix[2]/credit;mix[3]-=migr*shop.mix[3]/credit;mix[0]+=migr*(1-PERDA);}
 }
 shop.forecast.forEach((gross,i)=>mix.forEach((share,m)=>{
  const parts=m===3?parcels:1, vol=m===3?volFactor:1;
  const net=gross*(1+shock)*share*(1-shop.rates[m])*(m===0?1-pixDisc:1)*vol;
  for(let p=0;p<parts;p++) { const due=i+shop.delays[m]+30*p; if(due<days) incoming[due]+=net/parts; }
 }));
 const promotionPlan=action==='promotion'?(options._promotionPlan||allPromotionPlans(shop,data,options).find(p=>p.eligible)||null):null;
 const promotionIncoming=Array(days).fill(0);
 if(promotionPlan)promotionPlan.dailySettlement.forEach((v,i)=>{if(i<days){promotionIncoming[i]=v;incoming[i]+=v;}});
 const receivables=[...shop.receivables]; let fee=promotionPlan?promotionPlan.economicCost:0,advanced=0,shifted=0;
 if(action==='mix') shop.forecast.forEach(gross=>{
  const g=gross*(1+shock);
  fee+=g*mix[0]*pixDisc;                                          // desconto concedido no Pix
  fee+=g*lostShare*(1-pixDisc);                                   // vendas perdidas na migração (não convertem)
  fee+=g*mix[3]*(1-shop.rates[3])*(1-volFactor);                  // vendas parceladas perdidas ao reduzir parcelas
 });
 if(action==='negotiate') {
  const i=shop.expenses.findIndex(e=>e.supplier>0);
  if(i>=0 && i+7<days){shifted=shop.expenses[i].supplier;expenses[i]-=shifted;expenses[i+7]+=shifted;}
 }
 if(action==='reduce') { // hipótese: corte capado e com atrito, não é economia mágica de custo zero
  const CORTE_MAX=0.10, EFICIENCIA=0.70;   // no curto prazo corta-se no máximo 10%, e só ~70% vira economia real
  shop.expenses.forEach((e,i)=>{const corte=e.operating*CORTE_MAX; expenses[i]-=corte*EFICIENCIA; fee+=corte*(1-EFICIENCIA);});
 }
 if(action==='advance') {
  let remaining=Math.max(0,Number(options.advance??3000));
  for(let i=1;i<days&&remaining>0;i++) {const amount=Math.min(remaining,receivables[i]);receivables[i]-=amount;advanced+=amount;fee+=amount*.025*(i/30);remaining-=amount;}
  receivables[0]+=advanced-fee;
 }
 let balance=opening;
 const daily=data.dates.map((date,i)=>{balance+=receivables[i]+incoming[i]-expenses[i];return {date,existing:receivables[i],newSales:incoming[i],promotionNet:promotionIncoming[i],expense:expenses[i],balance};});
 return {daily,fee,advanced,shifted,promotion:promotionPlan,min:Math.min(...daily.map(d=>d.balance)),end:balance,firstNegative:daily.find(d=>d.balance<0)?.date??null};
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
function evaluatePromotion(shop,data,options={}){
 const H=[30,60].includes(+options.horizon)?+options.horizon:60,base=simulate(shop,data,{...options,action:'none'});
 const baseMin=Math.min(...base.daily.slice(0,H).map(d=>d.balance));
 const plans=allPromotionPlans(shop,data,{...options,horizon:H});
 if(!plans.length)return {action:'promotion',label:'Criar promoção comercial',eligible:false,
  reason:'Este negócio não possui catálogo sintético por produto suficiente para estimar uma promoção.',params:{horizon:H},candidates:[]};
 const evaluated=plans.map(plan=>{const r=simulate(shop,data,{...options,action:'promotion',_promotionPlan:plan});
  const min=Math.min(...r.daily.slice(0,H).map(d=>d.balance)),improvement=min-baseMin;
  return {plan,result:r,min,improvement,useful:plan.eligible&&improvement>0.01&&plan.totals.cashInHorizon>0&&plan.totals.marginImpact>0};});
 evaluated.sort((a,b)=>Number(b.useful)-Number(a.useful)||b.improvement-a.improvement||a.plan.economicCost-b.plan.economicCost);
 const best=evaluated[0],p=best.plan,r=best.result;
 const reason=best.useful?`${p.proposal} melhora o maior aperto em ${brl(best.improvement)} dentro de ${H} dias, com margem incremental positiva.`:
  `A promoção foi recusada: ${p.reason} O efeito calculado não melhora o caixa no prazo sem prejudicar a margem.`;
 return {action:'promotion',label:'Promoção orientada pelo caixa',eligible:best.useful,reason,proposal:p.proposal,
  params:{promotionId:p.id,discountPct:p.params.discountPct,horizon:H},products:p.products,assumptions:p.assumptions,
  cautions:['Demanda adicional, adesão e canibalização são hipóteses sintéticas.',
   'O custo do estoque já comprado afeta a margem e o ativo de estoque; não foi lançado novamente como saída de caixa.',
   p.uncertainty.note],
  min:best.min,end:r.daily[H-1].balance,fee:p.economicCost,firstNegative:r.daily.slice(0,H).find(d=>d.balance<0)?.date??null,negativeDays:r.daily.slice(0,H).filter(d=>d.balance<0).length,
  improvement:round2(best.improvement),totals:p.totals,uncertainty:p.uncertainty,
  stockConsumed:p.products.reduce((s,x)=>s+x.stockConsumed,0),stockRemaining:p.products.reduce((s,x)=>s+x.stockRemaining,0),
  series:base.daily.slice(0,H).map((d,i)=>({date:d.date,withoutAction:round2(d.balance),withAction:round2(r.daily[i].balance),promotionNet:round2(r.daily[i].promotionNet)})),
  candidates:evaluated.map(x=>({id:x.plan.id,proposal:x.plan.proposal,discountPct:x.plan.params.discountPct,
   eligible:x.plan.eligible,useful:x.useful,reason:x.plan.reason,improvement:round2(x.improvement),
   marginImpact:x.plan.totals.marginImpact,cashInHorizon:x.plan.totals.cashInHorizon,economicCost:x.plan.economicCost}))};
}
function evaluateActions(shop,data,options={}){
 const actions=['none','negotiate','reduce','advance','mix'].map(action=>{const r=simulate(shop,data,{...options,action});return {action,label:LABELS[action],min:r.min,end:r.end,fee:r.fee,firstNegative:r.firstNegative,negativeDays:r.daily.filter(d=>d.balance<0).length};});
 // Compatibilidade: o front atual conhece cinco cartões. A integração nova pede
 // explicitamente includePromotion:true quando estiver pronta para a sexta ação.
 if(shop.commercial&&options.includePromotion===true)actions.push(evaluatePromotion(shop,data,options));
 return actions;
}
const LABELS={none:'Não fazer nada',negotiate:'Negociar com o fornecedor',reduce:'Reduzir gastos variáveis',advance:'Antecipar recebíveis',mix:'Ajustar o mix de venda',promotion:'Criar promoção comercial'};
const brl=v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
const dia=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace(/\.$/,'');
// O motor não só lista: escolhe UMA alternativa. Cobre o buraco com 20% de margem, pelo menor custo,
// e nunca recomenda pagar mais que o próprio buraco. Em margem, nunca antecipação/crédito.
function recommend(shop,data,options={}){
 const H=[30,60].includes(+options.horizon)?+options.horizon:60;
 const base=simulate(shop,data,{...options,action:'none'});
 const minH=r=>Math.min(...r.daily.slice(0,H).map(d=>d.balance));
 const baseMin=minH(base),buraco=Math.max(0,-baseMin),alvo=0.2*buraco;   // margem de segurança de 20%
 const hz=shop.uncertainty&&shop.uncertainty.horizons?shop.uncertainty.horizons[String(H)]:null;
 const mode=hz?hz.diagnosis:diagnose(shop,data,options);
 const probNeg=hz?hz.probNegative:(buraco>0?1:0);
 const k=Math.min(29,H-1);
 const pack=(action,params,r,cost,extra={})=>({action,label:LABELS[action],params,cost:Math.round(cost),buraco:Math.round(buraco),
  coversAmount:Math.round(minH(r)-baseMin),coveragePct:buraco>0?Math.round(100*(minH(r)-baseMin)/buraco):100,
  saldo30Impacto:Math.round(r.daily[k].balance-base.daily[k].balance),altMin:Math.round(minH(r)),mode,probNegative:probNeg,horizon:H,...extra});
 // 1. saudável ou risco baixo (<20%): não fazer nada
 if(mode==='saudavel'||probNeg<0.20)
  return pack('none',{},base,0,{justificativa:`O risco de faltar caixa nos próximos ${H} dias é baixo (${Math.round(probNeg*100)}%). Não é preciso agir agora — o sistema segue acompanhando e reavalia se o cenário mudar.`});
 // 2. margem: nunca antecipação/crédito; alavanca operacional
 if(mode==='margem'){const rr=simulate(shop,data,{...options,action:'reduce'});
  return pack('reduce',{},rr,rr.fee,{structural:true,
   justificativa:`O problema é de margem: no período as saídas superam as entradas. Antecipar ou tomar crédito não resolve — só adia com custo, porque no período seguinte o buraco volta maior e sem recebível para vender. Comece cortando gastos e revendo preço e mix; sozinho isso ameniza, mas o ajuste é estrutural.`});}
 // 3/4. timing: menor custo que cobre com margem; custo nunca acima do buraco
 const cand=[];
 for(const action of ['negotiate','reduce']){const r=simulate(shop,data,{...options,action});cand.push({action,params:{},r,cost:r.fee});}
 const promo=evaluatePromotion(shop,data,{...options,horizon:H});
 if(promo.eligible){const params=promo.params,r=simulate(shop,data,{...options,action:'promotion',...params});
  cand.push({action:'promotion',params,r,cost:promo.fee,promotion:promo});}
 // menor antecipação que cobre o buraco, limitada a 1,5× o buraco: antecipar muito além do
 // necessário esvazia o caixa dos meses seguintes, que é o que o desafio pede para evitar.
 const capAdv=Math.floor(1.5*buraco*100)/100;
 // Entre dois recebíveis consumidos, cada saldo diário varia linearmente com o principal.
 // Intersectar os limites de TODOS os dias encontra o mínimo, mesmo quando antecipar mais
 // piora um saldo posterior. Uma busca binária global não teria essa garantia.
 let lo=0,left=base;
 for(let i=1;i<data.dates.length&&lo<capAdv;i++){
  const hi=Math.min(capAdv,lo+shop.receivables[i]);
  if(hi<=lo)continue;
  const right=simulate(shop,data,{...options,action:'advance',advance:hi});
  let lower=lo,upper=hi;
  for(let j=0;j<Math.min(H,base.daily.length);j++){
   const balance=left.daily[j].balance,slope=(right.daily[j].balance-balance)/(hi-lo);
   if(Math.abs(slope)<1e-12){if(balance<alvo-1e-8){upper=-1;break;}}
   else if(slope>0)lower=Math.max(lower,lo+(alvo-balance)/slope);
   else upper=Math.min(upper,lo+(alvo-balance)/slope);
  }
  const amount=Math.ceil((lower-1e-8)*100)/100;
  if(amount<=upper+1e-8&&amount<=capAdv){
   const r=simulate(shop,data,{...options,action:'advance',advance:amount});
   if(minH(r)>=alvo-1e-8&&r.fee<=buraco){
    cand.push({action:'advance',params:{advance:amount},r,cost:r.fee});break;
   }
  }
  lo=hi;left=right;
 }
 // mix: procura a config mais barata que cobre, considerando desconto no Pix E redução de parcelamento
 const baseParts=shop.installments??4, parcelOpts=[...new Set([baseParts,3,2])].filter(v=>v<=baseParts);
 let mx=null;
 for(const parcels of parcelOpts)for(let d=0;d<=6.0001;d+=0.5){const r=simulate(shop,data,{...options,action:'mix',pixDiscount:d,maxInstall:parcels});if(minH(r)>=alvo-1){if(!mx||r.fee<mx.cost)mx={action:'mix',params:{pixDiscount:d,maxInstall:parcels},r,cost:r.fee};break;}}
 cand.push(mx||(()=>{const r=simulate(shop,data,{...options,action:'mix',pixDiscount:6,maxInstall:2});return{action:'mix',params:{pixDiscount:6,maxInstall:2},r,cost:r.fee};})());
 const mixDesc=pp=>{const b=[];if(pp.pixDiscount>0)b.push(`desconto de ${pp.pixDiscount}% no Pix`);if(pp.maxInstall<baseParts)b.push(`parcelamento em ${pp.maxInstall}x`);return b.length?` (${b.join(', ')})`:'';};
 const cobre=cand.filter(c=>minH(c.r)>=alvo-1&&c.cost<=buraco+1);
 if(cobre.length){cobre.sort((a,b)=>a.cost-b.cost||minH(b.r)-minH(a.r));const c=cobre[0];
  // quando cobrir custa mais que metade do buraco, agir se aproxima do próprio risco: melhor
  // acompanhar (eixo 3 do desafio — não empurrar ação cara para um aperto pequeno).
  if(c.cost>0.5*buraco)
   return pack('none',{},base,0,{watch:true,justificativa:`Cobrir esse aperto custaria ${brl(c.cost)}, perto do próprio risco de ${brl(buraco)} — agir custa quase o que se perderia. Não compensa agora: o sistema segue acompanhando e reavalia nos próximos dias, quando o quadro ficar mais claro.`});
  const p=c.action==='mix'?mixDesc(c.params):c.action==='advance'?` (${brl(c.params.advance)})`:c.action==='promotion'?` (${c.promotion.proposal})`:'';
  const promoExtra=c.action==='promotion'?{promotion:c.promotion}:{};
  return pack(c.action,c.params,c.r,c.cost,{...promoExtra,justificativa:`Seu caixa aperta${base.firstNegative?` em ${dia(base.firstNegative)}`:''}, faltando ${brl(buraco)}. ${LABELS[c.action]}${p} cobre esse buraco pelo menor custo (${c.cost>0?brl(c.cost):'sem custo'}) e mantém o saldo no positivo.`});}
 // 4. nada cobre sozinho: a mais barata que chega mais perto, dizendo que não fecha a conta
 const pool=cand.filter(c=>c.cost<=buraco+1);(pool.length?pool:cand).sort((a,b)=>minH(b.r)-minH(a.r)||a.cost-b.cost);const c=(pool.length?pool:cand)[0];
 const p=c.action==='mix'?mixDesc(c.params):c.action==='advance'?` (${brl(c.params.advance)})`:c.action==='promotion'?` (${c.promotion.proposal})`:'';
 const promoExtra=c.action==='promotion'?{promotion:c.promotion}:{};
 return pack(c.action,c.params,c.r,c.cost,{...promoExtra,partial:true,justificativa:`Nenhuma alternativa sozinha cobre o buraco de ${brl(buraco)}. A mais barata que chega mais perto é ${LABELS[c.action].toLowerCase()}${p}; ela não fecha a conta sozinha — combine com revisão de custos e prazos.`});
}
if(typeof module!=='undefined') module.exports={simulate,financialSnapshot,evaluateActions,evaluatePromotion,diagnose,recommend};
