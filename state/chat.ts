import { atom } from "jotai";
import { MessageChat } from "../service/chats";
import { UUID } from "../utils/uuid";

export type Session = {
  id: string;
  messages: MessageChat[];
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
    { chatId, message }: { chatId: string; message: MessageChat },
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
