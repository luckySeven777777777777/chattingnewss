const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 配置信息
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; // 必须是数字，例如 -100123456789
const TIMEZONE = 'Asia/Yangon'; // 缅甸时区

const bot = new Telegraf(BOT_TOKEN);

// 用于存储当天已发送图片的用户 ID
// 实际生产环境建议使用 Redis，Railway 内存重启会清空此变量
let activeUsers = new Set();

// 监听图片和转发的消息
bot.on(['photo', 'forward_date'], (ctx) => {
  if (ctx.chat.id.toString() === GROUP_ID.toString()) {
    activeUsers.add(ctx.from.id);
    console.log(`Recorded activity from: ${ctx.from.first_name}`);
  }
});

// 每天中午 12:00 (缅甸时间) 执行任务
// Cron 表达式说明: 分(0) 时(12) 日(*) 月(*) 周(*)
cron.schedule('0 12 * * *', async () => {
  try {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    
    // 获取群组管理员列表（由于 Telegram 限制，Bot 很难直接获取所有普通成员名单）
    // 技巧：通常 Bot 只能获取管理员列表。如果是小群，建议手动维护一个 ID 列表。
    const chatMembers = await bot.telegram.getChatAdministrators(GROUP_ID);
    
    let mentions = "";
    chatMembers.forEach(member => {
      if (!activeUsers.has(member.user.id) && !member.user.is_bot) {
        mentions += `@${member.user.username || member.user.first_name} `;
      }
    });

    if (mentions.length > 0) {
      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentions.trim()}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages`;
      
      await bot.telegram.sendMessage(GROUP_ID, text);
    }

    // 重置当天的记录
    activeUsers.clear();
    console.log(`Task executed at ${today} 12:00 MMT`);
  } catch (error) {
    console.error('Error in cron job:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch();
console.log('Bot is running...');

// 优雅停机
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));