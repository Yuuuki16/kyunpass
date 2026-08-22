import pytest


@pytest.fixture(autouse=True)
def _no_openai_api_key_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prevent tests from hitting the real OpenAI API via a developer's local .env.

    Tests that want to exercise the LLM path must set OPENAI_API_KEY explicitly.
    """
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
