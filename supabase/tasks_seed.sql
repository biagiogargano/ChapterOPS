-- ─── ChapterOPS · Tasks seed (structured tasks only) ──────────────────────────
--
-- Run AFTER tasks_schema.sql. Seeds persistent versions of the STRUCTURED tasks
-- from lib/mockTasks.ts (MOCK_TASKS). Lightweight RSVP / name-submission tasks
-- are intentionally NOT seeded — their completion stays owned by the rsvps table
-- (rsvpStore), and they continue to come from MOCK_TASKS at runtime.
--
-- Ids match the mock ids ('tk3', 'tk5', 'tk5a'…) so parent/child links and
-- devTaskStore keys keep working without remapping.
--
-- Idempotent: deletes this chapter's task rows then re-inserts. Parent rows
-- (tk5, tk7) are listed BEFORE their children so the self-referential
-- parent_task_id FK is satisfied within the single INSERT statement.

DELETE FROM tasks WHERE chapter_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

INSERT INTO tasks (
  id, chapter_id, title, type, lightweight_kind, state, urgency, due_label,
  assigned_role, assigned_to, visible_to_all, visible_to,
  linked_event, linked_event_id, description,
  linked_event_mandatory, requires_covering,
  requires_proof, proof_type, requires_approval, reviewer_role,
  is_workflow_parent, parent_task_id, supervisor_role,
  escalation_chain, escalated_to,
  proof_content, rejection_note, created_by_role
) VALUES

  -- tk3 · Submit officer report (escalated / overdue)
  ('tk3', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Submit officer report', 'structured', NULL,
   'escalated', 'overdue', 'Was due Mon, May 12',
   'president', 'Biagio Gargano (President)', false, ARRAY['president','pro_consul','annotator'],
   NULL, NULL,
   'Monthly officer report due to national headquarters. Include chapter financials, event recap, membership count, and any disciplinary notes. Use the national template.',
   false, false,
   true, 'document', true, 'pro_consul',
   false, NULL, 'pro_consul',
   ARRAY['president','pro_consul'], 'pro_consul',
   '', '', NULL),

  -- tk4 · Assign literary exercise
  ('tk4', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Assign literary exercise', 'structured', NULL,
   'assigned', 'today', 'Today by 8:00 PM',
   'annotator', 'Annotator', false, ARRAY['president','pro_consul','annotator'],
   'Chapter Meeting', NULL,
   'Select and distribute this week''s literary exercise before the chapter meeting. Paste the excerpt as your proof of completion.',
   false, false,
   true, 'text', false, NULL,
   false, NULL, 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk5 · Draft risk plan for Date Party (workflow PARENT — must precede tk5a–tk5d)
  ('tk5', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Draft risk plan for Date Party', 'structured', NULL,
   'assigned', 'week', 'Wed, May 21',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Complete the national risk management plan template. Include venue info, alcohol policy, guest list cap, sober monitor assignments, and emergency contacts.',
   false, false,
   true, 'document', true, 'president',
   true, NULL, 'president',
   ARRAY['risk_manager','pro_consul','president'], NULL,
   '', '', NULL),

  -- tk5a · Confirm Date Party venue details (approved)
  ('tk5a', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Confirm Date Party venue details', 'structured', NULL,
   'approved', 'week', 'Mon, May 19',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Confirm the venue name, address, capacity, and any venue-specific rules for the Date Party. Submit as a brief summary.',
   false, false,
   true, 'text', true, 'president',
   false, 'tk5', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk5b · Draft alcohol policy for Date Party
  ('tk5b', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Draft alcohol policy for Date Party', 'structured', NULL,
   'assigned', 'week', 'Tue, May 20',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Draft the alcohol policy using the national risk management template. Include serving limits, ID verification, and cut-off times.',
   false, false,
   true, 'document', true, 'president',
   false, 'tk5', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk5c · Set guest list cap for Date Party (no proof / no approval)
  ('tk5c', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Set guest list cap for Date Party', 'structured', NULL,
   'assigned', 'week', 'Wed, May 21',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Determine the maximum guest list size based on venue capacity and national guidelines. Communicate the cap to the Social Chair.',
   false, false,
   false, NULL, false, NULL,
   false, 'tk5', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk5d · Assign emergency contacts for Date Party
  ('tk5d', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Assign emergency contacts for Date Party', 'structured', NULL,
   'assigned', 'week', 'Wed, May 21',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Designate at least two chapter members as emergency contacts for the Date Party. Include names and phone numbers.',
   false, false,
   true, 'text', false, NULL,
   false, 'tk5', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk6 · Confirm sober monitors (standalone)
  ('tk6', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Confirm sober monitors', 'structured', NULL,
   'assigned', 'week', 'Thu, May 22',
   'risk_manager', 'Risk Manager', false, ARRAY['president','pro_consul','risk_manager'],
   'Date Party', NULL,
   'Confirm 4 sober monitors for the Date Party. List their names and confirm each has completed national risk management training.',
   false, false,
   true, 'text', true, 'pro_consul',
   false, NULL, 'pro_consul',
   ARRAY['risk_manager','pro_consul'], NULL,
   '', '', NULL),

  -- tk7 · Recruitment video submission (workflow PARENT — must precede tk7a–tk7d)
  ('tk7', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Recruitment video submission', 'structured', NULL,
   'submitted', 'week', 'Fri, May 23',
   'recruitment_chair', 'Recruitment Chair', false, ARRAY['president','pro_consul','recruitment_chair'],
   NULL, NULL,
   'Submit the chapter''s official recruitment video for national review. Must be under 3 minutes, include the chapter motto, and follow national brand guidelines.',
   false, false,
   true, 'link', true, 'president',
   true, NULL, 'president',
   ARRAY['recruitment_chair','pro_consul','president'], NULL,
   '', '', NULL),

  -- tk7a · Submit recruitment video script (approved)
  ('tk7a', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Submit recruitment video script', 'structured', NULL,
   'approved', 'week', 'Fri, May 9',
   'recruitment_chair', 'Recruitment Chair', false, ARRAY['president','pro_consul','recruitment_chair'],
   NULL, NULL,
   'Submit the script and theme concept for the recruitment video. Must include the chapter motto and key messaging.',
   false, false,
   true, 'text', true, 'president',
   false, 'tk7', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk7b · Record recruitment video footage (approved, no approval needed)
  ('tk7b', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Record recruitment video footage', 'structured', NULL,
   'approved', 'week', 'Fri, May 16',
   'recruitment_chair', 'Recruitment Chair', false, ARRAY['president','pro_consul','recruitment_chair'],
   NULL, NULL,
   'Record all footage for the recruitment video following the approved script.',
   false, false,
   true, 'image', false, NULL,
   false, 'tk7', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk7c · Edit and finalize recruitment video (submitted)
  ('tk7c', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Edit and finalize recruitment video', 'structured', NULL,
   'submitted', 'week', 'Fri, May 23',
   'recruitment_chair', 'Recruitment Chair', false, ARRAY['president','pro_consul','recruitment_chair'],
   NULL, NULL,
   'Edit the recorded footage into the final recruitment video. Must be under 3 minutes and follow national brand guidelines.',
   false, false,
   true, 'link', true, 'president',
   false, 'tk7', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL),

  -- tk7d · Submit final video to national portal
  ('tk7d', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Submit final video to national portal', 'structured', NULL,
   'assigned', 'week', 'Fri, May 23',
   'recruitment_chair', 'Recruitment Chair', false, ARRAY['president','pro_consul','recruitment_chair'],
   NULL, NULL,
   'Submit the final approved recruitment video to national headquarters via the national portal. Include the chapter ID in the form.',
   false, false,
   true, 'link', true, 'president',
   false, 'tk7', 'president',
   ARRAY[]::text[], NULL,
   '', '', NULL);

-- Verify
SELECT id, title, state, urgency, assigned_role, parent_task_id
FROM tasks
WHERE chapter_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
ORDER BY id;
