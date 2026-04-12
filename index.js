const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; 
const TIMEZONE = 'Asia/Yangon';

const bot = new Telegraf(BOT_TOKEN);

/**
 * 【手动注册名单】
 * 在这里输入用户的数字 ID。
 * 只要 ID 在这里，重启后机器人也会立刻记得他们，不需要他们重新说话。
 * 如果想删除某个用户，直接从这个数组里删掉 ID 即可。
 */
const registeredUsers = [
  6615925197, // 用户A的ID
  8170698622,
  8179048089,
    6863315227,
  5681335747,
    2094656277,
  7794920274,
  2018656742,
  6635424294,
  8165185855,
  6557319746,

];

let activeUsers = new Set(); // 每天重置：记录今天谁发了图

// 1. 自动收集逻辑 (作为补充)
bot.on('message', async (ctx, next) => {
  if (ctx.chat.id.toString() !== GROUP_ID.toString()) return next();

  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  // 只要发图或转发，就记录为今日活跃
  if (ctx.message.photo || ctx.message.forward_date) {
    activeUsers.add(userId);
    console.log(`[今日活跃] ${firstName} (${userId})`);
  }
  
  return next();
});

// 2. 定时任务：每天中午 12:00
cron.schedule('0 12 * * *', async () => {
  try {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    let mentions = "";

    // 直接遍历你手动写好的注册名单
for (let id of registeredUsers) {
      try {
        const chatMember = await bot.telegram.getChatMember(GROUP_ID, id);
        
        if (chatMember.status === 'left' || chatMember.status === 'kicked') continue;

        if (!activeUsers.has(id)) {
          // 这里是关键：直接从 Telegram 实时获取该用户的昵称 (first_name)
          const name = chatMember.user.first_name || `用户${id}`; 
          mentions += `[${name}](tg://user?id=${id}) `; 
        }
      } catch (e) {
        console.error(`无法获取用户 ${id} 的状态`, e);
      }
    }

    if (mentions.trim().length > 0) {
      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentions.trim()}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages`; // 这里也帮你改好了
      
      await bot.telegram.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown' });
    }
    activeUsers.clear(); // 清空今日发图记录
    console.log(`[任务完成] ${today}`);

  } catch (error) {
    console.error('定时任务出错:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch().then(() => console.log('✅ 硬编码注册版机器人已启动'));
