import {io} from "socket.io-client";
import { socketUrl } from "../utils/util";

export const socket = io(socketUrl);
