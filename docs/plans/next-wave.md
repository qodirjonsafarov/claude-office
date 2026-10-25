# Next wave (owner-approved direction, 2026-10-26)

Owner asks: "everything done properly like on the internet" — good styles, smooth animations, icons that don't hurt the eyes, creative touches, missing features.

## Already queued by owner
- Own chat: tmux send-keys (see research: off by default, explicit key, loopback+tailnet allowlist, confirm, refuse during permission, strip control chars, rate limit, JSONL audit). Boss shows a "sent" bubble.
- Light theme (Radix 12-step logic; light-mode lime text ≈ #4f8a1f, #a7f36a only as fill behind dark text; scene keeps its palette, only stage tokens change). Toggle: dark / light / system.
- Character roster (+ later outfit picker; look seeded from agent name).
- New character looks (animation dev preparing before/after for owner to pick).

## Research top items (impact/effort)
1. "Needs you" state: amber pulse ring ≤1 Hz + "!" bubble, tab-bar badge, optional chime.
2. Pixel icons in bubbles instead of emoji (pixelarticons MIT, nearest-neighbour; `shared/iconMap.ts`).
3. Tool-specific poses/props: typing Edit/Write, reading Read/Grep, terminal glow Bash, globe Web.
4. Error state: red x bubble, 150 ms ±1px sprite shake, red tick in progress; red used nowhere else.
5. Day/night grading: one multiply rect by local time (night alpha ≤0.35) + additive lamp pools; sync CityWindow.
6. (shadows done) y-sort whole people layer by foot y.
7. Juice: arrival squash 160 ms; bubble pop 0.6→1.05→1.0 220 ms back-out.
8. Reduced motion inside Pixi (matchMedia → store): fade instead of walk, no bob/squash.
9. Name tags: BitmapText pixel font or Manrope 11–12/700 on --qo-panel pill 85% + status dot.
10. Camera easing + follow agent (exp damping, pixel snap).
11. Done celebration: ≤20 pooled particles <900 ms + ✓ stamp; off under reduced motion.
12. PWA manifest (standalone, maskable 192/512, theme #080d0c, apple meta).
13. Opt-in ambience sound (WebAudio, muted by default, lazy).
14. Sleeping after 5 min idle: zzz + dim 70%.
15. Hover/tap agent card (tool+file, elapsed, tokens, jump to log).
Also: daily standup board, session replay 1×/4×/16× (replay endpoint + replaySlice exist), phone mini-map, achievements shelf, `/` session search + `?` shortcuts, clickable office pet.

## Numbers
- Motion: hover 100–150 ms; pop/toast 200–250; sheets 300–400 in / 200–250 out; camera ≤500. Easings: standard cubic-bezier(0.2,0,0,1); enter (0.05,0.7,0.1,1); exit (0.3,0,0.8,0.15); overshoot (0.34,1.56,0.64,1) bubbles only. Reduced motion: opacity 100–150 ms. Idle loops 2–4 s; never >3 flashes/s.
- Contrast: body ≥7:1, faint ≥4.5:1, meaningful icons/borders ≥3:1. Long text ink ≈ #e4ebe6 instead of #f2f6f2 (less glare). Accent ≤5–10% of screen.
- Icons: Lucide only; 16/20/24 px; stroke ≈1.75 at 16 px, 2.2 at 24; icon–label gap 6–8 px, label 12–13/600. Pixel icons only in scene, line icons only in chrome.
- Elevation: one shadow 0 8px 24px rgba(0,0,0,.45) + 1px line border. Glow only for live/attention, blur ≤8 px ≤35%. No Pixi Glow/Outline filters on sprites; ≤1 filter in scene.

Sources: pixel-agents (pablodelucca), pixelagents (YehudaLevi), AI Town, Gather, WorkAdventure, M3 motion, Apple HIG, WCAG 2.2 (1.4.11, 2.3.1), Radix colors, PixiJS v8 perf guide, "Juice it or lose it".
- Cost pill confuses user (thought  was charged; they pay  subscription). Label it 'API-equivalent' + tooltip with breakdown, maybe show input/output vs cache-read split.
- English only (user): remove i18n/es.ts, i18n/pt-BR.ts, language picker in SettingsModal, language in preferencesStore.
- Role name pools (user OK, keep it simple/cheap, no AI names): add developer/qa/reviewer/devops (+claude) to _AGENT_TYPE_NAMES in backend/app/core/summary_service.py, e.g. developer: Builder, Coder, Forge; qa: Validator, Hawkeye, Test Pilot; reviewer: The Critic, Inspector, Judge; devops: Pipeline Pat, Deploy Dan. Keep SUMMARY_BACKEND=disabled.
- Bug: subagent tool calls arrive via hooks tagged 'main' AND via transcript poller under the subagent → duplicate rows '@Boss · …', Boss tool count inflated. Dedupe by native_agent_id/tool_use_id.
- Bugs from chat dev: (1) concurrent session_start → NoResultFound in _persist_event, rows lost; (2) restored log rows display time in UTC (22:40 vs 03:41 local) — check after e80a483. (3) Chat: only permission requests block sending; AskUserQuestion/other Claude dialogs are not detected — text would land in the dialog.
- Chat enable: ENABLE_WEB_PROMPT=true in backend/.env + restart backend (reload watches app/ only); Claude must run inside tmux. Phone reaches backend via loopback (Termius forward?) — global LocalhostOnly unchanged.

## Wave 3 (user, 2026-10-26)
- Office scene/stage tint is bluish (teal "studio" bg) → make it greenish in Olymp style (derive from Olymp tokens: bg #080d0c, lime accent), keep eye comfort.
- Agent card: tap / long-press (hold) on a character, its desk, or a walking character → nice card with details: name, role/look, what it's doing now (tool + file), task, elapsed, tool count, tokens/cost, progress, state (working/resting/needs you/error), recent actions, "jump to log". Desktop: click/hover; phone: long-press + bottom sheet. Pretty, Olymp style.
- Still queued: light theme, character roster, bug fixes listed above.
