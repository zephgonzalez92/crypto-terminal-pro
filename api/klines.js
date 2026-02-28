// ===== In-Memory Cache (persists while Vercel instance is warm) =====
const cache = {};

export default async function handler(req, res) {

  try {

    const { coin, days } = req.query;

    if (!coin || !days) {
      return res.status(200).json([]);
    }

    // sanitize days safely
    const safeDays = Math.max(1, parseInt(days));
    const cacheKey = `${coin}-${safeDays}`;
    const now = Date.now();

    // ===== 60 SECOND CACHE =====
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < 60000)) {
      return res.status(200).json(cache[cacheKey].data);
    }

    const url =
      `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${safeDays}`;

    // ===== FETCH WITH RETRY =====
    const data = await fetchWithRetry(url, 3);

    if (!data || !Array.isArray(data.prices)) {
      return res.status(200).json([]);
    }

    // Save to cache
    cache[cacheKey] = {
      timestamp: now,
      data: data.prices
    };

    return res.status(200).json(data.prices);

  } catch (error) {

    console.error("Klines API crash:", error);

    // Never return 500
    return res.status(200).json([]);
  }
}

// ===== Retry With Exponential Backoff =====
async function fetchWithRetry(url, retries) {

  for (let attempt = 0; attempt < retries; attempt++) {

    try {

      const response = await fetch(url);

      if (!response.ok) {

        // Rate limit protection
        if (response.status === 429) {
          await delay(1000 * (attempt + 1));
          continue;
        }

        return null;
      }

      return await response.json();

    } catch (err) {

      if (attempt === retries - 1) return null;

      await delay(500 * (attempt + 1));
    }
  }

  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
