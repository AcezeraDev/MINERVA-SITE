/**
 * Emojis 3D nos títulos da Mine (nov/2026).
 *
 * O emoji do sistema muda de aparelho para aparelho (no Windows, o Segoe é
 * chapado e simples). Os títulos das respostas usam os Fluent Emoji 3D da
 * Microsoft (licença MIT), guardados em public/emoji/<codepoints>.webp — sem
 * CDN, iguais em todo lugar. Só um subconjunto de estudo vem junto; emoji fora
 * da lista continua o do sistema.
 *
 * Para acrescentar: baixar https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/<codepoints>.webp
 * (codepoints em hexa separados por "-", com o fe0f quando o emoji completo tem)
 * para public/emoji/ e pôr o nome aqui.
 */

const AVAILABLE = new Set([
  "1f19a", "1f30a", "1f30d", "1f30e", "1f30f", "1f310", "1f319", "1f31f",
  "1f321-fe0f", "1f331", "1f333", "1f338", "1f33e", "1f33f", "1f343", "1f34e",
  "1f389", "1f392", "1f393", "1f3a8", "1f3ac", "1f3ad", "1f3af", "1f3b5",
  "1f3b6", "1f3c1", "1f3c6", "1f3d9-fe0f", "1f3db-fe0f", "1f3eb", "1f3ed", "1f3f7-fe0f",
  "1f40d", "1f440", "1f449", "1f44d", "1f44f", "1f4a1", "1f4a7", "1f4aa",
  "1f4ac", "1f4b0", "1f4b5", "1f4bb", "1f4c5", "1f4c8", "1f4c9", "1f4ca",
  "1f4cb", "1f4cc", "1f4cd", "1f4ce", "1f4cf", "1f4d0", "1f4d2", "1f4d3",
  "1f4d6", "1f4d7", "1f4d8", "1f4d9", "1f4da", "1f4dc", "1f4dd", "1f4e3",
  "1f4e6", "1f4f0", "1f4f7", "1f4fa", "1f501", "1f504", "1f50d", "1f50e",
  "1f511", "1f514", "1f517", "1f520", "1f522", "1f524", "1f525", "1f527",
  "1f52c", "1f52d", "1f52e", "1f570-fe0f", "1f58a-fe0f", "1f58d-fe0f", "1f5a5-fe0f", "1f5d2-fe0f",
  "1f5d3-fe0f", "1f5dd-fe0f", "1f5e3-fe0f", "1f5fa-fe0f", "1f609", "1f60a", "1f62e", "1f642",
  "1f64c", "1f680", "1f697", "1f6a8", "1f6e0-fe0f", "1f913", "1f914", "1f947",
  "1f973", "1f9a0", "1f9b4", "1f9d1-200d-1f393", "1f9d1-200d-1f3eb", "1f9d1-200d-1f4bb", "1f9d8", "1f9e0",
  "1f9e9", "1f9ea", "1f9eb", "1f9ec", "1f9ed", "1f9ee", "1f9ef", "1f9f0",
  "1f9f1", "1f9f2", "1f9f3", "1f9f7", "1f9fe", "1fa84", "1fa90", "1fac0",
  "1fac1", "231b", "2328-fe0f", "23f0", "23f3", "2600-fe0f", "2696-fe0f", "2697-fe0f",
  "2699-fe0f", "26a0-fe0f", "26a1", "26d4", "2705", "2708-fe0f", "270f-fe0f", "2716-fe0f",
  "2728", "274c", "2753", "2757", "2764-fe0f", "2795", "2797", "2b50",
]);

const hexOf = (emoji) => [...emoji].map((char) => char.codePointAt(0).toString(16)).join("-");

/** Caminho do emoji 3D, ou "" se ele não está no conjunto. Tolera fe0f faltando ou sobrando. */
export function emoji3dPath(emoji) {
  const value = String(emoji || "");
  if (!value) return "";
  const exact = hexOf(value);
  const bare = exact.replace(/-fe0f/g, "");
  const parts = bare.split("-");
  const candidates = [exact, bare, [parts[0], "fe0f", ...parts.slice(1)].join("-")];
  const found = candidates.find((name) => AVAILABLE.has(name));
  return found ? `/emoji/${found}.webp` : "";
}

// Um emoji "de verdade" no começo: pictográfico com seus modificadores, tom de
// pele, junções ZWJ e o seletor de variação.
const LEADING_EMOJI = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*/u;

/** "🧭 Entendendo o tema" -> { emoji: "🧭", rest: "Entendendo o tema" }; sem emoji, emoji "". */
export function splitLeadingEmoji(text) {
  const value = String(text || "");
  const match = value.match(LEADING_EMOJI);
  if (!match) return { emoji: "", rest: value };
  return { emoji: match[1], rest: value.slice(match[0].length) };
}

/** Os emojis que a Mine pode usar em título e saem em 3D (para o prompt). */
export const HEADING_EMOJIS = "🧠 🧭 ✏️ 📝 ✅ 📌 📚 📖 💡 🔍 🎯 🧪 🔬 🧬 🦠 🌍 🗺️ 📊 📈 📉 🧮 📐 📏 ⚡ 🔥 💧 🌱 🌳 🧲 ⚙️ 🛠️ 🧩 🏛️ ⚖️ 📜 🗓️ ⏰ ⏳ 🚀 ⭐ ✨ 🎓 🏆 🤔 ❓ ⚠️ 🚨 ❌ 🔑 💬 🗣️ 🎨 🎵 🌐 💻 🐍 👀 🔁 📦 💰 🪐 🌙 ☀️ 🌊 🏁 📋 🔢 🔤 🎒 📎 🌡️ ❤️ 🫀 🦴 🍎 🏭 ✈️ 🎭 📷 📰 🎉 🔮 🧰 📣 🔗";
