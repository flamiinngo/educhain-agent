import dotenv from "dotenv";
dotenv.config();

import "./server/index.js";
import { startAgent } from "./agent/index.js";

// Start the autonomous agent loop after server is ready
setTimeout(() => {
  startAgent();
}, 3000);