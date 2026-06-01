export type UserRole = 'Admin' | 'Moderator' | 'PaidUser' | 'User' | string;

export interface IUser {
  UserId: string;
  Email: string;
  UserRole: UserRole;
  CreatedAt: string;
  UserName: string;
  FirstName?: string;
  LastName?: string;
  Phone?: string;
  Bio?: string;
  AvatarUrl?: string;
}

export interface IAuthState {
  IsAuthenticated: boolean;
  CurrentUser: IUser | null;
  Token: string | null;
}
