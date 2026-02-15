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
  type: "user";
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
): Promise<ListMessagesPagination> => {
  const response = await api.get<ListMessagesPagination>(
    `/chats/${chatId}/messages`,
  );
  return response.data;
};
