import { defineConfig, InputTransformerFn } from "orval";
import path from "path";
import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Workaround: orval's bundled file-loader (@scalar/json-magic) currently fails to resolve a plain
// "./openapi.yaml" string path — its readFiles() loader returns raw string content but the resolver
// requires an object, so it throws "Failed to resolve input" (reproduced on orval 8.9.1 through
// 8.20.0, the latest at time of writing). Parsing the YAML ourselves and passing the object directly
// bypasses that broken code path entirely. Safe to remove this workaround once upstream fixes it —
// just revert `target` back to the "./openapi.yaml" string.
const openApiSpec = parseYaml(readFileSync(path.resolve(__dirname, "openapi.yaml"), "utf-8"));

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: openApiSpec,
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: openApiSpec,
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
