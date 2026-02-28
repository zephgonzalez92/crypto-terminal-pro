/* ===== RESTORE SAVED STATE ===== */

let currentCoin = localStorage.getItem("selectedCoin") || "ethereum";
let aiTimeframe = localStorage.getItem("selectedTimeframe") || "1m";

let liveInterval = null;
let liveCloses = [];
let debounceTimer = null;
let currentFetchController = null;
let requestVersion = 0;
let priceFetchInProgress = false;

/* ===== RESTORE THEME ===== */

const savedTheme = localStorage.getItem("selectedTheme");
if (savedTheme === "white") {
  document.body.classList.add("white");
}

/* ===== MAPS ===== */

const coinMap = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  litecoin: "litecoin",
  dogecoin: "dogecoin",
  ripple: "ripple",
  cardano: "cardano"
};

const binanceMap = {
  bitcoin: "BTCUSDT",
  ethereum: "ETHUSDT",
  solana: "SOLUSDT",
  litecoin: "LTCUSDT",
  dogecoin: "DOGEUSDT",
  ripple: "XRPUSDT",
  cardano: "ADAUSDT"
};

const timeframeDaysMap = {
  "1m": 1,
  "5m": 1,
  "30m": 3,
  "1h": 7,
  "4h": 14,
  "1d": 30,
  "1w": 90,
  "1mo": 180,
  "3mo": 365
};

/* ===== SAVE FUNCTIONS ===== */

function saveSelections() {
  localStorage.setItem("selectedCoin", currentCoin);
  localStorage.setItem("selectedTimeframe", aiTimeframe);
}

function saveTheme() {
  const theme = document.body.classList.contains("white") ? "white" : "dark";
  localStorage.setItem("selectedTheme", theme);
}

/* ===== GLOBAL ERROR GUARD ===== */

window.addEventListener("unhandledrejection", function (event) {
  console.warn("Handled async error:", event.reason);
});

/* ===== DEBOUNCE ===== */

function debounce(callback, delay = 400) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(callback, delay);
}

/* ===== CHART ===== */

function createChart() {
  try {
    const symbol = binanceMap[currentCoin];
    document.getElementById("tv_chart").innerHTML = "";

    new TradingView.widget({
      autosize: true,
      symbol: "BINANCE:" + symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: document.body.classList.contains("white") ? "light" : "dark",
      style: "1",
      container_id: "tv_chart"
    });

  } catch (err) {
    console.warn("Chart error:", err);
  }
}

/* ===== LOAD HISTORICAL ===== */

async function loadHistorical() {
  try {
    const days = timeframeDaysMap[aiTimeframe];

    requestVersion++;
    const thisRequest = requestVersion;

    if (currentFetchController) {
      currentFetchController.abort();
    }

    currentFetchController = new AbortController();

    const res = await fetch(
      `/api/klines?coin=${coinMap[currentCoin]}&days=${days}`,
      { signal: currentFetchController.signal }
    );

    if (!res.ok) {
      console.warn("Historical fetch failed:", res.status);
      return;
    }

    const data = await res.json();
    if (!Array.isArray(data)) return;
    if (thisRequest !== requestVersion) return;

    const closes = data.map(p => p[1]);
    liveCloses = closes.slice(-200);

    if (typeof calculateAndRender === "function") {
      calculateAndRender(liveCloses);
    }

  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("loadHistorical error:", err);
    }
  }
}

/* ===== ENHANCED REAL-TIME STRUCTURE ===== */

let microCandle = {
  open: null,
  high: null,
  low: null,
  close: null,
  startTime: null
};

function updateMicroCandle(price) {

  const now = Date.now();

  if (!microCandle.startTime) {
    microCandle = {
      open: price,
      high: price,
      low: price,
      close: price,
      startTime: now
    };
    return;
  }

  microCandle.high = Math.max(microCandle.high, price);
  microCandle.low = Math.min(microCandle.low, price);
  microCandle.close = price;

  if (now - microCandle.startTime >= 10000) {

    liveCloses.push(microCandle.close);

    if (liveCloses.length > 200)
      liveCloses.shift();

    microCandle.startTime = now;
    microCandle.open = price;
    microCandle.high = price;
    microCandle.low = price;
    microCandle.close = price;

    if (typeof calculateAndRender === "function") {
      calculateAndRender(liveCloses);
    }
  }
}

/* ===== SAFE POLLING ===== */

function startLiveUpdates() {

  if (liveInterval) clearInterval(liveInterval);

  liveInterval = setInterval(async () => {

    if (priceFetchInProgress) return;
    if (document.hidden) return;

    priceFetchInProgress = true;

    try {

      const res = await fetch(
        `/api/price?coin=${coinMap[currentCoin]}`
      );

      if (!res.ok) {
        priceFetchInProgress = false;
        return;
      }

      const data = await res.json();
      if (!data || !data.usd) {
        priceFetchInProgress = false;
        return;
      }

      updateMicroCandle(data.usd);

    } catch (err) {
      console.warn("Live update error:", err);
    }

    priceFetchInProgress = false;

  }, 2000);
}

/* ===== CHANGE HANDLERS ===== */

function changeCoin(coin) {
  debounce(() => {
    currentCoin = coin;
    saveSelections();
    createChart();
    loadHistorical();
    startLiveUpdates();
  });
}

function changeAITimeframe(tf) {
  debounce(() => {
    aiTimeframe = tf;
    saveSelections();
    loadHistorical();
    startLiveUpdates();
  });
}

/* ===== INIT ===== */

document.addEventListener("DOMContentLoaded", () => {

  const coinDropdown = document.getElementById("coinSelect");
  const tfDropdown = document.getElementById("aiTimeframeSelect");
  const themeToggle = document.getElementById("themeToggle");

  if (coinDropdown) coinDropdown.value = currentCoin;
  if (tfDropdown) tfDropdown.value = aiTimeframe;

  if (coinDropdown) {
    coinDropdown.addEventListener("change", e =>
      changeCoin(e.target.value)
    );
  }

  if (tfDropdown) {
    tfDropdown.addEventListener("change", e =>
      changeAITimeframe(e.target.value)
    );
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("white");
      saveTheme();
      createChart();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      startLiveUpdates();
    }
  });

  createChart();
  loadHistorical();
  startLiveUpdates();
});
