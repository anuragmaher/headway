# Required Slack OAuth Scopes

This document outlines the required OAuth scopes for the user token (xoxp-) used in the SlackService.

## Current Operations

Based on the `SlackService` implementation, the following Slack API endpoints are used:

1. **`auth.test`** - Validates user token (no scope required)
2. **`conversations.list`** - Lists public and private channels
3. **`conversations.history`** - Fetches message history from channels
4. **`users.info`** - Gets user information
5. **`chat.postMessage`** - Posts messages to channels (for theme notifications)

## Required User Token Scopes

For a **user token (xoxp-)**, the following scopes are required:

### Required Scopes

1. **`channels:read`** - Required to list public channels via `conversations.list`
   - Allows reading public channel metadata (name, purpose, topic, member count)
   - Used in: `get_channels()` for public channels

2. **`groups:read`** - Required to list private channels via `conversations.list`
   - Allows reading private channel metadata
   - Used in: `get_channels()` for private channels (when `include_private=True`)

3. **`channels:history`** - Required to read message history from public channels
   - Allows fetching messages from public channels
   - Used in: `get_channel_messages()` for public channels

4. **`groups:history`** - Required to read message history from private channels
   - Allows fetching messages from private channels
   - Used in: `get_channel_messages()` for private channels

5. **`users:read`** - Required to get user information
   - Allows reading basic user information (name, email, etc.)
   - Used in: `get_user_info()`

6. **`chat:write`** - Required to post messages to channels
   - Allows posting messages to channels where the user is a member
   - Used in: `post_message()` for theme notifications
   - **Note**: While user tokens can have this scope, it's more common to use a bot token (xoxb-) with `chat:write` for posting messages

## Recommended Approach

For **posting messages** (`chat.postMessage`), it's recommended to use a **bot token (xoxb-)** instead of a user token because:

1. Bot tokens are more secure and don't expire when users leave the workspace
2. Bot tokens can post to channels without being a member (if invited)
3. Bot tokens are better for automated notifications

### Bot Token Scopes (if using bot token for posting)

If you switch to using a bot token for `post_message()`, the bot token would need:
- **`chat:write`** - To post messages to channels
- **`channels:read`** - To read channel information (optional, for validation)

## Complete Scope List

For a user token that handles all current operations, request these scopes:

```
channels:read,groups:read,channels:history,groups:history,users:read,chat:write
```

## OAuth Flow

When setting up the OAuth flow, include these scopes in the authorization URL:

```
https://slack.com/oauth/v2/authorize?
  client_id=YOUR_CLIENT_ID&
  scope=channels:read,groups:read,channels:history,groups:history,users:read,chat:write&
  redirect_uri=YOUR_REDIRECT_URI
```

## Notes

- **Private channels**: The `groups:read` and `groups:history` scopes only allow access to private channels where the user is already a member
- **Message posting**: User tokens with `chat:write` can only post to channels where the user is a member
- **Token expiration**: User tokens can expire if the user revokes access or leaves the workspace
- **Bot tokens**: Consider using bot tokens for `chat.postMessage` to avoid token expiration issues

## Future Considerations

If you plan to:
- Post to channels without being a member → Use bot token with `chat:write`
- Access DMs → Add `im:read` and `im:history` scopes
- Access group DMs → Add `mpim:read` and `mpim:history` scopes
- Manage channels → Add `channels:manage` scope
- Invite users → Add `users:write` scope
