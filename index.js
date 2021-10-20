const puppeteer = require('puppeteer');
const fs = require('fs');
const jsonexport = require('jsonexport');


(async () => {


    let pageNumber = 1;
    const contractDateFrom = '01.10.2021';
    const contractDateTo = '20.10.2021';
    let urlStart = `https://zakupki.gov.ru/epz/contract/search/results.html?morphology=on&search-filter=Дате+размещения&fz44=on&fz94=on&contractStageList_0=on&contractStageList_1=on&contractStageList_2=on&contractStageList=0%2C1%2C2&contractCurrencyID=-1&budgetLevelsIdNameHidden=%7B%7D&customerPlace=5277383&customerPlaceCodes=66000000000&contractDateFrom=${contractDateFrom}&contractDateTo=${contractDateTo}&sortBy=PUBLISH_DATE&pageNumber=${pageNumber}&sortDirection=false&recordsPerPage=_50&showLotsInfoHidden=false`;
    let url = genUrl(urlStart);
    //
    let file_report = `./csv_json/${contractDateFrom}_${contractDateTo}_report`;
    if (!fs.existsSync(`${file_report}.json`)) {
        fs.writeFileSync(`${file_report}.json`, JSON.stringify([]));
    }

    let json_data = require(`${file_report}.json`);


    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        userDataDir: 'C:\\temp',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-accelerated-2d-canvas',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            //'--proxy-server=194.233.69.90:443',
            '--netifs-to-ignore=INTERFACE_TO_IGNORE',
            //'--window-size=1920x720',
            // '--blink-settings=imagesEnabled=false',
        ],
        'ignoreHTTPSErrors': true
    });

    this.browser = browser;

    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    //await page.setJavaScriptEnabled(false);


    await run();
    async function run() {
        const numberpgaes = await countPages();
        for (let i = 1; i <= numberpgaes; i++) {
            console.log(`Open ${i} page: of ${numberpgaes}`);
            pageNumber = i;
            await page.goto(genUrl(url));
            await getCardlinks();
        }
        await tocsv();
       await browser.close();
    }


    //await cardFullinfo('https://zakupki.gov.ru/epz/contract/printForm/view.html?contractReestrNumber=3661700951921000067');



    async function countPages() {
        try {
            await page.goto(url);
            await page.waitForSelector('.search-registry-entry-block', {timeout: 5000});

            try {
                const pages = await page.$$eval('ul.pages> li:last-of-type>a', as => as.map(a => a.getAttribute("data-pagenumber")));
                pageNumber = (pages.length) ? pages[0] : 1;

            } catch (e) {

            }

        } catch (e) {
            console.log("ERROR waitForSelector: .search-registry-entry-block")
            await browser.close();
        }

        return pageNumber;
    }

    async function getCardlinks() {

        try {
            await page.waitForSelector('.search-registry-entry-block .w-space-nowrap>a');
            const hrefs = await page.$$eval('.search-registry-entry-block .w-space-nowrap>a', as => as.map(a => a.href));

            for (const value of hrefs) {
                console.log("Parse link:", value)
                await cardFullinfo(value);
            }

        } catch (e) {
            console.log('getCardlinks', e)
        }


    }

    async function cardFullinfo(urlCart) {


        await page.goto(urlCart);
        let getIDOrg = new URL(page.url()).searchParams;
        let reestrNumber = getIDOrg.get('contractReestrNumber');

        let xp ='//*[contains(text(),\'Раздел IV. Информация о поставщика\')]/following-sibling::table[1]/tbody';
        await page.waitForXPath(xp);
        const data_tbody = await page.$x(xp);
        let gotoarr = await page.evaluate((el)=>{
            let data = {};
            let header = [
                '№п/п',
                'Наименование юридического лица (ф.и.о. физического лица)',
                'Наименование страны, код по ОКСМ',
                'Адрес в стране регистрации',
                'Адрес, код по ОКТМО',
                'Адрес пользователя услугами почтовой связи',
                'Наим. объекта почтовой связи',
                'Номер ячейки абонементного почтового шкафа',
                'ИНН',
                'КПП, дата постановки на учет',
                'Статус',
                'Телефон (электронная почта)',
                'Код по ОКПО',
            ];
            let row = el.querySelectorAll('tr:nth-child(4) td');

            for (let i = 0; i < header.length; i++){
                let header_data = header[i];
                let row_data = (row[i]!=null)? row[i].innerText.replace(/\r?\n|\r/g, " ").replace(/\s\s+/g, ' ') : '';
                data[header_data] = row_data;
            }
            let phoneandemail =data['Телефон (электронная почта)'].split(' ')
            data['Phone'] = phoneandemail[0];
            data['Email'] = phoneandemail[1];
            delete data["Телефон (электронная почта)"];
            delete data["№п/п"];

            return data;

        }, data_tbody[0]);
        gotoarr['id'] =reestrNumber




        let find_index = await json_data.findIndex(item => item.id === gotoarr.id);

        if (find_index === -1) {
            await json_data.push(gotoarr);
            await fs.writeFileSync(`${file_report}.json`, JSON.stringify(json_data));
            console.log('add_org', gotoarr.id);
        } else {
            console.log('exist_org', gotoarr.id);
        }


    }


    function genUrl(url) {
        let url_tmp = new URL(url);
        let params = new URLSearchParams(url_tmp.search);
        params.set('pageNumber', pageNumber);
        params.set('contractDateFrom', contractDateFrom);
        params.set('contractDateTo', contractDateTo);
        url_tmp.search = params;
        return url_tmp.toString();
    }

    async function tocsv() {

        await jsonexport(json_data, {rowDelimiter: ';'}, function (err, csv) {
            if (err) return console.log(err);
            fs.writeFileSync(`${file_report}.csv`, csv);
            console.log("Save csv:", `${file_report}.csv`);
        });
    }

})();
