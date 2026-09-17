/* Front independente: lê dados sintéticos e usa o motor financeiro existente. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const money = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Math.abs(Number(value)) > 0 && Math.abs(Number(value)) < 1 ? 2 : 0, maximumFractionDigits: Math.abs(Number(value)) > 0 && Math.abs(Number(value)) < 1 ? 2 : 0 }).format(Number(value))
    : 'Indisponível';
  const pct = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? `${Math.round(Number(value) * 100)}%` : 'Indisponível';
  const day = iso => {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'data não informada';
    const [, month, date] = iso.split('-');
    return `${date}/${month}`;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const state = { data: null, shop: null, horizon: 60, area: 'antecipa', actions: [], recommendation: null, selectedAction: null, notificationSeen: false };

  const actionMeta = {
    none: { title: 'Não fazer nada', summary: 'Veja como o caixa evolui sem uma nova medida.', how: 'Nenhuma mudança é aplicada ao fluxo projetado.', caution: 'Um risco identificado permanece no cenário.' },
    negotiate: { title: 'Conversar com o fornecedor', summary: 'Simule deslocar um pagamento por sete dias.', how: 'O vencimento do próximo fornecedor é deslocado em sete dias na simulação. A despesa continua no caixa futuro.', caution: 'Depende do aceite do fornecedor; ausência de multa é hipótese da demonstração.' },
    reduce: { title: 'Rever gastos variáveis', summary: 'Simule uma redução temporária de custos.', how: 'A simulação reduz 10% dos gastos operacionais variáveis do período.', caution: 'É uma hipótese: uma redução real pode afetar a operação e as vendas.' },
    advance: { title: 'Antecipar parte dos recebíveis', summary: 'Receba antes e compare o custo e as entradas futuras.', how: 'O motor traz para hoje parte da agenda de recebíveis, desconta a taxa ilustrativa e retira esses valores das datas originais.', caution: 'A agenda exibida não comprova elegibilidade real. Taxas, prazos e disponibilidade dependem de uma oferta efetiva.' },
    mix: { title: 'Ajustar as formas de pagamento', summary: 'Simule incentivo ao Pix e menos parcelas nas vendas futuras.', how: 'O motor simula a migração de parte das vendas no crédito para Pix e altera o prazo das novas vendas parceladas. O desconto concedido no Pix aparece como custo.', caution: 'A migração de clientes é uma hipótese; o desconto tem custo e não garante mudança real no comportamento de compra.' }
  };
  const actionSteps = {
    none: ['Acompanhe a previsão nos próximos dias.', 'Reavalie se aparecer um novo alerta.'],
    negotiate: ['Confira o vencimento e o valor do próximo pagamento ao fornecedor.', 'Converse com o fornecedor sobre um prazo de sete dias e confirme eventuais encargos.', 'Atualize o planejamento apenas se o novo prazo for aceito.'],
    reduce: ['Revise os gastos variáveis previstos para o período.', 'Identifique cortes temporários que não prejudiquem as vendas.', 'Acompanhe o saldo e ajuste o plano se a economia real for menor que a simulada.'],
    advance: ['Confira quais recebíveis estão disponíveis para antecipação.', 'Peça a taxa e o valor líquido de uma oferta real antes de decidir.', 'Compare também o caixa nas datas em que esses recebíveis deixariam de entrar.'],
    mix: ['Defina o desconto no Pix e o limite de parcelas que pretende testar.', 'Confira o custo do desconto e comunique as condições aos clientes.', 'Observe a adesão real e reavalie o caixa antes de manter a campanha.']
  };

  function currentHorizon() {
    return state.shop?.uncertainty?.horizons?.[String(state.horizon)] ?? null;
  }
  function currentQuantiles() {
    return state.shop?.uncertainty?.quantiles ?? null;
  }
  function shopDiagnosis() {
    const h = currentHorizon();
    return ['timing', 'margem', 'saudavel'].includes(h?.diagnosis) ? h.diagnosis : null;
  }
  function options() {
    const pixDiscount = Number($('pixRange').value);
    const maxInstall = [3, 4, 6, 12][Number($('installmentsRange').value)] ?? 3;
    return { pixDiscount, maxInstall };
  }
  function evaluate(extra = options()) {
    if (!state.shop || !state.data || typeof evaluateActions !== 'function') return [];
    try {
      const result = evaluateActions(state.shop, state.data, extra);
      return Array.isArray(result) ? result.filter(item => item && typeof item.action === 'string') : [];
    } catch (error) {
      console.error('Não foi possível avaliar as alternativas:', error);
      return [];
    }
  }
  function getRecommendation() {
    if (!state.shop || !state.data || typeof recommend !== 'function') return null;
    try { return recommend(state.shop, state.data, { horizon: state.horizon }); }
    catch (error) { console.error('Não foi possível obter a recomendação:', error); return null; }
  }
  function comparisonOptions() {
    const rec = state.recommendation;
    return {
      pixDiscount: finite(rec?.params?.pixDiscount) ?? 0.5,
      maxInstall: finite(rec?.params?.maxInstall) ?? 3,
      advance: finite(rec?.params?.advance) ?? Math.max(0, finite(rec?.buraco) ?? 0)
    };
  }
  function actionTitle(item) {
    return item?.label || item?.title || actionMeta[item?.action]?.title || 'Outra alternativa';
  }
  function actionSummary(item) {
    return item?.summary || item?.description || actionMeta[item?.action]?.summary || 'Consulte como esta alternativa altera o caixa projetado.';
  }
  function actionCost(item) {
    return finite(item?.cost ?? item?.fee) ?? 0;
  }
  function improvement(item, baseline) {
    const value = finite(item?.min);
    const base = finite(baseline?.min);
    return value !== null && base !== null ? value - base : null;
  }
  function changeLabel(delta) {
    if (delta === null) return ['Mudança do pior saldo', 'Indisponível'];
    if (delta <= 0.01) return ['Efeito no aperto', 'Não resolve neste caso'];
    if (delta > 0.01) return ['Melhora do pior saldo', money(delta)];
  }
  function noHelpReason(action, context = {}) {
    if (action === 'none') return 'Sem uma nova medida, o dia de aperto permanece.';
    if (action === 'negotiate') return 'Mudar este vencimento não altera o pior dia do caixa.';
    if (action === 'reduce') return 'O corte testado não é suficiente para afastar o aperto.';
    if (action === 'advance') return shopDiagnosis() === 'margem'
      ? 'Antecipar só muda a data do dinheiro e acrescenta custo.'
      : 'Trazer estes recebíveis para hoje não melhora o pior dia; há uma taxa.';
    if (action === 'mix') return finite(context.pixDiscount) === 0 && Number(context.maxInstall) === 3
      ? 'Sem mudar desconto ou parcelas, o caixa continua igual.'
      : 'A mudança testada não traz dinheiro suficiente antes do aperto.';
    return 'Esta mudança não melhora o pior dia na simulação.';
  }
  function scrollTop() { $('appContent').scrollTo({ top: 0, behavior: 'smooth' }); }

  function renderNavigation() {
    document.querySelectorAll('[data-area]').forEach(button => {
      const active = button.dataset.area === state.area;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('antecipaView').hidden = state.area !== 'antecipa';
    $('placeholderView').hidden = state.area === 'antecipa';
    $('detailView').hidden = true;
    if (state.area !== 'antecipa') {
      const labels = { inicio: ['⌂', 'Início'], vendas: ['▥', 'Vendas'], caixa: ['▤', 'Caixa diário'] };
      const [icon, title] = labels[state.area] || labels.inicio;
      $('placeholderView').innerHTML = `<div class="placeholder-art" aria-hidden="true">${icon}</div><h1>${title}</h1><p>Esta área representa a navegação já conhecida do aplicativo. A demonstração desenvolvida pela equipe está na nova aba Antecipa.</p><button type="button" id="openAntecipa">Abrir Antecipa</button>`;
      $('openAntecipa').addEventListener('click', () => navigate('antecipa'));
    }
  }
  function navigate(area) {
    state.area = area;
    renderNavigation();
    scrollTop();
  }

  function renderChart() {
    const quantiles = currentQuantiles();
    const dates = state.data?.dates;
    const n = Math.min(state.horizon, dates?.length ?? 0);
    const required = ['q2_5', 'q50', 'q97_5'];
    if (!n || !required.every(key => Array.isArray(quantiles?.[key]) && quantiles[key].length >= n && quantiles[key].slice(0, n).every(value => finite(value) !== null))) {
      $('chart').innerHTML = '<div class="chart-empty">A faixa de previsão ainda não está disponível para este negócio.</div>';
      $('chart').setAttribute('aria-label', 'Faixa de previsão indisponível');
      return;
    }
    const q = key => quantiles[key].slice(0, n).map(Number);
    const lower95 = q('q2_5'), median = q('q50'), upper95 = q('q97_5');
    const all = [...lower95, ...upper95, 0];
    const lo = Math.min(...all), hi = Math.max(...all), pad = Math.max(1000, (hi - lo) * .1);
    const min = lo - pad, max = hi + pad;
    const W = 360, H = 220, L = 48, R = 10, T = 12, B = 32;
    const x = i => L + i * (W - L - R) / Math.max(1, n - 1);
    const y = value => T + (max - value) * (H - T - B) / (max - min);
    const line = values => values.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const band = (lower, upper) => `${line(upper)} ${lower.map((_, i) => `L${x(n - 1 - i).toFixed(1)},${y(lower[n - 1 - i]).toFixed(1)}`).join(' ')} Z`;
    const grid = [0, .5, 1].map(f => {
      const value = min + (max - min) * f;
      return `<line x1="${L}" x2="${W - R}" y1="${y(value)}" y2="${y(value)}" stroke="#e5eff5"/><text x="${L - 6}" y="${y(value) + 3}" text-anchor="end" font-size="9" fill="#8096a5">${Math.round(value / 1000)} mil</text>`;
    }).join('');
    const zero = y(0);
    const firstNegative = currentHorizon()?.firstNegativeDay;
    const markerIndex = shopDiagnosis() !== 'saudavel' && typeof firstNegative === 'string' ? dates.slice(0, n).indexOf(firstNegative) : -1;
    const marker = markerIndex >= 0 ? `<line x1="${x(markerIndex)}" x2="${x(markerIndex)}" y1="${T}" y2="${H - B}" stroke="#df8a37" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${x(markerIndex)}" cy="${y(median[markerIndex])}" r="4" fill="#df8a37"/><text x="${Math.min(W - 38, Math.max(L + 20, x(markerIndex)))}" y="${T + 9}" text-anchor="middle" font-size="9" font-weight="700" fill="#ae671d">${day(firstNegative)}</text>` : '';
    $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${grid}<line x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}" stroke="#66849b" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${L - 6}" y="${zero - 3}" text-anchor="end" font-size="9" fill="#566f81">zero</text><path d="${band(lower95, upper95)}" fill="#d8eaf7"/><path d="${line(median)}" fill="none" stroke="#0877bf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${marker}<text x="${L}" y="${H - 8}" font-size="9" fill="#7b92a3">${day(dates[0])}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="9" fill="#7b92a3">${day(dates[n - 1])}</text></svg>`;
    $('chart').setAttribute('aria-label', `Saldo projetado por ${n} dias. Linha central e faixa de 95%. ${markerIndex >= 0 ? `Primeiro dia de risco destacado: ${day(firstNegative)}.` : 'Sem primeiro dia negativo destacado.'}`);
  }

  function renderStatus() {
    const h = currentHorizon(), diagnosis = shopDiagnosis();
    const card = document.querySelector('.status-card');
    card.classList.remove('timing', 'margem');
    if (diagnosis) card.classList.add(diagnosis);
    if (!h || !diagnosis) {
      $('statusContent').innerHTML = '<div class="status-top"><span class="status-symbol">?</span><h2 id="statusTitle">Análise indisponível</h2></div><p class="status-copy">O motor ainda não forneceu um diagnóstico para este período.</p>';
      return;
    }
    const config = {
      saudavel: { symbol: '✓', title: 'Seu cenário de caixa é positivo', copy: `No fim de ${state.horizon} dias, ${pct(h.probPositiveClose)} dos cenários simulados fecham com saldo positivo. Siga acompanhando a previsão.` },
      timing: { symbol: '!', title: 'Atenção ao prazo dos pagamentos', copy: `${pct(h.probNegative)} dos cenários simulados passam por saldo negativo em algum momento dos próximos ${state.horizon} dias. ${h.firstNegativeDay ? `O dia de maior concentração do primeiro aperto é ${day(h.firstNegativeDay)}.` : 'Nenhum dia negativo previsto foi identificado como o mais frequente.'}` },
      margem: { symbol: '!', title: 'Entradas podem não cobrir as saídas', copy: `${pct(h.diagnosisFreq?.margem)} dos cenários foram classificados como problema de margem. Antecipar recebíveis não corrige esse desequilíbrio e acrescenta custo.` }
    }[diagnosis];
    const hole = finite(h.medianHole);
    if (diagnosis === 'saudavel') {
      $('statusContent').innerHTML = `<div class="status-top"><span class="status-symbol" aria-hidden="true">${config.symbol}</span><h2 id="statusTitle">${config.title}</h2></div><p class="status-copy">${config.copy}</p>`;
      return;
    }
    $('statusContent').innerHTML = `<div class="status-top"><span class="status-symbol" aria-hidden="true">${config.symbol}</span><h2 id="statusTitle">${config.title}</h2></div><p class="status-copy">${config.copy}</p><div class="status-stat"><div class="stat-box"><strong>${pct(h.probNegative)}</strong><span>cenários com algum saldo negativo</span></div><div class="stat-box"><strong>${hole !== null ? money(Math.abs(hole)) : 'Indisponível'}</strong><span>buraco mediano, quando ocorre</span></div></div><button class="status-cta" type="button" id="seeOptions">Ver o que fazer ↓</button>`;
    $('seeOptions')?.addEventListener('click', () => $('recommendationSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function renderExplanation() {
    const h = currentHorizon(), diagnosis = shopDiagnosis();
    const content = $('explanationContent');
    if (!h || !diagnosis) { content.textContent = 'Ainda não há dados suficientes para explicar este cenário.'; return; }
    const text = diagnosis === 'saudavel'
      ? `A previsão indica um período favorável. ${h.firstNegativeDay === null ? (finite(h.probNegative) === 0 ? 'Nenhum dia negativo apareceu nas simulações deste período.' : 'Não há uma data predominante para eventual aperto.') : ''} Continue acompanhando o caixa.`
      : diagnosis === 'timing'
        ? `Alguns pagamentos podem chegar antes do dinheiro das vendas. ${h.firstNegativeDay ? `O aperto aparece com mais frequência em ${day(h.firstNegativeDay)}.` : ''} Há tempo para comparar caminhos.`
        : 'As saídas previstas podem superar as entradas ao longo do período. Adiantar dinheiro muda a data do recebimento, mas não reduz as despesas.';
    content.textContent = text;
    renderMethod();
  }

  function renderMethod() {
    const shop = state.shop;
    const method = shop?.uncertainty?.method;
    const metrics = shop?.metrics;
    const importance = Array.isArray(shop?.importance) ? [...shop.importance].filter(item => finite(item?.value) !== null).sort((a, b) => b.value - a.value).slice(0, 3) : [];
    const frequencies = currentHorizon()?.diagnosisFreq;
    const frequencyText = frequencies ? `<p>Frequência dos diagnósticos: caixa saudável ${pct(frequencies.saudavel)}, problema de prazos ${pct(frequencies.timing)} e problema de margem ${pct(frequencies.margem)}.</p>` : '';
    const validation = shop?.coldStart
      ? '<p><strong>Pouco histórico:</strong> esta empresa ainda não tem validação independente. A previsão é um ponto de partida com maior incerteza.</p>'
      : finite(metrics?.mae) !== null && finite(metrics?.baselineMae) !== null
        ? `<p>No teste com dados sintéticos, o erro médio diário foi ${money(metrics.mae)}, ante ${money(metrics.baselineMae)} da referência simples. Isso não garante a mesma precisão em dados reais.</p>`
        : '<p>Não há comparação de erro disponível para este negócio.</p>';
    $('methodContent').innerHTML = `${frequencyText}${validation}${importance.length ? `<p>Variáveis com maior peso no modelo: ${importance.map(item => `${escapeHtml(item.name)} (${Math.round(Number(item.value) * 100)}%)`).join(', ')}. Peso estatístico não identifica causa.</p>` : ''}${method ? `<p>${escapeHtml(method)}</p>` : ''}`;
  }

  function renderRecommendation() {
    const rec = state.recommendation;
    if (!rec || typeof rec.action !== 'string') {
      $('recommendationContent').textContent = 'O motor ainda não forneceu uma recomendação para este período.';
      $('technicalContent').textContent = 'Não há justificativa técnica disponível para este período.';
      return;
    }
    const healthy = rec.mode === 'saudavel' || rec.action === 'none';
    const structural = rec.mode === 'margem' && rec.structural === true;
    const coverage = finite(rec.coveragePct);
    const shortReason = {
      none: 'Seu caixa segue positivo na maior parte dos cenários. Continue acompanhando.',
      negotiate: 'Vale conversar sobre um novo prazo para o próximo pagamento ao fornecedor.',
      reduce: 'Rever gastos variáveis pode aliviar o caixa neste período.',
      advance: 'Antecipar apenas a parte necessária dos recebíveis pode aliviar o aperto.',
      mix: 'Um pequeno ajuste nas formas de pagamento pode trazer dinheiro para mais cedo.'
    }[rec.action] || 'Veja a medida indicada para este período.';
    $('recommendationSection').classList.toggle('structural', structural);
    $('recommendationSection').classList.toggle('healthy', healthy);
    $('recommendationContent').innerHTML = `<h2 id="recommendationTitle">${escapeHtml(healthy ? 'Acompanhar o caixa' : actionMeta[rec.action]?.title || rec.label || 'Veja esta medida')}</h2>${structural ? '<p class="structural-alert"><strong>Esta medida ajuda, mas não resolve sozinha.</strong> O ajuste nas entradas e saídas precisa continuar.</p>' : ''}<p class="recommendation-reason">${escapeHtml(shortReason)}</p>${healthy ? '' : `<div class="recommendation-metrics"><div><strong>${money(finite(rec.cost))}</strong><span>custo estimado</span></div><div><strong>${money(finite(rec.coversAmount))}</strong><span>alívio no pior dia</span></div><div><strong>${coverage !== null ? `${Math.round(coverage)}%` : 'Indisponível'}</strong><span>do aperto coberto</span></div><div><strong>${money(finite(rec.saldo30Impacto))}</strong><span>mudança no saldo do dia 30</span></div></div><p class="small-note">Estimativas para comparação; o resultado real pode variar.</p>`}`;
    $('technicalContent').innerHTML = `<h3>Por que esta medida foi escolhida</h3><p>${escapeHtml(rec.justificativa || 'Justificativa indisponível.')}</p><p>Probabilidade de algum saldo negativo no cenário atual de ${state.horizon} dias: ${pct(rec.probNegative)}. Os efeitos das ações são simulações pontuais e não têm faixa probabilística recalculada.</p><h3>Limites dos ajustes</h3><p>O desconto no Pix, a mudança de parcelas e a antecipação são calculados pelo motor como hipóteses. Os controles de Pix e parcelamento são avaliados separadamente nesta tela. A promoção de estoque ainda não tem cálculo de demanda, margem ou entrada de caixa no motor.</p>`;
  }

  function renderActions() {
    const diagnosis = shopDiagnosis();
    const params = comparisonOptions();
    const evaluated = evaluate(params);
    const baseline = evaluated.find(item => item.action === 'none') || null;
    state.actions = evaluated;
    $('choicesIntro').textContent = 'Compare o que ajuda, o que não muda o resultado e o que pode piorar o caixa.';
    $('actionList').innerHTML = state.actions.length ? state.actions.map((item, index) => {
      const delta = improvement(item, baseline);
      const cost = actionCost(item);
      const [effectTitle, effectValue] = changeLabel(delta);
      const selected = state.recommendation?.action === item.action;
      const incompatible = diagnosis === 'margem' && item.action === 'advance';
      const assumption = item.action === 'mix' ? `Desconto no Pix: ${params.pixDiscount}%; até ${params.maxInstall} parcelas.` : item.action === 'advance' ? `Valor ilustrativo antecipado: ${money(params.advance)}.` : '';
      const reason = delta !== null && delta <= 0.01 ? `<p class="action-caution">${escapeHtml(noHelpReason(item.action, params))}</p>` : '';
      return `<button type="button" class="action-card ${item.action === 'none' ? 'baseline' : ''}" data-action-index="${index}"><div class="action-card-header"><div><span class="action-number">${item.action === 'none' ? 'REFERÊNCIA' : `CENÁRIO ${index}`} ${selected ? ' · SUGERIDA' : ''}</span><br><strong>${escapeHtml(actionTitle(item))}</strong></div><span class="action-arrow" aria-hidden="true">›</span></div><p>${escapeHtml(actionSummary(item))} ${escapeHtml(assumption)}</p>${reason}${incompatible ? '<p class="action-caution">Em problema de margem, esta opção é apenas uma comparação.</p>' : ''}<div class="action-metrics"><span>Custo estimado<b>${money(cost)}</b></span><span>${effectTitle}<b>${effectValue}</b></span></div></button>`;
    }).join('') : '<p class="support-copy">O motor ainda não retornou alternativas para este cenário.</p>';
    $('marginWarning').hidden = diagnosis !== 'margem';
    $('marginWarning').textContent = 'A antecipação aparece apenas como simulação comparativa. O motor não a recomenda para um problema de margem.';
    document.querySelectorAll('[data-action-index]').forEach(button => button.addEventListener('click', () => showDetail(Number(button.dataset.actionIndex))));
  }

  function showDetail(index) {
    const item = state.actions[index];
    if (!item) return;
    state.selectedAction = item.action;
    const baseline = state.actions.find(value => value.action === 'none');
    const meta = actionMeta[item.action] || {};
    const delta = improvement(item, baseline);
    const [effectTitle, effectValue] = changeLabel(delta);
    const end = finite(item.end), baseEnd = finite(baseline?.end);
    const endDelta = end !== null && baseEnd !== null ? end - baseEnd : null;
    const steps = actionSteps[item.action] || ['Confira as condições reais da alternativa.', 'Compare custos e efeitos futuros antes de decidir.'];
    $('detailContent').innerHTML = `<div class="detail-hero"><span class="eyebrow">ENTENDA A ALTERNATIVA</span><h1>${escapeHtml(actionTitle(item))}</h1><p>${escapeHtml(actionSummary(item))}</p></div><div class="detail-metrics"><div class="stat-box"><strong>${money(actionCost(item))}</strong><span>custo direto simulado</span></div><div class="stat-box"><strong>${effectValue}</strong><span>${effectTitle.toLowerCase()}</span></div></div><div class="detail-card"><h2>Antes e depois · hipótese de 60 dias</h2><div class="before-after"><div><span>Sem a medida</span><strong>${money(finite(baseline?.min))}</strong><small>pior saldo simulado</small></div><span aria-hidden="true">→</span><div><span>Com a medida</span><strong>${money(finite(item.min))}</strong><small>pior saldo simulado</small></div></div><p class="small-note">Risco de algum saldo negativo no cenário-base de ${state.horizon} dias: ${pct(currentHorizon()?.probNegative)}. A faixa probabilística não foi recalculada para esta ação.</p></div><div class="detail-card"><h2>Como funciona</h2><p>${escapeHtml(meta.how || 'Confira as hipóteses desta ação antes de decidir.')}</p></div><div class="detail-card"><h2>O que muda depois</h2><p>Ao final dos 60 dias da simulação, a diferença em relação a não fazer nada é ${endDelta !== null ? money(endDelta) : 'indisponível'}. ${finite(item.negativeDays) !== null ? `O fluxo simulado ainda tem ${Number(item.negativeDays)} dia(s) com saldo negativo.` : 'A quantidade de dias negativos não foi informada.'} Valores podem mudar com vendas, despesas e prazos reais.</p></div><div class="detail-card"><h2>Plano da sessão</h2><p>Passos para avaliar esta medida; nenhuma etapa é executada automaticamente.</p><ol class="plan-steps">${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div><div class="detail-card detail-caution"><h2>Antes de decidir</h2><p>${escapeHtml(meta.caution || 'Confira as condições reais e os efeitos sobre os próximos meses antes de agir.')}</p></div><p class="detail-footer">Esta tela explica uma simulação. Nenhuma negociação, antecipação ou contratação é executada aqui.</p>`;
    $('antecipaView').hidden = true;
    $('detailView').hidden = false;
    scrollTop();
  }
  function closeDetail() {
    $('detailView').hidden = true;
    $('antecipaView').hidden = false;
    scrollTop();
  }

  function renderSimulator() {
    $('pixValue').textContent = `${$('pixRange').value}%`;
    $('installmentsValue').textContent = `${options().maxInstall}×`;
    const renderAdjustment = (target, params) => {
      const items = evaluate(params);
      const base = items.find(item => item.action === 'none');
      const mix = items.find(item => item.action === 'mix');
      const delta = mix ? improvement(mix, base) : null;
      const [label, value] = changeLabel(delta);
      $(target).innerHTML = mix
        ? `<span>${label}: <strong>${value}</strong></span><span>Custo estimado: <strong>${money(actionCost(mix))}</strong></span>${delta !== null && delta <= 0.01 ? `<small>${escapeHtml(noHelpReason('mix', params))}</small>` : ''}`
        : '<span>Não foi possível comparar este ajuste agora.</span>';
    };
    renderAdjustment('installmentsResult', { pixDiscount: 0, maxInstall: options().maxInstall });
    renderAdjustment('pixResult', { pixDiscount: options().pixDiscount, maxInstall: 3 });
  }
  function renderStock() {
    const share = Number($('stockShareRange').value);
    const discount = Number($('stockDiscountRange').value);
    $('stockShareValue').textContent = `${share}%`;
    $('stockDiscountValue').textContent = `${discount}%`;
    $('stockResult').textContent = `Plano de campanha: separar ${share}% do estoque e oferecer ${discount}% de desconto. Antes de lançar, confira a margem e os produtos escolhidos. O efeito no caixa ainda não pode ser estimado nesta demonstração.`;
  }

  function renderAll() {
    state.recommendation = getRecommendation();
    const recommendedPix = finite(state.recommendation?.params?.pixDiscount);
    $('pixRange').value = String(recommendedPix ?? 0.5);
    const recommendedInstallments = finite(state.recommendation?.params?.maxInstall);
    $('installmentsRange').value = String(Math.max(0, [3, 4, 6, 12].indexOf(recommendedInstallments ?? 3)));
    renderChart();
    renderStatus();
    renderExplanation();
    renderRecommendation();
    const showChoices = shopDiagnosis() !== 'saudavel';
    $('choicesSection').hidden = !showChoices;
    $('simulatorSection').hidden = !showChoices;
    $('pixSection').hidden = !showChoices;
    $('stockSection').hidden = !showChoices;
    if (showChoices) {
      renderActions();
      renderSimulator();
      renderStock();
    } else {
      state.actions = [];
    }
    closeDetail();
  }
  function selectShop(id) {
    state.shop = state.data?.shops?.find(shop => shop.id === id) || state.data?.shops?.[0] || null;
    if (state.shop) $('shopSelect').value = state.shop.id;
    $('shopNote').hidden = !state.shop?.coldStart;
    $('shopNote').textContent = state.shop?.coldStart ? 'Este negócio tem pouco histórico. A previsão merece atenção extra.' : '';
    $('notice').hidden = true;
    renderAll();
    $('notificationDot').hidden = shopDiagnosis() === 'saudavel';
  }
  function selectHorizon(value) {
    state.horizon = value === 30 ? 30 : 60;
    document.querySelectorAll('[data-horizon]').forEach(button => {
      const active = Number(button.dataset.horizon) === state.horizon;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('notice').hidden = true;
    renderAll();
    $('notificationDot').hidden = shopDiagnosis() === 'saudavel';
  }
  function notificationText() {
    const h = currentHorizon();
    if (!h || shopDiagnosis() === 'saudavel') return 'Seu caixa está estável na maioria dos cenários. Veja a previsão.';
    return `${pct(h.probNegative)} dos cenários têm algum dia no vermelho. Toque para entender.`;
  }
  function showNotification() {
    $('noticeText').textContent = notificationText();
    $('notice').hidden = false;
    $('notificationDot').hidden = false;
  }
  function openNotification() {
    $('notice').hidden = true;
    $('notificationDot').hidden = true;
    navigate('antecipa');
    $('chartTitle').focus?.();
  }
  function showLoadError(message) {
    $('chart').innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
    $('statusContent').textContent = 'Os dados ainda não puderam ser carregados.';
    $('actionList').textContent = 'Verifique o servidor local e tente recarregar a página.';
    $('shopSelect').disabled = true;
  }

  document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.area)));
  document.querySelectorAll('[data-horizon]').forEach(button => button.addEventListener('click', () => selectHorizon(Number(button.dataset.horizon))));
  $('shopSelect').addEventListener('change', event => selectShop(event.target.value));
  ['pixRange', 'installmentsRange'].forEach(id => $(id).addEventListener('input', renderSimulator));
  ['stockShareRange', 'stockDiscountRange'].forEach(id => $(id).addEventListener('input', renderStock));
  $('backButton').addEventListener('click', closeDetail);
  $('notifyButton').addEventListener('click', showNotification);
  $('noticeClose').addEventListener('click', () => { $('notice').hidden = true; });
  $('noticeOpen').addEventListener('click', openNotification);

  renderNavigation();
  fetch('../dist/data.json')
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(data => {
      if (!Array.isArray(data?.shops) || !Array.isArray(data?.dates)) throw new Error('Formato de dados inesperado');
      state.data = data;
      $('shopSelect').innerHTML = data.shops.map(shop => `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.name || shop.id)}</option>`).join('');
      selectShop(data.shops[0]?.id);
      if (shopDiagnosis() !== 'saudavel' && !state.notificationSeen) {
        state.notificationSeen = true;
        window.setTimeout(showNotification, 850);
      }
    })
    .catch(error => { console.error('Falha ao carregar a demonstração:', error); showLoadError('Não foi possível carregar a previsão.'); });
})();
