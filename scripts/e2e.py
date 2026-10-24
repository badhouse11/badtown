"""DEV ONLY: end-to-end browser test. Three phone-sized browsers (the minimum table) play a
full game through the real UI against the local server (node scripts/local-server.ts).

    python3 scripts/e2e.py [http://localhost:8787] [screenshot_dir]
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "e2e-shots"
NAMES = ["Ann", "Bez", "Cal"]
os.makedirs(SHOTS, exist_ok=True)
n_shot = 0


def shot(page, label, full=True):
    global n_shot
    n_shot += 1
    page.screenshot(path=f"{SHOTS}/{n_shot:02d}-{label}.png", full_page=full)


def harm_plan(name, rnd):
    return (name == "Ann" and rnd in (2, 3)) or (name == "Cal" and rnd == 3)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    pages, errors = [], []
    for name in NAMES:
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))
        pg.on("console", lambda m, n=name: errors.append(f"{n}: {m.text}") if m.type == "error" and "fonts" not in m.text else None)
        pages.append(pg)
    ann, bez, cal = pages

    def all_wait(sel, timeout=20000):
        for p in pages:
            p.wait_for_selector(sel, timeout=timeout)

    def all_click(label):
        for p in pages:
            b = p.locator(f'button:has-text("{label}")')
            if b.count() and b.first.is_enabled():
                b.first.click()

    ann.goto(BASE)
    ann.wait_for_selector("#cname")
    shot(ann, "home")
    ann.fill("#cname", "Ann")
    ann.click("button:has-text('Start a town')")
    ann.wait_for_function("location.hash.length === 8")
    code = ann.evaluate("location.hash.slice(2)")
    for p, name in ((bez, "Bez"), (cal, "Cal")):
        p.goto(f"{BASE}/#/{code}")
        p.fill("#jname", name)
        p.click("button:has-text('Join')")
    all_wait("text=I'm ready")
    all_click("I'm ready")
    ann.wait_for_selector("button:has-text('Start the game'):not([disabled])")
    shot(ann, "lobby")
    ann.click("button:has-text('Start the game')")

    all_wait("text=Your secret agenda")
    shot(ann, "agenda", full=False)
    all_click("Got it")

    for rnd in range(1, 7):
        all_wait("button:has-text('Ready to vote')")
        if rnd == 1:
            shot(ann, "crisis")
            ann.click("summary:has-text('Offer a bribe')")
            ann.click("[data-bribe-to] >> text=Bez")
            ann.click("[data-bribe-side='X']")
            ann.click("[data-bribe-send]")
            bez.wait_for_selector("button:has-text('Take it')")
            shot(bez, "bribe-offer", full=False)
            bez.click("button:has-text('Take it')")
        all_click("Ready to vote")
        all_wait("text=Help or harm?")
        if rnd == 1:
            shot(cal, "vote", full=False)
        for p, name in zip(pages, NAMES):
            if p.locator("button.vote").count():
                p.click("button.vote:has-text('Harm')" if harm_plan(name, rnd) else "button.vote:has-text('Help')")
        for p in pages:
            p.wait_for_selector(".after.show", timeout=20000)
        if rnd in (1, 3):
            shot(ann, f"result-r{rnd}", full=False)
        all_click("Next")
        if rnd == 3:
            all_wait("text=The grapevine")
            shot(bez, "rumour", full=False)
            all_click("Ready to point")
            all_wait("text=Who do you point at?")
            for p, name in zip(pages, NAMES):
                p.click(f"button.target:has-text('{'Cal' if name == 'Ann' else 'Ann'}')")
            all_wait("text=in the stocks")
            shot(cal, "verdict", full=False)
            all_click("Back to it")

    all_wait("text=The scores", timeout=30000)
    shot(ann, "end")
    print("errors:", errors or "none")
    browser.close()
