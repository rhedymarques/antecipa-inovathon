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
  const units = value => finite(value) === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value));
  const installmentChoices = [2, 3, 4, 6, 12];
  const state = { data: null, shop: null, horizon: 60, area: 'antecipa', actions: [], recommendation: null, promotion: null, selectedAction: null, notificationSeen: false };

  const actionMeta = {
    none: { title: 'Manter como está', summary: 'Veja como o caixa evolui sem uma nova medida.', how: 'Nenhuma mudança é aplicada à previsão do caixa.', caution: 'O risco indicado permanece se nada mudar.' },
    negotiate: { title: 'Conversar com o fornecedor', summary: 'Simule deslocar um pagamento por sete dias.', how: 'O vencimento do próximo fornecedor é deslocado em sete dias na simulação. A despesa continua no caixa futuro.', caution: 'Depende do aceite do fornecedor; ausência de multa é hipótese da demonstração.' },
    reduce: { title: 'Rever gastos variáveis', summary: 'Simule uma redução temporária de custos.', how: 'A simulação reduz 10% dos gastos operacionais variáveis do período.', caution: 'É uma hipótese: uma redução real pode afetar a operação e as vendas.' },
    advance: { title: 'Antecipar parte dos recebíveis', summary: 'Receba antes e compare o custo e as entradas futuras.', how: 'A simulação traz para hoje parte dos valores a receber, desconta uma taxa ilustrativa e retira esses valores das datas originais.', caution: 'Os valores exibidos podem não estar disponíveis para antecipação. Taxas, prazos e disponibilidade dependem de uma oferta real.' },
    mix: { title: 'Mudar Pix e parcelas das novas vendas', summary: 'Simule desconto no Pix e um novo limite de parcelas.', how: 'O desconto pode levar parte dos clientes a pagar no Pix. Reduzir parcelas faz o dinheiro de vendas parceladas chegar antes, mas o cálculo também considera que algumas dessas vendas podem deixar de acontecer.', caution: 'A adesão ao Pix e a perda de vendas ao reduzir parcelas são hipóteses. Confira as condições reais antes de alterar a oferta aos clientes.' },
    promotion: { title: 'Criar uma promoção', summary: 'Teste uma campanha com produtos e estoque deste negócio.', how: 'A análise estima vendas adicionais e desconta as que já aconteceriam. Também considera substituição de vendas, margem, estoque e prazo de recebimento.', caution: 'Adesão, resposta ao desconto e substituição de vendas são hipóteses sintéticas. Confira os dados e valide o resultado com o lojista.' }
  };
  const actionSteps = {
    none: ['Acompanhe a previsão nos próximos dias.', 'Reavalie se aparecer um novo alerta.'],
    negotiate: ['Confira o vencimento e o valor do próximo pagamento ao fornecedor.', 'Converse com o fornecedor sobre um prazo de sete dias e confirme eventuais encargos.', 'Atualize o planejamento apenas se o novo prazo for aceito.'],
    reduce: ['Revise os gastos variáveis previstos para o período.', 'Identifique cortes temporários que não prejudiquem as vendas.', 'Acompanhe o saldo e ajuste o plano se a economia real for menor que a simulada.'],
    advance: ['Confira quais recebíveis estão disponíveis para antecipação.', 'Peça a taxa e o valor líquido de uma oferta real antes de decidir.', 'Compare também o caixa nas datas em que esses recebíveis deixariam de entrar.'],
    mix: ['Defina o desconto no Pix e o limite de parcelas que pretende testar.', 'Confira o custo do desconto e comunique as condições aos clientes.', 'Observe a adesão real e reavalie o caixa antes de manter a campanha.'],
    promotion: ['Confira os produtos e o estoque considerados.', 'Revise o desconto e a duração sugeridos.', 'Compare caixa, margem e estoque antes de realizar a campanha.', 'Acompanhe a adesão real e interrompa a campanha se o resultado ficar abaixo da hipótese.']
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
    const maxInstall = installmentChoices[Number($('installmentsRange').value)] ?? (finite(state.shop?.installments) ?? 4);
    return { pixDiscount, maxInstall };
  }
  function evaluate(extra = options()) {
    if (!state.shop || !state.data || typeof evaluateActions !== 'function') return [];
    try {
      const days = Math.min(state.horizon, state.data.dates.length, state.shop.forecast.length,
        state.shop.expenses.length, state.shop.receivables.length);
      if (!days) return [];
      const periodShop = { ...state.shop, forecast: state.shop.forecast.slice(0, days),
        expenses: state.shop.expenses.slice(0, days), receivables: state.shop.receivables.slice(0, days) };
      const periodData = { ...state.data, dates: state.data.dates.slice(0, days) };
      const result = evaluateActions(periodShop, periodData, { ...extra, horizon: state.horizon, includePromotion: true });
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
  function getPromotion(extra = {}) {
    if (!state.shop?.commercial || !state.data || typeof evaluatePromotion !== 'function') return null;
    try { return evaluatePromotion(state.shop, state.data, { horizon: state.horizon, ...extra }); }
    catch (error) { console.error('Não foi possível avaliar a campanha:', error); return null; }
  }
  function comparisonOptions() {
    const rec = state.recommendation;
    return {
      pixDiscount: finite(rec?.params?.pixDiscount) ?? 0.5,
      maxInstall: finite(rec?.params?.maxInstall) ?? (finite(state.shop?.installments) ?? 4),
      advance: finite(rec?.params?.advance) ?? Math.max(0, finite(rec?.buraco) ?? 0)
    };
  }
  function actionTitle(item) {
    return item?.action === 'promotion' ? item.proposal || actionMeta.promotion.title
      : actionMeta[item?.action]?.title || item?.label || item?.title || 'Outra alternativa';
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
    if (delta === null) return ['Efeito no caixa', 'Indisponível'];
    if (delta <= 0.01) return ['Efeito no aperto', 'Não resolve neste caso'];
    if (delta > 0.01) return ['Alívio no maior aperto', money(delta)];
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
      $('statusContent').innerHTML = '<div class="status-top"><span class="status-symbol">?</span><h2 id="statusTitle">Análise indisponível</h2></div><p class="status-copy">Ainda não há uma avaliação para este período.</p>';
      return;
    }
    const config = {
      saudavel: { symbol: '✓', title: 'Seu cenário de caixa é positivo', copy: `No fim de ${state.horizon} dias, ${pct(h.probPositiveClose)} dos cenários simulados fecham com saldo positivo. Siga acompanhando a previsão.` },
      timing: { symbol: '!', title: 'Atenção ao prazo dos pagamentos', copy: h.firstNegativeDay ? `Data em que é mais provável o caixa ficar no vermelho: ${day(h.firstNegativeDay)}.` : 'Não há uma data predominante para o caixa ficar no vermelho.' },
      margem: { symbol: '!', title: 'Entradas podem não cobrir as saídas', copy: h.firstNegativeDay ? `Data em que é mais provável o caixa ficar no vermelho: ${day(h.firstNegativeDay)}.` : 'Não há uma data predominante para o caixa ficar no vermelho.' }
    }[diagnosis];
    if (diagnosis === 'saudavel') {
      $('statusContent').innerHTML = `<div class="status-top"><span class="status-symbol" aria-hidden="true">${config.symbol}</span><h2 id="statusTitle">${config.title}</h2></div><p class="status-copy">${config.copy}</p>`;
      return;
    }
    $('statusContent').innerHTML = `<div class="status-top"><span class="status-symbol" aria-hidden="true">${config.symbol}</span><h2 id="statusTitle">${config.title}</h2></div><p class="status-copy">${config.copy}</p><div class="status-stat"><div class="stat-box"><strong>${pct(h.probNegative)}</strong><span>possibilidade de ficar no vermelho</span></div></div><button class="status-cta" type="button" id="seeOptions">Ver o que fazer ↓</button>`;
    $('seeOptions')?.addEventListener('click', () => $('recommendationSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function renderExplanation() {
    const h = currentHorizon(), diagnosis = shopDiagnosis();
    const content = $('explanationContent');
    if (!h || !diagnosis) { content.textContent = 'Ainda não há dados suficientes para explicar este cenário.'; return; }
    const text = diagnosis === 'saudavel'
      ? `A previsão indica um período favorável. ${h.firstNegativeDay === null ? (finite(h.probNegative) === 0 ? 'Nenhum dia negativo apareceu nas simulações deste período.' : 'Não há uma data predominante para eventual aperto.') : ''} Continue acompanhando o caixa.`
      : diagnosis === 'timing'
        ? `Alguns pagamentos podem chegar antes do dinheiro das vendas. ${h.firstNegativeDay ? `O dia em que é mais provável a queda do saldo para o vermelho é ${day(h.firstNegativeDay)}.` : ''} Há tempo para comparar caminhos.`
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
      $('recommendationContent').textContent = 'Ainda não há uma sugestão para este período.';
      $('technicalContent').textContent = 'Não há justificativa técnica disponível para este período.';
      return;
    }
    const healthy = rec.mode === 'saudavel' || rec.action === 'none';
    const structural = rec.mode === 'margem' && rec.structural === true;
    const coverage = finite(rec.coveragePct);
    const baseParts = finite(state.shop?.installments) ?? 4;
    const suggestedParts = finite(rec.params?.maxInstall) ?? baseParts;
    const suggestedDiscount = finite(rec.params?.pixDiscount) ?? 0;
    const mixMeasures = [
      suggestedDiscount > 0 ? `oferecer ${String(suggestedDiscount).replace('.', ',')}% de desconto no Pix` : '',
      suggestedParts !== baseParts ? `vender em até ${suggestedParts} parcelas em vez de ${baseParts}` : ''
    ].filter(Boolean);
    const mixTitle = mixMeasures.length ? mixMeasures.map(measure => measure[0].toUpperCase() + measure.slice(1)).join(' e ') : 'Mudar Pix e parcelas das novas vendas';
    const shortReason = {
      none: rec.watch ? 'Neste momento, o custo das medidas disponíveis não compensa o valor que pode faltar. Continue acompanhando a previsão.' : 'Seu caixa segue positivo na maior parte dos cenários. Continue acompanhando.',
      negotiate: 'Vale conversar sobre um novo prazo para o próximo pagamento ao fornecedor.',
      reduce: 'Rever gastos variáveis pode aliviar o caixa neste período.',
      advance: 'Antecipar apenas a parte necessária dos recebíveis pode aliviar o aperto.',
      mix: mixMeasures.length ? `A simulação considera ${mixMeasures.join(' e ')}.${suggestedParts < baseParts ? ' Menos parcelas podem antecipar recebimentos, mas também reduzir algumas vendas.' : ''}` : 'Compare como novas condições de pagamento podem mudar as entradas do caixa.',
      promotion: `A campanha ${state.promotion?.proposal || 'calculada'} pode melhorar o caixa. Confira produtos, margem e estoque antes de decidir.`
    }[rec.action] || 'Veja a medida indicada para este período.';
    $('recommendationSection').classList.toggle('structural', structural);
    $('recommendationSection').classList.toggle('healthy', healthy);
    const costLabel = rec.action === 'mix' ? suggestedParts < baseParts
      ? 'descontos e vendas que podem deixar de acontecer' : 'descontos oferecidos no Pix'
      : rec.action === 'promotion' ? 'descontos e vendas substituídas' : 'custo estimado';
    const title = healthy ? 'Acompanhar o caixa' : rec.action === 'mix' ? mixTitle
      : rec.action === 'promotion' ? rec.promotion?.proposal || state.promotion?.proposal || actionMeta.promotion.title
        : actionMeta[rec.action]?.title || rec.label || 'Veja esta medida';
    const matchingAction = !healthy && rec.action !== 'promotion'
      ? evaluate({ ...comparisonOptions(), ...rec.params }).find(item => item.action === rec.action) : null;
    const displayedCost = matchingAction ? actionCost(matchingAction) : finite(rec.cost);
    $('recommendationContent').innerHTML = `<h2 id="recommendationTitle">${escapeHtml(title)}</h2>${structural ? '<p class="structural-alert"><strong>Esta medida ajuda, mas não resolve sozinha.</strong> O ajuste nas entradas e saídas precisa continuar.</p>' : ''}<p class="recommendation-reason">${escapeHtml(shortReason)}</p>${healthy ? '' : `<div class="recommendation-metrics"><div><strong>${money(displayedCost)}</strong><span>${costLabel}</span></div><div><strong>${money(finite(rec.coversAmount))}</strong><span>alívio no maior aperto</span></div><div><strong>${coverage !== null ? `${Math.round(coverage)}%` : 'Indisponível'}</strong><span>do valor que pode faltar</span></div><div><strong>${money(finite(rec.saldo30Impacto))}</strong><span>mudança no saldo do dia 30</span></div></div><p class="small-note">Estimativas para comparação; o resultado real pode variar.</p>`}`;
    $('technicalContent').innerHTML = `<h3>Por que esta medida foi escolhida</h3><p>${escapeHtml(rec.justificativa || 'Justificativa indisponível.')}</p><p>Probabilidade de algum saldo negativo no cenário atual de ${state.horizon} dias: ${pct(rec.probNegative)}. Os efeitos das ações são simulações pontuais e não têm faixa probabilística recalculada.</p><h3>Limites dos ajustes</h3><p>Desconto no Pix, parcelas, antecipação e campanhas comerciais usam hipóteses de demonstração. A faixa probabilística pertence apenas ao cenário-base. Os controles de Pix e parcelamento são avaliados separadamente nesta tela.</p>`;
  }

  function promotionChart(promotion) {
    const allSeries = Array.isArray(promotion?.series) ? promotion.series.filter(row => finite(row.withoutAction) !== null && finite(row.withAction) !== null) : [];
    const campaignDays = Math.max(1, finite(state.shop?.commercial?.assumptions?.campaignDays) ?? allSeries.length);
    const series = allSeries.slice(0, Math.min(allSeries.length, campaignDays + 7));
    if (series.length < 2) return '<p class="chart-empty">Ainda não há uma comparação diária para esta campanha.</p>';
    const W = 360, H = 190, L = 49, R = 9, T = 12, B = 28;
    const values = series.flatMap(row => [Number(row.withoutAction), Number(row.withAction), 0]);
    const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max(1, (hi - lo) * .1);
    const min = lo - pad, max = hi + pad;
    const x = i => L + i * (W - L - R) / (series.length - 1);
    const y = value => T + (max - value) * (H - T - B) / (max - min);
    const path = key => series.map((row, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(row[key])).toFixed(1)}`).join(' ');
    const minIndex = series.reduce((best, row, i) => Number(row.withAction) < Number(series[best].withAction) ? i : best, 0);
    const duration = Math.min(series.length, campaignDays);
    const campaignEnd = duration - 1;
    const zero = y(0).toFixed(1);
    const maxGap = series.reduce((best, row) => {
      const gap = Number(row.withAction) - Number(row.withoutAction);
      return Math.abs(gap) > Math.abs(best) ? gap : best;
    }, 0);
    const zoomed = series.length < allSeries.length;
    const label = `Saldo estimado sem e com a campanha nos primeiros ${series.length} dias, com escala incluindo zero. Menor saldo com a campanha em ${day(series[minIndex].date)}. Estimativa pontual.`;
    return `<div class="promotion-chart" role="img" aria-label="${escapeHtml(label)}"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><line x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}" stroke="#8ba0ae" stroke-dasharray="4 4"/><text x="${L - 5}" y="${Number(zero) - 3}" text-anchor="end" font-size="9" fill="#718799">zero</text><line x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H - B}" stroke="#b8cad4" stroke-dasharray="2 4"/><line x1="${x(campaignEnd)}" x2="${x(campaignEnd)}" y1="${T}" y2="${H - B}" stroke="#b8cad4" stroke-dasharray="2 4"/><path d="${path('withoutAction')}" fill="none" stroke="#718ba0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${path('withAction')}" fill="none" stroke="#0876bd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(minIndex)}" cy="${y(Number(series[minIndex].withAction))}" r="4" fill="#e18730"/><text x="${L}" y="${H - 7}" font-size="9" fill="#718799">${escapeHtml(day(series[0].date))}</text><text x="${W - R}" y="${H - 7}" text-anchor="end" font-size="9" fill="#718799">${escapeHtml(day(series[series.length - 1].date))}</text></svg></div><div class="promotion-legend"><span><i class="line-without"></i>Sem campanha</span><span><i class="line-with"></i>Com campanha</span></div><p class="promotion-chart-note"><strong>Maior diferença neste recorte: ${money(Math.abs(maxGap))} ${maxGap >= 0 ? 'a mais' : 'a menos'} com a campanha.</strong></p><p class="promotion-chart-note">${zoomed ? `Zoom nos primeiros ${series.length} dias: campanha e 7 dias seguintes. Os valores ao fim do período consideram ${allSeries.length} dias.` : `Período completo: ${series.length} dias.`} A escala inclui R$ 0. Campanha: ${escapeHtml(day(series[0].date))} a ${escapeHtml(day(series[campaignEnd].date))}.</p>`;
  }

  function renderPromotion() {
    const promotion = state.promotion;
    const section = $('promotionSection');
    section.hidden = !state.shop?.commercial || !promotion;
    if (section.hidden) return;
    const selected = state.recommendation?.action === 'promotion';
    const eligible = promotion.eligible === true;
    section.classList.toggle('not-eligible', !eligible);
    section.classList.toggle('chosen', selected);
    const status = selected ? 'ESCOLHA DA ANÁLISE' : eligible ? 'CAMPANHA CALCULADA' : 'NÃO INDICADA';
    const productNames = Array.isArray(promotion.products) ? promotion.products.map(product => product.name).filter(Boolean) : [];
    const duration = finite(state.shop.commercial?.assumptions?.campaignDays);
    const reason = !eligible ? promotion.reason || 'Esta campanha não melhora o caixa nas hipóteses testadas.'
      : selected ? 'Esta foi a medida escolhida na comparação das alternativas.'
        : state.recommendation?.mode === 'saudavel' ? `O caixa está positivo neste período. A melhora no momento de menor caixa é ${money(finite(promotion.improvement))}; a campanha pode ser explorada, mas não é necessária agora.`
          : 'A campanha melhora o caixa, mas a análise escolheu outra medida. Compare o efeito e os custos antes de decidir.';
    const candidates = Array.isArray(promotion.candidates) ? promotion.candidates : [];
    const candidateItems = candidates.map(candidate => `<li class="candidate-item"><div><strong>${escapeHtml(candidate.proposal || 'Campanha testada')}</strong><span>${money(finite(candidate.cashInHorizon))} de entrada · ${money(finite(candidate.improvement))} no aperto · margem ${money(finite(candidate.marginImpact))}</span><small>${escapeHtml(candidate.useful ? 'Pode ajudar neste período.' : candidate.eligible ? 'Não melhora o caixa neste prazo.' : candidate.reason || 'Não indicada neste período.')}</small></div><button type="button" data-promotion-id="${escapeHtml(candidate.id || '')}" data-promotion-discount="${escapeHtml(candidate.discountPct ?? '')}">Ver</button></li>`).join('');
    $('promotionContent').innerHTML = `<div class="promotion-heading"><span class="eyebrow">CAMPANHA CALCULADA PARA ESTE CENÁRIO</span><span class="promotion-badge">${status}</span></div><h2 id="promotionTitle">${escapeHtml(promotion.proposal || 'Campanha comercial')}</h2><p class="promotion-products">${escapeHtml(productNames.join(' · ') || 'Produtos não informados')}</p><p class="promotion-subtitle">${duration !== null ? `${duration} dias de campanha` : 'Duração não informada'} · desconto de ${finite(promotion.params?.discountPct) !== null ? `${units(promotion.params.discountPct)}%` : 'valor não informado'}</p><div class="promotion-metrics"><div><strong>${money(finite(promotion.totals?.cashInHorizon))}</strong><span>entrada líquida em ${state.horizon} dias</span></div><div><strong>${money(finite(promotion.improvement))}</strong><span>melhora no maior aperto</span></div><div><strong>${money(finite(promotion.totals?.marginImpact))}</strong><span>resultado após custos dos produtos</span></div><div><strong>${units(promotion.stockConsumed)} / ${units(promotion.stockRemaining)}</strong><span>unidades consumidas / restantes*</span></div></div><p class="promotion-reason">${escapeHtml(reason)}</p><button type="button" id="promotionDetailButton" class="promotion-open">Entender esta campanha →</button><details class="promotion-candidates"><summary>Ver outras campanhas testadas</summary><ul>${candidateItems || '<li>Nenhuma outra campanha disponível.</li>'}</ul></details><p class="promotion-footnote">*Soma das unidades dos produtos. Inclui vendas que já ocorreriam; veja o estoque por produto no detalhe.</p><p class="promotion-footnote">Produtos, preços, custos, estoque e comportamento dos clientes são sintéticos. A campanha é uma estimativa para demonstração e exigiria validação com o lojista.</p>`;
    $('promotionDetailButton').addEventListener('click', () => showPromotionDetail());
    section.querySelectorAll('[data-promotion-id]').forEach(button => button.addEventListener('click', () => showPromotionDetail(button.dataset.promotionId, Number(button.dataset.promotionDiscount))));
  }

  function renderActions() {
    const params = comparisonOptions();
    const evaluated = evaluate(params);
    const baseline = evaluated.find(item => item.action === 'none') || null;
    state.actions = evaluated;
    const visible = state.actions.filter(item => item.action !== 'none' &&
      (item.action !== 'promotion' || item.eligible === true) &&
      !(shopDiagnosis() === 'margem' && item.action === 'advance') &&
      (improvement(item, baseline) ?? 0) > 0.01);
    $('choicesSection').hidden = visible.length === 0;
    $('choicesIntro').textContent = 'Estas mudanças melhoram o saldo no momento de maior aperto na simulação. Compare o custo antes de decidir.';
    $('actionList').innerHTML = visible.map((item, displayIndex) => {
      const index = state.actions.indexOf(item);
      const delta = improvement(item, baseline);
      const cost = actionCost(item);
      const [effectTitle, effectValue] = changeLabel(delta);
      const selected = state.recommendation?.action === item.action;
      const baseParts = finite(state.shop?.installments) ?? 4;
      const mixOnlyPix = item.action === 'mix' && params.pixDiscount > 0 && params.maxInstall === baseParts;
      const mixOnlyParcels = item.action === 'mix' && params.pixDiscount === 0 && params.maxInstall !== baseParts;
      const cardTitle = mixOnlyPix ? 'Oferecer desconto no Pix' : mixOnlyParcels ? 'Mudar o limite de parcelas' : actionTitle(item);
      const cardSummary = item.action === 'promotion' ? 'Campanha calculada com produtos e estoque deste negócio.'
        : mixOnlyPix ? 'Parte dos clientes pode pagar mais cedo com o desconto.' : mixOnlyParcels ? 'Menos parcelas antecipam entradas, mas podem reduzir vendas.' : actionSummary(item);
      const assumption = item.action === 'mix' ? `${params.pixDiscount > 0 ? `Desconto no Pix: ${String(params.pixDiscount).replace('.', ',')}%. ` : ''}${params.maxInstall !== baseParts ? `Até ${params.maxInstall} parcelas, em vez de ${baseParts}.` : ''}` : item.action === 'advance' ? `Valor ilustrativo antecipado: ${money(params.advance)}.` : '';
      return `<button type="button" class="action-card ${selected ? 'suggested' : ''}" data-action-index="${index}"><div class="action-card-header"><div><span class="action-number">OPÇÃO ${displayIndex + 1} ${selected ? ' · SUGERIDA PARA VOCÊ' : ''}</span><br><strong>${escapeHtml(cardTitle)}</strong></div><span class="action-arrow" aria-hidden="true">›</span></div><p>${escapeHtml(cardSummary)} ${escapeHtml(assumption)}</p><div class="action-metrics"><span>${item.action === 'promotion' ? 'Descontos e vendas substituídas' : 'Custo estimado'}<b>${money(cost)}</b></span><span>${effectTitle}<b>${effectValue}</b></span></div></button>`;
    }).join('');
    $('marginWarning').hidden = true;
    document.querySelectorAll('[data-action-index]').forEach(button => button.addEventListener('click', () => showDetail(Number(button.dataset.actionIndex))));
  }

  function renderPromotionDetail(promotion) {
    if (!promotion) {
      $('detailContent').innerHTML = '<div class="detail-card"><h1>Campanha indisponível</h1><p>Não foi possível calcular esta proposta agora.</p></div>';
      return;
    }
    const eligible = promotion.eligible === true;
    const isDefault = promotion.params?.promotionId === state.promotion?.params?.promotionId
      && promotion.params?.discountPct === state.promotion?.params?.discountPct;
    const chosen = isDefault && state.recommendation?.action === 'promotion';
    const productRows = (promotion.products || []).map(product => `<li><strong>${escapeHtml(product.name || 'Produto')}</strong><span>${units(product.stockConsumed)} unidades estimadas no período · ${units(product.stockRemaining)} restantes</span><small>Preço sugerido: ${money(finite(product.promoPrice))} · custo informado na base: ${money(finite(product.cost))}</small></li>`).join('');
    const ids = [...new Map((state.promotion?.candidates || []).map(candidate => [candidate.id, candidate])).values()];
    const choices = ids.map(candidate => `<option value="${escapeHtml(candidate.id || '')}" ${candidate.id === promotion.params?.promotionId ? 'selected' : ''}>${escapeHtml((candidate.proposal || 'Campanha').replace(/ com (até )?\d+(?:[.,]\d+)?% de desconto$/, ''))}</option>`).join('');
    const discount = finite(promotion.params?.discountPct) ?? 0;
    let confirmedEnd = finite(promotion.end);
    if (eligible && typeof simulate === 'function') {
      try {
        const result = simulate(state.shop, state.data, { action: 'promotion', ...promotion.params });
        confirmedEnd = finite(result.daily?.[state.horizon - 1]?.balance) ?? confirmedEnd;
      } catch (error) { console.error('Não foi possível conferir o efeito da campanha:', error); }
    }
    const steps = eligible ? `<div class="detail-card"><h2>Antes de realizar</h2><p>Roteiro de avaliação; nenhuma campanha é criada pelo protótipo.</p><ol class="plan-steps">${actionSteps.promotion.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div>` : '';
    const caution = (promotion.cautions || [actionMeta.promotion.caution]).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    $('detailContent').innerHTML = `<div class="detail-hero"><span class="eyebrow">${eligible ? chosen ? 'ESCOLHA DA ANÁLISE' : isDefault ? 'CAMPANHA CALCULADA' : 'TESTE LIVRE' : 'NÃO INDICADA'}</span><h1>${escapeHtml(promotion.proposal || 'Campanha comercial')}</h1><p>${escapeHtml(eligible ? promotion.reason || actionMeta.promotion.summary : promotion.reason || 'Esta campanha não foi indicada nas hipóteses simuladas.')}</p></div><div class="detail-card promotion-test"><h2>Teste outra condição</h2><label for="promotionCandidateSelect">Produtos ou coleção</label><select id="promotionCandidateSelect">${choices}</select><label for="promotionDiscountRange">Desconto <output id="promotionDiscountValue">${units(discount)}%</output></label><input id="promotionDiscountRange" type="range" min="0" max="50" step="1" value="${Math.min(50, Math.max(0, discount))}"><p class="small-note">Este teste não altera a escolha principal da análise.</p></div><div class="detail-metrics"><div class="stat-box"><strong>${money(finite(promotion.totals?.cashInHorizon))}</strong><span>entrada líquida em ${state.horizon} dias</span></div><div class="stat-box"><strong>${money(finite(promotion.improvement))}</strong><span>mudança no maior aperto</span></div><div class="stat-box"><strong>${money(finite(promotion.totals?.marginImpact))}</strong><span>resultado após custos dos produtos</span></div><div class="stat-box"><strong>${money(confirmedEnd)}</strong><span>saldo estimado ao fim do período</span></div></div>${promotion.series?.length ? `<div class="detail-card"><h2>Como o caixa pode mudar</h2>${promotionChart(promotion)}<p class="small-note">Estimativa pontual da campanha. A faixa probabilística do cenário-base não foi recalculada.</p></div>` : ''}<div class="detail-card"><h2>Produtos e estoque</h2><ul class="promotion-product-list">${productRows || '<li>Produtos não informados para este teste.</li>'}</ul><p class="small-note">O estoque consumido inclui vendas que já aconteceriam. Confira quantidades reais antes de agir.</p></div><div class="detail-card"><h2>Por que ${eligible ? 'pode ajudar' : 'não foi indicada'}</h2><p>${escapeHtml(promotion.reason || 'A razão não foi informada.')}</p><p class="small-note">${chosen ? 'Esta campanha foi a escolha principal da análise.' : eligible ? 'Esta campanha pode melhorar o caixa, mas não foi necessariamente a escolha principal.' : 'Uma campanha recusada não deve ser colocada em prática com base nesta simulação.'}</p></div>${steps}<div class="detail-card detail-caution"><h2>Hipóteses e cuidados</h2><p>${escapeHtml(actionMeta.promotion.how)}</p><ul>${caution}</ul><p class="small-note">Produtos, preços, custos, estoque e comportamento dos clientes são sintéticos. Em produção, os produtos viriam do lojista ou de seu sistema de gestão.</p></div><p class="detail-footer">Nenhuma promoção, negociação ou operação financeira é executada nesta demonstração.</p>`;
    $('promotionCandidateSelect')?.addEventListener('change', event => {
      const matches = (state.promotion?.candidates || []).filter(candidate => candidate.id === event.target.value);
      const preferred = matches.find(candidate => candidate.useful) || matches[0];
      renderPromotionDetail(getPromotion({ promotionId: event.target.value, discountPct: preferred?.discountPct ?? 0 }));
    });
    $('promotionDiscountRange')?.addEventListener('input', event => { $('promotionDiscountValue').textContent = `${units(event.target.value)}%`; });
    $('promotionDiscountRange')?.addEventListener('change', event => {
      const value = Math.max(0, Math.min(50, Number(event.target.value)));
      renderPromotionDetail(getPromotion({ promotionId: $('promotionCandidateSelect').value, discountPct: value }));
    });
  }

  function showPromotionDetail(promotionId, discountPct) {
    state.selectedAction = 'promotion';
    $('antecipaView').hidden = true;
    $('detailView').hidden = false;
    scrollTop();
    const extra = promotionId ? { promotionId, discountPct: Math.max(0, Math.min(50, finite(discountPct) ?? 0)) } : {};
    renderPromotionDetail(promotionId ? getPromotion(extra) : state.promotion);
  }

  function showDetail(index) {
    const item = state.actions[index];
    if (!item) return;
    if (item.action === 'promotion') { showPromotionDetail(); return; }
    state.selectedAction = item.action;
    const baseline = state.actions.find(value => value.action === 'none');
    const meta = actionMeta[item.action] || {};
    const compare = comparisonOptions();
    const baseParts = finite(state.shop?.installments) ?? 4;
    const mixOnlyPix = item.action === 'mix' && compare.pixDiscount > 0 && compare.maxInstall === baseParts;
    const mixOnlyParcels = item.action === 'mix' && compare.pixDiscount === 0 && compare.maxInstall !== baseParts;
    const detailTitle = mixOnlyPix ? 'Oferecer desconto no Pix' : mixOnlyParcels ? 'Mudar o limite de parcelas' : actionTitle(item);
    const detailSummary = mixOnlyPix ? `Simule ${units(compare.pixDiscount)}% de desconto para quem pagar no Pix.`
      : mixOnlyParcels ? `Simule vendas em até ${compare.maxInstall} parcelas.` : actionSummary(item);
    const delta = improvement(item, baseline);
    const [effectTitle, effectValue] = changeLabel(delta);
    const end = finite(item.end), baseEnd = finite(baseline?.end);
    const endDelta = end !== null && baseEnd !== null ? end - baseEnd : null;
    const steps = actionSteps[item.action] || ['Confira as condições reais da alternativa.', 'Compare custos e efeitos futuros antes de decidir.'];
    $('detailContent').innerHTML = `<div class="detail-hero"><span class="eyebrow">ENTENDA A ALTERNATIVA</span><h1>${escapeHtml(detailTitle)}</h1><p>${escapeHtml(detailSummary)}</p></div><div class="detail-metrics"><div class="stat-box"><strong>${money(actionCost(item))}</strong><span>custo estimado</span></div><div class="stat-box"><strong>${effectValue}</strong><span>${effectTitle.toLowerCase()}</span></div></div><div class="detail-card"><h2>Antes e depois · hipótese de ${state.horizon} dias</h2><div class="before-after"><div><span>Sem a medida</span><strong>${money(finite(baseline?.min))}</strong><small>menor saldo estimado</small></div><span aria-hidden="true">→</span><div><span>Com a medida</span><strong>${money(finite(item.min))}</strong><small>menor saldo estimado</small></div></div><p class="small-note">Risco de algum saldo negativo no cenário-base de ${state.horizon} dias: ${pct(currentHorizon()?.probNegative)}. A faixa probabilística não foi recalculada para esta ação.</p></div><div class="detail-card"><h2>Como funciona</h2><p>${escapeHtml(meta.how || 'Confira as hipóteses desta ação antes de decidir.')}</p></div><div class="detail-card"><h2>O que muda depois</h2><p>Na comparação de ${state.horizon} dias, a diferença em relação a manter como está é ${endDelta !== null ? money(endDelta) : 'indisponível'}. ${finite(item.negativeDays) !== null ? `A previsão ainda mostra ${Number(item.negativeDays)} dia(s) com saldo negativo.` : 'A quantidade de dias negativos não foi informada.'} Valores podem mudar com vendas, despesas e prazos reais.</p></div><div class="detail-card"><h2>Plano da sessão</h2><p>Passos para avaliar esta medida; nenhuma etapa é executada automaticamente.</p><ol class="plan-steps">${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div><div class="detail-card detail-caution"><h2>Antes de decidir</h2><p>${escapeHtml(meta.caution || 'Confira as condições reais e os efeitos sobre os próximos meses antes de agir.')}</p></div><p class="detail-footer">Esta tela explica uma simulação. Nenhuma negociação, antecipação ou contratação é executada aqui.</p>`;
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
    $('pixValue').textContent = `${$('pixRange').value.replace('.', ',')}%`;
    $('installmentsValue').textContent = `${options().maxInstall}×`;
    const days = Math.min(state.horizon, state.data?.dates?.length ?? 0, state.shop?.forecast?.length ?? 0,
      state.shop?.expenses?.length ?? 0, state.shop?.receivables?.length ?? 0);
    const unavailable = '<span>Não foi possível comparar este ajuste agora.</span>';
    if (!days || typeof simulate !== 'function') {
      $('installmentsResult').innerHTML = unavailable;
      $('pixResult').innerHTML = unavailable;
      return;
    }
    // O motor calcula pelo tamanho das séries recebidas; o recorte mantém a comparação no período escolhido.
    const periodShop = { ...state.shop, forecast: state.shop.forecast.slice(0, days),
      expenses: state.shop.expenses.slice(0, days), receivables: state.shop.receivables.slice(0, days) };
    const periodData = { ...state.data, dates: state.data.dates.slice(0, days) };
    const difference = delta => Math.abs(delta) < 0.01 ? 'Praticamente igual'
      : `${money(Math.abs(delta))} ${delta > 0 ? 'a mais' : 'a menos'}`;
    const renderAdjustment = (target, base, changed, pix) => {
      const minDelta = changed.min - base.min;
      const endDelta = changed.end - base.end;
      const tightest = Math.abs(minDelta) < 0.01
        ? 'Nesse momento, o saldo ficaria praticamente igual.'
        : `Nesse momento, você teria ${difference(minDelta)} em caixa.`;
      $(target).innerHTML = `
        <div class="result-block"><span>Quando o caixa mais aperta</span><strong>${tightest}</strong></div>
        <div class="result-block"><span>Saldo ao fim de ${days} dias</span>
          <div class="result-pair"><span>Sem a mudança: <strong>${money(base.end)}</strong></span><span>Com a mudança: <strong>${money(changed.end)}</strong></span></div>
          <strong>${difference(endDelta)} ao fim do período</strong></div>
        <div class="result-block"><span>${pix ? 'Total oferecido em descontos no Pix' : 'Vendas que podem deixar de acontecer'}</span><strong>${money(changed.fee)}</strong><small>${pix ? 'É o valor que deixa de entrar pelas vendas com o desconto testado.' : 'Ao reduzir as parcelas, alguns clientes podem desistir da compra. Este valor é uma hipótese da simulação, não uma cobrança.'}</small></div>
        <small>Valores simulados para os próximos ${days} dias; o resultado real pode variar.</small>`;
    };
    try {
      const base = simulate(periodShop, periodData, { action: 'none' });
      const installments = simulate(periodShop, periodData, { action: 'mix', pixDiscount: 0, maxInstall: options().maxInstall });
      const pix = simulate(periodShop, periodData, { action: 'mix', pixDiscount: options().pixDiscount, maxInstall: finite(state.shop?.installments) ?? 4 });
      renderAdjustment('installmentsResult', base, installments, false);
      renderAdjustment('pixResult', base, pix, true);
    } catch (error) {
      console.error('Não foi possível simular os ajustes:', error);
      $('installmentsResult').innerHTML = unavailable;
      $('pixResult').innerHTML = unavailable;
    }
  }
  function renderAll() {
    state.promotion = getPromotion();
    state.recommendation = getRecommendation();
    const recommendedPix = finite(state.recommendation?.params?.pixDiscount);
    $('pixRange').value = String(recommendedPix ?? 0.5);
    const recommendedInstallments = finite(state.recommendation?.params?.maxInstall);
    $('installmentsRange').value = String(Math.max(0, installmentChoices.indexOf(recommendedInstallments ?? (finite(state.shop?.installments) ?? 4))));
    renderChart();
    renderStatus();
    renderExplanation();
    renderRecommendation();
    renderPromotion();
    const showChoices = shopDiagnosis() !== 'saudavel';
    $('choicesSection').hidden = !showChoices;
    $('simulatorSection').hidden = !showChoices;
    $('pixSection').hidden = !showChoices;
    if (showChoices) {
      renderActions();
      renderSimulator();
    } else {
      state.actions = [];
    }
    closeDetail();
  }
  function selectShop(id) {
    state.shop = state.data?.shops?.find(shop => ['bar', 'vestuario'].includes(shop.id) && shop.id === id)
      || state.data?.shops?.find(shop => shop.id === 'bar') || state.data?.shops?.find(shop => shop.id === 'vestuario') || null;
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
      const demoShops = ['bar', 'vestuario'].map(id => data.shops.find(shop => shop.id === id)).filter(Boolean);
      if (demoShops.length !== 2) throw new Error('Os dois negócios da demonstração não estão disponíveis');
      $('shopSelect').innerHTML = demoShops.map(shop => `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.name || shop.id)}</option>`).join('');
      selectShop(demoShops[0].id);
      if (shopDiagnosis() !== 'saudavel' && !state.notificationSeen) {
        state.notificationSeen = true;
        window.setTimeout(showNotification, 850);
      }
    })
    .catch(error => { console.error('Falha ao carregar a demonstração:', error); showLoadError('Não foi possível carregar a previsão.'); });
})();
