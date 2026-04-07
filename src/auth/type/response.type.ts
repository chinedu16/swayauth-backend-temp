export type LoginResponse = {
  access_token?: string;
  refresh_token?: string | null;
  reference?: string;
  two_factor_enabled?: boolean;
  two_factor_type?: string;
};
