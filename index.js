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
    let mentionList = []; // 存储 {name, id} 对象
    let entities = []; // 存储实体信息
    let currentOffset = 0;

    // 构建初始消息文本
    let text = `📢 Daily Task Reminders\n\n👤Member：`;
    currentOffset = text.length;

    for (let id of registeredUsers) {
      try {
        const chatMember = await bot.telegram.getChatMember(GROUP_ID, id);
        if (chatMember.status === 'left' || chatMember.status === 'kicked') continue;
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') continue;
        if (!activeUsers.has(id)) {
          const name = chatMember.user.first_name || `用户${id}`;
          
          // 构建 "@name" 的字符串
          const mentionStr = `@${name}`;
          
          // 记录实体：类型为 mention，从当前位置开始，长度为名字长度
          entities.push({
            type: 'text_mention',
            offset: currentOffset,
            length: mentionStr.length,
            user: { id: id, first_name: name, type: 'private' }
          });

          mentionList.push(mentionStr);
          currentOffset += mentionStr.length + 1; // +1 是为了逗号
        }
      } catch (e) {
        console.error(`无法获取用户 ${id} 的状态`, e);
      }
    }

    if (mentionList.length > 0) {
      const mentionsText = mentionList.join('，');
      text += `${mentionsText}\n📅 Date：${today}\n🌅 Today： No new users sent messages-1point`;

      // 使用 entities 发送，不要设置 parse_mode
      await bot.telegram.sendMessage(GROUP_ID, text, {
        entities: entities
      });
    }

    activeUsers.clear();
    console.log(`[任务完成] ${today}`);
  } catch (error) {
    console.error('定时任务出错:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch().then(() => console.log('✅ 纯文本防艾特管理员版机器人已启动'));
