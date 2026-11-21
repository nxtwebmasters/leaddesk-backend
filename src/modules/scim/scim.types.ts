export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig';
export const SCIM_RESOURCE_TYPE_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:ResourceType';

export interface ScimName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
}

export interface ScimEmail {
  value: string;
  type?: string;
  primary?: boolean;
}

export interface ScimMeta {
  resourceType: string;
  created: string;
  lastModified: string;
  location: string;
  version?: string;
}

export interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string | null;
  userName: string;
  name?: ScimName;
  displayName?: string;
  nickName?: string;
  title?: string | null;
  department?: string | null;
  active: boolean;
  emails: ScimEmail[];
  meta: ScimMeta;
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface ScimErrorResponse {
  schemas: string[];
  status: string;
  scimType?: string;
  detail: string;
}

export interface ScimPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value: any;
}

export interface ScimPatchBody {
  schemas: string[];
  Operations: ScimPatchOperation[];
}
