import { $Enums } from '@prisma/client';

export interface JWTProp {
  sub: string;
  email: string;
  two_factor_type: $Enums.two_factor_type;
  access: $Enums.access;
  scope: $Enums.scope[];
  permissions: $Enums.permissions[];
  status: $Enums.status;
  company_id: string;
  organization_id: string;
  organization_token_id: string;
}

export type AuthType =
  | 'Organization-Secret'
  | 'Bearer'
  | 'Application-Key'
  | 'Swayauth-Identifier'
  | null;
