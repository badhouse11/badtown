"""DEV ONLY: end-to-end browser test. Four separate phone-sized browsers play a full game
through the real UI against the local server (node scripts/local-server.ts).

    python3 scripts/e2e.py [http://localhost:8787] [screenshot_dir]
"""
import random
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "e2e-shots"
NAMES = ["Ann", "Bez", "Cal", "Dot"]
random.seed(3)
shot_n = 0


def shot(page, label):
    global shot_n
    shot_n += 1
    page.screenshot(path=f"{SHOTS}/{shot_n:02d}-{label}.png", full_page=True)


with sync_playwright() as pw:
    import os

    os.makedirs(SHOTS, exist_ok=True)
    browser = pw.chromium.launch()
    pages = []
    errors = []
    for i, name in enumerate(NAMES):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = ctx.new_page()
        page.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))
        page.on("console", lambda m, n=name: errors.append(f"{n} console: {m.text}") if m.type == "error" else None)
        pages.append(page)

    # Ann creates the room
    a = pages[0]
    a.goto(BASE)
    shot(a, "home")
    a.fill("#cname", "Ann")
    a.click("#create button")
    a.wait_for_function("location.hash.length === 8")
    code = a.evaluate("location.hash.slice(2)")
    print("room", code)
    for page, name in zip(pages[1:], NAMES[1:]):
        page.goto(f"{BASE}/#/{code}")
        page.fill("#jname", name)
        page.click("#join button")
    for page in pages:
        page.wait_for_selector("text=I'm ready")
    for page in pages:
        page.click("text=I'm ready")
    a.wait_for_selector("button:has-text('Start game'):not([disabled])")
    shot(a, "lobby")
    a.click("text=Start game")

    def wait_all(selector, timeout=20000):
        for p in pages:
            p.wait_for_selector(selector, timeout=timeout)

    did_bribe = did_loan = False
    for rnd in range(1, 9):
        wait_all("text=Negotiate")
        if rnd == 1:
            shot(a, "negotiate")
        # Round 1: Ann bribes Bez to back HARM; Cal lends Dot 4.
        if rnd == 1:
            a.click("summary:has-text('Offer a bribe')")
            a.select_option("#b-to", label=[o for o in a.eval_on_selector_all("#b-to option", "os => os.map(o => o.textContent)") if o.startswith("Bez")][0])
            a.select_option("#b-side", "X")
            a.select_option("#b-amt", "2")
            a.click("form[data-form=bribe] button")
            pages[1].wait_for_selector("text=Take the money")
            shot(pages[1], "bribe-offer")
            pages[1].click("text=Take the money")
            did_bribe = True
            c = pages[2]
            c.click("summary:has-text('Offer a loan')")
            c.select_option("#l-to", label=[o for o in c.eval_on_selector_all("#l-to option", "os => os.map(o => o.textContent)") if o.startswith("Dot")][0])
            c.select_option("#l-amt", "4")
            c.click("form[data-form=loan] button")
            pages[3].wait_for_selector("text=Accept")
            pages[3].click("button:has-text('Accept')")
            did_loan = True
            time.sleep(0.3)
        for p in pages:
            btn = p.locator("button:has-text('Done talking')")
            if btn.count() and btn.is_enabled():
                btn.click()
        wait_all("text=Secret vote")
        if rnd == 1:
            shot(pages[1], "vote-locked")
            shot(a, "vote")
        for i, p in enumerate(pages):
            if p.locator("button.big").count():
                side = "HARM" if (i == 0 and rnd % 2 == 0) or (i == 3 and rnd in (2, 3)) else "HELP"
                p.click(f"button.big:has-text('{side}')")
        wait_all("text=Your round (private)")
        if rnd == 1:
            shot(a, "recap")
        for p in pages:
            p.click("button:has-text('Continue')")
        if rnd == 4:
            wait_all("text=Town Meeting")
            shot(a, "meeting-plant")
            # Ann has backed HARM, so she can plant a rumour about Cal.
            if a.locator("form[data-form=plant]").count():
                a.select_option("#pl-to", label=[o for o in a.eval_on_selector_all("#pl-to option", "os => os.map(o => o.textContent)") if o.startswith("Cal")][0])
                a.select_option("#pl-n", "3")
                a.click("form[data-form=plant] button")
            for p in pages:
                b = p.locator("button:has-text('Continue')")
                if b.count() and b.is_enabled():
                    b.click()
            wait_all("text=The rumour you heard")
            shot(pages[2], "rumour")
            for p in pages:
                p.click("button:has-text('Ready to nominate')")
            wait_all("text=Who goes in the stocks?")
            for i, p in enumerate(pages):
                target = "Ann" if i != 0 else "Bez"
                p.click(f"#app button:text-is('{target}')")
            wait_all("text=in the stocks")
            shot(a, "stocks-audit")
            for p in pages:
                p.click("button:has-text('Continue')")

    wait_all("text=Final wallets", timeout=30000)
    shot(a, "reveal")
    print("bribe", did_bribe, "loan", did_loan)
    print("errors:", errors or "none")
    browser.close()
