import { getArea, type ResearchCategory } from "@/data/taxonomy";

export type FigureKind = "cnapp" | "competitive" | "adoption" | "industry";

export type TocChapter = {
  title: string;
  items: string[];
};

export type Report = {
  slug: string;
  title: string;
  titleJa: string;
  category: ResearchCategory;
  publishedAt: string;
  summary: string;
  priceJpy?: number;
  featured?: boolean;
  executiveSummary: string[];
  objectives: string[];
  scope: string[];
  analysisItems: string[];
  toc: TocChapter[];
  limits: string;
  figure: FigureKind;
  figureLabel: string;
  figureCaption: string;
};

export const reports: Report[] = [
  {
    slug: "cnapp-market-analysis",
    title: "CNAPP Market Analysis",
    titleJa: "CNAPP市場分析",
    category: "market-intelligence",
    publishedAt: "2026-10-08",
    summary:
      "Cloud Native Application Protection Platform市場の構造、主要プレイヤー、競争環境、技術トレンドを分析するレポート。",
    priceJpy: 220000,
    featured: true,
    executiveSummary: [
      "クラウド上のアプリケーションを守る製品は、設定の監査、ワークロードの保護、権限の可視化、そしてコードから実行環境までの連続した検査へと広がってきました。CNAPPという呼称は、これらを一つのプラットフォームとして買う動きを指します。呼称が同じでも、製品がどの領域を本業として始まり、どこを後から足しているかは揃っていません。",
      "本レポートは、CNAPPを市場規模の一点に還元しません。カテゴリの境界、購買の単位、プレイヤーの出自、競争が実際に起きている機能の層、という四つの問いに分けて整理します。比較の材料は、公開されている製品情報、技術文書、企業の開示です。",
      "読後に残すものは、特定製品の推奨順位ではありません。自社のクラウドの使い方に対して、どの保護領域がすでに重なり、どの領域がまだ分かれたままかを判断するための地図です。",
    ],
    objectives: [
      "CNAPPという呼称が指す範囲と、指さない範囲を定義する",
      "ポイント製品からプラットフォームへの移行を、購買単位の変化として記述する",
      "出自の違う事業者が、どの層で提供範囲を重ねているかを比較可能にする",
    ],
    scope: [
      "CNAPP、および CSPM、CWPP、CIEM、コードからクラウドまでの保護など隣接領域",
      "公開されている製品情報、技術文書、企業開示、規制・標準に関する文書",
      "特定顧客の非公開導入データ、および未公開の価格表は対象外",
    ],
    analysisItems: [
      "カテゴリの境界",
      "市場構造と購買単位",
      "プレイヤーの出自",
      "製品範囲の比較軸",
      "競争が集中する機能層",
      "技術トレンドと、導入側の確認項目",
    ],
    toc: [
      {
        title: "カテゴリの定義",
        items: ["CNAPPが束ねる領域", "隣接する呼称との重なり", "定義が揺れる境界"],
      },
      {
        title: "市場の構造",
        items: ["購買単位と予算の置き場所", "ポイント製品が残る条件", "プラットフォーム化の進み方"],
      },
      {
        title: "主要プレイヤー",
        items: ["ポスチャ出自", "ワークロード出自", "スイートとして広げる事業者"],
      },
      {
        title: "競争環境",
        items: ["差別化が説明できる機能", "梱包と価格のパターン", "資料だけでは比較できない点"],
      },
      {
        title: "技術トレンド",
        items: ["コードから実行環境まで", "アイデンティティとデータの接点", "運用に残る人手"],
      },
      {
        title: "意思決定への含意",
        items: ["導入前に分けるべき領域", "本レポートの限界"],
      },
    ],
    limits:
      "本編の比較は公開情報で確認できる範囲に限られます。非公開の割引、個別契約、実際の検知精度は、このレポートだけでは確定できません。",
    figure: "cnapp",
    figureLabel: "Fig. 01 — Category structure",
    figureCaption:
      "CNAPPを、単一機能ではなく複数の保護領域が一つの購買単位に束ねられていく構造として示す見取り図です。棒の長さやシェアを表すものではありません。",
  },
  {
    slug: "cloud-security-competitive-map",
    title: "Cloud Security Competitive Map",
    titleJa: "クラウドセキュリティ競争地図",
    category: "competitive-intelligence",
    publishedAt: "2026-09-16",
    summary:
      "クラウドセキュリティ事業者を、出自と提供範囲の二軸で整理し、製品境界と事業モデルの違いを比較するレポート。",
    priceJpy: 180000,
    executiveSummary: [
      "クラウドセキュリティの競争は、機能一覧を横に並べただけでは読めません。同じ「プラットフォーム」という説明でも、単一領域を深く持つ会社と、複数領域を浅く束ねる会社では、買い手が比較している対象が違います。",
      "本レポートは、事業者を順位づけません。出自（どこから製品を広げたか）と提供範囲（単一領域か、複数領域か）の二つの軸を固定し、公開情報で説明できる差と、説明できない差を分けます。",
      "目的は、提案資料の文言を翻訳し、自社が実際に比べるべき相手の範囲を狭くすることです。",
    ],
    objectives: [
      "比較軸を、機能の数ではなく出自と提供範囲に固定する",
      "事業モデルの違いが、製品の梱包と販売経路にどう現れるかを記述する",
      "公開情報では判定できない優位性を、判定できないまま残す",
    ],
    scope: [
      "クラウドセキュリティの主要カテゴリにまたがる事業者と製品",
      "公開されている製品文書、価格に関する公開情報、企業開示",
      "非公開の受注実績、個別の値引き、顧客満足の調査は対象外",
    ],
    analysisItems: [
      "出自別の整理",
      "提供範囲の重なり",
      "事業モデル",
      "梱包と販売経路",
      "比較可能な優位と、資料不足の箇所",
    ],
    toc: [
      {
        title: "比較の枠組み",
        items: ["なぜ機能一覧では足りないか", "二軸の定義"],
      },
      {
        title: "出自",
        items: ["設定とポスチャ", "ワークロード", "アイデンティティ", "開発工程"],
      },
      {
        title: "提供範囲",
        items: ["単一領域に留まる製品", "隣接領域への拡張", "スイートとして語る条件"],
      },
      {
        title: "事業モデル",
        items: ["ライセンスの単位", "販売経路", "パートナーとの分界"],
      },
      {
        title: "読み方",
        items: ["自社の比較対象を狭める手順", "限界"],
      },
    ],
    limits:
      "地図上の位置は、公開資料から読んだ類型です。個別企業の優劣や市場シェアを座標で示したものではありません。",
    figure: "competitive",
    figureLabel: "Fig. 02 — Comparison axes",
    figureCaption:
      "競争を読むための二軸です。マスの中は企業名やシェアではなく、比較のときに立つ類型です。",
  },
  {
    slug: "enterprise-generative-ai-adoption",
    title: "Enterprise Generative AI: Adoption Conditions",
    titleJa: "企業における生成AIの導入条件",
    category: "technology-research",
    publishedAt: "2026-08-21",
    summary:
      "生成AIの企業導入を、業務の単位、データの条件、ガバナンスの三つに分け、何が実装され、何がまだ実験に留まるかを整理するレポート。",
    executiveSummary: [
      "生成AIの導入は、ツールを配ったかどうかでは測れません。どの業務の、どの作業が短くなり、その作業に必要なデータが社内のどこにあり、出力を誰が確認するかが揃って、はじめて運用になります。",
      "本レポートは、導入事例の成功談を集めません。業務、データ、ガバナンスの三つの条件が揃う場合と、一つでも欠ける場合で、技術の使い方がどう変わるかを枠組みにします。",
      "価格は案件の範囲によって変わるため、この掲載では金額を固定していません。",
    ],
    objectives: [
      "生成AIを、業務システムの一部として見るための条件を定義する",
      "実験と運用の境界を、精度の宣伝ではなく作業と責任の単位で引く",
      "過大に語られやすい効果と、資料で確認できる効果を分ける",
    ],
    scope: [
      "文章、検索、業務ソフトウェアに接続する生成AIの企業利用",
      "公開されている技術文書、製品文書、規制・ガイドライン、企業開示",
      "特定企業の内部利用ログや、未公開の精度評価は対象外",
    ],
    analysisItems: [
      "対象となる作業の単位",
      "データが使える条件",
      "確認と責任の置き場所",
      "既存システムとの接続",
      "実験に留まりやすいパターン",
    ],
    toc: [
      {
        title: "問いの設定",
        items: ["導入とは何を指すか", "測らないことにするもの"],
      },
      {
        title: "業務",
        items: ["短くなりうる作業", "人が残る確認", "業務システムの境界"],
      },
      {
        title: "データ",
        items: ["学習と参照の違い", "権限と鮮度", "使えないデータの典型"],
      },
      {
        title: "ガバナンス",
        items: ["出力の責任", "記録", "規制と社内規程の接点"],
      },
      {
        title: "含意",
        items: ["導入判断の確認項目", "限界"],
      },
    ],
    limits:
      "技術の到達点は公開文書の時点に依存します。モデルの更新によって、個別の機能記述は早く古くなります。条件の枠組みの方が、機能一覧より長く使えます。",
    figure: "adoption",
    figureLabel: "Fig. 03 — Adoption conditions",
    figureCaption:
      "導入を三つの条件の重なりとして示す図です。達成率や利用率を表すものではありません。",
  },
  {
    slug: "japan-vertical-saas-structure",
    title: "Japan Vertical SaaS: Industry Structure",
    titleJa: "日本のバーティカルSaaS産業構造",
    category: "industry-analysis",
    publishedAt: "2026-07-03",
    summary:
      "業種特化の業務ソフトウェアについて、業務知識、業務システム、共通基盤がどの層に分かれ、置き換えと共存がどこで起きるかを整理するレポート。",
    priceJpy: 160000,
    executiveSummary: [
      "バーティカルSaaSは、業種の名前を冠した製品群として語られがちです。実際の産業構造は、業種の業務知識を誰が持ち、日々の業務システムを誰が握り、認証・データ・請求などの基盤を誰が提供するかの層で分かれます。",
      "本レポートは、個別の成功企業を模範として並べません。置き換えが起きる層と、既存の業務システムが残り続ける層を分け、新規参入が見るべき境界を言葉にします。対象は日本の業務ソフトウェア市場における公開情報です。",
      "読者に渡すのは、参入や提携の是非そのものではなく、その判断の前に確認すべき産業の層です。",
    ],
    objectives: [
      "バーティカルSaaSを、製品カテゴリではなく産業の層として定義する",
      "置き換えと共存が起きる境界を、業務の単位で記述する",
      "業種横断の基盤と、業種の中に残る知識を分けて比較できるようにする",
    ],
    scope: [
      "日本の業種特化型業務ソフトウェアと、その周辺の基盤",
      "公開されている企業情報、製品情報、統計、制度に関する文書",
      "未公開の受注、顧客単価、解約率は対象外",
    ],
    analysisItems: [
      "産業の層",
      "業務知識の所在",
      "業務システムの境界",
      "共通基盤との分界",
      "置き換えと共存",
    ],
    toc: [
      {
        title: "産業の見方",
        items: ["バーティカルを層に分ける", "業種名だけでは読めない理由"],
      },
      {
        title: "業務知識",
        items: ["現場に残る知", "ソフトウェアに写せる知", "写せない例外"],
      },
      {
        title: "業務システム",
        items: ["既存システムの役割", "置き換わる作業", "共存が続く接続"],
      },
      {
        title: "基盤",
        items: ["認証、データ、請求", "業種をまたぐ層", "依存の非対称"],
      },
      {
        title: "含意",
        items: ["境界を確認する問い", "限界"],
      },
    ],
    limits:
      "業種ごとの商習慣は公開情報だけでは粗くなります。個別業界の深掘りは、このレポートの範囲外としてカスタム調査に残します。",
    figure: "industry",
    figureLabel: "Fig. 04 — Industry layers",
    figureCaption:
      "バーティカルSaaSを、業務知識、業務システム、共通基盤の三層として示す図です。市場規模を表すものではありません。",
  },
];

export function getReport(slug: string) {
  return reports.find((report) => report.slug === slug);
}

export function getFeaturedReport() {
  return reports.find((report) => report.featured) ?? reports[0];
}

export function getCategoryLabel(category: ResearchCategory) {
  return getArea(category).name;
}
