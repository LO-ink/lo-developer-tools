# Bot credentials and group messages

LO tokens have the form `<bot_id>:<43 base64url characters>`. Pass the token only to a server transport. Keep it out of browser bundles, repositories, logs, app URLs and verification reports. Revoke a leaked token in LO Connect and update the server configuration.

[security/gitleaks.toml](../security/gitleaks.toml) provides a credential detection rule. Include it in your Gitleaks configuration. Review matches: synthetic test credentials may also fit the pattern.

Enable the appropriate bot setting in LO Connect to read all group messages. The SDK cannot grant this access. `getIdentity().canReadAllGroupMessages` reflects getMe's `can_read_all_group_messages`. Check it after changing the setting; group membership alone is insufficient.

The owner grants secretary rights separately. Group access, bot credentials and permission to send on an owner's behalf are distinct.
