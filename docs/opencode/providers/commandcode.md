# Command Code Provider

Command Code provider and models definitions are automatically handled by the
[`opencode-cmd-provider`](https://github.com/rashidrazak/opencode-cmd-provider)
plugin.

## Zero Data Retention (ZDR)

The `opencode-cmd-provider` plugin does not set ZDR in the request headers by default.
Instead, ZDR can be enabled via the `CMD_ZDR` environment variable. To enable
strict ZDR for the current shell process, execute either of the following commands:

```shell
CMD_ZDR=1 opencode --standalone

# Or:

export CMD_ZDR=1
opencode --standalone
```

The `--standalone` flag tells OpenCode to start and bind to its own dedicated
background server rather than the global OpenCode background server. Typically,
OpenCode instances bind to a global server; however, since this global server
is a resource shared by all OpenCode instances, this causes reliability issues
in the ZDR header being enabled.
