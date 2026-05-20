# ChapterOps — Project Context & Product Rules

## What ChapterOps Is

ChapterOps is a mobile-first operational management app for fraternity chapters.

The app exists to:

* centralize chapter operations
* reduce communication chaos
* improve accountability
* improve visibility
* simplify logistics
* keep members on track
* prevent things from falling through the cracks
* preserve operational continuity between officers

The app is NOT:

* a social media platform
* a chat app
* Discord
* Slack
* GroupMe
* a gamified productivity app
* a public social feed

This is an operational coordination system.

---

# Core Product Philosophy

## Show only what needs attention

The app should minimize cognitive load.

Do NOT show:

* every task
* every workflow
* every piece of metadata
* every supervised item

Only show:

* actionable items
* overdue items
* submitted items needing review
* upcoming important events
* operational problems

Additional detail should appear only after drilling deeper.

---

# Events are hubs. Tasks are actions.

Events are the operational center.

Tasks are actions tied to:

* events
* workflows
* responsibilities

Navigation rules:

* Event click → Event Detail
* Task click → Task Detail
* Task Detail may link to Event Detail
* Event Detail shows all related actions/tasks/responses

Do NOT create duplicate RSVP experiences.

---

# Mobile-first UX Rules

The app is designed for quick operational clarity on mobile.

Priorities:

* minimal clutter
* fast scanning
* thumb-friendly interaction
* simple navigation
* clear hierarchy

Avoid:

* excessive text
* dense dashboards
* unnecessary metadata
* decorative UI
* bloated layouts
* too many sections

If a screen feels crowded, simplify it.

---

# MVP Scope

Current MVP includes:

* authentication placeholders
* role system
* Today feed
* Calendar
* Events
* Tasks
* RSVP system
* reminders/placeholders
* approvals/placeholders
* recurring events
* role-based visibility
* event creation
* shared mock state

Current MVP does NOT include:

* AI automation
* advanced analytics
* chat systems
* complex gamification
* full J-board system
* production notifications
* advanced integrations
* full backend production logic

Keep the MVP simple and operational.

---

# Roles & Operational Hierarchy

## Brother

Should see:

* their own tasks
* chapter events
* RSVP/actions
* upcoming events

Should NOT see:

* officer accountability dashboards
* leadership oversight systems
* escalated operational systems

---

## Officers

Officers should primarily see:

* their own tasks
* their own events
* overdue issues in their area

Officers should NOT see every chapter operational detail.

---

## Pro Consul

Operational coordinator.

Should see:

* escalated items
* overdue operational issues
* submitted excuses/responses
* accountability problems
* officer compliance
* chapter operational health

Should NOT see every supervised task unless action is required.

---

## President / Consul

High-level operational oversight.

Should primarily see:

* major issues
* escalations
* chapter health
* final approvals
* important operational concerns

Should NOT appear personally responsible for every task.

---

## Annotator

Responsible for:

* minutes
* attendance
* officer reports
* documentation workflows

Should not receive unrelated operational tasks.

---

# Event System Rules

Events contain:

* title
* type
* date
* time
* location
* mandatory/optional
* description
* recurring settings
* related tasks
* RSVP/actions

Recurring events:

* each occurrence must have its own unique eventId
* RSVP state must exist per occurrence
* recurring series may share a seriesId/templateId

Changing RSVP for one occurrence must NOT affect the entire series.

---

# RSVP Rules

RSVPs are editable until the RSVP deadline.

Mandatory events:

* require RSVP
* "Not attending" requires excuse

E-Board absence:

* requires excuse
* requires covering person

Excuses should appear for:

* Pro Consul
* President
* Annotator

No approval workflow is needed yet.
Leadership visibility is sufficient for MVP.

---

# Task Philosophy

Tasks should feel lightweight whenever possible.

Tasks are either:

* simple actions
* operational work items

Simple actions:

* RSVP
* acknowledgements
* name submissions
* yes/no responses

Operational tasks:

* reports
* planning
* logistics
* recruitment work
* risk management
* event preparation

Do NOT overcomplicate task structures.

Subtasks should generally behave like standalone milestone tasks instead of deeply nested systems.

---

# Task Visibility Rules

Show users:

* what they personally need to do
* what requires their attention

Do NOT dump all supervised tasks onto dashboards.

Escalation visibility should occur only when:

* overdue
* escalated
* submitted for review
* operationally important

---

# State Management Rules

Mock/dev state should behave like a shared real application.

Changes made in one role must appear:

* across screens
* across role switches
* across related workflows

Avoid isolated local component state for operational data.

Use centralized shared state.

---

# Navigation Rules

Task click:

* open Task Detail

Event click:

* open Event Detail

Today cards:

* should navigate correctly

Avoid confusing duplicate screens.

---

# Design Language

The design should feel:

* operational
* clean
* calm
* structured
* lightweight
* professional

Not:

* playful
* social-media-like
* overly colorful
* gamified

Urgency should stand out clearly.

Red = problem/overdue.
Amber = warning/mandatory.
Neutral = normal operations.

---

# Development Rules

Before implementing major systems:

1. explain architecture
2. explain state flow
3. explain navigation flow
4. explain edge cases
5. then implement

Avoid:

* large sweeping refactors
* unnecessary abstractions
* premature optimization
* overengineering

Favor:

* simple scalable systems
* predictable behavior
* operational clarity
* incremental improvements

---

# Current Architecture

Frontend:

* Expo
* React Native
* TypeScript
* Expo Router

Backend (future):

* Supabase
* Postgres
* Realtime
* Auth

Current state:

* mostly mock/local shared state

AI systems:

* future phase only
* NOT MVP priority
