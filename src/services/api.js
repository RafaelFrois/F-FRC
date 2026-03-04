const API_BASE_URL = "";

import axios from 'axios';
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

const REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponseSafe(response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    if (response.ok) {
      throw new Error("Resposta inválida do servidor.");
    }

    throw new Error(`Erro ${response.status}: resposta inválida do servidor.`);
  }
}

function normalizeApiError(error, fallbackMessage) {
  if (error?.name === "AbortError") {
    return new Error("Tempo limite excedido. Verifique a conexão e tente novamente.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}


export const registerUser = async (userData) => {
  try {
    const response = await fetchWithTimeout(`/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await parseResponseSafe(response);

    if (!response.ok) {
      throw new Error(data.message || `Erro ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    throw normalizeApiError(error, "Erro ao cadastrar usuário");
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await fetchWithTimeout(`/api/login`, {
      method: "POST",
      credentials: 'include',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseResponseSafe(response);

    if (!response.ok) {
      throw new Error(data.message || "Erro ao fazer login");
    }

    return data;
  } catch (error) {
    throw normalizeApiError(error, "Erro ao fazer login");
  }
};

export const getUser = async (id) => {
  try {
    const response = await fetch(`/api/user/${id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao buscar usuário');
    return data.user;
  } catch (error) {
    throw error;
  }
};

export const updateUser = async (id, payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao atualizar usuário');
    return data.user;
  } catch (error) {
    throw error;
  }
};

export const uploadProfilePhoto = async (id, file) => {
  try {
    const form = new FormData();
    form.append('profilePhoto', file);
    const response = await fetch(`${API_BASE_URL}/user/${id}/photo`, {
      method: 'POST',
      body: form
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao enviar foto');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getMe = async () => {
  try {
    const response = await fetch(`/api/me`, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao buscar usuário atual');
    return data.user;
  } catch (error) {
    throw error;
  }
};

export const updateMe = async (payload) => {
  try {
    const response = await fetch(`/api/me`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao atualizar usuário');
    return data.user;
  } catch (error) {
    throw error;
  }
};

export const uploadProfilePhotoMe = async (file) => {
  try {
    const form = new FormData();
    form.append('profilePhoto', file);
    const response = await fetch(`/api/me/photo`, {
      method: 'POST',
      credentials: 'include',
      body: form
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao enviar foto');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getWorldRanking = async ({ search = "", name = "", teamNumber = "" } = {}) => {
  try {
    const params = new URLSearchParams();
    if (String(search || "").trim()) params.set("q", String(search).trim());
    if (String(name || "").trim()) params.set("name", String(name).trim());
    if (String(teamNumber || "").trim()) params.set("teamNumber", String(teamNumber).trim());
    const url = params.toString() ? `/api/ranking?${params.toString()}` : "/api/ranking";
    const response = await fetch(url, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao buscar ranking mundial");
    return data;
  } catch (error) {
    throw error;
  }
};

export const getPublicProfile = async (userId) => {
  try {
    const response = await fetch(`/api/ranking?userId=${encodeURIComponent(userId)}`, {
      credentials: "include"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao buscar perfil público");
    return data;
  } catch (error) {
    throw error;
  }
};
