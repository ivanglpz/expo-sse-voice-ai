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
  type:
    | "user"
    | "ai"
    | "assistant"
    | "transcription"
    | "ai_response"
    | "error"
    | "ai_thinking";
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
    order?: "desc" | "asc";
  },
): Promise<ListMessagesPagination> => {
  const queryParams = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    order: params?.order ?? "desc",
  };
  console.log(queryParams?.page);

  const response = await api.get<ListMessagesPagination>(
    `/chats/${chatId}/messages`,
    {
      params: queryParams,
    },
  );
  return response.data;
};

export type ChatMetaData = {
  chatId: string;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export const fetchChatMetadata = async (
  chatId: string,
): Promise<ChatMetaData> => {
  const response = await api.get<ChatMetaData>(
    `/chats/${chatId}/messages/meta`,
  );
  return response.data;
};
