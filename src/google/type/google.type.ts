export interface GoogleCodeResponseProp {
  state: string;
  error: string;
  code: string;
  scope: string;
  authuser: string;
  prompt: string;
}

export interface GoogleTokenResponseProp {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface GooglePhoneResponseProp {
  resourceName: string;
  etag: string;
  phoneNumbers: {
    metadata: object;
    value: string;
    canonicalForm: string;
  }[];
}

export interface StateProps {
  user_type: 'client' | 'user';
  redirect_url: string;
  organization_id: string;
  origins: string[];
  organization_token_id: string;
}

export interface JwtDecode {
  iss: 'https://accounts.google.com';
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  locale: string;
  exp: number;
}
