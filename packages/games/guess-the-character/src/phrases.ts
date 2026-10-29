import type { HelpLevel, LanguageHelp, Phrase } from "./types.js";

/**
 * Category English support for A1–A2 learners. Help depends only on the category
 * and level, never on a match's characters, so it is safe for every player.
 */

const p = (en: string, vi: string): Phrase => ({ en, vi });

interface LevelHelp {
  questions: Phrase[];
  answers: Phrase[];
  grammar: Phrase;
  vocabulary: Phrase[];
}

const BASE: Record<HelpLevel, Pick<LevelHelp, "questions" | "answers">> = {
  A1: {
    questions: [
      p("Is your character a boy or a girl?", "Nhân vật của bạn là con trai hay con gái?"),
      p("Is your character ___?", "Nhân vật của bạn có ___ không?"),
      p("Can your character ___?", "Nhân vật của bạn có thể ___ không?"),
      p("What does your character wear?", "Nhân vật của bạn mặc gì?"),
    ],
    answers: [
      p("Yes, it is. / No, it isn't.", "Đúng vậy. / Không phải."),
      p("Yes, it can. / No, it can't.", "Có, nó có thể. / Không, nó không thể."),
      p("My character can ___.", "Nhân vật của tôi có thể ___."),
      p("My character wears ___.", "Nhân vật của tôi mặc ___."),
    ],
  },
  A2: {
    questions: [
      p("What does your character look like?", "Nhân vật của bạn trông như thế nào?"),
      p("What is your character famous for?", "Nhân vật của bạn nổi tiếng vì điều gì?"),
      p("Where does your character live?", "Nhân vật của bạn sống ở đâu?"),
      p("What does your character want?", "Nhân vật của bạn muốn gì?"),
    ],
    answers: [
      p("My character uses ___ to ___.", "Nhân vật của tôi dùng ___ để ___."),
      p("My character is famous for ___.", "Nhân vật của tôi nổi tiếng vì ___."),
      p("My character lives in ___.", "Nhân vật của tôi sống ở ___."),
      p("I'm not sure, but I think ___.", "Tôi không chắc, nhưng tôi nghĩ ___."),
    ],
  },
};

const HELP: Record<string, Record<HelpLevel, LevelHelp>> = {
  superheroes: {
    A1: {
      questions: [
        p("Can your character fly?", "Nhân vật của bạn có bay được không?"),
        p("Does your character wear a mask?", "Nhân vật của bạn có đeo mặt nạ không?"),
        p("Is your character very strong?", "Nhân vật của bạn có rất khỏe không?"),
      ],
      answers: [
        p("Yes, my character can fly.", "Có, nhân vật của tôi bay được."),
        p("My character wears a ___ cape.", "Nhân vật của tôi mặc áo choàng màu ___."),
        p("No, my character doesn't wear a mask.", "Không, nhân vật của tôi không đeo mặt nạ."),
      ],
      grammar: p(
        "can + verb: “He can fly.” (not “He can flies.”)",
        "can + động từ nguyên mẫu: “He can fly.” (không thêm -s)",
      ),
      vocabulary: [
        p("fly", "bay"),
        p("strong", "khỏe"),
        p("mask", "mặt nạ"),
        p("cape", "áo choàng"),
        p("shield", "khiên"),
        p("power", "sức mạnh"),
      ],
    },
    A2: {
      questions: [
        p("What is your character's superpower?", "Siêu năng lực của nhân vật bạn là gì?"),
        p(
          "Does your character use a special tool?",
          "Nhân vật của bạn có dùng dụng cụ đặc biệt không?",
        ),
        p("Is your character a member of a team?", "Nhân vật của bạn có ở trong một đội không?"),
      ],
      answers: [
        p("My character's superpower is ___.", "Siêu năng lực của nhân vật tôi là ___."),
        p("My character uses a ___ to fight.", "Nhân vật của tôi dùng ___ để chiến đấu."),
        p("My character works with a team.", "Nhân vật của tôi làm việc cùng một đội."),
      ],
      grammar: p(
        "Present simple for facts: “She protects the city.” Add -s with he/she/it.",
        "Thì hiện tại đơn cho sự thật: thêm -s với he/she/it.",
      ),
      vocabulary: [
        p("protect", "bảo vệ"),
        p("superpower", "siêu năng lực"),
        p("suit", "bộ đồ"),
        p("hammer", "cây búa"),
        p("rich", "giàu"),
        p("save", "cứu"),
      ],
    },
  },
  "disney-princesses": {
    A1: {
      questions: [
        p("Does your character have long hair?", "Nhân vật của bạn có tóc dài không?"),
        p("Does your character live in a castle?", "Nhân vật của bạn có sống trong lâu đài không?"),
        p("Can your character sing?", "Nhân vật của bạn có hát không?"),
      ],
      answers: [
        p("Her hair is ___.", "Tóc của cô ấy màu ___."),
        p("She wears a ___ dress.", "Cô ấy mặc váy màu ___."),
        p("Yes, she lives in a castle.", "Có, cô ấy sống trong lâu đài."),
      ],
      grammar: p(
        "Use “has” for he/she: “She has long hair.”",
        "Dùng “has” với he/she: “She has long hair.”",
      ),
      vocabulary: [
        p("dress", "váy"),
        p("castle", "lâu đài"),
        p("sing", "hát"),
        p("hair", "tóc"),
        p("brave", "dũng cảm"),
        p("kind", "tốt bụng"),
      ],
    },
    A2: {
      questions: [
        p(
          "Does your character have an animal friend?",
          "Nhân vật của bạn có bạn là con vật không?",
        ),
        p("Where does your character's story happen?", "Câu chuyện của nhân vật diễn ra ở đâu?"),
        p("What problem does your character have?", "Nhân vật của bạn gặp vấn đề gì?"),
      ],
      answers: [
        p("Her best friend is a ___.", "Bạn thân của cô ấy là một ___."),
        p("Her story happens near the ___.", "Câu chuyện của cô ấy diễn ra gần ___."),
        p("She wants to ___.", "Cô ấy muốn ___."),
      ],
      grammar: p(
        "want + to + verb: “She wants to see the world.”",
        "want + to + động từ: “She wants to see the world.”",
      ),
      vocabulary: [
        p("ocean", "đại dương"),
        p("prince", "hoàng tử"),
        p("magic", "phép thuật"),
        p("adventure", "cuộc phiêu lưu"),
        p("sleep", "ngủ"),
        p("dream", "ước mơ"),
      ],
    },
  },
  "classic-cartoons": {
    A1: {
      questions: [
        p("Is your character an animal?", "Nhân vật của bạn có phải là con vật không?"),
        p("Is your character small?", "Nhân vật của bạn có nhỏ không?"),
        p("Is your character funny?", "Nhân vật của bạn có hài hước không?"),
      ],
      answers: [
        p("Yes, my character is a ___.", "Đúng, nhân vật của tôi là một ___."),
        p("My character is small and ___.", "Nhân vật của tôi nhỏ và ___."),
        p("My character has a best friend.", "Nhân vật của tôi có một người bạn thân."),
      ],
      grammar: p(
        "a / an: “a mouse”, “an animal” (an before a, e, i, o, u sounds).",
        "a / an: dùng “an” trước âm a, e, i, o, u.",
      ),
      vocabulary: [
        p("animal", "động vật"),
        p("funny", "hài hước"),
        p("small", "nhỏ"),
        p("chase", "đuổi theo"),
        p("friend", "bạn"),
        p("hungry", "đói"),
      ],
    },
    A2: {
      questions: [
        p("Who is your character's best friend?", "Bạn thân của nhân vật bạn là ai?"),
        p("Does your character live under the sea?", "Nhân vật của bạn có sống dưới biển không?"),
        p("What does your character like to eat?", "Nhân vật của bạn thích ăn gì?"),
      ],
      answers: [
        p("My character always ___.", "Nhân vật của tôi luôn luôn ___."),
        p("My character likes eating ___.", "Nhân vật của tôi thích ăn ___."),
        p("My character often tries to ___.", "Nhân vật của tôi thường cố gắng ___."),
      ],
      grammar: p(
        "always / often / never go before the main verb: “He always runs.”",
        "always / often / never đứng trước động từ chính.",
      ),
      vocabulary: [
        p("cat", "con mèo"),
        p("duck", "con vịt"),
        p("dog", "con chó"),
        p("sea", "biển"),
        p("sailor", "thủy thủ"),
        p("trick", "trò đùa"),
      ],
    },
  },
  "animated-movies": {
    A1: {
      questions: [
        p("Is your character a toy?", "Nhân vật của bạn có phải đồ chơi không?"),
        p("Is your character a robot?", "Nhân vật của bạn có phải người máy không?"),
        p("Does your character live in the water?", "Nhân vật của bạn có sống dưới nước không?"),
      ],
      answers: [
        p("Yes, my character is a ___.", "Đúng, nhân vật của tôi là một ___."),
        p("My character is ___ and ___.", "Nhân vật của tôi ___ và ___."),
        p("No, it isn't a toy.", "Không, nó không phải đồ chơi."),
      ],
      grammar: p(
        "Adjectives go before nouns: “a green ogre”, “a small fish”.",
        "Tính từ đứng trước danh từ: “a small fish”.",
      ),
      vocabulary: [
        p("toy", "đồ chơi"),
        p("robot", "người máy"),
        p("fish", "cá"),
        p("car", "xe hơi"),
        p("family", "gia đình"),
        p("adventure", "cuộc phiêu lưu"),
      ],
    },
    A2: {
      questions: [
        p(
          "Does your character have a best friend in the movie?",
          "Nhân vật của bạn có bạn thân trong phim không?",
        ),
        p("Is your character looking for someone?", "Nhân vật của bạn có đang tìm ai không?"),
        p(
          "Can your character do kung fu or race?",
          "Nhân vật của bạn có biết võ hoặc đua xe không?",
        ),
      ],
      answers: [
        p("In the movie, my character ___.", "Trong phim, nhân vật của tôi ___."),
        p("My character is looking for ___.", "Nhân vật của tôi đang tìm ___."),
        p("My character is good at ___.", "Nhân vật của tôi giỏi ___."),
      ],
      grammar: p(
        "good at + verb-ing: “He is good at racing.”",
        "good at + động từ thêm -ing: “He is good at racing.”",
      ),
      vocabulary: [
        p("lost", "bị lạc"),
        p("race", "đua"),
        p("space", "vũ trụ"),
        p("ogre", "chằn tinh"),
        p("panda", "gấu trúc"),
        p("alien", "người ngoài hành tinh"),
      ],
    },
  },
  "anime-manga": {
    A1: {
      questions: [
        p("Is your character a student?", "Nhân vật của bạn có phải học sinh không?"),
        p("Is your character a robot?", "Nhân vật của bạn có phải người máy không?"),
        p("Is your character from Japan?", "Nhân vật của bạn có đến từ Nhật Bản không?"),
      ],
      answers: [
        p("Yes, my character is a ___.", "Đúng, nhân vật của tôi là một ___."),
        p("My character has ___ hair.", "Nhân vật của tôi có tóc ___."),
        p("My character is ___ years old.", "Nhân vật của tôi ___ tuổi."),
      ],
      grammar: p(
        "Is he / Is she …? → Yes, he is. / No, she isn't.",
        "Hỏi “Is he/she …?” → trả lời “Yes, he is. / No, she isn't.”",
      ),
      vocabulary: [
        p("student", "học sinh"),
        p("robot", "người máy"),
        p("detective", "thám tử"),
        p("ninja", "ninja"),
        p("pirate", "cướp biển"),
        p("magic", "phép thuật"),
      ],
    },
    A2: {
      questions: [
        p(
          "Does your character have a special gadget?",
          "Nhân vật của bạn có bảo bối đặc biệt không?",
        ),
        p("What does your character dream of?", "Nhân vật của bạn mơ ước điều gì?"),
        p("Does your character fight bad guys?", "Nhân vật của bạn có đánh kẻ xấu không?"),
      ],
      answers: [
        p("My character dreams of becoming ___.", "Nhân vật của tôi mơ trở thành ___."),
        p("My character has a pocket with ___.", "Nhân vật của tôi có túi chứa ___."),
        p("My character solves ___.", "Nhân vật của tôi giải quyết ___."),
      ],
      grammar: p(
        "dream of + verb-ing: “He dreams of becoming king.”",
        "dream of + động từ thêm -ing.",
      ),
      vocabulary: [
        p("gadget", "bảo bối"),
        p("pocket", "túi"),
        p("cat", "con mèo"),
        p("lazy", "lười biếng"),
        p("ship", "con tàu"),
        p("forest", "rừng"),
      ],
    },
  },
  "video-game-characters": {
    A1: {
      questions: [
        p("Can your character jump high?", "Nhân vật của bạn có nhảy cao được không?"),
        p("Can your character run fast?", "Nhân vật của bạn có chạy nhanh không?"),
        p("Does your character collect things?", "Nhân vật của bạn có thu thập đồ vật không?"),
      ],
      answers: [
        p("Yes, my character can ___.", "Có, nhân vật của tôi có thể ___."),
        p("My character collects ___.", "Nhân vật của tôi thu thập ___."),
        p("My character is ___ (color).", "Nhân vật của tôi màu ___."),
      ],
      grammar: p(
        "Colors after “is”: “He is blue.” Colors before nouns: “a red hat”.",
        "Màu sắc sau “is” hoặc trước danh từ: “a red hat”.",
      ),
      vocabulary: [
        p("jump", "nhảy"),
        p("run", "chạy"),
        p("collect", "thu thập"),
        p("build", "xây"),
        p("race", "đua"),
        p("rescue", "giải cứu"),
      ],
    },
    A2: {
      questions: [
        p("Who does your character fight against?", "Nhân vật của bạn chiến đấu với ai?"),
        p(
          "Does your character have a brother or a friend?",
          "Nhân vật của bạn có anh em hoặc bạn không?",
        ),
        p("What does your character eat or collect?", "Nhân vật của bạn ăn hoặc thu thập gì?"),
      ],
      answers: [
        p("My character fights against ___.", "Nhân vật của tôi chiến đấu với ___."),
        p("In the game, players ___.", "Trong trò chơi, người chơi ___."),
        p("My character's brother is ___.", "Anh/em của nhân vật tôi là ___."),
      ],
      grammar: p(
        "Questions with “does”: “What does he eat?” (verb has no -s after does).",
        "Câu hỏi với “does”: động từ sau “does” không thêm -s.",
      ),
      vocabulary: [
        p("coin", "đồng xu"),
        p("hedgehog", "con nhím"),
        p("dinosaur", "khủng long"),
        p("princess", "công chúa"),
        p("sword", "thanh kiếm"),
        p("block", "khối"),
      ],
    },
  },
  "fairy-tales": {
    A1: {
      questions: [
        p("Does your character live in a forest?", "Nhân vật của bạn có sống trong rừng không?"),
        p("Can your character do magic?", "Nhân vật của bạn có làm phép được không?"),
        p("Is your character a fairy?", "Nhân vật của bạn có phải tiên không?"),
      ],
      answers: [
        p("My character lives in a ___.", "Nhân vật của tôi sống trong ___."),
        p(
          "Yes, my character can make a wish come true.",
          "Có, nhân vật của tôi có thể biến điều ước thành thật.",
        ),
        p("No, my character isn't a fairy.", "Không, nhân vật của tôi không phải tiên."),
      ],
      grammar: p(
        "in / on / at: “in a forest”, “in a tower”, “at home”.",
        "Giới từ nơi chốn: “in a forest”, “at home”.",
      ),
      vocabulary: [
        p("forest", "rừng"),
        p("magic", "phép thuật"),
        p("fairy", "tiên"),
        p("wish", "điều ước"),
        p("wooden", "bằng gỗ"),
        p("tower", "tòa tháp"),
      ],
    },
    A2: {
      questions: [
        p(
          "Does something bad happen to your character?",
          "Có chuyện xấu xảy ra với nhân vật của bạn không?",
        ),
        p("Who helps your character?", "Ai giúp nhân vật của bạn?"),
        p(
          "Does your character go to a strange place?",
          "Nhân vật của bạn có đến một nơi kỳ lạ không?",
        ),
      ],
      answers: [
        p("A ___ helps my character.", "Một ___ giúp nhân vật của tôi."),
        p("At the end, my character ___.", "Cuối cùng, nhân vật của tôi ___."),
        p("My character goes to ___.", "Nhân vật của tôi đi đến ___."),
      ],
      grammar: p(
        "Past simple for stories: “She met a wolf.” “He grew up.”",
        "Thì quá khứ đơn khi kể chuyện: met, grew, went…",
      ),
      vocabulary: [
        p("wolf", "chó sói"),
        p("lamp", "cây đèn"),
        p("lie", "nói dối"),
        p("nose", "mũi"),
        p("grandmother", "bà"),
        p("grow up", "lớn lên"),
      ],
    },
  },
  "vietnamese-folk-tales": {
    A1: {
      questions: [
        p("Does your character live in a village?", "Nhân vật của bạn có sống ở làng không?"),
        p("Is your character brave?", "Nhân vật của bạn có dũng cảm không?"),
        p(
          "Does your character live on the moon?",
          "Nhân vật của bạn có sống trên mặt trăng không?",
        ),
      ],
      answers: [
        p("My character lives near a ___.", "Nhân vật của tôi sống gần ___."),
        p("Yes, my character is brave.", "Đúng, nhân vật của tôi dũng cảm."),
        p("My character has a ___.", "Nhân vật của tôi có một ___."),
      ],
      grammar: p(
        "Names stay in Vietnamese, sentences in English: “Does your character have a sister?”",
        "Tên riêng giữ tiếng Việt, câu hỏi bằng tiếng Anh.",
      ),
      vocabulary: [
        p("village", "làng"),
        p("bamboo", "tre"),
        p("moon", "mặt trăng"),
        p("mountain", "núi"),
        p("river", "sông"),
        p("brave", "dũng cảm"),
      ],
    },
    A2: {
      questions: [
        p(
          "Is your character good or bad in the story?",
          "Nhân vật của bạn tốt hay xấu trong truyện?",
        ),
        p(
          "Does your character fight a monster or an enemy?",
          "Nhân vật của bạn có đánh quái vật hoặc kẻ thù không?",
        ),
        p(
          "Does your character have a sister or a brother?",
          "Nhân vật của bạn có chị em hoặc anh em không?",
        ),
      ],
      answers: [
        p("In the story, my character ___.", "Trong truyện, nhân vật của tôi ___."),
        p("My character is jealous of ___.", "Nhân vật của tôi ghen tị với ___."),
        p("My character marries ___.", "Nhân vật của tôi cưới ___."),
      ],
      grammar: p(
        "good / bad person → “He is a good person.” Use “because” to give a reason.",
        "Dùng “because” để giải thích lý do.",
      ),
      vocabulary: [
        p("king", "vua"),
        p("giant", "người khổng lồ"),
        p("flood", "lũ lụt"),
        p("coconut", "quả dừa"),
        p("banyan tree", "cây đa"),
        p("stepmother", "dì ghẻ"),
      ],
    },
  },
  "famous-villains": {
    A1: {
      questions: [
        p("Is your character a bad person?", "Nhân vật của bạn có phải người xấu không?"),
        p("Is your character an animal?", "Nhân vật của bạn có phải con vật không?"),
        p("Can your character do magic?", "Nhân vật của bạn có làm phép được không?"),
      ],
      answers: [
        p("Yes, my character is very ___.", "Đúng, nhân vật của tôi rất ___."),
        p("My character's enemy is ___.", "Kẻ thù của nhân vật tôi là ___."),
        p("No, my character can't do magic.", "Không, nhân vật của tôi không làm phép được."),
      ],
      grammar: p(
        "very + adjective: “very cruel”, “very powerful”.",
        "very + tính từ: “very cruel”.",
      ),
      vocabulary: [
        p("powerful", "mạnh mẽ"),
        p("cruel", "độc ác"),
        p("jealous", "ghen tị"),
        p("trick", "lừa"),
        p("fight", "chiến đấu"),
        p("enemy", "kẻ thù"),
      ],
    },
    A2: {
      questions: [
        p("What does your character want to get?", "Nhân vật của bạn muốn có được gì?"),
        p("Who is your character's enemy?", "Kẻ thù của nhân vật bạn là ai?"),
        p(
          "Does your character have a special object?",
          "Nhân vật của bạn có đồ vật đặc biệt không?",
        ),
      ],
      answers: [
        p("My character wants to ___.", "Nhân vật của tôi muốn ___."),
        p("My character is the enemy of ___.", "Nhân vật của tôi là kẻ thù của ___."),
        p("My character uses ___ to trick people.", "Nhân vật của tôi dùng ___ để lừa người khác."),
      ],
      grammar: p(
        "Comparatives: “stronger than”, “more powerful than”.",
        "So sánh hơn: “stronger than”, “more powerful than”.",
      ),
      vocabulary: [
        p("mirror", "gương"),
        p("hook", "cái móc"),
        p("lion", "sư tử"),
        p("puppy", "chó con"),
        p("wand", "đũa phép"),
        p("curse", "lời nguyền"),
      ],
    },
  },
};

export const HELP_CATEGORY_IDS = Object.keys(HELP);

export function languageHelp(categoryId: string, level: HelpLevel): LanguageHelp {
  const help = HELP[categoryId]?.[level];
  if (!help) throw new Error(`No language help for ${categoryId}/${level}`);
  return {
    questions: [...help.questions, ...BASE[level].questions],
    answers: [...help.answers, ...BASE[level].answers],
    grammar: help.grammar,
    vocabulary: help.vocabulary,
  };
}

/** Category-independent help, for screens shown before a category is chosen. */
export function generalHelp(level: HelpLevel): LanguageHelp {
  return {
    ...BASE[level],
    grammar:
      level === "A1"
        ? p("can + verb: “It can fly.”", "can + động từ nguyên mẫu: “It can fly.”")
        : p("Present simple for facts: “She lives in a castle.”", "Thì hiện tại đơn cho sự thật."),
    vocabulary: [],
  };
}
