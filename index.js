const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const moment = require('moment-timezone');

// --- 基础配置 ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; 
const TIMEZONE = 'Asia/Yangon'; // 缅甸时区

// --- 方案 A：手动设置需要考核的人员名单 ---
// 把你需要艾特的人对应的 ID 和名字填在这里
const targetUsers = [
  { id: 6863315227, name: "zee" }, // 替换成实际的 ID 和名字
  { id: 6635424294, name: "小九" },
  { id: 7976655123, name: "阿豪" },
  { id: 7951298720, name: "阿星" },
  { id: 2018656742, name: "猴子" },
  { id: 5681335747, name: "GuBa" },
  { id: 2094656277, name: "Pablo" }

];

const bot = new Telegraf(BOT_TOKEN);
let activeUsers = new Set(); // 记录今天谁发了图

// 1. 监听：记录谁发了图片或转发了消息
bot.on(['photo', 'forward_date'], (ctx) => {
  if (ctx.chat.id.toString() === GROUP_ID.toString()) {
    activeUsers.add(ctx.from.id);
    console.log(`[已记录] ${ctx.from.first_name} 完成了任务`);
  }
});

// 2. 定时任务：每天中午 12:00
cron.schedule('0 12 * * *', async () => {
  console.log('正在执行中午 12:00 核查任务...');
  
  try {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    let mentions = "";

    // 遍历名单，检查谁没在 activeUsers 里
    targetUsers.forEach(user => {
      if (!activeUsers.has(user.id)) {
        // 使用 Markdown 格式强制艾特（即使用户没设置 username 也能艾特到）
        mentions += `[${user.name}](tg://user?id=${user.id}) `;
      }
    });

    // 如果有人没发图
    if (mentions.trim().length > 0) {
      const text = 
        `📢 Daily Task Reminders\n\n` +
        `👤Member：${mentions.trim()}\n` +
        `📅 Date：${today}\n` +
        `🌅 Today： No new users sent messages`;
      
      await bot.telegram.sendMessage(GROUP_ID, text, { parse_mode: 'Markdown' });
      console.log('已发送提醒');
    } else {
      console.log('太棒了，所有人今天都发图了！');
    }

    // 重置，迎接新的一天
    activeUsers.clear();

  } catch (error) {
    console.error('定时任务运行出错:', error);
  }
}, {
  timezone: TIMEZONE
});

// 启动机器人
bot.launch()
  .then(() => console.log('✅ 机器人已启动（手动名单模式）'))
  .catch(err => console.error('❌ 启动失败:', err));

// 优雅退出
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
