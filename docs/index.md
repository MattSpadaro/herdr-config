---
okf_version: "0.2"
---

# Herdr app configuration

Knowledge bundle for the personal Herdr app setup kept in this repository: seven upstream plugins vendored with isolated patches, repository-owned mods, a Monokai visual base, and a build/install tool. Read this before changing anything under `plugins/`, `config/` or `herdrcfg.py`.

- [Architecture](./architecture/index.md) - Repository layout, build pipeline and install semantics
- [Plugins](./plugins/index.md) - Each vendored upstream plugin, its pin, patches and runtime surface
- [Layouts](./layouts/index.md) - The layouts installed into the Herdr home and how they are composed
- [Playbooks](./playbooks/index.md) - Step-by-step procedures for recurring changes
- [Decisions](./decisions/index.md) - Architecture decision records with rationale and trade-offs
- [References](./references/index.md) - Keybindings, privacy surface, Herdr facts this setup depends on
