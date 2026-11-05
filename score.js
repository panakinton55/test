export const TYPE_ORDER = [
  "builder",
  "architect",
  "researcher",
  "strategist",
  "translator",
  "host",
  "pathfinder",
  "steward",
];

export const types = {
  builder: {
    id: "builder",
    name: "つくる人",
    line: "考えを、動くものに変えた瞬間がいちばん気持ちいい。",
    fit: [
      "完成の定義が、自分の手の中にある",
      "荒い依頼でも、試作して会話できる",
      "道具や技術が、毎日少し深くなる",
    ],
    drain: [
      "決める場にいるだけで、手を動かす時間がない",
      "完成前に取り上げられて、別の人の作業になる",
    ],
    try: "頭の中の不満を一つ、30分で動く形にして誰かに渡す。",
    roles: ["ソフトウェアエンジニア", "ハードウェア開発", "プロトタイプ制作", "手を動かす個人制作"],
  },
  architect: {
    id: "architect",
    name: "設計する人",
    line: "部分より先に、全体の分かれ目を置きたくなる。",
    fit: [
      "境界、例外、責任の範囲を決める役割がある",
      "バラバラな要望を、一つの構造に落とせる",
      "長く使われるものの骨格を任される",
    ],
    drain: [
      "その場の空気だけで、方針が毎日変わる",
      "全体を見る前に、細部の作業だけ渡される",
    ],
    try: "いま抱えているごちゃつきを紙に三層だけ書いて、「ここが境界」と誰かに示す。",
    roles: ["システム設計", "アーキテクト", "プロダクトの骨格づくり", "建築や計画"],
  },
  researcher: {
    id: "researcher",
    name: "掘る人",
    line: "答えより、問いが正確になったときの方が残る。",
    fit: [
      "原因を、納得するまで追ってよい",
      "一次情報やデータに触れられる",
      "専門が深くなっても評価される",
    ],
    drain: [
      "根拠より速さが、常に優先される",
      "調べたことが、使われずに捨てられる",
    ],
    try: "最近「なんとなくそう」で済ませた判断を一つ、出典か実測まで戻して確かめる。",
    roles: ["研究", "データ分析", "取材", "原因を追う専門職"],
  },
  strategist: {
    id: "strategist",
    name: "筋を読む人",
    line: "労力の前に、どこが勝つかを見てしまう。",
    fit: [
      "選択肢を減らす判断が、仕事になる",
      "数字と人の動きの両方を材料にできる",
      "小さく賭けて、早く結果が返る",
    ],
    drain: [
      "正しさの議論だけが続き、決断がない",
      "読んでも、切る権限がない",
    ],
    try: "今週の予定から、成果に直結しないものを一つ止めて、空いた時間の使い道を先に書く。",
    roles: ["事業企画", "プロダクトマネジメント", "投資や審査", "交渉"],
  },
  translator: {
    id: "translator",
    name: "伝える人",
    line: "難しいことを、相手の言葉に翻訳できたときに仕事をした気になる。",
    fit: [
      "内容と受け手の間に立てる",
      "言葉、図、見た目のどれかで精度を上げられる",
      "伝わったかどうかが、その場で分かる",
    ],
    drain: [
      "伝える相手がいないまま、内向きに作り続ける",
      "正確さだけ求められて、届く形を削られる",
    ],
    try: "自分が詳しいことを、知らない人向けに半ページで書き、一箇所だけ反応を見る。",
    roles: ["編集", "デザイン", "技術の翻訳", "教育や執筆"],
  },
  host: {
    id: "host",
    name: "場をつくる人",
    line: "自分が前に出なくても、人が動ける場ができると満足する。",
    fit: [
      "役割と空気を整えることが、成果になる",
      "継続して顔を合わせる相手がいる",
      "衝突を、排除せず前に進む形にできる",
    ],
    drain: [
      "関係が毎回リセットされる、単発の作業だけ",
      "人の状態を無視して、数字だけが評価される",
    ],
    try: "次の集まりで、話す内容より先に「誰が何を決める場か」を一行で共有する。",
    roles: ["ファシリテーション", "コミュニティ運営", "人事", "カスタマーサクセス"],
  },
  pathfinder: {
    id: "pathfinder",
    name: "道を切る人",
    line: "地図がない方が燃える。小さく出て、反応で次を決める。",
    fit: [
      "前例が薄いテーマを任される",
      "不完全なまま出してよい",
      "結果が早く返って、方向を変えてよい",
    ],
    drain: [
      "手順が固定され、逸脱が悪になる",
      "出す前の合意が、作る時間より長い",
    ],
    try: "温めていたアイデアを説明資料にせず、今日一個だけ外に出す。",
    roles: ["起業", "新規事業", "0から1のプロダクト", "立ち上げ期の現場"],
  },
  steward: {
    id: "steward",
    name: "守り切る人",
    line: "始めたものを、壊れない状態まで育てるのが性に合う。",
    fit: [
      "同じ対象を長く見続けられる",
      "目立たない改善が、信頼として積み上がる",
      "異常に気づく観察が評価される",
    ],
    drain: [
      "毎週テーマが入れ替わり、引き渡しばかり",
      "速度のために、後始末が常に後回し",
    ],
    try: "繰り返し面倒な手順を一つ、次の自分が迷わないメモか仕組みに変える。",
    roles: ["運用", "品質保証", "バックオフィス", "長く使われるプロダクトの保守"],
  },
};

export const questions = [
  {
    prompt: "何も予定がない日、時間が溶けるのはどれ？",
    options: [
      { label: "道具やコードを触って、動くまでいじっている", scores: { builder: 3, architect: 1 } },
      { label: "気になったことを、出典まで遡って調べている", scores: { researcher: 3, architect: 1 } },
      { label: "誰かといて、その場の空気をよくしている", scores: { host: 3, translator: 1 } },
      { label: "前から気になっていたことを、とりあえず始めている", scores: { pathfinder: 3, strategist: 1 } },
    ],
  },
  {
    prompt: "新しい話を振られたとき、最初に出る問いは？",
    options: [
      { label: "全体は、どこで分かれている？", scores: { architect: 3, builder: 1 } },
      { label: "これは勝てる話か。どこで損する？", scores: { strategist: 3, pathfinder: 1 } },
      { label: "誰に、どう届けると意味が通る？", scores: { translator: 3, host: 1 } },
      { label: "これを三年続けたら、何が残る？", scores: { steward: 3, builder: 1 } },
    ],
  },
  {
    prompt: "チームが止まっている。自然な一手は？",
    options: [
      { label: "小さく動くものを作って、話を前に進める", scores: { builder: 3, steward: 1 } },
      { label: "前提と境界を整理して、論点を減らす", scores: { architect: 3, strategist: 1 } },
      { label: "それぞれが気にしていることを言葉にする", scores: { translator: 3, researcher: 1 } },
      { label: "「今週これだけ」と切って、自分も出る", scores: { pathfinder: 3, strategist: 1 } },
    ],
  },
  {
    prompt: "一番「うまくいった」と感じるのは？",
    options: [
      { label: "わからなかった理由が、一本の線になる", scores: { researcher: 3, architect: 1 } },
      { label: "読みが当たって、少ない手間で大きく動いた", scores: { strategist: 3, architect: 1 } },
      { label: "人が、自分の役割で動き始めた", scores: { host: 3, translator: 1 } },
      { label: "荒れていたものが、静かに回り続けている", scores: { steward: 3, builder: 1 } },
    ],
  },
  {
    prompt: "情報との付き合い方に近いのは？",
    options: [
      { label: "読むより、触って確かめる", scores: { builder: 3, pathfinder: 1 } },
      { label: "一次情報に当たるまで、信用しない", scores: { researcher: 3, strategist: 1 } },
      { label: "相手が使える形に編集してから渡す", scores: { translator: 3, host: 1 } },
      { label: "記録して、次の人が迷わないように残す", scores: { steward: 3, architect: 1 } },
    ],
  },
  {
    prompt: "人が多い場で、楽な位置は？",
    options: [
      { label: "端で、全体の配置を見ている", scores: { architect: 3, researcher: 1 } },
      { label: "勝負所を見て、必要なときだけ入る", scores: { strategist: 3, researcher: 1 } },
      { label: "会話が途切れないように、間を埋める", scores: { host: 3, translator: 1 } },
      { label: "その場で思いついたことを、その場で試す", scores: { pathfinder: 3, builder: 1 } },
    ],
  },
  {
    prompt: "任されると燃える依頼は？",
    options: [
      { label: "「これ、動くようにして」", scores: { builder: 3, architect: 1 } },
      { label: "「この状況、どう切る？」", scores: { strategist: 3, pathfinder: 1 } },
      { label: "「このメンバー、回るようにして」", scores: { host: 3, steward: 1 } },
      { label: "「この内容、伝わる形にして」", scores: { translator: 3, researcher: 1 } },
    ],
  },
  {
    prompt: "失敗した直後、最初に気になるのは？",
    options: [
      { label: "どこまで事実で、どこから推測だったか", scores: { researcher: 3, strategist: 1 } },
      { label: "構造の、どの仮定が崩れたか", scores: { architect: 3, builder: 1 } },
      { label: "次の一手を、今日中に打てるか", scores: { pathfinder: 3, strategist: 1 } },
      { label: "同じ抜けを、二度と出さない仕組み", scores: { steward: 3, builder: 1 } },
    ],
  },
  {
    prompt: "しっくりくる終わり方は？",
    options: [
      { label: "自分の手で、完成まで持っていく", scores: { builder: 3, pathfinder: 1 } },
      { label: "関係者が、同じ絵を見て判断できる", scores: { architect: 3, researcher: 1 } },
      { label: "関わる人が、次も来たいと思っている", scores: { host: 3, translator: 1 } },
      { label: "例外が起きても、手順が崩れない", scores: { steward: 3, researcher: 1 } },
    ],
  },
  {
    prompt: "学びが身につくのは？",
    options: [
      { label: "疑問が残ったところを、自分で掘ったとき", scores: { researcher: 3, architect: 1 } },
      { label: "結果が出て、読みの良し悪しが分かったとき", scores: { strategist: 3, architect: 1 } },
      { label: "誰かに説明して、相手の顔が変わったとき", scores: { translator: 3, host: 1 } },
      { label: "知らない領域に出て、初手を打ったとき", scores: { pathfinder: 3, builder: 1 } },
    ],
  },
  {
    prompt: "長く続けられる条件は？",
    options: [
      { label: "毎日、手を動かす時間がある", scores: { builder: 3, pathfinder: 1 } },
      { label: "自分の判断が、結果に返ってくる", scores: { strategist: 3, pathfinder: 1 } },
      { label: "言葉や見た目を、磨ける", scores: { translator: 3, host: 1 } },
      { label: "守る対象が明確で、改善が積み上がる", scores: { steward: 3, architect: 1 } },
    ],
  },
  {
    prompt: "十年後に残っていたいものは？",
    options: [
      { label: "まだ誰も言語化していない知見", scores: { researcher: 3, strategist: 1 } },
      { label: "人が迷わず使える構造", scores: { architect: 3, builder: 1 } },
      { label: "人が集まれる場所や関係", scores: { host: 3, translator: 1 } },
      { label: "自分が切り開いた仕事の列", scores: { pathfinder: 3, strategist: 1 } },
    ],
  },
];

function primaryId(option) {
  let best = null;
  let bestPoints = -1;
  for (const id of TYPE_ORDER) {
    const points = option.scores[id] ?? 0;
    if (points > bestPoints) {
      best = id;
      bestPoints = points;
    }
  }
  return best;
}

export function diagnose(answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new Error("回答は12問ぶん必要です");
  }

  const points = Object.fromEntries(TYPE_ORDER.map((id) => [id, 0]));
  const hits = Object.fromEntries(TYPE_ORDER.map((id) => [id, 0]));
  const evidence = Object.fromEntries(TYPE_ORDER.map((id) => [id, []]));

  answers.forEach((choice, questionIndex) => {
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
      throw new Error("選択肢が不正です");
    }
    const option = questions[questionIndex].options[choice];
    const primary = primaryId(option);
    for (const id of TYPE_ORDER) {
      const gained = option.scores[id] ?? 0;
      points[id] += gained;
      if (id === primary) {
        hits[id] += 1;
        evidence[id].push(option.label);
      }
    }
  });

  const ranked = TYPE_ORDER.map((id) => ({
    id,
    points: points[id],
    hits: hits[id],
    type: types[id],
  })).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.hits !== a.hits) return b.hits - a.hits;
    return TYPE_ORDER.indexOf(a.id) - TYPE_ORDER.indexOf(b.id);
  });

  const top = ranked[0];
  const second = ranked[1];
  const tied = top.points === second.points;
  const close = tied || top.points - second.points <= 2;
  const headline = close ? `${top.type.name} × ${second.type.name}` : top.type.name;
  const lead = close
    ? `${top.type.name}と${second.type.name}が近い。片方の職種に寄せると、もう片方の好みが余る。条件はセットで読む。`
    : top.type.line;

  const picked = [];
  const sources = close ? [top.id, second.id] : [top.id];
  const perType = close ? 2 : 4;
  for (const id of sources) {
    for (const label of evidence[id].slice(0, perType)) {
      if (!picked.includes(label)) picked.push(label);
    }
  }

  return {
    ranked,
    top,
    second,
    tied,
    close,
    headline,
    lead,
    profiles: close ? [top.type, second.type] : [top.type],
    evidence: picked.slice(0, 4),
    tryThis: top.type.try,
    maxPoints: top.points,
  };
}

export function resultText(result) {
  const lines = ["向き先", result.headline, result.lead, ""];
  if (result.tied) lines.push("上位は同点。", "");
  for (const profile of result.profiles) {
    lines.push(profile.name);
    lines.push(profile.line);
    lines.push("向いている条件");
    for (const item of profile.fit) lines.push(`・${item}`);
    lines.push("消耗しやすい条件");
    for (const item of profile.drain) lines.push(`・${item}`);
    lines.push("");
  }
  lines.push("今週ためすこと");
  if (result.close) {
    for (const profile of result.profiles) lines.push(`${profile.name}。${profile.try}`);
  } else {
    lines.push(result.tryThis);
  }
  lines.push("");
  lines.push("仕事の例");
  lines.push(result.profiles.flatMap((profile) => profile.roles).join("、"));
  return lines.join("\n");
}
