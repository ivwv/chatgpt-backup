const axios = require("axios");
const { HttpProxyAgent } = require("http-proxy-agent");
const fs = require("fs");
const logErrorMessage = `可能是由于网络问题，请确保你当前网络能够访问 ChatGPT，或尝试在环境变量中配置代理`;
require("dotenv").config();

let httpsAgent = null;
let proxy = false;

// Check if HTTP_PROXY environment variable is set
if (process.env.HTTP_PROXY) {
  httpsAgent = new HttpProxyAgent(process.env.HTTP_PROXY);
  proxy = true;
}

const headers = {
  accept: "*/*",
  "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6",
  authorization: "Bearer " + process.env.ACCESS_TOKEN,
  cookie: process.env.COOKIE || "",
  "oai-language": "zh-Hans",
  referer: "https://chat.openai.com/",
  "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
  "sec-ch-ua-arch": '"x86"',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-full-version": '"123.0.6312.122"',
  "sec-ch-ua-full-version-list":
    '"Google Chrome";v="123.0.6312.122", "Not:A-Brand";v="8.0.0.0", "Chromium";v="123.0.6312.122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-model": '""',
  "sec-ch-ua-platform": '"Windows"',
  "sec-ch-ua-platform-version": '"10.0.0"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "if-none-match": 'W/"1312055c2261cg"',
};

function fetchConversationList(offset, limit) {
  return new Promise(async (resolve) => {
    try {
      const response = await axios.get(`https://chat.openai.com/backend-api/conversations`, {
        params: {
          offset,
          limit,
          order: "updated",
        },
        headers,
        httpsAgent,
        proxy,
      });

      resolve(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch conversation list | ${logErrorMessage}`);
    }
  });
}

async function fetchConversationData(id) {
  try {
    const response = await axios.get(`https://chat.openai.com/backend-api/conversation/${id}`, {
      headers,
      httpsAgent,
      proxy,
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch conversation data for ID: ${id} | ${logErrorMessage}`);
  }
}

function extractAndDownloadData(data) {
  const { title, conversation_id, mapping } = data;
  let markdownContent = `# ${title}\n\nConversation ID: ${conversation_id}\n\n`;

  for (const messageId in mapping) {
    const message = mapping[messageId].message;
    if (message) {
      const role = message.author.role;
      const parts = message.content.parts;

      if (role) {
        markdownContent += `## ${role}\n\n`;
      }

      parts.forEach((part) => {
        markdownContent += `${part}\n\n`;
      });
    }
  }

  const fileName = `md-${title}_${conversation_id}.md`;
  fs.writeFileSync(`md1/${sanitizeFileName(fileName)}`, markdownContent);
}

function sanitizeFileName(fileName) {
  const invalidCharsPattern = /[<>:"\/\\|?*\x00-\x1F]/g;
  const sanitizedFileName = fileName.replace(invalidCharsPattern, "");

  return sanitizedFileName;
}

async function backupConversations(offset, limit) {
  try {
    const conversationList = await fetchConversationList(offset, limit);
    console.log(`Fetched ${conversationList.items.length} conversations`);

    for (const conversation of conversationList.items) {
      const conversationData = await fetchConversationData(conversation.id);
      console.log(`Processing conversation: ${conversationData.title}`);
      extractAndDownloadData(conversationData);
    }

    console.log("Backup completed successfully");
  } catch (error) {
    console.error("Backup failed:", error);
  }
}

(async () => {
  const allConversationNum = await fetchConversationList(0, 1);
  console.log(`共计: ${allConversationNum.total} 个对话`);
  const limit = 100; // 每次备份的数量限制为 100
  const totalConversations = allConversationNum.total; // 总对话数量
  const totalIterations = Math.ceil(totalConversations / limit);
  for (let i = 0; i < totalIterations; i++) {
    const offset = i * limit;
    await backupConversations(offset, limit);
  }
})();
