---
type: Architecture
title: asks.state shared contract
description: The shape and ownership of Agent Ask's asks.state shared key, and the rules for mods outside Agent Ask that read it.
tags: [contract, shared-state, agent-ask, integration]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-17T09:30:00-03:00 }
resource: plugins/agent-ask/upstream/mods/tabs-asks/state.js
---

# asks.state shared contract

`shared("asks.state")` is the one piece of Agent Ask state that mods outside the plugin may read. This page is the contract required by the [runtime coupling rule](/architecture/repository-layout.md).

## Owner

- Writer: the detection engine in `tabs-asks` (and `asks`, when answering), through `update()` in `state.js`. Nothing outside Agent Ask writes the key.
- Readers outside the plugin: Agent Columns `0001-spaces-asks-count` (pending pill per space in `agent-columns-spaces`).

## Shape

    { schema: 1, asks: Ask[] }

A reader must treat any value whose `schema` is not `1` or whose `asks` is not an array as empty, as `readState()` does.

Fields of `Ask` that readers may rely on:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | stable id of the ask |
| `state` | `"pending"` \| `"sending"` \| `"delivered"` \| `"failed"` \| `"stale"` \| `"dismissed"` | lifecycle; only `pending` waits for the person |
| `space` | string \| null | Herdr space id of the agent |
| `address` | string | terminal address of the agent |
| `kind` | `"QUESTION"` \| `"DECISION"` \| `"APPROVAL"` \| `"UNCLEAR"` | `UNCLEAR`: a dialog that could not be parsed, still blocking the agent |

Every other field is internal to Agent Ask and may change without notice.

## Pending count

An ask waits for the person when `state === "pending"`, whatever its `kind`. `UNCLEAR` counts: the agent is still blocked and the card offers Open terminal. The tab bar badge (`tabs-asks`) and the Spaces pill (`agent-columns-spaces`) both use this definition, so they agree.

## Changing the contract

A change to the fields above, or to the pending definition, bumps `schema` in Agent Ask's `state.js` (both copies) and updates every reader listed under Owner in the same commit.

## Related

- [Agent Ask](/plugins/agent-ask.md)
- [Agent Columns](/plugins/agent-columns.md)
- [Repository layout](/architecture/repository-layout.md)
