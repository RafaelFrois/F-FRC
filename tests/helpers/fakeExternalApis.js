// Substitui as chamadas HTTP do axios (TBA/Statbotics) por dados de teste.
// FIXTURES DE TESTE: não representam eventos ou equipes reais.
import axios from "axios";

export const fakeApis = {
  events: [],
  teamsByEvent: {},
  failTba: false
};

function respond(config, data) {
  return Promise.resolve({ data, status: 200, statusText: "OK", headers: {}, config, request: {} });
}

function notFound(config) {
  const error = new Error(`fake 404 ${config.url}`);
  error.config = config;
  error.response = { status: 404, statusText: "Not Found", data: null, headers: {}, config };
  return Promise.reject(error);
}

export function installFakeExternalApis() {
  axios.defaults.adapter = (config) => {
    const url = `${config.baseURL || ""}${config.url || ""}`;
    if (url.includes("thebluealliance.com")) {
      if (fakeApis.failTba) {
        const error = new Error("fake TBA indisponível");
        error.config = config;
        return Promise.reject(error);
      }
      if (/\/events\/\d{4}$/.test(url)) return respond(config, fakeApis.events);
      const teamsMatch = url.match(/\/event\/([^/]+)\/teams$/);
      if (teamsMatch) {
        const teams = fakeApis.teamsByEvent[teamsMatch[1]];
        return teams ? respond(config, teams) : notFound(config);
      }
    }
    return notFound(config);
  };
}
