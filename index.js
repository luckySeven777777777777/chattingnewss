const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; 
const TIMEZONE = 'Asia/Yangon';

const bot = new Telegraf(BOT_TOKEN);

/**
 * 【手动注册名单】
 */
const registeredUsers = [
  2055027475, 
  8337820899,
  6863315227, 
  2018656742, 
  6635424294, 
  7794920274, 
  1625231530, 
  7961174070, 
  2094656277, 
  8101295137,
];

let activeUsers = new Set(); // 每天重置：记录今天谁发了图

// 1. 自动收集逻辑
bot.on('message', async (ctx, next) => {
  if (ctx.chat.id.toString() !== GROUP_ID.toString()) return next();

  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

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
    let mentionList = [];

    // 遍历手动写好的注册名单
    for (let id of registeredUsers) {
      try {
        const chatMember = await bot.telegram.getChatMember(GROUP_ID, id);
        
        // 如果退群、被踢，直接跳过
        if (chatMember.status === 'left' || chatMember.status === 'kicked') continue;

        // 🌟【新增核心逻辑】如果他是管理员或群主，则不需要催交任务，直接跳过
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
          console.log(`[跳过管理员] ID: ${id} 身份为 ${chatMember.status}，无需提醒`);
          continue;
        }

        // 如果不是管理员，并且今天没有发图
        if (!activeUsers.has(id)) {
          const name = chatMember.user.first_name || `用户${id}`; 
          // 🌟【修改】只存纯文本名字，不再拼装 Markdown 链接
          mentionList.push(name); 
        }
      } catch (e) {
        console.error(`无法获取用户 ${id} 的状态`, e);
      }
    }

    if (mentionList.length > 0) {
      // 🌟【修改】用 "，" 把所有名字连起来
      const mentionsText = mentionList.join('，');

      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentionsText}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages-1point`; 
      
      // 🌟【修改】因为不带任何链接了，去掉 parse_mode，防止特殊符号引发 Markdown 报错
      await bot.telegram.sendMessage(GROUP_ID, text);
    }

    activeUsers.clear(); // 清空今日发图记录
    console.log(`[任务完成] ${today}`);

  } catch (error) {
    console.error('定时任务出错:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch().then(() => console.log('✅ 纯文本防艾特管理员版机器人已启动'));
