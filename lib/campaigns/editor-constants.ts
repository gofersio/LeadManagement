export const MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First Name" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{title}}", label: "Job Title" },
] as const;

export const VARIABLE_TAGS = [
  { tag: "{{first_name}}", label: "First Name" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{title}}", label: "Title" },
  { tag: "{{last_name}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
] as const;

export const SPINTAX_PRESETS = [
  {
    title: "Opening Greetings",
    items: [
      "{Hi | Hello | Good Morning}",
      "{Hi | Hello | Hey there}",
      "{Good morning | Good afternoon}",
    ],
  },
  {
    title: "Closing Greetings",
    items: [
      "{Best regards, | Sincerely, | Regards}",
      "{Thank you | Thanks | Appreciate it}",
      "{Warm regards | Cheers | All the best}",
    ],
  },
  {
    title: "Praises",
    items: [
      "{Excellent | Outstanding | Impressive}",
      "{Remarkable | Phenomenal | Exceptional}",
      "{Brilliant | Fantastic | Superb}",
    ],
  },
] as const;

export const EMOJI_FREQUENTLY_USED = ["👋", "😊", "🙏", "✅", "🚀", "💡", "📧", "⭐"];

export const EMOJI_SMILEYS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😅",
  "😂",
  "🙂",
  "😉",
  "😊",
  "😇",
  "🥰",
  "😍",
  "🤩",
  "😘",
  "😗",
  "😚",
  "😋",
  "😛",
  "😜",
  "🤪",
  "😝",
  "🤑",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🤐",
  "🤨",
  "😐",
  "😑",
  "😶",
  "😏",
  "😒",
  "🙄",
  "😬",
  "🤥",
];
