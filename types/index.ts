import type { Role } from '../lib/roles';

export type { Role };

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  chapter_id: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  organization: string;
  created_at: string;
}
