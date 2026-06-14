# Contributing a TraceCast Example

Community scripts make TraceCast more useful. To submit one:

1. **Keep it self-contained.** Prefer a local HTML page (like `examples/demo-target.html`)
   or a stable, well-known public endpoint. Avoid anything that needs credentials.

2. **Grant the minimum permissions.** Only enable `terminal`, `browser`, or `network`
   if the script actually uses them. Permissions default to `deny`.

3. **Validate before submitting:**

   ```bash
   tracecast validate path/to/your.tracecast.yaml
   ```

4. **Add an assert step where it makes sense.** Assertions turn a demo into a smoke
   test, so a broken demo fails loudly instead of recording garbage.

5. **Document it.** Add a row to `examples/README.md` describing what it demonstrates,
   the permissions it needs, and any prerequisites.

6. **No secrets.** Never commit API keys, tokens, or passwords — not even in comments.

## Style

- One clear idea per script.
- Comment the intent at the top of the file.
- Use `pacing` and `output` blocks that read well in a recording (slower for tutorials,
  faster for CI smoke tests).

## Review

Open a PR. A maintainer will validate the script, run it, and check the produced
artifacts before merging.
