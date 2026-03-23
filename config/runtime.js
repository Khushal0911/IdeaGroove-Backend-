const normalizeOrigin = (origin) => origin.replace(/\/+$/, "");

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_ALT,
  process.env.CLIENT_URL_WWW,
  process.env.NETLIFY_URL
    ? `https://${process.env.NETLIFY_URL.replace(/^https?:\/\//, "")}`
    : null,
  "http://localhost:5173",
].filter(Boolean);

export const allowedOrigins = [
  ...new Set(configuredOrigins.map(normalizeOrigin)),
];

export const isProduction = process.env.NODE_ENV === "production";

export const corsOrigin = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.includes(normalizedOrigin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} not allowed by CORS`));
};

export const sessionCookieOptions = {
  name: "session",
  keys: [process.env.COOKIE_KEY || "idea-groove-secret-key"],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

export const clientAppUrl = allowedOrigins[0] || "http://localhost:5173";
