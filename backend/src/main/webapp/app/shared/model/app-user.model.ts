export interface IAppUser {
  id?: number;
  email?: string;
  fullName?: string;
  phone?: string | null;
  accountStatus?: string;
  googleSubject?: string | null;
  passwordHash?: string | null;
}

export const defaultValue: Readonly<IAppUser> = {};
