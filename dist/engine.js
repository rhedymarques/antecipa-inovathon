/* Deterministic cash accounting over forecasts trained in Python. */
function simulate(shop,data,options={}) {
 const opening=Number(options.balance??shop.balance), shock=Number(options.shock??0)/100;
 const action=options.action??'none';
 const days=data.dates.length;
 const incoming=Array(days).fill(0), expenses=shop.expenses.map(e=>e.operating+e.supplier+e.fixed);
 const baseParts=shop.installments??4;   // nº de parcelas do crédito parcelado vem dos dados (credito_4x = 4)
 // Alavanca "ajustar o mix de venda": um desconto no Pix migra crédito -> Pix (6 p.p. por 1%); e o
 // parcelamento (2,3,4,6,12) muda o prazo do crédito parcelado. Reduzir parcelas acelera o caixa, mas
 // parte das vendas parceladas deixa de acontecer: -8% de volume por parcela abaixo da base (hipótese
 // declarada), somado ao custo da alavanca. Aumentar parcelas apenas alonga o prazo.
 let mix=shop.mix, parcels=baseParts, pixDisc=0, volFactor=1;
 if(action==='mix') {
  const d=Math.min(6,Math.max(0,Number(options.pixDiscount??0)));
  pixDisc=d/100; parcels=[2,3,4,6,12].includes(+options.maxInstall)?+options.maxInstall:baseParts;
  volFactor=Math.max(0,1-0.08*Math.max(0,baseParts-parcels));
  const credit=shop.mix[2]+shop.mix[3], migr=Math.min(credit,0.06*d);
  mix=[...shop.mix];
  if(credit>0){mix[2]-=migr*shop.mix[2]/credit;mix[3]-=migr*shop.mix[3]/credit;mix[0]+=migr;}
 }
 shop.forecast.forEach((gross,i)=>mix.forEach((share,m)=>{
  const parts=m===3?parcels:1, vol=m===3?volFactor:1;
  const net=gross*(1+shock)*share*(1-shop.rates[m])*(m===0?1-pixDisc:1)*vol;
  for(let p=0;p<parts;p++) { const due=i+shop.delays[m]+30*p; if(due<days) incoming[due]+=net/parts; }
 }));
 const receivables=[...shop.receivables]; let fee=0,advanced=0,shifted=0;
 if(action==='mix') shop.forecast.forEach(gross=>{
  fee+=gross*(1+shock)*mix[0]*pixDisc;                             // custo = desconto concedido no Pix
  fee+=gross*(1+shock)*mix[3]*(1-shop.rates[3])*(1-volFactor);     // + vendas parceladas perdidas ao reduzir parcelas
 });
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
const LABELS={none:'Não fazer nada',negotiate:'Negociar com o fornecedor',reduce:'Reduzir gastos variáveis',advance:'Antecipar recebíveis',mix:'Ajustar o mix de venda'};
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
 if(mode==='margem')
  return pack('reduce',{},simulate(shop,data,{...options,action:'reduce'}),0,{structural:true,
   justificativa:`O problema é de margem: no período as saídas superam as entradas. Antecipar ou tomar crédito não resolve — só adia com custo, porque no período seguinte o buraco volta maior e sem recebível para vender. Comece cortando gastos e revendo preço e mix; sozinho isso ameniza, mas o ajuste é estrutural.`});
 // 3/4. timing: menor custo que cobre com margem; custo nunca acima do buraco
 const cand=[];
 for(const action of ['negotiate','reduce'])cand.push({action,params:{},r:simulate(shop,data,{...options,action}),cost:0});
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
  const p=c.action==='mix'?mixDesc(c.params):c.action==='advance'?` (${brl(c.params.advance)})`:'';
  return pack(c.action,c.params,c.r,c.cost,{justificativa:`Seu caixa aperta${base.firstNegative?` em ${dia(base.firstNegative)}`:''}, faltando ${brl(buraco)}. ${LABELS[c.action]}${p} cobre esse buraco pelo menor custo (${c.cost>0?brl(c.cost):'sem custo'}) e mantém o saldo no positivo.`});}
 // 4. nada cobre sozinho: a mais barata que chega mais perto, dizendo que não fecha a conta
 const pool=cand.filter(c=>c.cost<=buraco+1);(pool.length?pool:cand).sort((a,b)=>minH(b.r)-minH(a.r)||a.cost-b.cost);const c=(pool.length?pool:cand)[0];
 const p=c.action==='mix'?mixDesc(c.params):c.action==='advance'?` (${brl(c.params.advance)})`:'';
 return pack(c.action,c.params,c.r,c.cost,{partial:true,justificativa:`Nenhuma alternativa sozinha cobre o buraco de ${brl(buraco)}. A mais barata que chega mais perto é ${LABELS[c.action].toLowerCase()}${p}; ela não fecha a conta sozinha — combine com revisão de custos e prazos.`});
}
if(typeof module!=='undefined') module.exports={simulate,financialSnapshot,evaluateActions,diagnose,recommend};
