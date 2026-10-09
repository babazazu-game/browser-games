from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--allow-file-access-from-files'])
    page=browser.new_page(viewport={'width':1280,'height':720});errors=[]
    page.on('console',lambda m: errors.append(f'console {m.type}: {m.text}') if m.type=='error' else None);page.on('pageerror',lambda e: errors.append(f'pageerror: {e}'))
    page.goto(root.joinpath('index.html').as_uri(),wait_until='load');page.wait_for_timeout(900)
    page.mouse.click(538,164);page.wait_for_timeout(150);page.mouse.click(538,129);page.wait_for_timeout(3900)
    page.screenshot(path=str(root/'screenshot.png'))
    print('\n'.join(errors) if errors else 'Browser errors: none');print('Canvas:',page.locator('canvas').count(),'asset-error visible:',page.locator('#asset-error:visible').count());browser.close()
