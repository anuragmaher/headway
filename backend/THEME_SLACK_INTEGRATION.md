# Theme Slack Integration

## Overview

This feature allows users to connect each theme to a specific Slack channel. When features are created or updated in a theme, notifications are automatically sent to that theme's connected Slack channel.

## Architecture

### Database Changes

**Theme Model** (`app/models/theme.py`):
- Added `slack_integration_id` (UUID, FK to integrations)
- Added `slack_channel_id` (String) - Slack channel ID
- Added `slack_channel_name` (String) - Slack channel name for display

**Migration**: `alembic/versions/add_theme_slack_integration.py`

### API Endpoints

**Connect Theme to Slack Channel**:
```
POST /api/v1/features/themes/{theme_id}/slack/connect
Body: {
  "integration_id": "uuid",
  "channel_id": "C1234567890",
  "channel_name": "product-feedback"
}
```

**Disconnect Theme from Slack**:
```
DELETE /api/v1/features/themes/{theme_id}/slack/disconnect
```

### Services

1. **ThemeSlackNotificationService** (`app/services/theme_slack_notification_service.py`):
   - `send_feature_created_notification()` - Sends notification when new feature is created
   - `send_feature_matched_notification()` - Sends notification when feature is matched to existing one
   - Uses Slack API (`chat.postMessage`) instead of webhooks
   - Only sends if theme has active Slack channel connected

2. **SlackService** (`app/services/slack_service.py`):
   - Added `post_message()` method to post messages to Slack channels using `chat.postMessage` API
   - Supports Block Kit formatting for rich notifications

### Integration Points

**Feature Creation/Update** (`app/services/transcript_ingestion_service.py`):
- When features are created or matched, checks if theme has Slack channel connected
- If connected, sends notification to theme's specific channel
- Uses async notification (fire and forget) to avoid blocking

## How It Works

1. **User connects Slack workspace** (existing flow)
2. **User connects theme to Slack channel**:
   - Selects a theme
   - Chooses a Slack integration (if multiple)
   - Selects a channel from that integration
   - Theme is now connected

3. **Feature created/updated**:
   - System checks if theme has `slack_integration_id` and `slack_channel_id`
   - If yes, sends notification to that specific channel
   - Notification includes feature details, theme name, urgency, confidence, etc.

4. **User disconnects**:
   - Removes Slack connection from theme
   - Notifications stop for that theme

## Benefits Over Old System

### Old System (Webhook-based):
- ❌ Single webhook URL for all notifications
- ❌ All themes sent to same channel
- ❌ No per-theme customization
- ❌ Required webhook URL configuration

### New System (Theme-specific):
- ✅ Each theme can have its own Slack channel
- ✅ Uses existing Slack integrations (no webhook needed)
- ✅ Better organization - different teams can monitor different themes
- ✅ More flexible - connect/disconnect per theme
- ✅ Uses Slack API directly (more reliable)

## Example Flow

1. User has Slack workspace connected
2. User creates theme "Design"
3. User connects "Design" theme to `#design-feedback` channel
4. New feature "Dark mode toggle" is created in "Design" theme
5. Notification automatically sent to `#design-feedback` channel:
   ```
   ✨ New Feature Created
   Feature Name: Dark mode toggle
   Theme: Design
   Urgency: HIGH
   ...
   ```

## Frontend Integration (TODO)

The frontend needs to:
1. Show Slack connection status in theme UI
2. Add "Connect to Slack" button in theme settings
3. Show channel selector when connecting
4. Display connected channel name in theme list
5. Add "Disconnect" option

## Testing

To test:
1. Connect a theme to a Slack channel via API
2. Create a feature in that theme
3. Check Slack channel for notification
4. Disconnect theme
5. Create another feature - should not send notification

## Migration Notes

- Old `SlackNotificationService` (webhook-based) is kept for backward compatibility
- New `ThemeSlackNotificationService` is used for theme-specific notifications
- Both can coexist - old system can be deprecated later
