import type { UserProfile } from '@/types';

export const DEMO_USER: UserProfile = {
  id: 'demo-biagio',
  email: 'biagio@alphalambda.org',
  full_name: 'Biagio Gargano',
  role: 'president',
  chapter_id: 'demo-chapter',
  created_at: new Date().toISOString(),
};

export const DEMO_CHAPTER = {
  id: 'demo-chapter',
  name: 'Alpha Lambda',
  organization: 'ChapterOPS Demo',
};
