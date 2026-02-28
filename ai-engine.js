function calculateAndRender(closes){

  if(!closes || closes.length < 30) return;

  const loader = document.getElementById("aiLoading");
  if(loader) loader.style.display = "flex";

  /* =============================
     CORE INDICATORS
  ============================= */

  const rsiFast = calcRSI(closes, 9);
  const rsiSlow = calcRSI(closes, 14);

  const momentumShort = closes[closes.length-1] - closes[closes.length-2];
  const momentumMedium = closes[closes.length-1] - closes[closes.length-4];
  const momentum = (momentumShort * 0.6) + (momentumMedium * 0.4);

  const volatility = calcVolatility(closes);

  /* =============================
     REVERSAL DETECTION
  ============================= */

  const rsiSlope = rsiFast - calcRSI(closes.slice(0, closes.length-1), 9);
  const priceSlope = closes[closes.length-1] - closes[closes.length-5];

  const bullishReversal =
    rsiFast < 35 &&
    rsiSlope > 0 &&
    priceSlope > 0;

  const bearishReversal =
    rsiFast > 65 &&
    rsiSlope < 0 &&
    priceSlope < 0;

  /* =============================
     DIVERGENCE DETECTION
  ============================= */

  const divergence = detectDivergence(closes);

  /* =============================
     BASE SCORING
  ============================= */

  let bull = 0;
  let bear = 0;

  // RSI scoring
  if(rsiFast < 25) bull += 50;
  else if(rsiFast < 40) bull += 25;
  else if(rsiFast > 75) bear += 50;
  else if(rsiFast > 60) bear += 25;

  // Momentum scoring
  if(momentum > 0) bull += 35;
  else if(momentum < 0) bear += 35;

  // Reversal weighting
  if(bullishReversal) bull += 20;
  if(bearishReversal) bear += 20;

  // Divergence weighting
  if(divergence === "bullish") bull += 25;
  if(divergence === "bearish") bear += 25;

  /* =============================
     VOLATILITY WEIGHTING
  ============================= */

  const volWeight = Math.min(1.3, 1 + volatility);

  bull *= volWeight;
  bear *= volWeight;

  /* =============================
     MULTI-LAYER COMPOSITE
  ============================= */

  const microScore = momentum > 0 ? 1 : -1;
  const rsiBias = rsiSlow < 50 ? -0.5 : 0.5;

  const compositeBias =
    (microScore * 0.3) +
    (rsiBias * 0.3) +
    ((bull - bear) * 0.4 / 100);

  if(compositeBias > 0) bull += Math.abs(compositeBias) * 30;
  else bear += Math.abs(compositeBias) * 30;

  const total = bull + bear || 1;

  const bullPct = (bull / total) * 100;
  const bearPct = (bear / total) * 100;

  const probability = Math.abs(bullPct - bearPct);
  const trendStrength = Math.min(100, probability * (1 + volatility));

  renderPanel(bullPct, bullPct, bearPct, probability, trendStrength, rsiFast);

  if(loader) loader.style.display = "none";
}

/* =========================================
   HELPER FUNCTIONS
========================================= */

function calcRSI(closes, period){
  let gains = 0, losses = 0;

  for(let i = closes.length - period; i < closes.length - 1; i++){
    const diff = closes[i+1] - closes[i];
    if(diff > 0) gains += diff;
    else losses -= diff;
  }

  const rs = gains / (losses || 1);
  return 100 - (100 / (1 + rs));
}

function calcVolatility(closes){
  let sum = 0;
  for(let i = closes.length-10; i < closes.length-1; i++){
    sum += Math.abs(closes[i+1] - closes[i]);
  }
  return (sum / 10) / closes[closes.length-1];
}

function detectDivergence(closes){

  if(closes.length < 20) return null;

  const recentLow = Math.min(...closes.slice(-10));
  const previousLow = Math.min(...closes.slice(-20, -10));

  const recentHigh = Math.max(...closes.slice(-10));
  const previousHigh = Math.max(...closes.slice(-20, -10));

  const rsiRecent = calcRSI(closes.slice(-15), 9);
  const rsiPrevious = calcRSI(closes.slice(-25, -10), 9);

  if(recentLow < previousLow && rsiRecent > rsiPrevious)
    return "bullish";

  if(recentHigh > previousHigh && rsiRecent < rsiPrevious)
    return "bearish";

  return null;
}

/* =========================================
   RENDER (UNCHANGED STRUCTURE)
========================================= */

function renderPanel(value, bull, bear, prob, strength, rsi){

  const panel = document.getElementById("ai-panel");
  if(!panel) return;

  const label =
    value < 20 ? "STRONG SELL" :
    value < 40 ? "SELL" :
    value < 60 ? "HOLD" :
    value < 80 ? "BUY" :
    "STRONG BUY";

  const labelColor =
    value < 40 ? "#d32f2f" :
    value < 60 ? "#ffcc00" :
    "#00c853";

  const rsiColor =
    rsi > 70 ? "#d32f2f" :
    rsi < 30 ? "#00c853" :
    "#ffcc00";

  panel.innerHTML = `
    <div style="text-align:center;font-size:24px;font-weight:700;margin:15px 0;color:${labelColor};">
      ${label}
    </div>

    <div style="height:14px;border-radius:10px;background:linear-gradient(90deg,#ff0000,#ff7f00,#ffff00,#7fff00,#00ff00);position:relative;margin-bottom:20px;">
      <div style="position:absolute;top:50%;left:${value}%;transform:translate(-50%, -50%);width:20px;height:20px;border-radius:50%;background:white;border:2px solid #222;transition:left .3s ease;"></div>
    </div>

    <div class="ai-metric">
      <div class="metric-left">
        RSI
        <span class="info-icon" data-info="rsi">i</span>
      </div>
      <div class="ai-metric-value" style="color:${rsiColor};">
        ${rsi.toFixed(2)}
      </div>
    </div>

    <div class="ai-metric">
      <div class="metric-left">
        Bullish Pressure
        <span class="info-icon" data-info="bull">i</span>
      </div>
      <div class="ai-metric-value">${bull.toFixed(1)}%</div>
    </div>

    <div class="ai-metric">
      <div class="metric-left">
        Bearish Pressure
        <span class="info-icon" data-info="bear">i</span>
      </div>
      <div class="ai-metric-value">${bear.toFixed(1)}%</div>
    </div>

    <div class="ai-metric">
      <div class="metric-left">
        Probability
        <span class="info-icon" data-info="probability">i</span>
      </div>
      <div class="ai-metric-value">${prob.toFixed(1)}%</div>
    </div>

    <div class="ai-metric">
      <div class="metric-left">
        Trend Strength
        <span class="info-icon" data-info="strength">i</span>
      </div>
      <div class="ai-metric-value">${strength.toFixed(1)}/100</div>
    </div>

    <div style="margin-top:18px;height:8px;border-radius:6px;background:#ddd;overflow:hidden;">
      <div style="width:${prob}%;height:100%;background:${labelColor};transition:width .25s ease;"></div>
    </div>
  `;
}
