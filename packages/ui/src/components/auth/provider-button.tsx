import { authMutationKeys, getProviderName } from "@better-auth-ui/core";
import { providerIcons, useAuth, useSignInSocial } from "@better-auth-ui/react";
import { useIsMutating } from "@tanstack/react-query";
import type { SocialProvider } from "better-auth/social-providers";
import type { ComponentProps } from "react";

import { Button } from "@handeck/ui/components/button";
import { Spinner } from "@handeck/ui/components/spinner";

export type ProviderButtonProps = {
  provider: SocialProvider;
  display?: "full" | "name" | "icon";
  /** When `display` is `"full"`, overrides the default “Continue with …” label. */
  label?: string;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children" | "disabled">;

/**
 * Social provider sign-in button.
 *
 * @param provider - Provider to sign in with.
 * @param display - `"full"` (e.g. "Continue with Google"), `"name"` (just the provider name), or `"icon"` (icon only).
 * @param label - When `display` is `"full"`, overrides the default localized "Continue with …" text.
 */
export function ProviderButton({
  provider,
  display = "full",
  variant = "outline",
  label,
  ...props
}: ProviderButtonProps) {
  const { authClient, baseURL, localization, redirectTo } = useAuth();

  const callbackURL = `${baseURL}${redirectTo}`;

  const { mutate: signInSocial, isPending: signInSocialPending } = useSignInSocial(authClient);

  const ProviderIcon = providerIcons[provider];

  const signInMutating = useIsMutating({
    mutationKey: authMutationKeys.signIn.all,
  });
  const signUpMutating = useIsMutating({
    mutationKey: authMutationKeys.signUp.all,
  });
  const isPending = signInMutating + signUpMutating > 0;

  return (
    <Button
      type="button"
      variant={variant}
      disabled={isPending}
      onClick={() => signInSocial({ provider, callbackURL })}
      {...props}
      aria-label={label ?? getProviderName(provider)}
    >
      {signInSocialPending ? <Spinner /> : <ProviderIcon />}

      {display === "full"
        ? (label ??
          localization.auth.continueWith.replace("{{provider}}", getProviderName(provider)))
        : display === "name"
          ? getProviderName(provider)
          : null}
    </Button>
  );
}
