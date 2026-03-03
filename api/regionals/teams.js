import teamsByEventHandler from "./[eventKey]/teams.js";

export default async function handler(req, res) {
  req.query = {
    ...(req.query || {}),
    eventKey: String(req.query?.eventKey || req.query?.event_key || "").trim()
  };

  return teamsByEventHandler(req, res);
}