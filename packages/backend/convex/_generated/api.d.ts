/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as baseTemplate from "../baseTemplate.js";
import type * as dictionarySearch from "../dictionarySearch.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as privateData from "../privateData.js";
import type * as profile from "../profile.js";
import type * as schemas from "../schemas.js";
import type * as template from "../template.js";
import type * as word from "../word.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  baseTemplate: typeof baseTemplate;
  dictionarySearch: typeof dictionarySearch;
  healthCheck: typeof healthCheck;
  http: typeof http;
  privateData: typeof privateData;
  profile: typeof profile;
  schemas: typeof schemas;
  template: typeof template;
  word: typeof word;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
