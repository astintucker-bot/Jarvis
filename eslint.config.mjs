import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  { ignores: [".next/**", ".next-production/**", "node_modules/**", "public/**", "server.py"] },
];

export default config;
