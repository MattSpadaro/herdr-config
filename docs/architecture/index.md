# Architecture

- [Repository layout](./repository-layout.md) - What lives where and who owns each directory
- [Build pipeline](./build-pipeline.md) - How herdrcfg.py turns upstream snapshots and patches into a Herdr home tree
- [Base layout as the integration point](./base-layout.md) - chowdr-herdr-ctrl hosts every plugin; plugins install mods, not layouts
- [Per-terminal chat view](./chat-view.md) - Terminal / Chat switch per terminal, Flockbook's chat embedded in the base layout
- [Agent usage](./agent-usage.md) - Plan limits strip and per-agent usage panel, fed by a statusline tap and local transcripts
- [Folder picker for new spaces](./folder-picker.md) - Dropdown on the Spaces + that opens a shell in a chosen, default or favorite folder
- [Claude session labels contract](./session-labels-contract.md) - cc.session / cc.transcript labels set by a Claude Code hook, read by the board's card menu
- [asks.state contract](./asks-state-contract.md) - Shape and owner of Agent Ask's shared state for readers outside the plugin
- [Install semantics](./install-semantics.md) - Manifest, conflict rules, JSON merges and checks during install
