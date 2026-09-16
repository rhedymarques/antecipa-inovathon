/* Front independente: lê dados sintéticos e usa o motor financeiro existente. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const money = value => Number.isFinite(Number(value))
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value))
    : 'Indisponível';
  const pct = value => Number.isFinite(Number(value))
    ? `${Math.round(Number(value) * 100)}%` : 'Indisponível';
  const day = iso => {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'data não informada';
    const [, month, date] = iso.split('-');
    return `${date}/${month}`;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const state = { data: null, shop: null, horizon: 60, area: 'antecipa', actions: [], selectedAction: null, notificationSeen: false };

  const actionMeta = {
    none: { title: 'Não fazer nada', summary: 'Veja como o caixa evolui sem uma nova medida.', how: 'Nenhuma mudança é aplicada ao fluxo projetado.', caution: 'Um risco identificado permanece no cenário.' },
    negotiate: { title: 'Conversar com o fornecedor', summary: 'Simule deslocar um pagamento por sete dias.', how: 'O vencimento do próximo fornecedor é deslocado em sete dias na simulação. A despesa continua no caixa futuro.', caution: 'Depende do aceite do fornecedor; ausência de multa é hipótese da demonstração.' },
    reduce: { title: 'Rever gastos variáveis', summary: 'Simule uma redução temporária de custos.', how: 'A simulação reduz 10% dos gastos operacionais variáveis do período.', caution: 'É uma hipótese: uma redução real pode afetar a operação e as vendas.' },
    advance: { title: 'Antecipar parte dos recebíveis', summary: 'Receba antes e compare o custo e as entradas futuras.', how: 'O motor traz para hoje parte da agenda de recebíveis, desconta a taxa ilustrativa e retira esses valores das datas originais.', caution: 'A agenda exibida não comprova elegibilidade real. Taxas, prazos e disponibilidade dependem de uma oferta efetiva.' }
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
    const maxInstallments = Number($('installmentsRange').value);
    // Campos extras são ignorados por versões antigas do motor.
    return { pixDiscount, pixDiscountPct: pixDiscount, maxInstallments };
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
    const required = ['q2_5', 'q25', 'q50', 'q75', 'q97_5'];
    if (!n || !required.every(key => Array.isArray(quantiles?.[key]) && quantiles[key].length >= n && quantiles[key].slice(0, n).every(value => finite(value) !== null))) {
      $('chart').innerHTML = '<div class="chart-empty">A faixa de previsão ainda não está disponível para este negócio.</div>';
      $('chart').setAttribute('aria-label', 'Faixa de previsão indisponível');
      $('chartNote').textContent = 'Aguardando os quantis calculados pelo motor de previsão.';
      return;
    }
    const q = key => quantiles[key].slice(0, n).map(Number);
    const lower95 = q('q2_5'), lower50 = q('q25'), median = q('q50'), upper50 = q('q75'), upper95 = q('q97_5');
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
    const markerIndex = typeof firstNegative === 'string' ? dates.slice(0, n).indexOf(firstNegative) : -1;
    const marker = markerIndex >= 0 ? `<line x1="${x(markerIndex)}" x2="${x(markerIndex)}" y1="${T}" y2="${H - B}" stroke="#df8a37" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${x(markerIndex)}" cy="${y(median[markerIndex])}" r="4" fill="#df8a37"/><text x="${Math.min(W - 38, Math.max(L + 20, x(markerIndex)))}" y="${T + 9}" text-anchor="middle" font-size="9" font-weight="700" fill="#ae671d">${day(firstNegative)}</text>` : '';
    $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${grid}<line x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}" stroke="#60798b" stroke-width="1.6" stroke-dasharray="5 4"/><text x="${L - 6}" y="${zero - 3}" text-anchor="end" font-size="9" fill="#566f81">zero</text><path d="${band(lower95, upper95)}" fill="#d7eaf6"/><path d="${band(lower50, upper50)}" fill="#a9d4ee"/><path d="${line(median)}" fill="none" stroke="#0877b8" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>${marker}<text x="${L}" y="${H - 8}" font-size="9" fill="#7b92a3">${day(dates[0])}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="9" fill="#7b92a3">${day(dates[n - 1])}</text></svg>`;
    $('chart').setAttribute('aria-label', `Saldo projetado por ${n} dias. Mediana e faixas de 50% e 95%. ${markerIndex >= 0 ? `Primeiro dia de risco destacado: ${day(firstNegative)}.` : 'Sem primeiro dia negativo destacado.'}`);
    $('chartNote').textContent = state.shop.uncertainty?.method || 'Faixas derivadas de cenários simulados com dados sintéticos.';
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
      saudavel: { symbol: '✓', title: 'Caixa estável na maioria dos cenários', copy: `No fim de ${state.horizon} dias, ${pct(h.probPositiveClose)} dos cenários simulados fecham com saldo positivo. Continue acompanhando os dias intermediários.` },
      timing: { symbol: '!', title: 'Atenção ao prazo dos pagamentos', copy: `${pct(h.probNegative)} dos cenários simulados passam por saldo negativo em algum momento dos próximos ${state.horizon} dias. O dia de maior concentração do primeiro aperto é ${day(h.firstNegativeDay)}.` },
      margem: { symbol: '!', title: 'Entradas podem não cobrir as saídas', copy: `${pct(h.diagnosisFreq?.margem)} dos cenários foram classificados como problema de margem. Antecipar recebíveis não corrige esse desequilíbrio e acrescenta custo.` }
    }[diagnosis];
    const hole = finite(h.medianHole);
    $('statusContent').innerHTML = `<div class="status-top"><span class="status-symbol" aria-hidden="true">${config.symbol}</span><h2 id="statusTitle">${config.title}</h2></div><p class="status-copy">${config.copy}</p><div class="status-stat"><div class="stat-box"><strong>${pct(h.probNegative)}</strong><span>cenários com algum saldo negativo</span></div><div class="stat-box"><strong>${hole !== null ? money(Math.abs(hole)) : 'Indisponível'}</strong><span>buraco mediano, quando ocorre</span></div></div>${diagnosis !== 'saudavel' ? '<button class="status-cta" type="button" id="seeOptions">Ver o que fazer ↓</button>' : ''}`;
    $('seeOptions')?.addEventListener('click', () => $('choicesSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function renderActions() {
    const diagnosis = shopDiagnosis();
    const evaluated = evaluate();
    const baseline = evaluated.find(item => item.action === 'none') || null;
    const allowed = evaluated.filter(item => !(diagnosis === 'margem' && item.action === 'advance'));
    const baselineItems = allowed.filter(item => item.action === 'none');
    const alternatives = allowed.filter(item => item.action !== 'none').sort((a, b) => actionCost(a) - actionCost(b));
    state.actions = [...baselineItems, ...alternatives];
    $('choicesIntro').textContent = diagnosis === 'saudavel'
      ? 'Compare caminhos possíveis, mesmo sem um alerta principal para este período.'
      : 'Veja o efeito estimado no caixa antes de escolher qualquer medida.';
    $('actionList').innerHTML = state.actions.length ? state.actions.map((item, index) => {
      const delta = improvement(item, baseline);
      const cost = actionCost(item);
      return `<button type="button" class="action-card ${item.action === 'none' ? 'baseline' : ''}" data-action-index="${index}"><div class="action-card-header"><div><span class="action-number">${item.action === 'none' ? 'REFERÊNCIA' : `OPÇÃO ${alternatives.indexOf(item) + 1}`}</span><br><strong>${escapeHtml(actionTitle(item))}</strong></div><span class="action-arrow" aria-hidden="true">›</span></div><p>${escapeHtml(actionSummary(item))}</p><div class="action-metrics"><span>Custo estimado<b>${money(cost)}</b></span><span>Melhora do pior saldo<b>${delta !== null ? money(Math.max(0, delta)) : 'Indisponível'}</b></span></div></button>`;
    }).join('') : '<p class="support-copy">O motor ainda não retornou alternativas para este cenário.</p>';
    $('marginWarning').hidden = diagnosis !== 'margem';
    $('marginWarning').textContent = 'Por que não antecipar? Neste diagnóstico, o problema é estrutural: trazer recebimentos para hoje pode apenas deslocar o aperto e acrescentar uma taxa.';
    document.querySelectorAll('[data-action-index]').forEach(button => button.addEventListener('click', () => showDetail(Number(button.dataset.actionIndex))));
  }

  function showDetail(index) {
    const item = state.actions[index];
    if (!item) return;
    state.selectedAction = item.action;
    const baseline = state.actions.find(value => value.action === 'none');
    const meta = actionMeta[item.action] || {};
    const delta = improvement(item, baseline);
    const end = finite(item.end), baseEnd = finite(baseline?.end);
    const endDelta = end !== null && baseEnd !== null ? end - baseEnd : null;
    $('detailContent').innerHTML = `<div class="detail-hero"><span class="eyebrow">ENTENDA A ALTERNATIVA</span><h1>${escapeHtml(actionTitle(item))}</h1><p>${escapeHtml(actionSummary(item))}</p></div><div class="detail-metrics"><div class="stat-box"><strong>${money(actionCost(item))}</strong><span>custo direto estimado</span></div><div class="stat-box"><strong>${delta !== null ? money(Math.max(0, delta)) : 'Indisponível'}</strong><span>melhora do pior saldo</span></div></div><div class="detail-card"><h2>Como funciona</h2><p>${escapeHtml(item.how || meta.how || 'O motor aplica esta alternativa ao cenário e compara a projeção resultante com a referência.')}</p></div><div class="detail-card"><h2>O que muda depois</h2><p>Ao final dos 60 dias da simulação, a diferença em relação a não fazer nada é ${endDelta !== null ? money(endDelta) : 'indisponível'}. ${finite(item.negativeDays) !== null ? `O fluxo simulado ainda tem ${Number(item.negativeDays)} dia(s) com saldo negativo.` : 'A quantidade de dias negativos não foi informada.'} Valores podem mudar com vendas, despesas e prazos reais.</p></div><div class="detail-card detail-caution"><h2>Antes de decidir</h2><p>${escapeHtml(item.caution || meta.caution || 'Confira as condições reais e os efeitos sobre os próximos meses antes de agir.')}</p></div><p class="detail-footer">Esta tela explica uma simulação. Nenhuma negociação, antecipação ou contratação é executada aqui.</p>`;
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
    $('installmentsValue').textContent = `${$('installmentsRange').value}×`;
    const reference = evaluate({ pixDiscount: 0, pixDiscountPct: 0, maxInstallments: 4 });
    const adjusted = evaluate();
    const changed = JSON.stringify(reference) !== JSON.stringify(adjusted);
    const defaultControls = $('pixRange').value === '0' && $('installmentsRange').value === '4';
    $('simulatorNote').textContent = defaultControls
      ? 'Mova os controles para testar. As faixas do gráfico representam o cenário base e não são recalculadas aqui.'
      : changed
        ? 'Alternativas recalculadas pelo motor para estes controles. As faixas do gráfico continuam no cenário base.'
        : 'Esta versão do motor ainda não aplica esses controles ao cálculo. Os valores acima são uma hipótese de interface, sem efeito financeiro exibido.';
  }

  function renderAll() {
    renderChart();
    renderStatus();
    renderActions();
    renderSimulator();
    closeDetail();
  }
  function selectShop(id) {
    state.shop = state.data?.shops?.find(shop => shop.id === id) || state.data?.shops?.[0] || null;
    if (state.shop) $('shopSelect').value = state.shop.id;
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
    renderAll();
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
  ['pixRange', 'installmentsRange'].forEach(id => $(id).addEventListener('input', () => { renderActions(); renderSimulator(); }));
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
