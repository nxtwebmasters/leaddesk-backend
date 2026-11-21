import { z } from 'zod';

export const SSO_PROVIDERS = ['OKTA', 'AZURE_AD', 'GOOGLE', 'GENERIC_SAML'] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

export const updateSsoConfigSchema = z.object({
  ssoEnabled: z.boolean().default(false),
  ssoProvider: z.enum(SSO_PROVIDERS).optional().nullable(),
  ssoEntityId: z.string().trim().optional().nullable(),
  ssoLoginUrl: z.string().trim().url('Single Sign-On URL must be a valid URL').optional().nullable().or(z.literal('')),
  ssoAcsUrl: z.string().trim().optional().nullable().or(z.literal('')),
  ssoCert: z.string().trim().optional().nullable().or(z.literal('')),
  ssoMetadataUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  enforceSso: z.boolean().default(false),
  allowedDomains: z.array(z.string().trim().toLowerCase()).default([]),
});

export type UpdateSsoConfigInput = z.infer<typeof updateSsoConfigSchema>;

export interface SamlIdentity {
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
  nameId: string;
  issuer?: string;
}

export interface SsoInitiateResult {
  redirectUrl: string;
  samlRequest?: string;
  relayState?: string;
  isMock?: boolean;
}
