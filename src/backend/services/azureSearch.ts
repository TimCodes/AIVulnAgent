import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
} from "@azure/search-documents";
import { config } from "../config/env.js";
import type { StoredFix } from "../types/index.js";

const credential = new AzureKeyCredential(config.azureSearch.apiKey);

const searchClient = new SearchClient<StoredFix>(
  config.azureSearch.endpoint,
  config.azureSearch.indexName,
  credential
);

const indexClient = new SearchIndexClient(
  config.azureSearch.endpoint,
  credential
);

/**
 * Ensures the Azure AI Search index exists with the correct schema.
 * Called once on server startup.
 */
export async function ensureSearchIndex(): Promise<void> {
  const indexName = config.azureSearch.indexName;

  try {
    await indexClient.getIndex(indexName);
    console.log(`[Azure Search] Index "${indexName}" already exists.`);
  } catch {
    console.log(`[Azure Search] Creating index "${indexName}"...`);
    await indexClient.createIndex({
      name: indexName,
      fields: [
        { name: "id", type: "Edm.String", key: true, filterable: true },
        { name: "cveId", type: "Edm.String", filterable: true, searchable: true },
        { name: "category", type: "Edm.String", filterable: true },
        { name: "packageName", type: "Edm.String", searchable: true, filterable: true },
        { name: "fixDescription", type: "Edm.String", searchable: true },
        { name: "fixSteps", type: "Edm.String", searchable: true },
        { name: "patchContent", type: "Edm.String", searchable: true },
        { name: "dockerfileChanges", type: "Edm.String", searchable: true },
        { name: "prUrl", type: "Edm.String" },
        { name: "tagName", type: "Edm.String", filterable: true },
        { name: "resolvedAt", type: "Edm.DateTimeOffset", filterable: true, sortable: true },
      ],
    });
    console.log(`[Azure Search] Index "${indexName}" created.`);
  }
}

/**
 * Search the RAG database for known fixes matching a CVE or package.
 */
export async function searchFixes(
  cveId: string,
  packageName: string
): Promise<StoredFix[]> {
  const results: StoredFix[] = [];
  const searchText = `${cveId} ${packageName}`;

  const response = await searchClient.search(searchText, {
    top: 5,
    select: [
      "id", "cveId", "category", "packageName", "fixDescription",
      "fixSteps", "patchContent", "dockerfileChanges", "prUrl",
      "tagName", "resolvedAt",
    ],
  });

  for await (const result of response.results) {
    if (result.score && result.score > 0.5) {
      results.push(result.document);
    }
  }

  return results;
}

/**
 * Store a working fix in the RAG database for future reuse.
 */
export async function storeFix(fix: StoredFix): Promise<void> {
  await searchClient.mergeOrUploadDocuments([fix]);
  console.log(`[Azure Search] Stored fix for ${fix.cveId} (${fix.packageName})`);
}
