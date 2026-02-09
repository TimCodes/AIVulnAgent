import { StateGraph, END } from "@langchain/langgraph";
import { RemediationStateAnnotation } from "./state.js";
import type { RemediationStateType } from "./state.js";
import {
  classifyVuln,
  tryRebuild,
  searchRAG,
  researchFix,
  createPRNode,
  createTagWorkflowNode,
  verifyRebuildResult,
  storeInRAG,
} from "./agentNodes.js";

/**
 * Builds and compiles the vulnerability remediation agent map.
 *
 * Flow:
 *
 *   classify
 *      │
 *      ├── container ──▶ tryRebuild
 *      │                    │
 *      │              fixed? ── yes ──▶ createTagWorkflow ──▶ END
 *      │                    │           (no RAG — just a rebuild)
 *      │                    no
 *      │                    │
 *      │                    ▼
 *      │               searchRAG
 *      │                    │
 *      │              found? ── yes ──▶ createTagWorkflow ──▶ storeInRAG ──▶ END
 *      │                    │
 *      │                    no
 *      │                    │
 *      │                    ▼
 *      │              researchFix ──▶ createTagWorkflow ──▶ storeInRAG ──▶ END
 *      │
 *      └── code ──▶ searchRAG
 *                       │
 *                  found? ── yes ──▶ createPR ──▶ storeInRAG ──▶ END
 *                       │
 *                       no
 *                       │
 *                       ▼
 *                  researchFix ──▶ createPR ──▶ storeInRAG ──▶ END
 */
export function buildRemediationAgentMap() {
  const graph = new StateGraph(RemediationStateAnnotation)
    // Register all nodes
    .addNode("classifyVuln", classifyVuln)
    .addNode("tryRebuild", tryRebuild)
    .addNode("searchRAG", searchRAG)
    .addNode("researchFix", researchFix)
    .addNode("createPR", createPRNode)
    .addNode("createTagWorkflow", createTagWorkflowNode)
    .addNode("verifyRebuildResult", verifyRebuildResult)
    .addNode("storeInRAG", storeInRAG)

    // Entry point
    .addEdge("__start__", "classifyVuln")

    // After classification: route to container or code path
    .addConditionalEdges("classifyVuln", (state: RemediationStateType) => {
      if (state.category === "container") return "tryRebuild";
      return "searchRAG_code";
    }, {
      tryRebuild: "tryRebuild",
      searchRAG_code: "searchRAG",
    })

    // After tryRebuild: if rebuild fixes it, still need a tag for user approval;
    // otherwise search RAG for a deeper fix
    .addConditionalEdges("tryRebuild", (state: RemediationStateType) => {
      if (state.rebuildWouldFix) return "createTagWorkflow";
      return "searchRAG_container";
    }, {
      createTagWorkflow: "createTagWorkflow",
      searchRAG_container: "searchRAG",
    })

    // After searchRAG: route based on category and whether we found a fix
    .addConditionalEdges("searchRAG", (state: RemediationStateType) => {
      const isContainer = state.category === "container";

      if (state.ragFixApplicable && isContainer) return "createTagWorkflow";
      if (state.ragFixApplicable && !isContainer) return "createPR";
      return "researchFix";
    }, {
      createTagWorkflow: "createTagWorkflow",
      createPR: "createPR",
      researchFix: "researchFix",
    })

    // After researchFix: route to PR (code) or tag workflow (container)
    .addConditionalEdges("researchFix", (state: RemediationStateType) => {
      if (state.category === "container") return "createTagWorkflow";
      return "createPR";
    }, {
      createTagWorkflow: "createTagWorkflow",
      createPR: "createPR",
    })

    // After PR: always store the fix in RAG
    .addEdge("createPR", "storeInRAG")

    // After tag workflow: always verify the rebuild result
    .addEdge("createTagWorkflow", "verifyRebuildResult")

    // After verification: store fix if successful, otherwise end with failure
    .addConditionalEdges("verifyRebuildResult", (state: RemediationStateType) => {
      if (state.rebuildSuccessful) return "storeInRAG";
      return "done";
    }, {
      storeInRAG: "storeInRAG",
      done: END,
    })

    // After storing: done
    .addEdge("storeInRAG", END);

  return graph.compile();
}
