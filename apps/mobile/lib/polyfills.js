const { Buffer } = require("buffer");
const { TextEncoder } = require("text-encoding-utf-8");

// Install before Expo Router loads wallet modules on Hermes.
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;
if (typeof globalThis.TextEncoder === "undefined")
  globalThis.TextEncoder = TextEncoder;
