# Faster feedback while editing

For presentation-only changes to Home, shared navigation, Demo or Session, run this subset from the repository root:

```sh
node --test tests/network-ui.test.mjs tests/demo-ui.test.mjs tests/session-ui.test.mjs
```

Use Node 22 satisfying `package.json` and already installed, reviewed dependencies. Run only in an isolated local environment with synthetic fixtures, no production bindings and no private secrets. The command itself does not create that isolation.

The Session suite also renders Demo and exercises the actual Demo-to-Session journey. Including it catches cross-component changes that Demo-only checks can miss. These fixtures do not establish native-browser usability, hosted sign-in or genuine market results.

Do not append filenames to `npm test` to select this subset: its existing script already expands `tests/*.test.mjs`, so the full suite remains included.

This recipe is not complete dependency analysis. Changes to engines, authentication, storage, protocols, shared logic or CI require broader test selection based on the actual change.

For the final change, retain the required `npm test`, `npm run typecheck`, `npm run build` and `git diff --check`, plus the unchanged full CI against the exact approved source. Record the source, commands, outcomes and failures. A subset pass does not replace those gates or grant release approval.
