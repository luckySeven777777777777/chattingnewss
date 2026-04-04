const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; 
const TIMEZONE = 'Asia/Yangon';

const bot = new Telegraf(BOT_TOKEN);

// 核心存储
let allMembers = new Map(); // 记录群里所有发言过的普通成员 {id: name}
let activeUsers = new Set(); // 记录今天谁发了图

// 1. 自动收集逻辑：监听群内所有消息
bot.on('message', async (ctx, next) => {
  if (ctx.chat.id.toString() !== GROUP_ID.toString()) return next();

  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  // 检查是否是图片或转发
  if (ctx.message.photo || ctx.message.forward_date) {
    activeUsers.add(userId);
    console.log(`[已记录发图] ${firstName}`);
  }

  // 动态维护“待考核名单”：如果是新面孔，先查他是不是管理员
  if (!allMembers.has(userId)) {
    try {
      const memberStatus = await ctx.getChatMember(userId);
      // 只有不是管理员和群主的人，才加入考核名单
      if (memberStatus.status === 'member') {
        allMembers.set(userId, firstName);
        console.log(`[新成员加入考核] ${firstName}`);
      }
    } catch (e) {
      console.error("查询成员权限失败", e);
    }
  }
  return next();
});

// 2. 定时任务：每天中午 12:00
cron.schedule('0 12 * * *', async () => {
  try {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    let mentions = "";

    // 遍历所有记录过的普通成员
    for (let [id, name] of allMembers) {
      if (!activeUsers.has(id)) {
        mentions += `[${name}](tg://user?id=${id}) `;
      }
    }

    if (mentions.trim().length > 0) {
      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentions.trim()}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages`;
      
      await bot.telegram.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown' });
    }

    // 每天重置发图状态，但保留 allMembers 名单，这样第二天不用重新说话也能检测
    activeUsers.clear();
    console.log(`[任务完成] ${today} 12:00`);

  } catch (error) {
    console.error('定时任务出错:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch().then(() => console.log('✅ 全自动过滤机器人已启动'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
