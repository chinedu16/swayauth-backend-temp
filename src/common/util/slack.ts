import { WebClient } from '@slack/web-api';
const web = new WebClient(process.env.SLACK_TOKEN, {});

export const reportErrorToSlack = (data: any) => {
  const json = `
  ${'```'}
  Date: ${new Date().toLocaleDateString([], { timeZone: 'Africa/Lagos', hour12: true, hourCycle: 'h12', day: '2-digit', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })}
  
  
  ${JSON?.stringify(data, null, 2)}
  ${'```'}
  `;

  web.chat
    .postMessage({
      text: json,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: json,
          },
        },
      ],
      channel: process.env.SLACK_CHANNEL_ID,
    })
    .catch(async () => {
      // console.log(err, 'postMessage')
      web.conversations
        .join({ channel: process.env.SLACK_CHANNEL_ID as string })
        .catch(() => {
          // console.log(err, 'join')
        });
    });
};
