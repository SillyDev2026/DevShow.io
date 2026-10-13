import os
import subprocess
import tempfile
import time
import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
port = 43918
with tempfile.TemporaryDirectory() as temp:
    env = dict(os.environ, PORT=str(port), DB_PATH=str(Path(temp)/'devshow.sqlite'))
    process = subprocess.Popen(['node','server/index.js'], cwd=root, env=env, stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    try:
        for i in range(70):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=1)
                break
            except Exception:
                time.sleep(.12)
        else:
            raise RuntimeError('Backend failed to start')
        data=json.dumps({'name':'Browser User','handle':'browser28','email':'browser28@example.com','password':'TestPassword2028!'}).encode()
        req=urllib.request.Request(f'http://127.0.0.1:{port}/api/auth/register',data=data,headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req) as response:
            user=json.load(response)
        errors=[]
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            for width,height in [(360,760),(390,844),(768,1024),(1200,850),(1440,900),(1920,1080)]:
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
                page.on('pageerror', lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{port}/#workspace',wait_until='domcontentloaded')
                page.evaluate("token=>sessionStorage.setItem('devshow-session-v25',token)",user['token'])
                page.reload(wait_until='domcontentloaded')
                page.locator('#v28-find-results').wait_for(timeout=10000)
                page.wait_for_timeout(350)
                overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
                assert not overflow, f'Horizontal overflow at {width}'
                assert page.locator('#v28-find-form').count() == 1
                if width in (390,1440):
                    page.screenshot(path=str(root.parent/f'DevShow-v2.8-{width}.png'),full_page=True)
                if width==390:
                    page.locator('[name="q"]','#v28-find-form').fill('No matches here')
                    page.locator('#v28-find-form button[type="submit"]').click()
                    page.wait_for_timeout(250)
                    assert 'No projects found' in page.locator('#v28-find-results').inner_text()
                print(f'PASS viewport {width}x{height}')
                page.close()
            browser.close()
        assert not errors,errors
        print('PASS JS errors none')
    finally:
        process.terminate()
        try:process.wait(timeout=4)
        except subprocess.TimeoutExpired:process.kill()
