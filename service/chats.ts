import { api } from "./axios";

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
export const fetchListChats = async (): Promise<Chat[]> => {
  const response = await api.get<Chat[]>("/chats");
  return response.data;
};

export type MessageChat = {
  id: string;
  chatId: string;
  type: "user" | "ai" | "assistant" | "transcription" | "ai_response" | "error";
  content: string;
  createdAt: string;
};

export type ListMessagesPagination = {
  messages: MessageChat[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export const fetchListMessagesFromChat = async (
  chatId: string,
  params?: {
    page?: number;
    limit?: number;
  },
): Promise<ListMessagesPagination> => {
  const queryParams = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
  };

  const response = await api.get<ListMessagesPagination>(
    `/chats/${chatId}/messages`,
    {
      params: queryParams,
    },
  );
  return response.data;
};
