const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');
const fs = require('fs'); // 引入文件系统模块

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; 
const TIMEZONE = 'Asia/Yangon';
const DATA_FILE = './members.json'; // 数据保存路径

const bot = new Telegraf(BOT_TOKEN);

// --- 数据持久化逻辑 ---

// 初始化加载数据
let allMembers = new Map();
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    allMembers = new Map(data);
    console.log(`[系统] 已从文件加载 ${allMembers.size} 名成员`);
  } catch (e) {
    console.error("加载成员数据失败", e);
  }
}

// 保存数据到文件的函数
const saveMembers = () => {
  try {
    const data = JSON.stringify(Array.from(allMembers.entries()));
    fs.writeFileSync(DATA_FILE, data, 'utf8');
  } catch (e) {
    console.error("保存数据失败", e);
  }
};

// 记录今天谁发了图（这个可以留在内存，因为每天定时任务后会清空）
let activeUsers = new Set(); 

// 1. 自动收集逻辑
bot.on('message', async (ctx, next) => {
  if (ctx.chat.id.toString() !== GROUP_ID.toString()) return next();

  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  if (ctx.message.photo || ctx.message.forward_date) {
    activeUsers.add(userId);
    console.log(`[已记录发图] ${firstName}`);
  }

  if (!allMembers.has(userId)) {
    try {
      const memberStatus = await ctx.getChatMember(userId);
      if (memberStatus.status === 'member') {
        allMembers.set(userId, firstName);
        saveMembers(); // 存入文件
        console.log(`[新成员加入考核] ${firstName}`);
      }
    } catch (e) {
      console.error("查询成员权限失败", e);
    }
  }
  return next();
});

// 2. 定时任务
cron.schedule('0 12 * * *', async () => {
  try {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    let mentions = "";
    let changed = false;

    for (let [id, name] of allMembers) {
      try {
        const chatMember = await bot.telegram.getChatMember(GROUP_ID, id);
        
        if (chatMember.status === 'left' || chatMember.status === 'kicked') {
          allMembers.delete(id);
          changed = true;
          console.log(`[清理退群成员] ${name}`);
          continue;
        }
      } catch (e) {
        allMembers.delete(id);
        changed = true;
        continue;
      }

      if (!activeUsers.has(id)) {
        mentions += `[${name}](tg://user?id=${id}) `;
      }
    }

    // 如果清理了成员，更新文件
    if (changed) saveMembers();

    if (mentions.trim().length > 0) {
      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentions.trim()}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages`;
      
      await bot.telegram.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown' });
    }

    activeUsers.clear();
    console.log(`[任务完成] ${today} 12:00`);

  } catch (error) {
    console.error('定时任务出错:', error);
  }
}, {
  timezone: TIMEZONE
});

bot.launch().then(() => console.log('✅ 永久记录版机器人已启动'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
