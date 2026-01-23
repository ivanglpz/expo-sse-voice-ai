import AXIOS from "axios";
import { CONFIG } from "../config/config";

export const api = AXIOS.create({ baseURL: CONFIG.API_URL });
