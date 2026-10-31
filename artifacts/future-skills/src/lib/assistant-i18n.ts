import type { ChatLanguage } from "@workspace/api-client-react";

export const CHAT_LANGUAGES: { code: ChatLanguage; label: string; short: string }[] = [
  { code: "ms", label: "Bahasa Melayu", short: "BM" },
  { code: "zh-CN", label: "简体中文", short: "中文" },
  { code: "en", label: "English", short: "EN" },
];

export type AssistantStrings = {
  title: string;
  subtitle: string;
  welcome: string;
  suggestionsLabel: string;
  suggestions: string[];
  followUpsLabel: string;
  placeholder: string;
  send: string;
  thinking: string;
  sources: string;
  noCitations: string;
  relevance: string;
  openSource: string;
  conversations: string;
  newChat: string;
  noConversations: string;
  untitled: string;
  deleteChat: string;
  showHistory: string;
  backToChat: string;
  minimize: string;
  expand: string;
  close: string;
  languageLabel: string;
  disclaimer: string;
  notReadyTitle: string;
  needsKey: string;
  needsEmbeddingKey: string;
  needsKnowledge: string;
  searchOnlyTitle: string;
  searchOnlyNotice: string;
  errors: {
    rateLimited: string;
    insufficientBalance: string;
    inputLimit: string;
    notReady: string;
    aiFailed: string;
    generic: string;
    network: string;
  };
  limitHint: string;
  you: string;
};

export const T: Record<ChatLanguage, AssistantStrings> = {
  en: {
    title: "Aiversecity AI Mentor",
    subtitle: "Your Future Skills Assistant",
    welcome:
      "Hi! I answer questions about roles, skills, learning pathways and how Aiversecity's scores work, using only approved sources. Every answer lists what it cites. Some sources are fictional demo data and are labelled as synthetic.",
    suggestionsLabel: "Try asking",
    suggestions: [
      "What skills does a Junior Data Analyst need?",
      "Which free e-LATiH courses teach Python?",
      "How is my match score calculated?",
      "What does AI Risk mean?",
    ],
    followUpsLabel: "Ask next",
    placeholder: "Ask about a role, skill, course or score…",
    send: "Send",
    thinking: "Searching approved sources…",
    sources: "Sources",
    noCitations: "This answer cites no source.",
    relevance: "match",
    openSource: "Open source",
    conversations: "Conversations",
    newChat: "New chat",
    noConversations: "No conversations yet.",
    untitled: "New conversation",
    deleteChat: "Delete conversation",
    showHistory: "Conversation history",
    backToChat: "Back to chat",
    minimize: "Minimise",
    expand: "Expand",
    close: "Close",
    languageLabel: "Answer language",
    disclaimer: "AI-generated from approved sources. Estimates, not guarantees; synthetic data is fictional.",
    notReadyTitle: "The AI Mentor is being set up",
    needsKey: "A DeepSeek API key is needed before it can answer.",
    needsEmbeddingKey: "A Gemini API key is needed to search its approved knowledge.",
    needsKnowledge: "No approved knowledge is searchable yet. An admin must approve the knowledge documents first.",
    searchOnlyTitle: "Search-only mode",
    searchOnlyNotice: "AI answer generation is unavailable right now. Replies show excerpts found by keyword search in approved sources; they are not AI-generated.",
    errors: {
      rateLimited: "Too many questions in a short time. Please wait a few minutes and try again.",
      insufficientBalance: "DeepSeek reports insufficient account balance. No message was saved; check the API balance before retrying.",
      inputLimit: "This conversation is too long for the current request limit. Start a new chat or shorten your question.",
      notReady: "The AI Mentor is not ready to answer yet.",
      aiFailed: "The AI service did not answer. Nothing was saved; please try again.",
      generic: "Something went wrong. Nothing was saved; please try again.",
      network: "Could not reach the server. Check your connection and try again.",
    },
    limitHint: "characters",
    you: "You",
  },
  ms: {
    title: "Mentor AI Aiversecity",
    subtitle: "Pembantu Kemahiran Masa Depan Anda",
    welcome:
      "Hai! Saya menjawab soalan tentang peranan, kemahiran, laluan pembelajaran dan cara skor Aiversecity dikira, hanya menggunakan sumber yang diluluskan. Setiap jawapan menyenaraikan sumber yang dirujuk. Sesetengah sumber ialah data demo rekaan dan dilabel sebagai sintetik.",
    suggestionsLabel: "Cuba tanya",
    suggestions: [
      "Apakah kemahiran yang diperlukan oleh Junior Data Analyst?",
      "Kursus e-LATiH percuma manakah yang mengajar Python?",
      "Bagaimanakah skor padanan saya dikira?",
      "Apakah maksud AI Risk?",
    ],
    followUpsLabel: "Tanya seterusnya",
    placeholder: "Tanya tentang peranan, kemahiran, kursus atau skor…",
    send: "Hantar",
    thinking: "Mencari dalam sumber yang diluluskan…",
    sources: "Sumber",
    noCitations: "Jawapan ini tidak merujuk sebarang sumber.",
    relevance: "padanan",
    openSource: "Buka sumber",
    conversations: "Perbualan",
    newChat: "Sembang baharu",
    noConversations: "Belum ada perbualan.",
    untitled: "Perbualan baharu",
    deleteChat: "Padam perbualan",
    showHistory: "Sejarah perbualan",
    backToChat: "Kembali ke sembang",
    minimize: "Kecilkan",
    expand: "Besarkan",
    close: "Tutup",
    languageLabel: "Bahasa jawapan",
    disclaimer: "Dijana AI daripada sumber yang diluluskan. Anggaran, bukan jaminan; data sintetik adalah rekaan.",
    notReadyTitle: "Mentor AI sedang disediakan",
    needsKey: "Kunci API DeepSeek diperlukan sebelum ia boleh menjawab.",
    needsEmbeddingKey: "Kunci API Gemini diperlukan untuk mencari ilmu yang diluluskan.",
    needsKnowledge: "Belum ada pengetahuan diluluskan yang boleh dicari. Admin perlu meluluskan dokumen terlebih dahulu.",
    searchOnlyTitle: "Mod carian sahaja",
    searchOnlyNotice: "Penjanaan jawapan AI tidak tersedia buat masa ini. Balasan memaparkan petikan daripada carian kata kunci dalam sumber diluluskan; ia bukan dijana AI.",
    errors: {
      rateLimited: "Terlalu banyak soalan dalam masa singkat. Sila tunggu beberapa minit dan cuba lagi.",
      insufficientBalance: "DeepSeek melaporkan baki akaun tidak mencukupi. Mesej tidak disimpan; semak baki API sebelum mencuba lagi.",
      inputLimit: "Perbualan ini terlalu panjang untuk had permintaan semasa. Mulakan sembang baharu atau pendekkan soalan.",
      notReady: "Mentor AI belum bersedia untuk menjawab.",
      aiFailed: "Perkhidmatan AI tidak menjawab. Tiada apa-apa disimpan; sila cuba lagi.",
      generic: "Berlaku ralat. Tiada apa-apa disimpan; sila cuba lagi.",
      network: "Tidak dapat menghubungi pelayan. Semak sambungan anda dan cuba lagi.",
    },
    limitHint: "aksara",
    you: "Anda",
  },
  "zh-CN": {
    title: "Aiversecity AI 导师",
    subtitle: "你的未来技能助手",
    welcome:
      "你好！我只根据已审核的资料，回答关于职位、技能、学习路径以及 Aiversecity 评分方式的问题。每个回答都会列出引用来源。部分资料是虚构的演示数据，并标注为合成数据。",
    suggestionsLabel: "试着问",
    suggestions: [
      "Junior Data Analyst 需要哪些技能？",
      "哪些免费的 e-LATiH 课程教授 Python？",
      "我的匹配分数是如何计算的？",
      "AI Risk 是什么意思？",
    ],
    followUpsLabel: "接下来可以问",
    placeholder: "询问职位、技能、课程或评分…",
    send: "发送",
    thinking: "正在检索已审核的资料…",
    sources: "来源",
    noCitations: "此回答未引用任何来源。",
    relevance: "相关度",
    openSource: "打开来源",
    conversations: "对话",
    newChat: "新对话",
    noConversations: "还没有对话。",
    untitled: "新对话",
    deleteChat: "删除对话",
    showHistory: "对话记录",
    backToChat: "返回对话",
    minimize: "最小化",
    expand: "展开",
    close: "关闭",
    languageLabel: "回答语言",
    disclaimer: "由 AI 根据已审核资料生成。仅为估计，并非保证；合成数据为虚构。",
    notReadyTitle: "AI 导师正在准备中",
    needsKey: "需要 DeepSeek API 密钥才能回答。",
    needsEmbeddingKey: "需要 Gemini API 密钥才能检索已审核的知识。",
    needsKnowledge: "目前没有可检索的已审核知识。需要管理员先审核资料。",
    searchOnlyTitle: "仅搜索模式",
    searchOnlyNotice: "AI 回答生成目前不可用。回复显示在已审核资料中通过关键词搜索找到的摘录，并非 AI 生成。",
    errors: {
      rateLimited: "短时间内提问过多，请稍等几分钟再试。",
      insufficientBalance: "DeepSeek 账户余额不足。消息未保存；请先检查 API 余额再重试。",
      inputLimit: "对话内容超过当前请求限制。请开启新对话或缩短问题。",
      notReady: "AI 导师暂时还不能回答。",
      aiFailed: "AI 服务没有回应，未保存任何内容，请重试。",
      generic: "出现错误，未保存任何内容，请重试。",
      network: "无法连接服务器，请检查网络后重试。",
    },
    limitHint: "字符",
    you: "你",
  },
};
