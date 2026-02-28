export default async function handler(req, res) {
  const { coin = "ethereum" } = req.query;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`
    );

    const data = await response.json();

    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch price" });
  }
}
