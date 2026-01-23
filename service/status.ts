// 1. Definir el tipo de la respuesta del backend
export type StatusResponse = {
  status: "ok";
  clientsConnected: number;
  uptime: number; // en segundos
  timestamp: number; // timestamp en ms
  message: string;
};

// 2. Tipar la request con Axios
import { api } from "./axios";

export const getStatus = async (): Promise<StatusResponse> => {
  const { data } = await api.get<StatusResponse>("/status");
  return data;
};
