export interface GenericResponse<T = any> {
  status?: boolean;
  message?: string;
  data?: T;
}
