import axios from "axios";

const BASE_URL = "https://www.thebluealliance.com/api/v3";

const headers = {
  "X-TBA-Auth-Key": process.env.TBA_KEY
};

export async function getEventsByYear(year) {
  if (!process.env.TBA_KEY) {
    console.error("❌ TBA_KEY não está definida! Verifique o .env");
  }
  try {
    console.log("📡 Chamando TBA API para eventos de", year, "com chave:", process.env.TBA_KEY?.substring(0, 10) + "...");
    const response = await axios.get(`${BASE_URL}/events/${year}`, { headers: { "X-TBA-Auth-Key": process.env.TBA_KEY } });
    return response.data;
  } catch (error) {
    console.error("❌ Erro na API TBA:", error.response?.status, error.response?.statusText);
    throw error;
  }
}

export async function getTeamsByEvent(eventKey) {
  const response = await axios.get(`${BASE_URL}/event/${eventKey}/teams`, { headers: { "X-TBA-Auth-Key": process.env.TBA_KEY } });
  return response.data;
}

export async function getTeamEventsByYear(teamNumber, year) {
  const teamKey = `frc${Number(teamNumber)}`;
  const response = await axios.get(`${BASE_URL}/team/${teamKey}/events/${year}/simple`, {
    headers: { "X-TBA-Auth-Key": process.env.TBA_KEY }
  });
  return response.data;
}

export async function getEventOprs(eventKey) {
  const response = await axios.get(`${BASE_URL}/event/${eventKey}/oprs`, {
    headers: { "X-TBA-Auth-Key": process.env.TBA_KEY }
  });
  return response.data;
}