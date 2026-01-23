import { atomWithQuery } from "jotai-tanstack-query";
import { getStatus } from "../service/status";

export const statusAtom = atomWithQuery((get) => ({
  queryKey: ["status"],
  queryFn: getStatus,
  refetchInterval: 60000, // cada 1 minuto
  refetchIntervalInBackground: true, // opcional: sigue refrescando si la app está en background
}));
