from pathlib import Path
import base64,re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
def inline(path):
    source=(root/'src'/path).read_text()
    for other in re.findall(r"from '\./([^']+)'",source):
        source=source.replace("from './"+other+"'", "from '"+inline(other)+"'")
    return 'data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
uri=inline('main.js')
styles=(root/'styles.css').read_text()+'\n'+(root/'styles-fluid.css').read_text()
html=(root/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+styles+'</style>').replace('<link rel="stylesheet" href="./styles-fluid.css" />','').replace('<script src="./config.js" defer></script>','').replace('<script type="module" src="./src/main.js"></script>','')
setup=r'''() => {
 const data = new Map();
 for (const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{configurable:true,value:{getItem:k=>data.get(key+':'+k)||null,setItem:(k,v)=>data.set(key+':'+k,String(v)),removeItem:k=>data.delete(key+':'+k)}});
 window.DEVSHOW_API_URL='https://api.example.com';
 const author={id:'author',name:'Design Tester',handle:'designer',role:'Software engineer',bio:'Open-source builder',color:'#b4ffa6',location:'',skills:['Luau','JavaScript'],pinnedProjectId:''};
 const sample={id:'proj-1',creatorId:'author',title:'NovaNum',tagline:'High performance numeric library for Luau developers',description:'An extremely efficient library with community contributions.',category:'Developer Tools',tags:['Luau','Open Source'],likes:29,comments:3,views:413,visibility:'public',repo:'https://github.com/example/NovaNum',cover:'',createdAt:'2026-10-10 10:00:00'};
 const samples=[sample,{...sample,id:'proj-2',title:'ScriptLab',category:'Roblox',likes:16},{...sample,id:'proj-3',title:'BuildStudio',category:'Web',likes:9},{...sample,id:'proj-4',title:'LatencyX',category:'Developer Tools',likes:7}];
 let signed=false;
 window.fetch=async(url,options={})=>{
    let endpoint=new URL(url).pathname.replace('/api','');
    let payload={};let status=200;
    if(endpoint==='/bootstrap') payload={version:'2.5.0',projects:samples,myProjects:signed?[sample]:[],creators:[author],user:signed?author:null,liked:[],saved:[],following:[],boards:[],notifications:[],updates:{},comments:{}};
    else if(endpoint==='/stats')payload={developers:1,projects:4,comments:3};
    else if(endpoint==='/auth/register'){signed=true;payload={token:'a'.repeat(64),user:author};status=201;}
    else if(endpoint.startsWith('/projects/')&&options.method==='GET')payload={project:sample,creator:author,comments:[],updates:[]};
    else if(endpoint==='/projects'&&options.method==='POST'){signed=true;payload={project:sample};status=201;}
    else payload={ok:true};
    return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
 };
}'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,360,390,430,600,650,700,768,900,1024,1280,1440,1920]:
        page=browser.new_page(viewport={'width':width,'height':840},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(html)
        page.evaluate(setup)
        page.evaluate(f"async()=>import('{uri}')")
        page.wait_for_selector('.project-card',timeout=6000)
        def stats():
            return page.evaluate("""() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:document.body.scrollWidth,cardCount:document.querySelectorAll('.project-card').length,gridColumns:getComputedStyle(document.querySelector('.project-grid')).gridTemplateColumns,coverHeight:document.querySelector('.project-cover').getBoundingClientRect().height,coverWidth:document.querySelector('.project-cover').getBoundingClientRect().width,hasMobileNav:getComputedStyle(document.querySelector('.mobile-bottom')).display!=='none'})""")
        d=stats()
        assert d['scrollWidth']<=width and d['body']<=width,(width,d)
        assert d['cardCount']>0 and not errors,(width,errors)
        assert 1.3 < d['coverWidth']/d['coverHeight'] < 2.25,(width,d)
        if width<704:
            assert d['hasMobileNav'],(width,d)
            page.locator('[data-action="focus-search"]').click()
            assert page.locator('#global-search').evaluate('(e)=>document.activeElement===e')
            assert page.locator('.topbar').evaluate('(e)=>e.classList.contains("search-active")')
            page.keyboard.press('Escape')
            assert not page.locator('.topbar').evaluate('(e)=>e.classList.contains("search-active")')
        print('PASS viewport',width,'grid',d['gridColumns'],'cover',round(d['coverWidth']/d['coverHeight'],2),'no overflow')
        if width in [390,900,1440]:
            page.screenshot(path=f'/mnt/data/DevShow-v2.5.1-{width}.png',full_page=True)
        page.locator('.mobile-bottom a[href="#explore"]' if width<704 else '.sidebar a[href="#explore"]').click(timeout=4000)
        page.wait_for_timeout(60)
        page.locator('[data-action="view"][data-value="list"]').click()
        assert page.locator('.project-grid.is-list').count()==1,(width,page.locator('body').inner_text()[-300:])
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        page.reload() if False else None
        page.close()
    # Browser zoom/text enlargement accessibility checks.
    for width in [390,768,1280]:
        page=browser.new_page(viewport={'width':width,'height':820})
        page.set_content(html)
        page.evaluate(setup)
        page.evaluate(f"async()=>import('{uri}')")
        page.wait_for_selector('.project-card')
        page.evaluate('document.documentElement.style.fontSize="150%"')
        page.wait_for_timeout(50)
        overflow=page.evaluate('({scroll:document.documentElement.scrollWidth, width:innerWidth})')
        if overflow['scroll']>width:
            bad=page.evaluate("""() => [...document.querySelectorAll('*')].map(el=>({tag:el.tagName,cls:el.className?.baseVal||el.className,x:Math.round(el.getBoundingClientRect().x),right:Math.round(el.getBoundingClientRect().right),scroll:el.scrollWidth,client:el.clientWidth})).filter(x=>x.right>innerWidth+2||x.x< -8).slice(0,22)""")
            print('OFFENDERS',width,bad)
        assert overflow['scroll']<=width,(width,overflow)
        print('PASS enlarged-text',width)
        page.close()
    browser.close()
print('Responsive UI, mobile search and grid/list actions PASS')
