const API_BASE_URL = "";

import axios from 'axios';
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });


export const registerUser = async (userData) => {
  try {
    const response = await fetch(`/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erro ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await fetch(`/api/login`, {
      method: "POST",
      credentials: 'include',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erro ao fazer login");
    }

    return data;
  } catch (error) {
    throw error;
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
    const response = await fetch(`http://localhost:3000/api/me`, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao buscar usuário atual');
    return data.user;
  } catch (error) {
    throw error;
  }
};

export const updateMe = async (payload) => {
  try {
    const response = await fetch(`http://localhost:3000/api/me`, {
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
    const response = await fetch(`http://localhost:3000/api/me/photo`, {
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
