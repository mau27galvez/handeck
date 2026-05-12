import type { SocialProvider } from "better-auth/social-providers";

const authViewPaths = {
  signIn: "sign-in",
  signUp: "sign-up",
  signOut: "sign-out",
  magicLink: "magic-link",
  forgotPassword: "forgot-password",
  resetPassword: "reset-password",
} as const;

const settingsViewPaths = {
  account: "account",
  security: "security",
} as const;

export type AuthPath = (typeof authViewPaths)[keyof typeof authViewPaths];
export type SettingsPath =
  (typeof settingsViewPaths)[keyof typeof settingsViewPaths];

const emailAndPasswordEnabled = false;
const magicLinkEnabled = false;
const passkeyEnabled = false;
const socialProviders: SocialProvider[] = ["google"];
const signUpEnabled = emailAndPasswordEnabled;

export const authUiConfig = {
  emailAndPassword: {
    enabled: emailAndPasswordEnabled,
    forgotPassword: false,
    requireEmailVerification: false,
  },
  magicLink: magicLinkEnabled,
  passkey: passkeyEnabled,
  socialProviders,
};

export const allowedAuthPaths = [
  authViewPaths.signIn,
  authViewPaths.signOut,
  ...(signUpEnabled ? [authViewPaths.signUp] : []),
  ...(magicLinkEnabled ? [authViewPaths.magicLink] : []),
  ...(emailAndPasswordEnabled
    ? [authViewPaths.forgotPassword, authViewPaths.resetPassword]
    : []),
] as const satisfies readonly AuthPath[];

export function isAllowedAuthPath(path: string): path is AuthPath {
  return allowedAuthPaths.includes(path as AuthPath);
}

export const allowedSettingsPaths = [
  settingsViewPaths.account,
  settingsViewPaths.security,
] as const satisfies readonly SettingsPath[];

export function isAllowedSettingsPath(path: string): path is SettingsPath {
  return allowedSettingsPaths.includes(path as SettingsPath);
}
