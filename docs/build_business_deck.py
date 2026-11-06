"""Generate the business briefing deck. Run from the repo root."""

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

FONT = "Noto Sans CJK JP"
INK = RGBColor(0x1C, 0x19, 0x15)
MUTED = RGBColor(0x5C, 0x56, 0x4E)
PAPER = RGBColor(0xF6, 0xF4, 0xEF)
WHITE = RGBColor(0xFF, 0xFC, 0xF8)
GREEN = RGBColor(0x1B, 0x45, 0x34)
GREEN_SOFT = RGBColor(0xE6, 0xEE, 0xE8)
LINE = RGBColor(0xE2, 0xDC, 0xD2)
AMBER_SOFT = RGBColor(0xF6, 0xED, 0xD8)

W = Inches(13.333)
H = Inches(7.5)


def set_font(run, size, bold, color):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    r_pr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        element = r_pr.find(qn(tag))
        if element is None:
            element = r_pr.makeelement(qn(tag), {})
            r_pr.append(element)
        element.set("typeface", FONT)


def add_run(paragraph, text, size, bold, color):
    run = paragraph.add_run()
    run.text = text
    set_font(run, size, bold, color)
    return run


def box(slide, left, top, width, height, text, size=16, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_textbox(left, top, width, height)
    frame = shape.text_frame
    frame.word_wrap = True
    frame.auto_size = None
    frame.margin_left = 0
    frame.margin_right = 0
    frame.margin_top = 0
    frame.margin_bottom = 0
    try:
        frame._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])
    except Exception:
        pass
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    paragraph.space_after = Pt(0)
    add_run(paragraph, text, size, bold, color)
    return shape


def rect(slide, left, top, width, height, fill):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    # Avoid the default shadow by clearing effect list if present.
    sp_pr = shape._element.spPr
    effect = sp_pr.find(qn("a:effectLst"))
    if effect is not None:
        sp_pr.remove(effect)
    return shape


def background(slide):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = PAPER


def footer(slide, page, total=8):
    box(slide, Inches(0.55), Inches(7.12), Inches(9), Inches(0.24), "エージェント関所  ·  販売仮説  ·  税別  ·  2026年11月", 10, False, MUTED)
    box(slide, Inches(11.4), Inches(7.12), Inches(1.4), Inches(0.24), f"{page}  /  {total}", 10, False, MUTED, PP_ALIGN.RIGHT)


def new_slide(prs, title, page):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    background(slide)
    rect(slide, 0, 0, Inches(0.12), H, GREEN)
    box(slide, Inches(0.55), Inches(0.32), Inches(12), Inches(0.48), title, 26, True, INK)
    footer(slide, page)
    return slide


def paint_table(slide, left, top, width, rows, col_widths, font=12, header=True, row_h=0.42):
    height = Inches(row_h * len(rows))
    table_shape = slide.shapes.add_table(len(rows), len(rows[0]), left, top, width, height)
    table = table_shape.table
    for index, col_w in enumerate(col_widths):
        table.columns[index].width = col_w
    for r, row in enumerate(rows):
        for c, text in enumerate(row):
            cell = table.cell(r, c)
            cell.text = ""
            cell.margin_left = Inches(0.08)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(0.05)
            cell.margin_bottom = Inches(0.05)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            frame = cell.text_frame
            frame.word_wrap = True
            paragraph = frame.paragraphs[0]
            paragraph.alignment = PP_ALIGN.LEFT
            is_header = header and r == 0
            add_run(paragraph, text, font, is_header, WHITE if is_header else INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = GREEN if is_header else (WHITE if r % 2 else GREEN_SOFT)
            tc = cell._tc
            tc_pr = tc.get_or_add_tcPr()
            for edge in ("lnL", "lnR", "lnT", "lnB"):
                line = tc_pr.find(qn(f"a:{edge}"))
                if line is None:
                    line = tc_pr.makeelement(qn(f"a:{edge}"), {"w": "6350"})
                    tc_pr.append(line)
                line.clear()
                line.set("w", "6350")
                fill = line.makeelement(qn("a:solidFill"), {})
                color = fill.makeelement(qn("a:srgbClr"), {"val": "E2DCD2"})
                fill.append(color)
                line.append(fill)
    return table_shape


def build():
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H
    prs.core_properties.title = "エージェント関所の売り方"
    prs.core_properties.subject = "販売仮説 2026年11月"
    total = 8

    cover = prs.slides.add_slide(prs.slide_layouts[6])
    background(cover)
    rect(cover, 0, 0, Inches(0.18), H, GREEN)
    box(cover, Inches(0.7), Inches(0.48), Inches(11), Inches(0.3), "販売仮説   ·   2026年11月   ·   税別   ·   受注実績なし", 13, False, MUTED)
    box(cover, Inches(0.7), Inches(1.7), Inches(11.8), Inches(1.6), "エージェントを本番に出せない\n会社に売る", 40, True, INK)
    box(
        cover,
        Inches(0.7),
        Inches(3.7),
        Inches(11.2),
        Inches(0.9),
        "買う理由は暗号の名前ではない。外部へ送る直前に、誰が、何の権限で、どこへ、何を出さなかったかを説明できない。関所がその説明を残す。",
        18,
        False,
        INK,
    )
    labels = [
        ("200–500万円", "今日の設計パートナー\n3ヶ月"),
        ("240–600万円", "製品化後の部門\n年額"),
        ("900–2,400万円", "製品化後の全社\n年額"),
    ]
    for index, (value, label) in enumerate(labels):
        left = Inches(0.7 + index * 4.05)
        rect(cover, left, Inches(5.05), Inches(3.8), Inches(1.45), WHITE)
        box(cover, left + Inches(0.2), Inches(5.18), Inches(3.4), Inches(0.55), value, 24, True, GREEN)
        box(cover, left + Inches(0.2), Inches(5.75), Inches(3.4), Inches(0.6), label, 13, False, MUTED)

    slide = new_slide(prs, "顧客が止まっている判断", 2)
    box(slide, Inches(0.55), Inches(0.95), Inches(12), Inches(0.4), "共通点はモデルの精度ではない。エージェントが外部APIを叩いたあとに、セキュリティ部門が本番を許可できない。", 15, False, MUTED)
    cards = [
        ("銀行・保険", "顧客情報やAPIキーが外部LLMへ抜ける恐れがあり、リスク管理部が本番を止める。", "登録済みエージェント、許可した宛先、落とした秘密、ハッシュでつながる記録", "リスク・コンプライアンス"),
        ("業務SaaS", "大企業の審査で、ツール呼び出しの認可と証跡を聞かれ、商談が止まる。", "審査回答に貼れる関所。身元、スコープ、宛先の固定、監査", "エンタープライズ契約"),
        ("製造・通信の情シス", "部門ごとに宛先が増える。止めると生産性が落ち、放置すると持ち出しが見えない。", "宛先は許可リストだけ。部門はエージェントを足せ、情シスは記録を持つ", "全社のAI基盤"),
    ]
    for index, (name, problem, keeps, budget) in enumerate(cards):
        left = Inches(0.55 + index * 4.2)
        rect(slide, left, Inches(1.6), Inches(3.95), Inches(5.15), WHITE)
        rect(slide, left, Inches(1.6), Inches(3.95), Inches(0.1), GREEN)
        box(slide, left + Inches(0.22), Inches(1.85), Inches(3.5), Inches(0.4), name, 18, True, INK)
        box(slide, left + Inches(0.22), Inches(2.4), Inches(3.5), Inches(1.5), problem, 14, False, INK)
        box(slide, left + Inches(0.22), Inches(4.0), Inches(3.5), Inches(0.28), "関所が残すもの", 11, True, GREEN)
        box(slide, left + Inches(0.22), Inches(4.32), Inches(3.5), Inches(1.35), keeps, 13, False, INK)
        box(slide, left + Inches(0.22), Inches(5.8), Inches(3.5), Inches(0.28), "払う予算", 11, True, MUTED)
        box(slide, left + Inches(0.22), Inches(6.1), Inches(3.5), Inches(0.4), budget, 14, True, INK)

    slide = new_slide(prs, "いくらで売るか", 3)
    box(slide, Inches(0.55), Inches(0.95), Inches(12), Inches(0.35), "税別。設計パートナーは3ヶ月の一括、ほかは年額。受注実績はなく、隣の買い方から置いた幅。", 15, False, MUTED)
    paint_table(
        slide,
        Inches(0.55),
        Inches(1.55),
        Inches(12.2),
        [
            ["売り方", "期間", "下限", "上限", "この金額で渡すもの"],
            ["設計パートナー", "3ヶ月", "200万円", "500万円", "今のMVPで、要件と監査の見本を一緒に固める"],
            ["部門", "年額", "240万円", "600万円", "本番の関所。エージェント数十、宛先は一桁"],
            ["全社", "年額", "900万円", "2,400万円", "専用環境、規制産業、監査の保存とサポート"],
        ],
        [Inches(2.3), Inches(1.5), Inches(1.7), Inches(1.9), Inches(4.8)],
        font=14,
        row_h=0.72,
    )
    box(slide, Inches(0.55), Inches(5.0), Inches(12.2), Inches(1.7), "全社APIの置換価格にはしない。対象はエージェントの外部呼び出しだけ。広いAPI基盤は通常もっと高いので、全社でも2,400万円を上限の目安にする。デモ用の署名口は本番の売り物にしない。", 16, False, INK)

    slide = new_slide(prs, "価格の式", 4)
    box(slide, Inches(0.55), Inches(0.98), Inches(12.2), Inches(0.85), "年額  =  180万円  +  エージェント × 3.6万円  +  宛先 × 12万円\n規制産業は 1.5倍、専用環境は 1.35倍、下限は 240万円。交渉下限は提示の80%。", 18, False, INK)
    paint_table(
        slide,
        Inches(0.55),
        Inches(2.15),
        Inches(12.2),
        [
            ["条件", "提示", "交渉下限"],
            ["製品化後 · 一般 · 共有 · エージェント50 · 宛先5", "420万円 / 年", "336万円 / 年"],
            ["製品化後 · 金融 · 専用環境 · エージェント200 · 宛先15", "2,187万円 / 年", "1,750万円 / 年"],
            ["今のMVP · 一般 · 共有 · 3ヶ月", "200万円", "160万円"],
            ["今のMVP · 金融 · 専用環境 · エージェント200 · 3ヶ月", "420万円", "336万円"],
        ],
        [Inches(7.4), Inches(2.5), Inches(2.3)],
        font=13,
        row_h=0.62,
    )
    box(slide, Inches(0.55), Inches(5.85), Inches(12.2), Inches(1.0), "PoCは基盤200万円。規制産業で+80万円、専用環境で+100万円、エージェント200で+40万円。エージェント単価はPoCには乗せない。", 15, False, MUTED)

    slide = new_slide(prs, "420万円が立つ理由", 5)
    rect(slide, Inches(0.55), Inches(1.15), Inches(5.9), Inches(2.5), WHITE)
    box(slide, Inches(0.8), Inches(1.35), Inches(5.4), Inches(0.4), "機会損失", 14, True, GREEN)
    box(slide, Inches(0.8), Inches(1.85), Inches(5.4), Inches(1.5), "部門の効果が年5,000万円という仮定なら、420万円はその8%。審査で止まったままなら、その効果はゼロのまま残る。仮定が半分でも価格は残る。", 16, False, INK)
    rect(slide, Inches(6.7), Inches(1.15), Inches(6.05), Inches(2.5), WHITE)
    box(slide, Inches(6.95), Inches(1.35), Inches(5.55), Inches(0.4), "持ち出し1件", 14, True, GREEN)
    box(slide, Inches(6.95), Inches(1.85), Inches(5.55), Inches(1.5), "APIキーや個人情報の外部送信を1件止めると、ローテーション、顧客連絡、監査対応で数百万円から数千万円が動く。見積では顧客自身の対応費に置き換える。", 16, False, INK)
    box(slide, Inches(0.55), Inches(4.0), Inches(12.2), Inches(2.5), "5,000万円は説明用の仮定であり、受注の根拠資料ではない。効果の定義は前頁の式。関所はモデル利用料でも、全APIのゲートウェイでもない。", 16, False, INK)

    slide = new_slide(prs, "誰が買い、誰には売らないか", 6)
    paint_table(
        slide,
        Inches(0.55),
        Inches(1.2),
        Inches(12.2),
        [
            ["相手", "決裁の置き方", "入り方"],
            ["情報システム・セキュリティ", "本番許可の条件として年額", "部門から入り、宛先と保存が増えたら全社へ"],
            ["エージェントを売るSaaS", "審査が通る機能としてOEM", "相手の商談資料に、関所の回答を載せる"],
            ["SI・コンサル", "顧客提案の部品", "ライセンスはエンド顧客。導入費はSIが取る"],
            ["個人と、実験が1個の会社", "予算が課題より小さい", "売らない。設計パートナーにもしない"],
        ],
        [Inches(3.5), Inches(4.0), Inches(4.7)],
        font=14,
        row_h=0.85,
    )

    slide = new_slide(prs, "商談で言ってよいこと", 7)
    box(slide, Inches(0.55), Inches(0.92), Inches(12.2), Inches(0.35), "ゼロ知識証明やDIDは先に出さない。顧客が買う言葉は左の列。", 15, False, MUTED)
    paint_table(
        slide,
        Inches(0.55),
        Inches(1.4),
        Inches(12.2),
        [
            ["顧客の言葉", "今あるもの", "年額の前に足すもの"],
            ["登録された者だけ通す", "Ed25519署名とメモリ上の台帳", "鍵の配布と失効、SSO、台帳の保存"],
            ["権限を最小にする", "スコープと、隠した属性のコミットメント", "管理画面。暗号の名前は脚注へ"],
            ["秘密と注入を出さない", "規則による検知。本文は監査に残さない", "日本語の個人情報、社内用語、誤検知の運用"],
            ["記録をあとから疑える", "直前ハッシュを含む監査JSON", "保存期間、書き出し、時計、改ざん時の手順"],
            ["宛先を選ばせない", "3種の許可リストと暗号化コンテキスト", "高可用、宛先ごとの契約、秘密の保管"],
        ],
        [Inches(3.3), Inches(4.5), Inches(4.4)],
        font=12,
        row_h=0.78,
    )

    slide = new_slide(prs, "商談の最初の30秒", 8)
    rect(slide, Inches(0.55), Inches(1.2), Inches(12.2), Inches(3.15), WHITE)
    rect(slide, Inches(0.55), Inches(1.2), Inches(0.1), Inches(3.15), GREEN)
    box(
        slide,
        Inches(0.95),
        Inches(1.45),
        Inches(11.5),
        Inches(2.7),
        "エージェントを本番に出せない理由は、モデルの性能ではありません。外へ出す直前に、誰が、何の権限で、どこへ送り、何を落とさなかったかを説明できないからです。関所を一つ置くと、その説明が残ります。今日できるのは3ヶ月の設計パートナーで200万円から。本番の年額は、部門で240万円、全社で900万円が入口です。",
        20,
        False,
        INK,
    )
    box(slide, Inches(0.55), Inches(4.6), Inches(12.2), Inches(2.1), "年額に含めないもの\n全社のAPIゲートウェイ、モデルそのもの、SOC報告の代行、ゼロ知識証明の認証取得。\nデモ用の署名エンドポイントは本番の売り物にしない。", 16, False, MUTED)

    output = "docs/agent-gateway-business.pptx"
    prs.save(output)
    return output


if __name__ == "__main__":
    print(build())
