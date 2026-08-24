// Reusable, transport-agnostic engagement policy for Personal Zalo agents.
// It decides intent only; an account adapter remains responsible for API calls.

const CRITICAL = /(?:tự\s*(?:tử|hại|vẫn)|không\s+muốn\s+(?:sống|tồn\s*tại)|muốn\s+chết|giết\s+(?:người|ai|tôi|em)|bạo\s*hành|xâm\s*hại|cấp\s*cứu|nguy\s+hiểm\s+(?:ngay|tức\s*thì)|suicide|self[- ]?harm|kill\s+(?:myself|someone)|rape|domestic\s+violence)/iu;
const SENSITIVE = /(?:buồn|khóc|mất\s+(?:mát|người)|qua\s+đời|đau|bệnh|y\s*tế|bác\s*sĩ|thuốc|lo\s+quá|sợ|thất\s+vọng|bực|giận|khiếu\s*nại|lỗi|khẩn\s*cấp|\bgấp\b|pháp\s*lý|luật\s*sư|tòa\s*án|thanh\s*toán|chuyển\s*khoản|ngân\s*hàng|mật\s*khẩu|\botp\b|bị\s*hack|chiếm\s+tài\s*khoản|lừa\s*đảo|trẻ\s*(?:em|vị\s*thành\s*niên)|em\s*bé|mang\s*thai|abuse|fraud|scam)/iu;

export function classifyEngagementSafety(text = "") {
  const input = String(text || "").normalize("NFKC").toLowerCase();
  if (CRITICAL.test(input)) return "critical";
  if (SENSITIVE.test(input)) return "sensitive";
  return "normal";
}

export function selectInboundReaction(text = "") {
  const input = String(text || "").normalize("NFKC").toLowerCase().trim();
  if (!input || classifyEngagementSafety(input) !== "normal") return "";
  if (/(?:cảm\s*ơn|thank|tuyệt|hay\s+quá|đỉnh|yêu|chúc\s*mừng|haha|hehe|hihi|❤️|❤|♥|🥰|😍)/iu.test(input)) return "heart";
  if (/^(?:alo|a\s*lô|hello|hi|chào|em\s*ơi|amon\s*ơi|ok(?:e|ay)?|được|vâng|dạ|ừ|uh|ừa|rồi|đã\s+nhận)(?:\s+(?:em|amon|anh|chị|nha|nhé|ạ))*[.!?…]*$/iu.test(input)) return "like";
  return "";
}

export function buildFriendRequestMessage(agentName = "Amon") {
  const safeName = String(agentName || "Amon").replace(/[\r\n]/gu, " ").trim().slice(0, 40) || "Amon";
  return `${safeName} xin phép kết bạn để hỗ trợ mình thuận tiện hơn nhé 🐾`;
}

export function firstContactReplyInstruction(agentName = "Amon") {
  const safeName = String(agentName || "Amon").replace(/[\r\n]/gu, " ").trim().slice(0, 40) || "Amon";
  return `Đây là lượt DM đầu tiên. Mở bằng một lời chào ngắn, ấm và tự nhiên của ${safeName}, rồi trả lời thẳng việc người dùng vừa hỏi. Chỉ chào một lần; không chào lại ở các lượt sau.`;
}
