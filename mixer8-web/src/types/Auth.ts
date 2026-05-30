export type UserRole = 'Admin' | 'Moderator' | 'PaidUser' | 'User';

export interface IUser {
  UserId: string;
  Email: string;
  UserRole: UserRole;
  CreatedAt: string;
}

export interface IAuthState {
  IsAuthenticated: boolean;
  CurrentUser: IUser | null;
  Token: string | null;
}
