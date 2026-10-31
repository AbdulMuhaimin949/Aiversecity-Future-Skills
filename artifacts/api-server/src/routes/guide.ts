/**
 * Guide chat: intelligent assistant that explains how to use
 * CTRL CV Future Skills.
 *
 * Supports:
 * - Smart conversational intent extraction (strips "hai nak tanya", "can I ask", etc.)
 * - Context-aware topic matching across scenarios (Low/Mod/High impact), Radar,
 *   Profile & CV scan, Matches, Pathway, AI Risk & Job Safety, SDGs, Sources
 * - Automatic language detection & responses in English, Bahasa Melayu, and Mandarin (中文)
 * - LLM calling with graceful fallback to the multi-language knowledge engine
 */
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Msg = { role: "user" | "assistant"; content: string };
type Action = { label: string; href: string };
export type GuideLang = "en" | "ms" | "zh";

const PAGES: Record<string, string> = {
  "/": "Home / overview",
  "/profile": "Step 1 Profile (upload CV, demo persona or pick skills)",
  "/matches": "Step 2 Matches (ranked role matches)",
  "/pathway": "Step 3 Pathway (week-by-week learning plan)",
  "/radar": "Future Skills Radar (rising and slowing roles/skills)",
  "/roles": "Role detail page",
  "/sdgs": "SDG links page",
  "/about": "Sources and methodology page",
};

const GUIDE = `
CTRL CV Future Skills is a free career exploration tool for Malaysian students and workers.
Flow: 1 Profile -> 2 Matches -> 3 Pathway. The Radar is a floating bubble available on every page.

SCENARIOS:
- Low Impact (Baseline): The market continues following its recent hiring pattern without sudden extra AI shocks.
- Moderate Impact: Quick adoption of automation across sectors, displacing routine tasks while augmenting others.
- High Impact (Fast AI): Rapid transformation across all sectors where AI exposure and augmentation effects are strongest.

STEP 1 PROFILE (/profile): Add skills by (a) uploading a PDF CV or pasting CV text, (b) loading a synthetic demo persona, or (c) picking skills manually. Scan results are shown for review before being added; remove anything wrong and set proficiency. Then set education level, years of experience, weekly learning hours and optional interest sectors, and press Save. Profile data stays in the browser (localStorage); CV files are processed for scanning and not stored.

STEP 2 MATCHES (/matches): Roles ranked by a documented weighted match score combining skill overlap, education, experience, interests, learning feasibility and demand trend. Each match shows matched skills, skill gaps, AI Risk and Job Safety. Pick a role to set it as your target, then open its Pathway. Use the scenario switch (Low / Moderate / High Impact) to see how rankings change with faster AI adoption.

STEP 3 PATHWAY (/pathway/:id): A reskilling plan for the chosen role. Lists skill gaps, matched HRD Corp e-LATiH courses, total hours and estimated weeks at your weekly learning hours. Gaps with no matching course are flagged as uncovered; courses are never invented.

RADAR (floating bubble, drag it anywhere; full page at /radar): Shows roles and skills rising or slowing under three scenarios: Low Impact (baseline, today's trend), Moderate Impact, High Impact (fast AI adoption). Line = forecast direction, shaded band = 90% forecast range. Direction is relative to other roles in the same scenario.

TERMS:
- AI Risk (AI exposure): how much AI may affect a role's tasks. Not a prediction of job loss.
- Job Safety (augmentation): how much AI may help with the work rather than replace it. Not a guarantee of employment.
- AI-Resilient / Exposed badges summarise the roles that need a skill.
- 90% range: the forecast is expected to fall inside this band 90% of the time.
- Match score: 0-100, higher means a closer fit to your profile today.

DATA: 240 roles across 20 sectors, 255 skills. Demand histories are simulated, MyCOL-anchored estimates; forecasts use Ridge autoregression. Estimates, not guarantees. Sources are on /about. SDG links (especially SDG 4 Quality Education, SDG 8 Decent Work) are on /sdgs.

TROUBLESHOOTING: No matches -> save a profile first. Low match score -> add more skills or check proficiency. CV scan missed skills -> add them manually under "Pick skills". Want a different role -> go back to Matches and pick another.
`.trim();

const LANG_LABELS: Record<GuideLang, { name: string; profile: string; matches: string; radar: string; sources: string }> = {
  en: { name: "English", profile: "Open Profile", matches: "Open Matches", radar: "Open Radar", sources: "Open Sources" },
  ms: { name: "Bahasa Melayu (Malay)", profile: "Buka Profil", matches: "Buka Padanan", radar: "Buka Radar", sources: "Buka Sumber" },
  zh: { name: "Simplified Chinese (简体中文)", profile: "打开个人档案", matches: "查看职位匹配", radar: "打开雷达", sources: "查看数据来源" },
};

export function detectLanguage(text: string): GuideLang {
  // 1. Chinese characters or Malaysian Chinese pinyin / phrases
  if (/[\u4e00-\u9fa5]/.test(text) || /\b(zuomode|zheyang|weishenme|shenme|zenme|xiexie|nihao|haode)\b/i.test(text)) {
    return "zh";
  }
  // 2. Malay / Bahasa Pasar / Malaysian slang contractions
  const msPattern =
    /\b(saya|aku|kau|bro|do|weh|nak|nk|tanya|tny|boleh|bleh|bagaimana|bgmana|macam\s*mana|mcm\s*mana|mcm|camne|cmne|cara|muat\s*naik|apa|ape|ialah|yang|yg|di|ke|ini|ni|itu|tu|dan|dgn|ngan|untuk|utk|tidak|tak|tk|x|xleh|takleh|xde|takde|tak\s*ada|ada|dah|dh|kenapa|knp|nape|mengapa|padanan|laluan|kemahiran|pekerjaan|kursus|siapa|sape|tolong|hai|salam|terima\s*kasih|tq|terangkan|faham|blur|pastu|pstu|lepas\s*tu|tgh|sbb|terbaik|mantap)\b/i;
  if (msPattern.test(text)) {
    return "ms";
  }
  return "en";
}

const SYSTEM = (page: string, lang: GuideLang) => `You are "CTRL CV Guide", a friendly and helpful assistant inside the CTRL CV Future Skills web app.
Your mission: help users understand how to use the system and answer questions about what they see on their screen.
User selected language: ${LANG_LABELS[lang].name}.
CRITICAL LANGUAGE INSTRUCTION: You MUST write your response ENTIRELY in ${LANG_LABELS[lang].name}.

Rules:
- Answer ONLY from the guide below. If something is not covered, say you are not sure and point them to the Sources page (/about).
- Never invent features, numbers or courses. Do not give personal hiring guarantees.
- Style: concise and clear (under 120 words), friendly tone, use bullet points for steps.
- The user is currently on: ${page}.

At the very end of your response, if relevant to help the user navigate, output one line with action shortcuts formatted exactly like:
ACTIONS: Button Label|/path ; Button Label|/path
Allowed paths: /profile, /matches, /radar, /about, /sdgs.
Use translated button labels suitable for ${LANG_LABELS[lang].name} (e.g. "${LANG_LABELS[lang].profile}|/profile"). Omit this line if not helpful.

GUIDE:
${GUIDE}`;

function pageLabel(path: string): string {
  if (PAGES[path]) return PAGES[path];
  const hit = Object.keys(PAGES).find((k) => k !== "/" && path.startsWith(k));
  return hit ? PAGES[hit] : "Unknown page";
}

const ALLOWED = new Set(["/profile", "/matches", "/radar", "/about", "/sdgs"]);

function splitActions(text: string): { reply: string; actions: Action[] } {
  const m = text.match(/\n?ACTIONS:\s*(.+)\s*$/i);
  if (!m) return { reply: text.trim(), actions: [] };
  const actions = m[1]
    .split(";")
    .map((p) => p.split("|").map((s) => s.trim()))
    .filter(([l, h]) => l && h && ALLOWED.has(h))
    .slice(0, 3)
    .map(([label, href]) => ({ label, href }));
  return { reply: text.slice(0, m.index).trim(), actions };
}

// -----------------------------------------------------------------------------
// INTELLIGENT TOPICS FOR MULTILINGUAL CTRL CV SYSTEM GUIDE
// -----------------------------------------------------------------------------
interface Topic {
  id: string;
  test: (q: string, history?: Msg[]) => boolean;
  answers: Record<GuideLang, { text: string; action?: { path: string; key: keyof typeof LANG_LABELS["en"] } }>;
}

const TOPICS: Topic[] = [
  // 1. Social Intelligence: Compliments
  {
    id: "compliments",
    test: (q) =>
      /\b(bagus\s*do\s*kau|bagus\s*la|terbaik(\s*lah)?(\s*bro)?|mantap(\s*gila)?|steady(\s*lah|\s*bro)?|you\s*are\s*(so\s*)?(good|great|awesome)|nice\s*one)\b/i.test(
        q,
      ) || /(你很厉害|真棒|太厉害|你好聪明|太好用|很厉害|赞啊)/i.test(q),
    answers: {
      en: { text: "Thanks! 😄 Let me know if you need help with any part of CTRL CV." },
      ms: { text: "Hahaha terima kasih! 😄 Ada apa-apa lagi nak tanya pasal CTRL CV?" },
      zh: { text: "哈哈，谢谢你！😄 还有什么 CTRL CV 的功能需要我为你解答吗？" },
    },
  },

  // 2. Social Intelligence: Thanks & Appreciation
  {
    id: "thanks",
    test: (q) =>
      /\b(thank|terima\s*kasih|thanks|thanks\s*boss|tq|tqvm|mekasih)\b/i.test(q) ||
      /(xie\s*xie|谢谢|好的啦[，,\s]*谢谢你|多谢|非常感谢)/i.test(q),
    answers: {
      en: {
        text: "You're very welcome! Feel free to ask whenever you need guidance with CTRL CV. Best of luck with your future skills exploration!",
      },
      ms: {
        text: "Sama-sama! Jangan ragu-ragu untuk bertanya lagi jika perlukan bimbingan di CTRL CV. Selamat maju jaya dalam penerokaan kerjaya anda!",
      },
      zh: {
        text: "不客气！随时欢迎向我咨询 CTRL CV 系统的使用技巧，祝您探索出理想的职业与学习路径！",
      },
    },
  },

  // 3. Social Intelligence: Pure Greetings
  {
    id: "greetings",
    test: (q) =>
      /^(hi|hello|hai|salam|hey|pagi|selamat\s*(pagi|petang|malam)|salam\s*sejahtera)[!.\s]*$/i.test(q.trim()) ||
      /^(你好|哈喽|您好|早安|午安|嗨)[!。！.\s]*$/i.test(q.trim()),
    answers: {
      en: {
        text: "Hello! Feel free to ask me anything about CTRL CV—such as uploading your CV (Profile), understanding your role Matches, exploring learning Pathways, or checking job trends in the Radar. What would you like help with?",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Hai! Silakan bertanya, saya sedia membantu anda memahami sistem CTRL CV—seperti cara muat naik CV (Profil), menyemak padanan kerjaya, membina laluan pembelajaran, atau melihat trend radar pasaran kerja. Ada apa-apa yang ingin anda ketahui?",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "您好！很高兴为您服务。我可以帮助您快速熟悉 CTRL CV 系统——例如如何上传简历（档案）、解读职位匹配结果、规划技能学习路线，或者查看就业市场雷达趋势。请问有什么想了解的吗？",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 4. Action Guardrail: Non-autonomous agent boundary ("tolong upload", "can you upload", "帮我上传")
  {
    id: "action_guardrail",
    test: (q) =>
      /\b(tolong\s*(upload|muat\s*naik|ubah|tukar|update|buat)|can\s*you\s*(upload|edit|update|change|create)|help\s*me\s*upload)\b/i.test(
        q,
      ) || /(帮我上传|替我上传|帮我修改|替我做)/i.test(q),
    answers: {
      en: {
        text: "I am an informational guide and cannot upload files or edit your profile directly. You can easily do it yourself:\n1. Go to **Step 1 (Profile)**.\n2. Click the upload box or drag-and-drop your resume PDF (under 5MB).\n3. Click **Scan CV** to extract your skills, review them, and press **Save Profile**.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Saya adalah panduan sistem bermaklumat dan tidak boleh memuat naik fail atau menyunting profil bagi pihak anda. Anda boleh melakukannya sendiri dengan mudah:\n1. Pergi ke **Langkah 1 (Profil)**.\n2. Klik ruangan muat naik atau seret fail PDF resume anda (kurang daripada 5MB).\n3. Tekan **Imbas CV** untuk mengekstrak kemahiran, semak hasilnya, dan klik **Simpan Profil**.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "我是系统智能助手，无法直接代表您上传文件或修改档案。您可以自行操作：\n1. 前往 **第1步（个人档案 Profile）**。\n2. 点击上传区域或拖拽您的简历 PDF 文件（5MB以内）。\n3. 点击 **扫描简历 (Scan CV)** 提取技能，确认核对后点击 **保存个人档案** 即可。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 5. Troubleshooting: "No Matches" / "kenape xde match" / "why cannot match" / "为什么没有match"
  {
    id: "troubleshoot_no_matches",
    test: (q) =>
      /\b((kenape|kenapa|knp|why|how\s*come|apasal)\s*(xde|takde|tak\s*ada|no|zero)\s*(match|matches|padanan)|(xde|takde)\s*match|no\s*matches?)\b/i.test(
        q,
      ) || /(为什么没有match|为什么没有匹配|没有match|配对不到)/i.test(q),
    answers: {
      en: {
        text: "If you see no matched roles on the **Matches** page:\n1. Make sure you clicked **Save Profile** in Step 1 first so your skills are recorded in your browser.\n2. Add more relevant skills under **Pick skills** or adjust your proficiency levels.\n3. Ensure your profile has at least a few skills matching Malaysian future-readiness areas.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Jika tiada pekerjaan sepadan dipaparkan di bahagian **Padanan**:\n1. Pastikan anda telah menekan butang **Simpan Profil** di Langkah 1 terlebih dahulu.\n2. Tambah beberapa kemahiran teras di bahagian **Pilih kemahiran** atau naikkan tahap kemahiran anda.\n3. Pilih sekurang-kurangnya satu sektor minat agar algoritma dapat mengesyorkan peranan yang relevan.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "如果【职位匹配 (Matches)】页面没有显示推荐职位：\n1. 请确认您在第1步【个人档案】中点击了 **保存个人档案 (Save Profile)**。\n2. 尝试在【手动挑选技能】中多添加几项核心技能，或调高您已有技能的熟练度评级。\n3. 在个人档案中勾选您的意向行业，帮助算法更精准地推荐匹配岗位。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 6. Troubleshooting: Upload issues ("xleh upload", "why cannot upload lah", "我upload不到CV")
  {
    id: "troubleshoot_upload",
    test: (q) =>
      /\b(xleh\s*upload|takleh\s*upload|cannot\s*upload|fail\s*sangkut|pdf\s*error|upload\s*error)\b/i.test(q) ||
      /(upload不到|上传不了|上传失败|无法上传)/i.test(q) ||
      (/\b(upload|muat\s*naik|上传)\b/i.test(q) &&
        /\b(xleh|takleh|tak\s*boleh|cannot|why|knp|kenapa|error|gagal)\b/i.test(q)),
    answers: {
      en: {
        text: "If you cannot upload your CV:\n1. **Format:** Ensure the file is a PDF under 5MB with selectable text (not an image scan or photo).\n2. **Alternative:** You can paste your resume text directly into the text box.\n3. **Manual Entry:** You can also pick skills manually from the 255 skill catalogue under **Pick skills**.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Jika anda tidak boleh muat naik CV:\n1. **Format fail:** Pastikan fail dalam format PDF dan saiz tidak melebihi 5MB dengan teks boleh disalin (bukan gambar imbasan/foto).\n2. **Tampal teks:** Anda boleh terus menyalin dan menampal teks resume ke dalam ruangan teks.\n3. **Pilihan manual:** Anda juga boleh memilih kemahiran secara manual daripada 255 kemahiran di bahagian **Pilih kemahiran**.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "如果您无法正常上传简历（CV）：\n1. **文件检查：** 请确认文件为 PDF 格式且在 5MB 以内，内容必须为可复制文本（不能是拍照图片或纯扫描件）。\n2. **直接粘贴文本：** 您可以直接将简历文字复制并粘贴到下方文本框中进行解析。\n3. **手动添加技能：** 您随时可以在【手动挑选技能】中直接搜索添加255项标准化未来技能。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 7. Radar & Trends Explanation ("what is this radar for", "我看不懂Radar", "radar tk faham", "做么的", "干嘛的")
  {
    id: "radar",
    test: (q) =>
      /\b(radar|rising|slowing|meningkat|perlahan|90%|julat|trend|arah|forecast|ramalan|雷达|上升|放缓|90%区间|做么的|干嘛的)\b/i.test(
        q,
      ) || (/\b(radar|雷达)\b/i.test(q) && /\b(function|guna|fungsi|apa|maksud|faham|看不懂|做什么|干嘛)\b/i.test(q)),
    answers: {
      en: {
        text: "The **Future Skills Radar** visualizes labor market demand trends across 20 Malaysian industries:\n• **Rising roles:** Careers where hiring demand is expanding relative to other occupations.\n• **Slowing roles:** Careers where demand is decelerating or routine tasks are being automated.\n• **90% Range:** Statistical forecast uncertainty band (expected range 90% of the time).\n• **Floating Bubble:** You can tap or drag the Radar bubble anywhere on your screen to inspect trends anytime!",
        action: { path: "/radar", key: "radar" },
      },
      ms: {
        text: "**Radar Kemahiran Masa Hadapan (Radar)** menunjukkan trend pekerjaan merentas 20 sektor di Malaysia:\n• **Meningkat (Rising):** Pekerjaan yang permintaannya semakin bertambah berbanding pekerjaan lain.\n• **Perlahan (Slowing):** Pekerjaan yang permintaannya berkurangan atau tugas lazim diautomasikan.\n• **Julat 90%:** Jalur ketidaktentuan ramalan statistik.\n• **Butang Gelembung:** Anda boleh klik atau tarik butang Radar terapung di skrin pada bila-bila masa untuk menyemak trend!",
        action: { path: "/radar", key: "radar" },
      },
      zh: {
        text: "**未来技能雷达 (Radar)** 用于追踪马来西亚20大行业中岗位与技能的变化趋势：\n• **上升职位 (Rising)：** 市场需求增速领先同情景其他岗位的职业。\n• **放缓职位 (Slowing)：** 需求放缓或常规日常工作容易被自动化技术替代的职业。\n• **90%预测区间：** 统计预测的波动范围阴影带。\n• **浮动气泡：** 屏幕右下方的雷达气泡随时可点击或拖拽，方便您在任何页面查阅走势！",
        action: { path: "/radar", key: "radar" },
      },
    },
  },

  // 8. Matches & Where to see matches ("where to see matches", "我要怎样看工作配对", "camne nak tengok matches")
  {
    id: "matches",
    test: (q) =>
      /\b(match|matches|padanan|padan|skor|score|ranking|kiraan|formula|kenapa\s*rendah|cara\s*kira|senarai\s*kerja|匹配|工作配对|配对|查看匹配|匹配度|分数|算法|计算)\b/i.test(
        q,
      ) ||
      (/\b(matches|padanan|配对|工作推荐)\b/i.test(q) && /\b(where|dimana|mana|tengok|see|macam\s*mana|怎样|看)\b/i.test(q)),
    answers: {
      en: {
        text: "You can find your matched roles on the **Matches** page (Step 2). It ranks 240 future-ready occupations based on:\n1. **Skill Coverage & Proficiency (70% total):** How many required/preferred skills you possess and your levels.\n2. **Education & Experience (15%):** Readiness for the role's baseline requirements.\n3. **Interests & Demand (15%):** Alignment with your preferred sectors and projected growth.\n\nTip: Add more skills in Step 1 (Profile) to raise your match scores!",
        action: { path: "/matches", key: "matches" },
      },
      ms: {
        text: "Anda boleh melihat peranan sepadan di tab **Padanan** (Langkah 2). Sistem menyusun 240 pekerjaan berdasarkan:\n1. **Pertindihan & Tahap Kemahiran (70%):** Berapa banyak kemahiran yang anda miliki dan tahap kemahirannya.\n2. **Pendidikan & Pengalaman (15%):** Kesesuaian kelayakan dan tempoh bekerja.\n3. **Minat & Trend Permintaan (15%):** Sektor pilihan serta unjuran pasaran.\n\nPetua: Tambah kemahiran di Langkah 1 (Profil) untuk meningkatkan skor padanan anda!",
        action: { path: "/matches", key: "matches" },
      },
      zh: {
        text: "您可以在【第2步 职位匹配 (Matches)】查看推荐工作。系统基于透明数学模型为您对240个职业打分：\n1. **技能重合与熟练度 (70%)：** 您具备该职业所需核心/优先技能的数量与熟练等级。\n2. **学历与工作年限 (15%)：** 评估您的教育背景与经验成熟度。\n3. **兴趣与行业需求 (15%)：** 结合意向领域及市场预测趋势。\n\n提示：在第1步【个人档案】中补充更多技能可显著提升匹配分数！",
        action: { path: "/matches", key: "matches" },
      },
    },
  },

  // 9. Scenarios (Low / Moderate / High impact, Baseline)
  {
    id: "scenarios",
    test: (q) =>
      /\b(low\s*impact|moderate\s*impact|high\s*impact|baseline|impak\s*rendah|impak\s*sederhana|impak\s*tinggi|senario|scenario|低影响|中度影响|高影响|情景|情景模拟)\b/i.test(
        q,
      ) ||
      (/\b(low|moderate|high|rendah|sederhana|tinggi)\b/i.test(q) &&
        /\b(impact|impak|maksud|tu\s*apa|apa\s*itu|bermaksud|意思|是什么)\b/i.test(q)),
    answers: {
      en: {
        text: "**Low Impact (Baseline)** represents the current hiring trend continuing as usual without sudden extra AI shocks.\n\nWe provide 3 AI adoption scenarios:\n• **Low Impact (Baseline):** Today's hiring baseline.\n• **Moderate Impact:** Quick adoption of automation across sectors.\n• **High Impact:** Rapid transformation where AI exposure and augmentation have the strongest effect.\n\nYou can switch scenarios on the Radar and Matches pages to see how rankings adjust.",
        action: { path: "/radar", key: "radar" },
      },
      ms: {
        text: "**Low Impact (Impak Rendah / Garis Asas)** bermaksud pasaran pekerjaan kekal mengikut trend pengambilan pekerja semasa tanpa kejutan AI mendadak.\n\nSistem CTRL CV menyediakan 3 senario kadar penerimagunaan AI:\n• **Low Impact (Impak Rendah):** Garis asas pasaran hari ini.\n• **Moderate Impact (Impak Sederhana):** Automasi digunakan secara pantas di pelbagai sektor.\n• **High Impact (Impak Tinggi):** Transformasi pesat yang memberi kesan paling kuat terhadap tugasan.\n\nAnda boleh menukar senario ini di bahagian Radar atau Padanan.",
        action: { path: "/radar", key: "radar" },
      },
      zh: {
        text: "**低影响场景（Low Impact / Baseline）** 代表就业市场保持当前的招聘趋势发展，没有受到突发额外的AI技术冲击。\n\nCTRL CV 提供 3 种AI采用情景对比：\n• **Low Impact（低影响/基线）：** 维持现状的基准走势。\n• **Moderate Impact（中度影响）：** 各行业快速引入自动化技术。\n• **High Impact（高影响）：** 全面深度转型，AI暴露度和赋能影响最为显著。\n\n您可以在雷达或职位匹配页面随时切换情景查看对比。",
        action: { path: "/radar", key: "radar" },
      },
    },
  },

  // 10. AI Risk & Job Safety
  {
    id: "ai_risk_safety",
    test: (q) =>
      /\b(risk|safety|exposure|augmentation|risiko|keselamatan|terdedah|pembantu|bantu|风险|安全|AI风险|工作安全|工作安全度)\b/i.test(
        q,
      ),
    answers: {
      en: {
        text: "• **AI Risk (AI Exposure):** Measures how much a role's tasks could be affected by AI. It is **not** a guarantee of job loss, but a measure of task transformation.\n• **Job Safety (Augmentation):** Reflects how much AI acts as a helpful tool that augments your work rather than replacing it.\n\nRoles with high Job Safety benefit greatly when you learn to use AI tools!",
        action: { path: "/matches", key: "matches" },
      },
      ms: {
        text: "• **Risiko AI (AI Risk):** Menilai sejauh mana tugasan sesuatu peranan boleh dipengaruhi oleh AI. Ini **bukan** ramalan kehilangan kerja, tetapi tahap perubahan tugasan.\n• **Keselamatan Kerja (Job Safety):** Menunjukkan sejauh mana AI berfungsi sebagai alat bantuan untuk memperkasakan kerja anda dan bukannya menggantikan anda.\n\nPeranan dengan Keselamatan Kerja tinggi amat berfaedah sekiranya anda mempelajari kemahiran menggunakan alat AI!",
        action: { path: "/matches", key: "matches" },
      },
      zh: {
        text: "• **AI 风险 (AI Risk)：** 衡量该职业日常任务受AI技术影响的程度。这**不是**失业预测，而是工作任务被AI重构的概率。\n• **工作安全度 (Job Safety)：** 反映AI赋能辅助人类工作而非完全替代的程度。\n\n高工作安全度的职位在掌握AI工具后将具有极大的发展竞争优势！",
        action: { path: "/matches", key: "matches" },
      },
    },
  },

  // 11. Step 1 Profile & CV Upload
  {
    id: "profile_cv",
    test: (q) =>
      /\b(cv|upload|scan|resume|muat\s*naik|imbas|fail|pdf|persona|profil|profile|tambah\s*kemahiran|simpan|data\s*disimpan|privacy|简历|上传|文件|扫描|档案|隐私)\b/i.test(
        q,
      ),
    answers: {
      en: {
        text: "**Step 1 Profile:** You have 3 easy ways to build your skills:\n1. **Scan CV (PDF):** Upload your resume or paste text to auto-detect skills. You can review and adjust them before saving.\n2. **Demo Persona:** Load ready-made student or professional personas.\n3. **Pick Skills:** Search and select skills manually from 255 canonical skills.\n\nYour data stays safely in your browser (localStorage); CV files are never stored.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "**Langkah 1 Profil:** Anda mempunyai 3 cara mudah untuk menambah kemahiran:\n1. **Imbas CV (PDF):** Muat naik resume atau tampal teks untuk imbasan automatik. Anda boleh menyemak kemahiran sebelum menyimpannya.\n2. **Demo Persona:** Pilih persona pelajar atau profesional sedia ada.\n3. **Pilih Kemahiran:** Cari dan pilih kemahiran secara manual daripada 255 kemahiran rasmi.\n\nData anda disimpan dalam pelayar anda sahaja (localStorage); fail CV tidak disimpan.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "**第1步 个人档案 (Profile)：** 支持3种方式录入技能：\n1. **扫描简历 (PDF)：** 上传简历PDF或粘贴文本，自动提取技能，审核调整后点击保存。\n2. **演示角色 (Persona)：** 一键加载预设的学生或在职人员档案试用。\n3. **手动挑选：** 从255项标准化技能库中自主检索添加。\n\n您的所有数据均保存在本地浏览器中，绝不上载存储个人简历文件，保护隐私安全。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 12. Step 3 Pathway & Reskilling Courses
  {
    id: "pathway",
    test: (q) =>
      /\b(pathway|course|courses|learn|learning|plan|kursus|laluan|belajar|e-latih|e\s*latih|hrd|jam|minggu|uncovered|tidak\s*diliputi|jurang|gaps|路线|课程|培训|路线图|未覆盖)\b/i.test(
        q,
      ),
    answers: {
      en: {
        text: "**Step 3 Pathway:** Once you select a target role in Matches, the system maps your missing skills into a personalized reskilling pathway.\n\n• **HRD Corp e-LATiH:** Matches missing skills to genuine free courses.\n• **Timeline:** Estimates hours and weeks based on your weekly study schedule.\n• **Uncovered Gaps:** If a skill lacks an existing e-LATiH course, it is transparently flagged rather than fabricating a fake course.",
        action: { path: "/matches", key: "matches" },
      },
      ms: {
        text: "**Langkah 3 Laluan:** Selepas anda memilih peranan sasaran di bahagian Padanan, sistem memetakan jurang kemahiran ke dalam pelan pembelajaran tersusun.\n\n• **HRD Corp e-LATiH:** Memadankan kemahiran yang kurang dengan kursus percuma sebenar.\n• **Jadual:** Mengira anggaran jam dan minggu berdasarkan masa belajar mingguan anda.\n• **Jurang Tidak Diliputi (Uncovered):** Jika tiada kursus e-LATiH padanan, ia ditandakan dengan jujur tanpa mereka kursus palsu.",
        action: { path: "/matches", key: "matches" },
      },
      zh: {
        text: "**第3步 技能提升路线 (Pathway)：** 在职位匹配中选定目标岗位后，系统自动为您规划补全技能短板的学习路径：\n\n• **HRD Corp e-LATiH 课程：** 将技能缺口精准匹配至官方真实免费在线课程。\n• **周期估算：** 根据您设定的每周投入学习时长，计算所需总学时及预计周数。\n• **透明标记未覆盖缺口：** 若部分新兴技能暂无现有对应课程，系统会清晰提示未覆盖，杜绝捏造假课程。",
        action: { path: "/matches", key: "matches" },
      },
    },
  },

  // 13. Sources & Methodology
  {
    id: "sources",
    test: (q) =>
      /\b(source|sources|data|accurate|accuracy|where|sumber|ketepatan|dari\s*mana|mycol|ridge|bukti|来源|数据|真实性|可信度)\b/i.test(
        q,
      ),
    answers: {
      en: {
        text: "CTRL CV is built on verified, transparent data:\n• Covers **240 future-facing occupations** across 20 Malaysian industries.\n• References official **MyCOL (Malaysian Critical Occupations List)** benchmarks.\n• Forecasts use deterministic **Ridge autoregression** models.\n• Course recommendations draw from the official **HRD Corp e-LATiH** catalogue.\n\nFull citations and methodology notes can be inspected on the Sources page.",
        action: { path: "/about", key: "sources" },
      },
      ms: {
        text: "CTRL CV dibina berasaskan data telus dan berwibawa:\n• Merangkumi **240 pekerjaan masa hadapan** merentas 20 industri di Malaysia.\n• Dirujuk daripada piawaian **MyCOL (Senarai Pekerjaan Kritikal Malaysia)**.\n• Unjuran menggunakan model matematik **Ridge autoregression**.\n• Cadangan kursus menggunakan katalog rasmi **HRD Corp e-LATiH**.\n\nSemua bukti dan kaedah teknikal boleh dilihat di halaman Sumber.",
        action: { path: "/about", key: "sources" },
      },
      zh: {
        text: "CTRL CV 建立在真实透明的数据体系之上：\n• 覆盖马来西亚20大领域的 **240个前沿关键职位** 与 255 项核心技能。\n• 严格锚定官方 **MyCOL（马来西亚紧缺职业清单）** 标准。\n• 趋势采用确定性 **Ridge 自回归预测模型**。\n• 技能课程直接对接马来西亚人力资源部官方 **HRD Corp e-LATiH** 平台。\n\n所有引用文献与方法论均可在【数据来源】页面查验。",
        action: { path: "/about", key: "sources" },
      },
    },
  },

  // 14. SDGs
  {
    id: "sdgs",
    test: (q) => /\b(sdg|sdgs|un\s*sdg|matlamat|kelestarian|kemampanan|联合国|可持续发展目标)\b/i.test(q),
    answers: {
      en: {
        text: "CTRL CV aligns directly with UN Sustainable Development Goals:\n• **SDG 4 (Quality Education):** Lifelong learning and skill development.\n• **SDG 8 (Decent Work & Economic Growth):** Preparing the workforce for high-productivity future careers.\n\nExplore role-to-SDG mappings on the SDGs page.",
        action: { path: "/sdgs", key: "sources" },
      },
      ms: {
        text: "CTRL CV berhubung rapat dengan Matlamat Pembangunan Mampan PBB:\n• **SDG 4 (Pendidikan Berkualiti):** Pembelajaran sepanjang hayat dan peningkatan kemahiran.\n• **SDG 8 (Pekerjaan Sesuai & Pertumbuhan Ekonomi):** Menyediakan tenaga kerja untuk kerjaya masa depan berproduktiviti tinggi.\n\nLihat hubungan setiap pekerjaan dengan SDG di halaman SDGs.",
        action: { path: "/sdgs", key: "sources" },
      },
      zh: {
        text: "CTRL CV 深度结合联合国可持续发展目标：\n• **SDG 4（优质教育）：** 终身学习与未来技能获取。\n• **SDG 8（体面工作与经济增长）：** 引导劳动力转向高产出、抗AI冲击的未来岗位。\n\n您可以在【SDGs】页面查看每个职业与联合国目标的具体关联。",
        action: { path: "/sdgs", key: "sources" },
      },
    },
  },

  // 15. Conversational Continuation ("pastu?", "then?", "lepas tu?", "然后呢？")
  {
    id: "continuation",
    test: (q) =>
      /^(pastu|pstu|lepas\s*tu|then|and\s*then|after\s*that|dan\s*lagi)[?!.\s]*$/i.test(q.trim()) ||
      /^(然后呢|接下来呢|然后咧)[?!。？.\s]*$/i.test(q.trim()),
    answers: {
      en: {
        text: "Next, proceed to **Step 2 (Matches)** to review your recommended career matches and AI resilience scores. Once you pick a target role, continue to **Step 3 (Pathway)** to unlock your personalized training courses!",
        action: { path: "/matches", key: "matches" },
      },
      ms: {
        text: "Seterusnya, pergi ke **Langkah 2 (Padanan)** untuk menyemak peranan kerjaya yang sesuai dengan anda serta skor ketahanan AI. Selepas memilih peranan sasaran, teruskan ke **Langkah 3 (Laluan)** untuk mendapatkan pelan kursus latihan anda!",
        action: { path: "/matches", key: "matches" },
      },
      zh: {
        text: "接下来，前往 **第2步（职位匹配 Matches）** 查看为您量身推荐的未来职业及AI安全度评分。选中心仪岗位后，即可进入 **第3步（学习路线 Pathway）** 领取专属技能培训课程！",
        action: { path: "/matches", key: "matches" },
      },
    },
  },

  // 16. Confusion & Expressed Frustration ("aku blur la", "tk faham", "i don't get this leh", "我看不懂", "我不会用咧")
  {
    id: "confusion",
    test: (q) =>
      /\b(blur|tk\s*faham|tak\s*faham|pening|i\s*don'?t\s*get\s*this|not\s*sure\s*what\s*to\s*do|confused)\b/i.test(
        q,
      ) || /(我看不懂|我不会用|搞不懂|看不明白)/i.test(q),
    answers: {
      en: {
        text: "No worries, I'm here to help! Here is how CTRL CV works in 3 easy steps:\n1. **Step 1 (Profile):** Upload your PDF resume or manually pick your skills, then click **Save Profile**.\n2. **Step 2 (Matches):** Browse future job roles matched to your skills, and check AI risk and job safety ratings.\n3. **Step 3 (Pathway):** Select a target career to get a customized reskilling roadmap with free HRD Corp e-LATiH courses.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Jangan risau, saya bantu! Tiga langkah utama untuk menggunakan CTRL CV:\n1. **Langkah 1 (Profil):** Muat naik resume (PDF) atau pilih kemahiran anda, kemudian tekan **Simpan Profil**.\n2. **Langkah 2 (Padanan):** Lihat senarai pekerjaan masa hadapan yang paling padan dengan kemahiran anda.\n3. **Langkah 3 (Laluan):** Pilih pekerjaan sasaran untuk menjana pelan latihan percuma bersama HRD Corp e-LATiH.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "别慌，我来一步步带您使用 CTRL CV：\n1. **第1步（个人档案）：** 上传您的简历（PDF）或手动挑选掌握的技能，然后点击 **保存个人档案**。\n2. **第2步（职位匹配）：** 查看系统为您量身推荐的未来职业，了解AI风险与工作安全度。\n3. **第3步（技能路线）：** 选定目标职业，一键生成专属学习路线与官方免费 e-LATiH 培训课程。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 17. How to Use / Getting Started / General Guide ("mcm mana nk guna ni", "camne nak start", "how to use this ah", "这个系统怎么用？", "这个系统怎样用啊？")
  {
    id: "how_to_use",
    test: (q) =>
      (/\b(how\s*to\s*use|how\s*it\s*works|how\s*to\s*start|start|guide|mcm\s*mana(\s*nk\s*guna)?|camne(\s*nak\s*start)?|cmne|cara\s*(nak\s*)?guna|nak\s*mula|mula|guna\s*sistem|start\s*sistem|fungsi\s*sistem|apa\s*fungsi|macam\s*mana|bagaimana)\b/i.test(
        q,
      ) ||
        /(怎么用|怎样用|如何使用|使用方法|新手指南|怎么开始|如何开始|你可以教我一下吗)/i.test(q)) &&
      !/\b(radar|profile|profil|matches|padanan|pathway|laluan|cv)\b/i.test(q),
    answers: {
      en: {
        text: "To get started with CTRL CV, follow these 3 simple steps:\n1. **Step 1 (Profile):** Upload your resume (PDF) or pick skills to build your verified profile.\n2. **Step 2 (Matches):** Discover future-facing job roles ranked specifically for your skills, and check AI risk & job safety.\n3. **Step 3 (Pathway):** Select a target role to build a step-by-step learning roadmap with free HRD Corp e-LATiH courses.\n\nTip: You can also tap the floating **Radar** bubble anytime to see industry hiring trends!",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Untuk mula menggunakan sistem CTRL CV, ikuti 3 langkah mudah ini:\n1. **Langkah 1 (Profil):** Muat naik resume (PDF) atau pilih kemahiran untuk membina profil anda.\n2. **Langkah 2 (Padanan):** Semak senarai pekerjaan masa hadapan yang dipadankan dengan kemahiran anda, serta lihat analisis Risiko AI & Keselamatan Kerja.\n3. **Langkah 3 (Laluan):** Pilih pekerjaan sasaran untuk menjana pelan pembelajaran kemahiran bersama kursus percuma HRD Corp e-LATiH.\n\nPetua: Anda juga boleh klik butang terapung **Radar** pada bila-bila masa untuk melihat trend pekerjaan meningkat dan perlahan!",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "使用 CTRL CV 系统的3个核心步骤：\n1. **第1步（个人档案）：** 上传您的简历（PDF）或自主挑选技能，快速建立技能档案。\n2. **第2步（职位匹配）：** 浏览系统为您量身匹配的未来前沿职位，查看AI影响风险与工作安全度。\n3. **第3步（技能路线）：** 选定心仪职位，一键生成针对技能缺口的专属学习路径及免费官方 e-LATiH 培训课程。\n\n提示：您还可以随时点击浮动的 **Radar（雷达）** 气泡查看全国行业就业趋势！",
        action: { path: "/profile", key: "profile" },
      },
    },
  },

  // 18. Latest Industry News (NewsData.io integration)
  {
    id: "newsdata_news",
    test: (q) =>
      /\b(news|newsdata|berita|industry\s*news|employment\s*news|job\s*news|terkini|berita\s*pasaran|berita\s*kerjaya)\b/i.test(
        q,
      ) || /(新闻|行业新闻|最新资讯|就业新闻|资讯|newsdata)/i.test(q),
    answers: {
      en: {
        text: "You can find real-time graduate employability and tech workforce news under **Section C (Latest Industry News)** on the **Radar** page. It ingests verified headlines from **NewsData.io** covering Malaysian initiatives (TalentCorp, MDEC, HRD Corp) and global future-skills shifts.\n\nNote: Headlines provide qualitative industry signals and are not official salary or unemployment statistics.",
        action: { path: "/radar", key: "radar" },
      },
      ms: {
        text: "Anda boleh melihat berita terkini kebolehpasaran siswazah dan guna tenaga digital di **Seksyen C (Berita Industri Terkini)** pada halaman **Radar**. Ia memaparkan tajuk berita disahkan daripada **NewsData.io** meliputi inisiatif Malaysia (TalentCorp, MDEC, HRD Corp) serta trend global.\n\nNota: Berita ini berfungsi sebagai isyarat industri dan bukannya statistik rasmi gaji atau kadar pengangguran.",
        action: { path: "/radar", key: "radar" },
      },
      zh: {
        text: "您可以在【雷达趋势 (Radar)】页面的 **C 部分（最新行业资讯）** 查看实时毕业生就业与数字劳动力动态。该模块接入了 **NewsData.io** 经过核验的新闻源，涵盖马来西亚本地发展（TalentCorp、MDEC、HRD Corp）及全球未来技能转型。\n\n提示：新闻动态提供质性行业参考，并非官方薪资或失业率统计数据。",
        action: { path: "/radar", key: "radar" },
      },
    },
  },

  // 19. Anthropic Economic Index (AI Task Trends integration)
  {
    id: "anthropic_econ_index",
    test: (q) =>
      /\b(anthropic|economic\s*index|task\s*trend|task\s*trends|ai\s*usage|automation\s*vs\s*augmentation|tugasan\s*ai|guna\s*ai|task)\b/i.test(
        q,
      ) || /(anthropic|经济指数|任务趋势|ai使用|自动化与增强|任务分析)/i.test(q),
    answers: {
      en: {
        text: "On the **Radar** page under **Section B (AI Task Trends)**, you will find research indicators from the **Anthropic Economic Index (v2024-Q3)**. It illustrates how AI interacts with specific work tasks across coding, data pipelines, and documentation—highlighting whether AI augments or automates each task.\n\nImportant: Observed Claude AI usage describes task-level assistance patterns; it does NOT equal job replacement probability or graduate unemployment risk.",
        action: { path: "/radar", key: "radar" },
      },
      ms: {
        text: "Pada halaman **Radar** di bawah **Seksyen B (Trend Tugasan AI)**, anda boleh meneliti indikator penyelidikan daripada **Anthropic Economic Index (v2024-Q3)**. Ia memaparkan bagaimana AI berinteraksi dengan tugasan kerja (seperti pengekodan, analisis data, dan dokumentasi)—serta nisbah pengukuhan (augmentation) berbanding automasi.\n\nPenting: Pemerhatian penggunaan Claude AI ini mencerminkan corak bantuan tugasan, dan BUKAN kebarangkalian kehilangan pekerjaan atau risiko pengangguran graduan.",
        action: { path: "/radar", key: "radar" },
      },
      zh: {
        text: "在【雷达趋势 (Radar)】页面的 **B 部分（AI 任务交互趋势）**，您可以查阅源自 **Anthropic Economic Index (2024-Q3)** 的官方研究指标。它展示了 AI 在编程、数据流水线与技术文档等具体工作任务中的交互强度，以及“增强赋能 (Augmentation)”与“自动化 (Automation)”的比例分布。\n\n重要提示：观察到的 Claude 使用量仅描述任务辅助模式，绝不等于失业概率或毕业生被取代的风险。",
        action: { path: "/radar", key: "radar" },
      },
    },
  },

  // 18. General Troubleshooting (other errors, stuck, fail)
  {
    id: "troubleshooting_general",
    test: (q) =>
      /\b(xleh|takleh|error|gagal|tak\s*boleh|tak\s*jadi|masalah|fail|stuck|sangkut|loading|tak\s*keluar|problem|cannot|why|knp|kenapa|无法|报错|错误|失败)\b/i.test(
        q,
      ),
    answers: {
      en: {
        text: "If you encounter an issue:\n1. **CV Upload:** Ensure your file is a PDF under 5MB. If text extraction is limited, you can manually select skills under **Pick skills**.\n2. **No Matches:** Make sure you clicked **Save Profile** on Step 1 first.\n3. **Display/Connection:** Refresh your browser. CTRL CV stores your current profile locally in your browser so you will not lose your saved skills.",
        action: { path: "/profile", key: "profile" },
      },
      ms: {
        text: "Jika berlaku sebarang masalah:\n1. **Muat Naik CV:** Pastikan fail dalam format PDF dan saiz tidak melebihi 5MB. Jika imbasan terhad, anda boleh pilih kemahiran secara manual di bahagian **Pilih kemahiran**.\n2. **Tiada Padanan:** Pastikan anda telah menekan butang **Simpan Profil** di Langkah 1 terlebih dahulu.\n3. **Sambungan/Paparan:** Muat semula pelayar anda. Sistem CTRL CV menyimpan profil secara setempat dalam peranti anda.",
        action: { path: "/profile", key: "profile" },
      },
      zh: {
        text: "如遇系统使用异常，请检查：\n1. **简历上传：** 请确认文件为 PDF 格式且大小在 5MB 以内；如未能识别，可直接通过【手动挑选技能】快速添加。\n2. **无匹配结果：** 请先确保已在第1步点击【保存个人档案】。\n3. **网络或页面卡顿：** 尝试刷新网页。您的技能数据已保存在浏览器本地，刷新不会丢失已存内容。",
        action: { path: "/profile", key: "profile" },
      },
    },
  },
];

/**
 * Clean conversational filler words like "hai nak tanya", "can i ask", etc., to extract core subject.
 */
function cleanQuery(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(
    /^(hai|hi|hello|salam|hey|pagi|selamat\s*(pagi|petang|malam)|你好|您好)\s*[,，!！.\s]*/i,
    "",
  );
  cleaned = cleaned.replace(
    /^(nak\s*tanya|saya\s*nak\s*tanya|tumpang\s*tanya|nak\s*tahu|boleh\s*saya\s*tahu|tolong\s*terangkan|can\s*i\s*ask|i\s*want\s*to\s*ask|could\s*you\s*tell\s*me|please\s*explain|请问|我想问|我想知道|可以告诉我)\s*[,，:：\s]*/i,
    "",
  );
  return cleaned.trim() || text.trim();
}

function faqAnswer(rawText: string, lang: GuideLang, history?: Msg[]) {
  const query = cleanQuery(rawText);

  // Match the most specific topic first (skipping pure greeting if there are other words)
  let hit = TOPICS.find((t) => t.id !== "greetings" && (t.test(rawText, history) || t.test(query, history)));

  // If no topic matched, check if it's a pure greeting
  if (!hit && TOPICS.find((t) => t.id === "greetings")?.test(rawText, history)) {
    hit = TOPICS.find((t) => t.id === "greetings");
  }

  const fallbackTexts: Record<GuideLang, string> = {
    en: "Sorry, this detail isn't covered in the CTRL CV system guide. Please refer to our official support or documentation on the Sources page.",
    ms: "Maaf, maklumat ini tiada dalam panduan sistem CTRL CV. Anda boleh semak dokumentasi rasmi atau hubungi pihak sokongan di halaman Sumber.",
    zh: "抱歉，CTRL CV 系统指南中未涵盖此细节。请在【数据来源】页面查阅官方说明或联系技术支持。",
  };

  if (hit) {
    const item = hit.answers[lang];
    const actions: Action[] = item.action
      ? [{ label: LANG_LABELS[lang][item.action.key], href: item.action.path }]
      : [];
    return { reply: item.text, actions };
  }

  return {
    reply: fallbackTexts[lang],
    actions: [{ label: LANG_LABELS[lang].sources, href: "/about" }],
  };
}

router.get("/guide/status", (_req, res) => {
  const hasKey = Boolean(process.env.KD_API_KEY || process.env.LLM_API_KEY);
  const isAuthorized =
    process.env.KD_LIVE_AUTHORISED === "true" || process.env.KD_LIVE_AUTHORISED === "1";
  res.json({
    aiEnabled: hasKey && isAuthorized,
    provider: "KrackDevs (gpt-5.4-mini)",
    liveAuthorized: isAuthorized,
  });
});

router.post("/guide/chat", async (req, res) => {
  const body = req.body as { messages?: Msg[]; page?: string; lang?: GuideLang | "auto" };

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    res.status(400).json({ error: "Send a question." });
    return;
  }

  // 1. Explicit language selection ALWAYS overrides automatic detection!
  let effectiveLang: GuideLang;
  if (body.lang && body.lang !== "auto" && (body.lang === "en" || body.lang === "ms" || body.lang === "zh")) {
    effectiveLang = body.lang;
  } else {
    // 2. AUTO mode: infer language from the latest message and context
    effectiveLang = detectLanguage(last.content);
  }

  // KrackDevs OpenAI-compatible provider configuration (Phase 4)
  const kdApiKey = process.env.KD_API_KEY || process.env.LLM_API_KEY;
  const kdBaseUrl = (
    process.env.KD_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "https://litellm.rapidscreen.io/v1"
  ).replace(/\/+$/, "");
  const kdModel = process.env.KD_MODEL || process.env.LLM_MODEL || "gpt-5.4-mini";
  const isAuthorized =
    process.env.KD_LIVE_AUTHORISED === "true" || process.env.KD_LIVE_AUTHORISED === "1";

  // Security guardrail (Phase 9 & 4): only send live billable LLM requests when explicitly authorized
  if (!kdApiKey || !isAuthorized) {
    res.json({ ...faqAnswer(last.content, effectiveLang, messages), source: "faq", lang: effectiveLang });
    return;
  }

  try {
    const r = await fetch(`${kdBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${kdApiKey}` },
      body: JSON.stringify({
        model: kdModel,
        temperature: 0.3,
        max_tokens: 450,
        messages: [{ role: "system", content: SYSTEM(pageLabel(String(body.page ?? "/")), effectiveLang) }, ...messages],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`LLM HTTP ${r.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Empty LLM reply");
    res.json({ ...splitActions(text), source: "ai", lang: effectiveLang });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("401")) {
      logger.warn({ msg }, "Guide LLM fallback triggered");
    }
    res.json({ ...faqAnswer(last.content, effectiveLang, messages), source: "faq", lang: effectiveLang });
  }
});

export default router;
