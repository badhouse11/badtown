"""DEV ONLY: play the practice yard to the end as each role, screenshotting each new screen.
    python3 scripts/e2e_practice.py dist/badtown-practice.html shots_dir"""
import os, sys
from playwright.sync_api import sync_playwright

PAGE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "dist/badtown-practice.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else "practice-shots"
os.makedirs(OUT, exist_ok=True)

def play(pw, role, size, shoot):
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("file://" + PAGE)
    pg.fill("#name", "Tim")
    pg.click(f"[data-size='{size}']")
    pg.click(f"[data-role='{role}']")
    if shoot: pg.screenshot(path=f"{OUT}/{role}-00-setup.png", full_page=True)
    pg.click("#go")
    seen = set()
    for step in range(400):
        phase = pg.evaluate("state && state.phase")
        if phase == "END":
            break
        key = phase
        if shoot and key not in seen:
            seen.add(key)
            pg.wait_for_timeout(250)
            pg.screenshot(path=f"{OUT}/{role}-{len(seen):02d}-{phase.lower()}.png", full_page=True)
        btns = pg.locator("#app [data-cmd]")
        if btns.count():
            pick = None
            if phase == "CELLS": pick = pg.locator("#app [data-cmd]:has-text('Dig')").first
            elif phase == "GUARDROOM": pick = pg.locator("#app .cells [data-cmd]").first if pg.locator("#app .cells [data-cmd]").count() else btns.first
            elif phase == "TRUSTY_CHOICE" and pg.locator("#app [data-cmd]:has-text('Mole')").count(): pick = pg.locator("#app [data-cmd]:has-text('Mole')").first
            else: pick = btns.first
            pick.click()
        pg.wait_for_timeout(300)
    pg.wait_for_timeout(300)
    final = pg.evaluate("state.phase")
    if shoot: pg.screenshot(path=f"{OUT}/{role}-99-end.png", full_page=True)
    result = pg.evaluate("state.outcome && state.outcome.winner")
    b.close()
    return final, result, errors

with sync_playwright() as pw:
    for role, size, shoot in [("inmate", 6, True), ("guard", 6, True), ("rat", 5, True), ("random", 8, False), ("random", 4, False)]:
        print(role, size, play(pw, role, size, shoot))
