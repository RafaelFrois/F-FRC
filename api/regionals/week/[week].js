import connectMongo from "../../../config/mongo.js";
import { getEventsByYear } from "../../../src/DataBase/services/tba.services.js";
import { methodNotAllowed, setCors, handleOptions } from "../../_lib/http.js";

function getWeekNumberFromDate(dateInput, seasonYear) {
  const week1Start = new Date(seasonYear, 2, 1);
  const eventDate = new Date(dateInput);
  let eventWeek = 1;

  if (eventDate >= new Date(seasonYear, 2, 8)) {
    const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
    eventWeek = Math.floor(daysSinceWeek1 / 7) + 1;
  }

  return eventWeek;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (methodNotAllowed(req, res, ["GET"])) return;

  try {
    await connectMongo();

    const year = new Date().getFullYear();
    const today = new Date();
    const weekParam = parseInt(req.query.week, 10);

    if (!Number.isInteger(weekParam) || weekParam < 1) {
      return res.status(400).json({ message: "Parâmetro week inválido" });
    }

    const events = await getEventsByYear(year);
    const regionals = events.filter((event) => event.event_type === 0 || event.event_type === 1);

    const filtered = regionals.filter((event) => {
      const end = new Date(event.end_date);
      if (today > end) return false;
      return getWeekNumberFromDate(event.start_date, year) === weekParam;
    });

    return res.json(filtered);
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao buscar regionais da semana",
      details: error.message
    });
  }
}
