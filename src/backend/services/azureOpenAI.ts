import { AzureChatOpenAI } from "@langchain/openai";
import { config } from "../config/env.js";

let _llm: AzureChatOpenAI | null = null;

/**
 * Returns a singleton AzureChatOpenAI instance configured from environment variables.
 * Used by all LangGraph nodes for LLM calls.
 */
export function getLLM(): AzureChatOpenAI {
  if (!_llm) {
    _llm = new AzureChatOpenAI({
      azureOpenAIApiKey: config.azureOpenAI.apiKey,
      azureOpenAIApiInstanceName: extractInstanceName(config.azureOpenAI.endpoint),
      azureOpenAIApiDeploymentName: config.azureOpenAI.deployment,
      azureOpenAIApiVersion: config.azureOpenAI.apiVersion,
      temperature: 0.1,
      maxTokens: 4096,
    });
  }
  return _llm;
}

/**
 * Extracts the instance name from an Azure OpenAI endpoint URL.
 * e.g. "https://my-resource.openai.azure.com" -> "my-resource"
 */
function extractInstanceName(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.hostname.split(".")[0];
  } catch {
    return endpoint;
  }
}
