/**
 * Public B1 sentence frames that help a team talk. They are the same for every case: they hold
 * no clue, name or answer, so this module is safe to ship to the browser.
 */

/** An English frame with its Vietnamese meaning. */
export type Phrase = { en: string; vi: string };

/** Help topics, one per kind of talk the game asks for. */
export type HelpTopic = "share" | "clarify" | "propose" | "disagree" | "uncertain" | "conclude";

/** A group of frames under one heading. */
export type HelpGroup = { topic: HelpTopic; title: string; phrases: Phrase[] };

const GROUPS: Record<HelpTopic, HelpGroup> = {
  share: {
    topic: "share",
    title: "Share your clue",
    phrases: [
      { en: "According to my clue, …", vi: "Theo manh mối của mình, …" },
      { en: "The report says …", vi: "Báo cáo nói rằng …" },
      { en: "My clue is from …", vi: "Manh mối của mình đến từ …" },
    ],
  },
  clarify: {
    topic: "clarify",
    title: "Ask again",
    phrases: [
      { en: "Do you mean …?", vi: "Ý bạn là …?" },
      { en: "When exactly did that happen?", vi: "Chính xác điều đó xảy ra lúc nào?" },
      { en: "Can you read that part again?", vi: "Bạn đọc lại đoạn đó được không?" },
    ],
  },
  propose: {
    topic: "propose",
    title: "Suggest what to do",
    phrases: [
      { en: "We should check … because …", vi: "Chúng ta nên kiểm tra … vì …" },
      { en: "Let's ask … about …", vi: "Hãy hỏi … về …" },
      { en: "I think we need more information about …", vi: "Mình nghĩ cần thêm thông tin về …" },
    ],
  },
  disagree: {
    topic: "disagree",
    title: "Disagree politely",
    phrases: [
      {
        en: "That explains …, but what about …?",
        vi: "Điều đó giải thích …, nhưng còn … thì sao?",
      },
      { en: "I'm not sure that is true.", vi: "Mình không chắc điều đó đúng." },
      { en: "I see it differently.", vi: "Mình nhìn khác." },
    ],
  },
  uncertain: {
    topic: "uncertain",
    title: "Know or suspect",
    phrases: [
      { en: "We know …, but we only suspect …", vi: "Chúng ta biết …, nhưng chỉ nghi ngờ …" },
      { en: "This is a statement, not a proof.", vi: "Đây là lời khai, chưa phải bằng chứng." },
      { en: "It could be … or …", vi: "Có thể là … hoặc …" },
    ],
  },
  conclude: {
    topic: "conclude",
    title: "Explain your answer",
    phrases: [
      { en: "We ruled out … because …", vi: "Chúng mình loại … vì …" },
      { en: "Our evidence is …", vi: "Bằng chứng của chúng mình là …" },
      { en: "We agree that the answer is …", vi: "Chúng mình thống nhất đáp án là …" },
    ],
  },
};

/** Which help groups to show in each phase of the game. */
const BY_PHASE: Record<string, HelpTopic[]> = {
  BRIEFING: ["share", "clarify"],
  SHARING: ["share", "clarify", "uncertain"],
  INVESTIGATION: ["propose", "disagree", "uncertain"],
  CONCLUSION: ["disagree", "uncertain", "conclude"],
};

const DEFAULT_TOPICS: HelpTopic[] = ["share", "clarify"];

/**
 * The frames to show during a phase.
 *
 * @param phase the current game phase.
 * @returns two or three groups; unknown phases get the sharing basics.
 */
export function helpFor(phase: string): HelpGroup[] {
  return (BY_PHASE[phase] ?? DEFAULT_TOPICS).map((topic) => GROUPS[topic]);
}
