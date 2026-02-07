import { getConfigValue } from './config.js';

export interface NotificationPayload {
  title: string;
  message: string;
  level?: 'info' | 'warning' | 'error' | 'success';
  fields?: { name: string; value: string }[];
}

/**
 * Send a Slack notification via webhook
 */
export async function sendSlackNotification(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = getConfigValue('SLACK_WEBHOOK_URL');

  if (!webhookUrl) {
    console.log('[Notifications] Slack webhook not configured');
    return false;
  }

  const color = {
    info: '#2196F3',
    warning: '#FF9800',
    error: '#F44336',
    success: '#4CAF50',
  }[payload.level || 'info'];

  const slackPayload = {
    attachments: [
      {
        color,
        title: payload.title,
        text: payload.message,
        fields: payload.fields?.map(f => ({
          title: f.name,
          value: f.value,
          short: f.value.length < 50,
        })),
        footer: 'Pauly',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      console.error(`[Notifications] Slack webhook failed: ${response.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Notifications] Slack webhook error:', err);
    return false;
  }
}

/**
 * Send a Discord notification via webhook
 */
export async function sendDiscordNotification(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = getConfigValue('DISCORD_WEBHOOK_URL');

  if (!webhookUrl) {
    console.log('[Notifications] Discord webhook not configured');
    return false;
  }

  const color = {
    info: 0x2196F3,
    warning: 0xFF9800,
    error: 0xF44336,
    success: 0x4CAF50,
  }[payload.level || 'info'];

  const discordPayload = {
    embeds: [
      {
        title: payload.title,
        description: payload.message,
        color,
        fields: payload.fields?.map(f => ({
          name: f.name,
          value: f.value,
          inline: f.value.length < 50,
        })),
        footer: {
          text: 'Pauly',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error(`[Notifications] Discord webhook failed: ${response.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Notifications] Discord webhook error:', err);
    return false;
  }
}

/**
 * Send notification to all configured channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<{
  slack: boolean;
  discord: boolean;
}> {
  const [slack, discord] = await Promise.all([
    sendSlackNotification(payload),
    sendDiscordNotification(payload),
  ]);

  return { slack, discord };
}

/**
 * Notify about task failure
 */
export async function notifyTaskFailure(
  taskType: string,
  errorMessage: string,
  projectName?: string
): Promise<void> {
  await sendNotification({
    title: `Task Failed: ${taskType}`,
    message: errorMessage,
    level: 'error',
    fields: projectName
      ? [{ name: 'Project', value: projectName }]
      : undefined,
  });
}

/**
 * Notify about task success
 */
export async function notifyTaskSuccess(
  taskType: string,
  message: string,
  projectName?: string
): Promise<void> {
  await sendNotification({
    title: `Task Completed: ${taskType}`,
    message,
    level: 'success',
    fields: projectName
      ? [{ name: 'Project', value: projectName }]
      : undefined,
  });
}

/**
 * Notify about dead-letter queue issues
 */
export async function notifyDeadLetterAlert(
  abandonedCount: number,
  pendingCount: number
): Promise<void> {
  if (abandonedCount === 0 && pendingCount < 10) {
    return; // No alert needed
  }

  await sendNotification({
    title: 'Dead-Letter Queue Alert',
    message: `There are ${abandonedCount} abandoned tasks and ${pendingCount} pending retries in the dead-letter queue.`,
    level: abandonedCount > 0 ? 'error' : 'warning',
    fields: [
      { name: 'Abandoned', value: abandonedCount.toString() },
      { name: 'Pending', value: pendingCount.toString() },
    ],
  });
}
