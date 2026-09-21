"""Local browser verification; credentials supplied only through environment."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960}, device_scale_factor=1)
    page.goto("http://127.0.0.1:8501", wait_until="networkidle")
    page.get_by_label("Username", exact=True).fill("admin")
    page.get_by_label("Password", exact=True).fill(os.environ["RAGGAUGE_UI_TEST_PASSWORD"])
    page.get_by_role("button", name="Sign in", exact=True).click()
    page.get_by_role("table", name="Recent runs").wait_for(timeout=20000)
    page.get_by_role('button', name='Open run drill-down').wait_for()
    page.evaluate("document.fonts.ready")
    page.screenshot(path=str(Path('.run/dashboard-redesign.png').resolve()), full_page=True)
    measurements = page.evaluate('''() => {
      const box = s => {const e=document.querySelector(s); if(!e)return {missing:s}; const b=e.getBoundingClientRect();
        const c=getComputedStyle(e); return {x:b.x,y:b.y,width:b.width,height:b.height,
        background:c.backgroundColor,color:c.color,padding:c.padding,font:c.fontFamily};};
      return {sidebar:box('[data-testid="stSidebar"]'),header:box('.topbar'),
        cards:[0,1,2,3].map(i=>box('.st-key-kpi-'+i)),table:box('.table-scroll'),
        rail:box('.st-key-rail-panel-queue'), select:box('[data-testid="stSelectbox"] [role="group"]'),
        tableRows:document.querySelectorAll('.runs-table tbody tr').length,
        activeNav:box('[data-testid="stRadioOption"][data-selected="true"]'),
        sidebarUser:box('[data-testid="stSidebarUserContent"]'),
        button:box('.st-key-open-run button'),
        railGap:document.querySelector('.st-key-rail-panel-preflight').getBoundingClientRect().top-document.querySelector('.st-key-rail-panel-queue').getBoundingClientRect().bottom};
    }''')
    print(json.dumps(measurements, indent=2))
    assert measurements['sidebar']['width'] == 248
    assert all(item['height'] == 118 for item in measurements['cards'])
    assert abs(measurements['table']['y'] - measurements['rail']['y']) < 2
    assert measurements['select']['height'] == 40
    assert measurements['select']['background'] == 'rgb(22, 32, 42)'
    assert measurements['activeNav']['height'] == 36
    assert measurements['activeNav']['width'] >= 190
    assert measurements['railGap'] == 12
    assert measurements['button']['height'] == 40
    assert measurements['button']['background'] == 'rgb(26, 61, 56)'
    assert page.get_by_text('Not in this run', exact=True).is_visible()
    page.get_by_role('button', name='Open run drill-down').click()
    page.get_by_text('Case explorer', exact=True).wait_for()
    assert page.get_by_role('radio', name='Runs', exact=True).is_checked()
    page.get_by_role('combobox', name='Evaluation case', exact=True).click()
    page.get_by_role('option').nth(1).click()
    page.get_by_text('Case explorer', exact=True).wait_for()
    assert page.get_by_role('radio', name='Runs', exact=True).is_checked()
    for name in ['Datasets', 'Experiments', 'Comparisons', 'Administration', 'Dashboard']:
        page.locator('[data-testid="stRadioOption"]').filter(has_text=name).click()
        page.wait_for_timeout(700)
        assert page.locator('[data-testid="stException"]').count() == 0, name
    page.set_viewport_size({'width':1180,'height':900})
    page.get_by_role('table', name='Recent runs').wait_for()
    page.wait_for_timeout(300)
    page.screenshot(path=str(Path('.run/dashboard-redesign-1180.png').resolve()), full_page=True)
    print('Login, dashboard, drill-down and all existing navigation screens passed.')
    browser.close()
