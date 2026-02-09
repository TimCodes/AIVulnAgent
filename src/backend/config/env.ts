import dotenv from "dotenv";
dotenv.config();

export const config = {
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
    apiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview",
  },
  azureSearch: {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT ?? "",
    apiKey: process.env.AZURE_SEARCH_API_KEY ?? "",
    indexName: process.env.AZURE_SEARCH_INDEX_NAME ?? "vuln-fixes",
  },
  github: {
    token: process.env.GITHUB_TOKEN ?? "",
    owner: process.env.GITHUB_OWNER ?? "",
    repo: process.env.GITHUB_REPO ?? "",
  },
  server: {
    port: parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
  },
} as const;
