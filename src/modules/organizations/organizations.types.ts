import { z } from 'zod';

export const OrgRole = {
  OWNER: 'OWNER',
  ORG_ADMIN: 'ORG_ADMIN',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
  GUEST_STAKEHOLDER: 'GUEST_STAKEHOLDER',
  COMPLIANCE_AUDITOR: 'COMPLIANCE_AUDITOR',
} as const;

export type OrgRole = keyof typeof OrgRole;

export const OrgRoleEnum = z.enum([
  'OWNER',
  'ORG_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'MEMBER',
  'GUEST_STAKEHOLDER',
  'COMPLIANCE_AUDITOR',
]);

export const CreateOrgSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters'),
  domain: z.string().trim().optional(),
  logoUrl: z.string().url().optional(),
});

export const UpdateOrgSchema = z.object({
  name: z.string().trim().min(2).optional(),
  domain: z.string().trim().optional(),
  logoUrl: z.string().url().optional(),
});

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters'),
  description: z.string().trim().optional(),
  parentId: z.string().uuid().optional(),
});

export const CreateTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team / Squad name must be at least 2 characters'),
  description: z.string().trim().optional(),
  workspaceId: z.string().uuid(),
  leadUserId: z.string().uuid().optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  role: OrgRoleEnum.default('MEMBER'),
  title: z.string().trim().optional(),
  department: z.string().trim().optional(),
});

export const AcceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
});

export const UpdateMemberRoleSchema = z.object({
  role: OrgRoleEnum.optional(),
  title: z.string().trim().optional(),
  department: z.string().trim().optional(),
  reportsToId: z.string().uuid().nullable().optional(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
