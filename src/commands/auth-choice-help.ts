import type { FoxFangConfig } from "../config/config.js";
import { resolveManifestProviderAuthChoices } from "../plugins/provider-auth-choices.js";
import { formatStaticAuthChoiceChoicesForCli } from "./auth-choice-options.static.js";

type OnboardAuthChoiceHelpParams = {
  includeSkip?: boolean;
  includeLegacyAliases?: boolean;
  config?: FoxFangConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
};

function supportsTextInferenceOnboarding(scopes: readonly string[] | undefined): boolean {
  return scopes ? scopes.includes("text-inference") : true;
}

export function formatOnboardAuthChoiceChoicesForCli(params?: OnboardAuthChoiceHelpParams): string {
  const values = [
    ...formatStaticAuthChoiceChoicesForCli(params).split("|"),
    ...resolveManifestProviderAuthChoices(params)
      .filter((choice) => supportsTextInferenceOnboarding(choice.onboardingScopes))
      .map((choice) => choice.choiceId),
  ];

  return [...new Set(values)].join("|");
}
