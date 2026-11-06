"""Three site templates that fit a Cloudflare Pro zone."""

from dataclasses import dataclass

from wafops.errors import ProtectionError
from wafops.paths import validate_path

# Pro zones allow two rate limiting rules and a modest number of custom rules.
# Expressions stay on path and a few custom-rule fields. `matches` is Business+.
MAX_CUSTOM_RULES = 5
MAX_RATE_RULES = 2


@dataclass(frozen=True)
class RateLimit:
    requests: int
    period_seconds: int = 60
    mitigation_seconds: int = 600


@dataclass(frozen=True)
class PathClause:
    path: str
    match: str = "exact"


@dataclass(frozen=True)
class Rule:
    key: str
    description: str
    kind: str
    clauses: tuple[PathClause, ...] = ()
    raw_expression: str | None = None
    rate_limit: RateLimit | None = None


@dataclass(frozen=True)
class Template:
    key: str
    label: str
    summary: str
    fp_paths: tuple[str, ...]
    rules: tuple[Rule, ...]


def _block(key: str, description: str, clauses: tuple[PathClause, ...] = (), raw: str | None = None) -> Rule:
    return Rule(key=key, description=description, kind="block", clauses=clauses, raw_expression=raw)


def _rate(key: str, description: str, paths: tuple[str, ...], requests: int) -> Rule:
    return Rule(
        key=key,
        description=description,
        kind="rate",
        clauses=_visit_clauses(paths),
        rate_limit=RateLimit(requests=requests),
    )


def _visit_clauses(paths: tuple[str, ...]) -> tuple[PathClause, ...]:
    clauses: list[PathClause] = []
    for path in paths:
        clauses.append(PathClause(path, "exact"))
        leaf = path.rsplit("/", 1)[-1]
        if "." not in leaf:
            clauses.append(PathClause(path + "/", "prefix"))
    return tuple(clauses)


_SENSITIVE = (
    PathClause("/.env"),
    PathClause("/.git"),
    PathClause("/.git/", "prefix"),
    PathClause("/.aws"),
    PathClause("/.aws/", "prefix"),
    PathClause("/wp-config.php"),
    PathClause("/wp-config.php.bak"),
    PathClause("/xmlrpc.php"),
    PathClause("/server-status"),
    PathClause("/actuator"),
    PathClause("/actuator/", "prefix"),
    PathClause("/.DS_Store"),
    PathClause("/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php"),
)

_SENSITIVE_RULE = _block(
    "sensitive-paths",
    "機密ファイルと公開しないパスへのアクセスを拒否",
    _SENSITIVE,
)
_TRAVERSAL_RULE = _block(
    "path-traversal",
    "パストラバーサルを拒否",
    raw='http.request.uri.path contains "../"',
)
_WP_USERS = (
    PathClause("/wp-json/wp/v2/users"),
    PathClause("/wp-json/wp/v2/users/", "prefix"),
)


def _catalog() -> dict[str, Template]:
    corporate = Template(
        key="corporate",
        label="コーポレート",
        summary="問い合わせとログインがある会社サイト。フォームの連続送信を制限します。",
        fp_paths=("/contact", "/inquiry", "/form", "/contact-us"),
        rules=(
            _SENSITIVE_RULE,
            _TRAVERSAL_RULE,
            _rate("login", "ログインの連続試行を制限", ("/login", "/signin", "/wp-login.php"), 10),
            _rate("contact", "問い合わせフォームの連続送信を制限", ("/contact", "/inquiry", "/form", "/contact-us"), 10),
        ),
    )
    wordpress = Template(
        key="wordpress",
        label="WordPress",
        summary="管理画面の通常操作は残し、xmlrpc・ユーザー列挙・ログイン試行を止めます。",
        fp_paths=(
            "/wp-admin/admin-ajax.php",
            "/wp-admin/post.php",
            "/wp-admin/async-upload.php",
            "/wp-cron.php",
        ),
        rules=(
            _SENSITIVE_RULE,
            _TRAVERSAL_RULE,
            _block("wp-users-api", "ユーザー一覧APIを拒否", _WP_USERS),
            _block(
                "wp-author-enum",
                "作者番号の列挙を拒否",
                raw='any(http.request.uri.args["author"][*] ne "")',
            ),
            _rate("wp-login", "ログインの連続試行を制限", ("/wp-login.php",), 10),
            _rate("checkout", "カートと決済の連続送信を制限", ("/checkout", "/cart", "/payment", "/order"), 30),
        ),
    )
    ecommerce = Template(
        key="ecommerce",
        label="決済ありEC",
        summary="ログインと決済の連続送信を制限します。決済パスのマネージドルールは維持します。",
        fp_paths=("/checkout", "/cart"),
        rules=(
            _SENSITIVE_RULE,
            _TRAVERSAL_RULE,
            _rate("login", "ログインの連続試行を制限", ("/login", "/signin", "/account/login"), 10),
            _rate("checkout", "カートと決済の連続送信を制限", ("/checkout", "/cart", "/payment", "/order"), 30),
        ),
    )
    return {item.key: item for item in (corporate, wordpress, ecommerce)}


def path_is_blocked(template: Template, path: str) -> bool:
    for rule in template.rules:
        if rule.kind != "block":
            continue
        for clause in rule.clauses:
            if clause.match == "exact" and path == clause.path:
                return True
            if clause.match == "prefix" and path.startswith(clause.path):
                return True
    return False


def _check(template: Template) -> None:
    custom = 0
    rate = 0
    for rule in template.rules:
        if rule.kind == "block":
            custom += 1
            if rule.rate_limit is not None:
                raise ProtectionError(f"{rule.key} は遮断ルールです")
        elif rule.kind == "rate":
            rate += 1
            if rule.raw_expression or rule.rate_limit is None:
                raise ProtectionError(f"{rule.key} のレート制限が不完全です")
            if rule.rate_limit.period_seconds != 60 or rule.rate_limit.mitigation_seconds > 3600:
                raise ProtectionError(f"{rule.key} はProの期間に合いません")
        else:
            raise ProtectionError(f"{rule.key} の種類が違います")
        if rule.raw_expression and "matches" in rule.raw_expression:
            raise ProtectionError(f"{rule.key} は正規表現を使っています")
        for clause in rule.clauses:
            validate_path(clause.path)
            if clause.match not in {"exact", "prefix"}:
                raise ProtectionError(f"{rule.key} の一致方法が違います")
    if custom > MAX_CUSTOM_RULES or rate > MAX_RATE_RULES:
        raise ProtectionError(f"{template.key} がProのルール数を超えています")
    if len({rule.key for rule in template.rules}) != len(template.rules):
        raise ProtectionError(f"{template.key} のルールキーが重複しています")
    for path in template.fp_paths:
        validate_path(path)
        if path_is_blocked(template, path):
            raise ProtectionError(f"{template.key} の通常操作パスが遮断対象です: {path}")


_CHECKED: dict[str, Template] | None = None


def catalog() -> dict[str, Template]:
    global _CHECKED
    if _CHECKED is None:
        built = _catalog()
        for template in built.values():
            _check(template)
        _CHECKED = built
    return _CHECKED


def get_template(key: str) -> Template:
    found = catalog().get(key)
    if found is None:
        known = ", ".join(catalog())
        raise ProtectionError(f"テンプレは {known} のいずれかです")
    return found
