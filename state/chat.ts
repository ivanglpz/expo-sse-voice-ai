import { atom, PrimitiveAtom } from "jotai";
import { UUID } from "../utils/uuid";

export type Message = {
  id: string;
  type: "user" | "ai" | "transcription" | "ai_response" | "error";
  text: PrimitiveAtom<string>;
  timestamp: number;
  message?: string;
};

export type Session = {
  id: string;
  messages: Message[];
};
export const CHATS_ATOM = atom<Session[]>([]);

export const CREATE_CHAT_ATOM = atom(null, async (get, set) => {
  const chats = get(CHATS_ATOM);
  const newChat: Session = {
    id: UUID(),
    messages: [],
  };
  set(CHATS_ATOM, [...chats, newChat]);
  return newChat.id;
});

export const CREATE_MESSAGE_ATOM = atom(
  null,
  async (
    get,
    set,
    { chatId, message }: { chatId: string; message: Message },
  ) => {
    const chats = get(CHATS_ATOM);
    const updatedChats = chats.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: [...chat.messages, message],
        };
      }
      return chat;
    });
    set(CHATS_ATOM, updatedChats);
  },
);

export const DELETE_CHAT_ATOM = atom(null, async (get, set, chatId: string) => {
  const chats = get(CHATS_ATOM);
  const updatedChats = chats.filter((chat) => chat.id !== chatId);
  set(CHATS_ATOM, updatedChats);
});

export const DELETE_MESSAGE_ATOM = atom(
  null,
  async (
    get,
    set,
    { chatId, messageId }: { chatId: string; messageId: string },
  ) => {
    const chats = get(CHATS_ATOM);
    const updatedChats = chats.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.filter((message) => message.id !== messageId),
        };
      }
      return chat;
    });
    set(CHATS_ATOM, updatedChats);
  },
);

export const CLEAR_CHATS_ATOM = atom(null, async (get, set) => {
  set(CHATS_ATOM, []);
});

export const GET_HISTORY_CHAT = atom(null, (get, set, chatId: string) => {
  const chats = get(CHATS_ATOM);
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) return [];
  return chat.messages.map((msg) => {
    const textValue = get(msg.text);
    return {
      role: msg.type === "user" ? "user" : "assistant",
      content: textValue,
    };
  });
});

type UpdateMessageParams = {
  messageId: string;
  newText: string;
  sessionId: string;
};

export const UPDATE_MESSAGE_ATOM = atom(
  null,
  async (get, set, { sessionId, messageId, newText }: UpdateMessageParams) => {
    const chats = get(CHATS_ATOM);
    const GET_CHAT = chats.find((c) => c.id === sessionId);

    if (!GET_CHAT) return;
    const GET_MESSAGE = GET_CHAT?.messages.find((m) => m.id === messageId);
    if (!GET_MESSAGE) return;

    set(GET_MESSAGE.text, newText);
  },
);
