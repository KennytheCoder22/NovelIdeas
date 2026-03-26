import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGcdGraphicNovelRecommendations } from "../screens/recommenders/gcd/gcdGraphicNovelRecommender";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const result = await getGcdGraphicNovelRecommendations(input);
    return res.status(200).json({ result });
  } catch (error) {
    console.error("[GCD API] error", error);
    return res.status(500).json({
      error: "GCD API failed",
      result: null,
    });
  }
}
