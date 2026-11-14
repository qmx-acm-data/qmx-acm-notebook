# Trusted release inputs

The release workflow is dispatched from `main`. Its `trust` job checks out the exact workflow commit (`github.sha`) and resolves the requested stable tag to a commit already in `origin/main` history. Before a downstream job checks out that tag, the guard compares the two immutable Git trees using the `TRUSTED_INPUTS` array embedded in the trusted workflow. It does not obtain an allowlist or execute a comparison helper from the tag. `git diff --no-ext-diff --no-textconv --quiet` rejects differences, including additions, deletions, and file-mode or symlink changes, in any listed path. The moving `origin/main` ref is used for ancestry only, never as the comparison baseline.

## Build and execution graph

| Input | How the release uses it | Comparison scope |
| --- | --- | --- |
| `package.json` | pnpm scripts and lifecycle hooks, package manager version, production and development dependencies, application entry point and version | Exact file |
| `pnpm-lock.yaml` | Frozen dependency resolution, including TypeScript, Node declarations, Electron, packager/builder, production JavaScript and WASM dependencies and their transitives | Exact file |
| `pnpm-workspace.yaml`, `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`, `pnpmfile.cjs`, `patches/`, `.gitattributes` | Workspace/install policy, dependency hooks or patches, and checkout attributes; absent listed paths are still checked if introduced in the other tree | Exact files and recursive patches directory |
| `tools/package.cjs` and `tools/installer.cjs` | Package application, verify accepted ASAR bytes, select official Electron runtime, and produce installers/archives | Recursive `tools/` |
| `tools/build-app.cjs` | Check tracked generated output, copy `electron/` and `ui/` into `build/app`, write runtime package metadata, stage every production dependency and transitive production asset | Recursive `tools/`, `electron/`, `ui/`; package and lock files |
| `tools/build-reading-detail.cjs` | Read `tsconfig.json` and declarations, compile `src/renderer/reading/reading-detail.ts`, verify `ui/reading-detail.js` | Recursive `tools/`, `src/`, `types/`, `ui/`; root config glob |
| `tools/build-preload.cjs` | Read inherited preload config, compile `src/preload/preload.ts`, enforce standalone sandbox code, verify `electron/preload.cjs` | Recursive `tools/`, `src/`, `types/`, `electron/`; root config glob |
| `tools/build-ipc-boundary.cjs` | Use the preload compiler with boundary config for main IPC, renderer IPC, and local-record sources, checking emitted runtime boundaries | Recursive `tools/`, `src/`, `types/`, `tests/`, `electron/`, `ui/`; root config glob |
| `tools/build-modules.cjs` | Compile renderer modules with `tsconfig.modules.json` and main/tool/server modules with `tsconfig.node.json`; compare emitted code with original tracked `ui/`, `electron/`, `tools/`, and `server.js` paths | Recursive source/output/tool/type/test directories; exact server file; root config glob |
| `src/` | All main, renderer, preload, shared, tool, and server TypeScript sources, including update/signing/package code and shared models | Entire recursive directory, covering future files |
| `tsconfig*.json`, `types/`, `tests/types/`, `tests/types-node/` | Compiler target/module/resolution rules, inherited settings, ambient declarations, and compile-time assertion inputs | Root-only Git glob `:(top,glob)tsconfig*.json`; recursive type/test directories |
| `tools/update-manifest.cjs`, `tools/release-feed.cjs`, `tools/delta-feed.cjs`, updater/key/delta modules | Signing, pinned-key verification, delta creation and verification, feed installation, and installer integrity | Recursive `tools/`, `electron/`; original ten explicit critical paths retained |
| `tools/test-app.cjs`, `tests/`, `data/` | Build before tests, execute test files/helpers and Linux acceptance script, and validate algorithm JSON against generated runtime data | Entire recursive directories |

The source check is an extension of the existing emitted-tool comparison. Both source and generated output are trusted inputs: unchanged tracked JavaScript does not excuse changed TypeScript, generators, declarations, compiler settings, or dependencies. Generated output remains in its original paths. The guard itself does not compile, regenerate, install dependencies, or execute tag-controlled scripts.

The signer, signing-key check, and draft preparation continue to check out `github.sha`. Tag builds and packaging consume the resolved `needs.trust.outputs.release_sha`, and all depend on the successful trust job. The signing key remains confined to the existing trusted signing jobs. The update protocol, pinned repository and public key, channel activation, and signed-feed validation are unchanged.

## Deliberately separate data

Ordinary user documentation and release notes are outside the executable trust comparison. Packaging copies `docs/USAGE.md` as passive installer text; algorithm tests also read passive JSON evidence under `docs/algorithm-research/`. These do not control compilation or execute as application/build code. They do not justify requiring the entire documentation tree to match.

`feed/` and `resources/` contain signed channel manifests, the previously activated archive, and delta data. Their provenance continues to be enforced by the existing pinned-key, version, and SHA-256 checks. The signer obtains the previous channel base from its trusted checkout. Those data paths may differ from the release tag without weakening the source comparison.

## Regression checks

`tests/release-workflow.test.cjs` checks that the exact trusted SHA is the baseline, downstream source checkouts wait for `trust`, and signing jobs use the trusted checkout. A local regression extracts and runs the actual Bash allowlist/comparison loop against isolated Git tree objects. It independently changes source files, generators, inherited configs, declarations, package/lock/install controls, and tracked outputs, then asserts rejection. It also rejects newly added sources/generators/configs/types and a deleted source, permits documentation and signed-channel data differences, and confirms that uncommitted working files cannot change the tree comparison. It creates no commits or tags, executes no build or signing action, and uses no network.
