# Decisions

- [0001 Vendor + patches](./0001-vendor-plus-patches.md) - Pristine upstream snapshots with per-plugin patch queues
- [0002 Unified primary layout](./0002-unified-primary-layout.md) - Agent Columns + Asks in one layout (Flockbook part superseded by 0006)
- [0003 Flockbook helper from source](./0003-flockbook-helper-from-source.md) - cargo build with a side-by-side pinned toolchain
- [0004 Asks never calls a model](./0004-asks-no-model.md) - Model classification removed in code; log outside repos
- [0005 Base layout for every plugin](./0005-base-layout-integration-point.md) - chowdr-herdr-ctrl is repository-owned and hosts all plugins
- [0006 Per-terminal chat view](./0006-per-terminal-chat-view.md) - Flockbook's chat embedded and toggled per terminal; flockbook layout removed
- [0007 Usage from a statusline tap](./0007-usage-from-statusline-tap.md) - Plan limits from Claude Code's statusline payload, no credentials; one repository-owned usage mod
