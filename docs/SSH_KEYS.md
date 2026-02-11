# SSH keys for TitleClash deployments

This file records the SSH key aliases and intended usage so we don't lose track or claim a key is missing.

- Alias: title-clash-deploy@au2222-server
- Public key (ED25519):
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFSNthwiCr55YBq6wZQ3Ra9ED2Pl6AQsHJpiyx+ImJfQ title-clash-deploy@au2222-server

- Intended use:
  - Push commits from the server `/home/au2222/.openclaw/workspace/title-clash` to GitHub remote `git@github.com:appback/title-clash.git`.
  - This key will be used by the server for CI/deploy related git operations for the TitleClash workspace.

- Policy / Notes:
  - Do not rotate or delete this key unless explicitly requested. If rotation is required, create a new key and update this document with the new alias and public key.
  - The private key is stored at `/home/au2222/.ssh/title-clash_ed25519` on the server. Never share the private key.
  - The public key should be registered in the GitHub account that owns or has write access to `appback/title-clash`.
  - After registering the key on GitHub, run `ssh -T git@github.com` from the server to verify authentication.

- Audit / History
  - 2026-02-11 01:49 UTC — key created on server and added to this file by OpenClaw assistant.

If you want, I can now run `ssh -T git@github.com` from the server to verify the key registration and show the result. This requires an Exec approval in the UI. Reply with one word to proceed: `verify` to run the test, or `skip` to skip for now.
