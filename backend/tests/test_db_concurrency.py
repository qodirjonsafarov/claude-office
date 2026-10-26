"""Concurrent events against the production engine setup.

The live backend uses a file SQLite database. Events for several sessions
arrive at once (hooks fire in parallel), each one persisted in its own
``AsyncSessionLocal``. They must not share one connection: a rollback or
commit in one session used to undo another's half-done upsert, which then
failed with ``NoResultFound`` in ``_persist_event`` and lost the event.
"""

# pyright: reportPrivateUsage=false

import asyncio
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.core.event_processor import EventProcessor
from app.db.database import AsyncSessionLocal, Base, get_engine, make_engine, override_engine
from app.db.models import EventRecord
from app.models.events import EventAdapter, EventType


@pytest.fixture
def file_db(tmp_path: Path) -> Iterator[None]:
    """Point the app at a fresh file database built like the live one."""
    previous = get_engine()
    engine = make_engine(f"sqlite+aiosqlite:///{tmp_path / 'race.db'}")

    async def _setup() -> None:
        import app.db.models  # noqa: F401  # pyright: ignore[reportUnusedImport]

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_setup())
    override_engine(engine)
    yield
    asyncio.run(engine.dispose())
    override_engine(previous)


@pytest.mark.asyncio
async def test_concurrent_session_starts_all_persist(file_db: None) -> None:
    """Many sessions starting at once: every event is stored, none raises."""
    ep = EventProcessor()
    count = 30
    events = [
        EventAdapter.validate_python(
            {
                "event_type": EventType.SESSION_START,
                "session_id": f"race-{i}",
                "data": {"project_name": "app"},
            }
        )
        for i in range(count)
    ]

    results = await asyncio.gather(
        *(ep._process_event_internal(evt) for evt in events), return_exceptions=True
    )

    assert [r for r in results if isinstance(r, BaseException)] == []
    async with AsyncSessionLocal() as db:
        stored = (await db.execute(select(func.count()).select_from(EventRecord))).scalar()
    assert stored == count


@pytest.mark.asyncio
async def test_concurrent_start_and_prompt_for_one_session(file_db: None) -> None:
    """session_start racing other events of the same new session stays safe."""
    ep = EventProcessor()
    kinds = [EventType.SESSION_START, EventType.USER_PROMPT_SUBMIT] * 10
    events = [
        EventAdapter.validate_python(
            {"event_type": kind, "session_id": f"pair-{i // 2}", "data": {"prompt": "hi"}}
        )
        for i, kind in enumerate(kinds)
    ]

    results = await asyncio.gather(
        *(ep._process_event_internal(evt) for evt in events), return_exceptions=True
    )

    assert [r for r in results if isinstance(r, BaseException)] == []
