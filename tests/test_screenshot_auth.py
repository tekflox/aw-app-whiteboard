"""The board screenshot used to be a PNG of `{"error": "unauthorized"}`.

`_screenshot_url` launched a bare chromium and navigated to
`/api/apps/whiteboard/boards/{id}/html`, which the runtime's IdentityGuard
gates. With no session it fetched the 401 and screenshotted that — returning a
real path and a real byte count, which is why it read as working for weeks and
agents kept attaching an error string to reports.

The fix has a sharp edge: `browse` accepts an ARBITRARY url and reuses the same
page, and Playwright's `extra_http_headers` apply to every request a context
makes. Setting the key unconditionally would hand this workspace's API key to
whatever site was browsed to — worse than the bug. Hence the scoping, which is
what these tests are really about.
"""
import os

from whiteboard_app.browser import workspace_api_headers

OWN = "http://127.0.0.1:9030"


def test_own_url_gets_the_key(monkeypatch):
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "secret-key")
    h = workspace_api_headers(f"{OWN}/api/apps/whiteboard/boards/main/html", OWN)
    assert h == {"X-Api-Key": "secret-key"}


def test_external_url_gets_nothing(monkeypatch):
    """The one that matters. A leaked workspace key is not recoverable by
    rotating a board."""
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "secret-key")
    for url in ("https://example.com/", "http://evil.test/x",
                "https://aw.workspace.aw.tekflox.com/"):
        assert workspace_api_headers(url, OWN) == {}, url


def test_no_key_in_env_is_not_an_error(monkeypatch):
    """Standalone mode has no workspace key; the board is simply ungated there.
    Returning a header with None would blow up deeper, in playwright."""
    monkeypatch.delenv("AW_WORKSPACE_API_KEY", raising=False)
    assert workspace_api_headers(f"{OWN}/api/apps/whiteboard/x", OWN) == {}


def test_empty_own_base_url_never_leaks(monkeypatch):
    """If own_base_url is somehow unset, every url is 'not ours' — fail closed,
    not open."""
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "secret-key")
    assert workspace_api_headers("http://anything/", "") == {}


def test_lookalike_host_gets_nothing(monkeypatch):
    """The first cut of this compared with `url.startswith(own_base_url)`,
    which accepts "http://127.0.0.1:9030.evil.test/" — the same leading
    characters, a completely different host. Origin comparison, not prefix."""
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "secret-key")
    for url in ("http://127.0.0.1:9030.evil.test/",
                "http://127.0.0.1:90309/",
                "https://127.0.0.1:9030/"):          # scheme differs too
        assert workspace_api_headers(url, OWN) == {}, url


def test_a_different_path_on_our_own_origin_still_gets_the_key(monkeypatch):
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "secret-key")
    assert workspace_api_headers(f"{OWN}/api/apps/whiteboard/boards/x/html", OWN)
    assert workspace_api_headers(f"{OWN}/", OWN)


def test_there_is_exactly_one_screenshot_implementation():
    """routes.py and mcp/http_handler.py used to hold a byte-identical
    `_screenshot_url` each. That duplication is precisely how the
    unauthorized-PNG bug survived its own fix: the header landed in routes.py
    while the MCP handler — the copy every agent actually reaches — kept
    shipping a picture of {"detail":"unauthorized"}, with the fix apparently
    deployed and verified."""
    import os
    import re
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "whiteboard_app")
    defs = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if not f.endswith(".py"):
                continue
            src = open(os.path.join(dirpath, f)).read()
            defs += [(f, m) for m in re.findall(r"^def (_?screenshot_url)\(", src, re.M)]
    assert len(defs) == 1, f"more than one screenshot implementation: {defs}"
    assert defs[0][0] == "browser.py"
