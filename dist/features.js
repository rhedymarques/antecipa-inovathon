let coverage='complete';
function setCoverage(value){
 if(!['complete','payments'].includes(value))throw Error('Cobertura inválida');
 coverage=value;action='none';$('planStatus').textContent='';render();
}
function renderCopilot(){
 const complete=coverage==='complete';
 $('coverage').value=coverage;
 $('coverageNote').textContent=complete?'Saldo e despesas fictícios disponíveis. Open Finance, DDA e informações do lojista são representados por dados locais de demonstração. Nenhuma conta está conectada.':'Só pagamentos e recebíveis estão disponíveis. Sem saldo e saídas, não é possível concluir se haverá falta de caixa.';
 $('historyNote').textContent=shop.coldStart?'Pouco histórico: 14 dias próprios + modelo de 18 negócios sintéticos do mesmo segmento. Estimativa inicial, ainda sem validação independente.':`${shop.historyDays} dias de histórico sintético · modelo individual · referência em 15 set 2026`;
 $('balance').disabled=!complete;
 document.querySelector('.actions').hidden=!complete;
 document.querySelector('.workspace').classList.toggle('limited',!complete);
 $('chartHeading').textContent=complete?'O caminho do seu caixa':'Entradas que conseguimos enxergar';
 document.querySelector('.legend').hidden=!complete;
 if(!complete){
  const h=Number($('horizon').value),a=base.daily.slice(0,h),known=a.reduce((s,d)=>s+d.existing,0),pred=a.reduce((s,d)=>s+d.newSales,0);
  $('metrics').innerHTML=[['Recebíveis existentes',money(known),'Das vendas já realizadas'],['Novas entradas previstas',money(pred),'Vendas futuras liquidadas no período'],['Saldo de caixa','Não disponível','Falta informar o saldo inicial'],['Risco de falta de caixa','Não avaliado','Faltam despesas e outras entradas']].map(([l,v,s])=>`<article class="metric"><span class="label">${l}</span><strong class="${v.length>16?'text-value':''}">${v}</strong><small>${s}</small></article>`).join('');
  let total=0;const vals=a.map(d=>total+=d.existing+d.newSales);const max=Math.max(1,...vals),W=850,H=260,L=75,B=35;
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><title>Entradas acumuladas; não representa saldo de caixa.</title>${[0,.25,.5,.75,1].map(f=>`<line x1="${L}" x2="830" y1="${H-B-f*(H-B-20)}" y2="${H-B-f*(H-B-20)}" stroke="#e4edf1"/><text x="65" y="${H-B-f*(H-B-20)+4}" text-anchor="end" font-size="12" fill="#607585">${(f*max/1000).toFixed(1)} mil</text>`).join('')}<polyline fill="none" stroke="#089b8b" stroke-width="3" points="${vals.map((v,i)=>`${L+i*755/(h-1)},${H-B-v/max*(H-B-20)}`).join(' ')}"/><text x="75" y="255" font-size="12" fill="#607585">${day(a[0].date)}</text><text x="790" y="255" font-size="12" fill="#607585">${day(a[h-1].date)}</text></svg>`;
  $('chart').setAttribute('aria-label',`Entradas acumuladas em ${h} dias: ${money(known+pred)}. Saldo e risco não avaliados por falta de dados.`);
  $('insight').textContent='Entradas acumuladas não são saldo disponível. Pix fora do provedor, outras adquirentes e despesas precisam ser conciliados para uma visão do negócio.';
  $('copilot').innerHTML='<div><p class="eyebrow">COPILOTO · PRÓXIMO PASSO</p><h2>Complete a visão antes de decidir.</h2><p>Temos pagamentos, mas ainda faltam saldo e compromissos. Inclua essas informações para avaliar o caixa.</p></div><button id="completeDemo">Usar dados complementares simulados</button>';
  $('completeDemo').onclick=()=>setCoverage('complete');$('comparison').hidden=true;return;
 }
 $('comparison').hidden=false;
 const first=base.daily.find(d=>d.balance<0),alternatives=evaluateActions(shop,DATA,opts());
 const operational=alternatives.filter(a=>['reduce','negotiate'].includes(a.action)&&a.min>base.min+.01).sort((a,b)=>b.min-a.min||b.end-a.end);
 const suggested=first&&operational.length?operational[0]:null;
 const H=Number($('horizon').value),u=shop.uncertainty,hz=u.horizons[String(H)];
 const mode=hz.diagnosis,margem=mode==='margem';   // diagnóstico mais frequente entre os cenários
 const modeName={margem:'MARGEM',timing:'TIMING',saudavel:'SAUDÁVEL'}[mode];
 const modeExplain={
  margem:'Diagnóstico de margem: em 90 dias as saídas superam as entradas. Antecipar recebíveis não resolve — só adianta um dinheiro que já é seu e ainda cobra taxa, empurrando o aperto para frente. Aqui o caminho é preço, mix de recebimento, custo ou volume, não crédito.',
  timing:'Diagnóstico de timing: em 90 dias entra mais do que sai, mas o dinheiro chega depois das contas. Reorganizar prazos e recebimentos tende a ajudar.',
  saudavel:'Diagnóstico saudável: sem descompasso predominante nos cenários deste horizonte.'
 }[mode];
 const X=Math.round(hz.probPositiveClose*100),Y=Math.round(hz.probNegative*100);
 const frase=Y>0&&hz.firstNegativeDay
  ?`Nos próximos ${H} dias, você tem ${X}% de chance de fechar o mês no azul. Mas há ${Y}% de risco de o saldo ficar negativo no dia ${day(hz.firstNegativeDay)}.`
  :`Nos próximos ${H} dias, você tem ${X}% de chance de fechar o mês no azul, e o risco de o saldo ficar negativo é baixo (${Y}%).`;
 const recommendation=suggested?`Vale avaliar: ${choices.find(c=>c[0]===suggested.action)[1].toLowerCase()}. É a alternativa operacional com maior melhora do menor saldo entre as hipóteses simuladas.`:'Revise compromissos e premissas com o lojista antes de assumir novas obrigações.';
 const freqPct=Math.round(hz.diagnosisFreq[mode]*100);
 const statLine=`Diagnóstico ${modeName} em ${freqPct}% dos ${u.scenarios} cenários${hz.medianHole<0?`; buraco mediano ${money(hz.medianHole)}, p95 ${money(hz.p95Hole)}`:''}.`;
 $('copilot').innerHTML=`<div><p class="eyebrow">COPILOTO · DIAGNÓSTICO: ${modeName}</p><h2>${frase}</h2><p>${modeExplain}${margem?'':' '+recommendation}</p><p>${statLine}</p><p class="small">${shop.coldStart?'Pouco histórico: trate a projeção como ponto de partida. ':''}Probabilidades e diagnóstico vêm dos ${u.scenarios} cenários do modelo, calculados em cada cenário. Não há monitoramento em segundo plano nem contratação automática.</p></div>${suggested?'<button id="trySuggestion">Simular alternativa sugerida</button>':''}`;
 if(suggested)$('trySuggestion').onclick=()=>{action=suggested.action;$('planStatus').textContent='';render();};
 const ordered=[...alternatives].sort((a,b)=>a.fee-b.fee);   // da mais barata para a mais cara; "não fazer nada" (custo 0) sempre presente
 $('comparisonRows').innerHTML=ordered.map(a=>{const veto=margem&&a.action==='advance';return `<tr><td>${choices.find(c=>c[0]===a.action)[1]}${veto?' <span class="tag-warn">não recomendado</span>':''}</td><td class="${a.min<0?'negative':''}">${money(a.min)}</td><td>${a.negativeDays} dias</td><td>${money(a.fee)}</td><td>${money(a.end)}</td><td><button class="secondary compare" data-action="${a.action}" ${action===a.action?'disabled':''}>${action===a.action?'Em exibição':'Simular'}</button></td></tr>`;}).join('');
 document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{action=el.dataset.action;$('planStatus').textContent='';render();});
 $('comparisonNote').textContent=margem?'Modo margem: antecipar recebíveis não fecha a conta — só adia o problema e cobra taxa. Priorize preço, mix de recebimento, custo e volume antes de assumir crédito.':(alternatives.every(a=>a.min<0)?'Nenhuma alternativa isolada elimina todos os dias negativos neste cenário. Rever gastos, prazos e operação continua necessário. Antecipar só desloca entradas e gera custo.':'Compare também a viabilidade operacional. Uma hipótese favorável não garante o resultado real.');
 // Recomendação: o copiloto escolhe UMA alternativa (acima da tabela)
 const rec=recommend(shop,DATA,{...opts(),horizon:H});
 const bp=shop.installments??4,mb=[];if(rec.params.pixDiscount>0)mb.push(`desconto de ${rec.params.pixDiscount}% no Pix`);if(rec.params.maxInstall!=null&&rec.params.maxInstall<bp)mb.push(`parcelamento em ${rec.params.maxInstall}x`);
 const pt=rec.action==='mix'?` — ${mb.join(', ')||'ajuste de mix'}`:rec.action==='advance'?` — ${money(rec.params.advance)}`:'';
 const stats=rec.action==='none'?'':`<ul class="reco-stats"><li>Cobre ${rec.coveragePct}% do buraco${rec.buraco?' ('+money(rec.buraco)+')':''}</li><li>Custo: ${rec.cost>0?money(rec.cost):'sem custo'}</li><li>Impacto no saldo em 30 dias: ${money(rec.saldo30Impacto)}</li></ul>`;
 $('recommendation').innerHTML=`<p class="eyebrow">O COPILOTO RECOMENDA</p><div class="reco-head"><strong>${rec.label}${pt}</strong>${rec.cost>0?`<span class="reco-cost">custo ${money(rec.cost)}</span>`:'<span class="reco-cost free">sem custo</span>'}</div><p>${rec.justificativa}</p>${stats}${rec.action==='none'?'':'<button id="applyReco">Simular esta recomendação</button>'}`;
 if(rec.action!=='none')$('applyReco').onclick=()=>{if(rec.action==='mix'){$('pixDiscount').value=rec.params.pixDiscount;$('maxInstall').value=rec.params.maxInstall;}if(rec.action==='advance')$('advance').value=rec.params.advance;action=rec.action;$('planStatus').textContent='';render();};
}
function customDetail(){
 if(tab==='cash'&&coverage==='payments'){
  $('detail').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Recebíveis existentes</th><th>Novas entradas previstas</th></tr></thead><tbody>${base.daily.slice(0,Number($('horizon').value)).map(d=>`<tr><td>${day(d.date)}</td><td>${money(d.existing)}</td><td>${money(d.newSales)}</td></tr>`).join('')}</tbody></table></div><p class="small">Saídas e saldo omitidos: dados complementares indisponíveis neste modo.</p>`;return true;
 }
 if(tab==='finance'){
  if(coverage==='payments'){$('detail').innerHTML='<p>Para calcular ciclo financeiro, NCG e tesouraria, precisamos de estoque, prazos de fornecedores, obrigações e saldo. Ative os dados complementares simulados.</p>';return true;}
  const f=shop.finance,s=financialSnapshot(shop,Number($('balance').value),Number($('shock').value));
  $('detail').innerHTML=`<div class="finance-cards"><article><span>Ciclo financeiro</span><strong>${s.cycle.toFixed(1)} dias</strong><small>${f.pme} de estoque + ${s.pmr.toFixed(1)} para receber − ${f.pmp} para pagar</small></article><article><span>Necessidade de capital de giro</span><strong>${money(s.ncg)}</strong><small>Estoque + contas a receber − obrigações operacionais</small></article><article><span>Saldo de tesouraria</span><strong>${money(s.st)}</strong><small>Saldo informado − dívidas financeiras de curto prazo</small></article></div><div class="model-grid"><div><h3>O que está por trás dos números</h3><p>Estoque declarado: ${money(f.stock)}<br>Contas a receber: ${money(s.receivables)}<br>Obrigações operacionais: ${money(f.operatingLiabilities)}<br>Dívidas financeiras: ${money(f.financialDebt)}</p><p class="small">Contas a receber incluem parcelas existentes após os 60 dias do gráfico. Saldos contábeis fictícios na data de referência. Não são uma soma das despesas futuras. PMR estimado pelo mix e pelos prazos contratuais simplificados; PME e PMP informados pelo lojista. Não se infere insolvência ou custo da dívida apenas pelo sinal da tesouraria.</p></div><div><h3>Mais vendas podem exigir mais capital</h3><p>Com a hipótese de vendas em <strong>${$('shock').value}%</strong>, a variação ilustrativa de NCG positiva é de <strong>${money(s.incremental)}</strong>.</p><p class="small">Cálculo didático: NCG positiva × variação de vendas, mantendo prazos, margens e proporções constantes. Não é uma relação automática. Esta sensibilidade é separada e não é descontada novamente do fluxo diário. O controle de vendas não altera automaticamente compras ou despesas.</p><p class="small">ROE, retenção de lucros, EBITDA e Capex não estão disponíveis neste conjunto. Não exibimos uma taxa de crescimento sustentável ou fluxo de caixa livre sem esses dados.</p></div></div>`;return true;
 }
 if(tab==='model'&&shop.coldStart){
  $('detail').innerHTML=`<div class="model-grid"><div><h3>Uma primeira estimativa, mesmo com pouco histórico</h3><p>Este negócio tem <strong>14 dias de vendas próprias</strong>. A previsão vem de uma Random Forest de 100 árvores treinada com <strong>18 negócios sintéticos de alimentação</strong> e ${shop.trainSamples} exemplos.</p><p>O modelo combina calendário, média e variação das vendas recentes. Nenhum dado pessoal ou histórico de outro cliente real é utilizado.</p></div><div><h3>O que ainda precisa ser validado</h3><p>Não há avaliação independente deste modelo de início de operação. Os erros medidos nos outros três negócios não se aplicam a este.</p><p class="small">Em um piloto real, seria necessário validar em empresas não usadas no treino, verificar comparabilidade dos perfis e substituir gradualmente a referência do grupo pelo histórico do próprio negócio. Não há integração com Cielo Farol.</p><a class="download" href="prototipo-faro.zip" download>Baixar código e dados</a></div></div>`;return true;
 }
 if(tab==='source'){
  $('detail').innerHTML=`<div class="source-grid"><div><h3>Camada 1 · Pagamentos e recebíveis</h3><p>Vendas, modalidades, taxas, parcelamentos e agenda de liquidação simulam categorias de dados de uma adquirente. Não reproduzem sistemas internos da Cielo.</p><p class="small">Pix D+0; débito D+1; crédito D+30; 3 parcelas em D+30/60/90. Dias corridos, sem feriados, estornos ou chargebacks. Pix externo e outras adquirentes não são automaticamente observados.</p><a class="download" href="pagamentos_sinteticos.csv" download>Baixar pagamentos sintéticos</a></div><div><h3>Camada 2 · Informações complementares</h3><p>Saldo: registro bancário fictício. Fornecedores: compromissos fictícios, como uma possível agenda obtida por DDA. Operação, estoque, prazos e custos fixos: informações declaradas pelo lojista.</p><p class="small">Open Finance e DDA são integrações propostas, não implementadas. Compartilhar dados reais por Open Finance depende de consentimento e integração adequada. DDA e dados bancários não cobrem necessariamente todas as obrigações futuras. A demo não pede autorização bancária nem envia dados.</p><a class="download" href="alinhamento-proposta.md" download>Notas da proposta e limites</a></div></div>`;return true;
 }
 return false;
}
