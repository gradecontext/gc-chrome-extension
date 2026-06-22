# CLAUDE.md

# ContextGrade Browser Extension

## Mission

The browser extension is the primary capture mechanism for ContextGrade.

It lives where work happens.

Most modern work occurs inside browser-based software:

* Jira
* Salesforce
* HubSpot
* Figma
* Zendesk
* Linear
* GitHub

The extension captures decision context at the moment decisions happen.

---

# Product Goal

Capture the "why" behind important actions.

Not every click matters.

Not every page view matters.

Only meaningful decisions matter.

---

# Examples

Good signals:

* Ticket closed
* Ticket escalated
* Discount changed
* Deal approved
* Comment resolved
* Design published
* Incident acknowledged
* Pull request approved

Bad signals:

* Mouse movement
* Navigation
* Scrolling
* Typing
* Random clicks

We are not analytics software.

We are not surveillance software.

---

# Extension Responsibilities

The extension should:

1. Observe meaningful events
2. Ask whether context should be saved
3. Collect rationale
4. Send trace data to backend
5. Remain lightweight

The extension should NOT:

1. Make decisions
2. Score employees
3. Monitor productivity
4. Record unnecessary activity

---

# Architecture

The extension contains:

## Content Scripts

Responsible for:

* DOM observation
* Event detection
* Site-specific integrations

No business logic.

No AI logic.

No API orchestration.

---

## Background Worker

Responsible for:

* authentication
* API communication
* caching
* syncing

---

## UI Layer

Responsible for:

* prompts
* side panels
* note capture
* user interaction

The UI should feel similar to:

* Grammarly
* Loom
* Notion AI

Minimal and unobtrusive.

---

# Supported Applications

Initial targets:

* Jira
* Figma
* HubSpot

Future targets:

* Salesforce
* GitHub
* Zendesk
* Linear
* Google Docs

All integrations should be isolated.

Example:

/content/sites/jira.ts

/content/sites/figma.ts

/content/sites/hubspot.ts

Never mix site-specific logic.

---

# Event Model

All site integrations emit a common event structure.

Example:

{
sourceApp: "jira",
eventType: "ticket_closed",
entityId: "ENG-442",
title: "Fix login timeout",
url: "...",
timestamp: "..."
}

The extension should normalize events.

The backend should not care where events came from.

---

# UX Principles

Capture should be frictionless.

Users should never feel interrupted.

Preferred pattern:

Decision detected
↓
Small prompt
↓
Optional rationale
↓
Save

Avoid:

* full-screen modals
* repeated popups
* intrusive notifications

---

# Security Principles

Collect the minimum amount of data required.

Never collect:

* passwords
* payment information
* private messages
* keystrokes

Only collect decision-related metadata.

---

# Future Vision

The extension becomes:

A memory layer for work.

Eventually it should help users answer:

* Why did we do this?
* Have we done this before?
* What precedent exists?
* What happened last time?

The extension captures context.

The backend builds memory.

Together they create the Context Graph.

---

# Engineering Principle

Optimize for:

* signal quality
* maintainability
* explainability

Do not optimize for:

* event volume
* surveillance
* complexity

The goal is preserving human judgment.
