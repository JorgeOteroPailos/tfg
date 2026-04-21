const BASE_URL = 'http://192.168.1.41:8082';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Error en la petición');
  }

  return response.json() as Promise<T>;
}

export async function loginRequest(
  data: LoginRequest
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<LoginResponse>(response);
}

export async function registerRequest(
  data: RegisterRequest
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<LoginResponse>(response);
}