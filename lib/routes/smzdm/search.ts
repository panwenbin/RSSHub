import { Route, ViewType } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import puppeteer from '@/utils/puppeteer';

export const route: Route = {
    path: '/search/:keyword',
    categories: ['shopping', 'popular'],
    view: ViewType.Notifications,
    example: '/smzdm/search/女装',
    parameters: { keyword: '你想订阅的关键词' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '关键词',
    maintainers: ['pwb'],
    handler,
};

async function handler(ctx) {
    const keyword = ctx.req.param('keyword');

    const searchParams = new URLSearchParams({
        c: 'faxian',
        s: keyword,
        order: 'time',
        f_c: 'zhi',
        v: 'b',
        mx_v: 'b',
    });

    const url = `https://search.smzdm.com/?` + searchParams.toString();

    const browser = await puppeteer({ stealth: true });
    const page = await browser.newPage();

    await page.setRequestInterception(true);

    let data = '';

    page.on('request', (req) => {
        req.continue();
    });

    page.on('response', async (response) => {
        if (response.url() === url) {
            if (response.status() > 300) {
                return;
            }
            data = await response.text();
        }
    });

    await page.goto(url, {
        waitUntil: 'networkidle2',
    });

    const $ = load(data);
    const list = $('.feed-row-wide');

    page.close();

    return {
        title: `${keyword} - 什么值得买`,
        link: `https://search.smzdm.com/?c=home&s=${encodeURIComponent(keyword)}&order=time`,
        item:
            list &&
            list
                .toArray()
                .filter((item) => {
                    item = $(item);
                    const zhi = item.find('.z-feed-foot .price-btn-up .unvoted-wrap').eq(0).text().trim();
                    const unzhi = item.find('.z-feed-foot .price-btn-down .unvoted-wrap').eq(0).text().trim();
                    const comment = item.find('.z-feed-foot .feed-btn-comment').eq(0).text().trim();
                    if (comment < 5 || zhi < unzhi * 2) {
                        return false;
                    }
                    return true;
                })
                .map((item) => {
                    item = $(item);
                    return {
                        title: `[${item.find('.feed-block-extras span').eq(0).text().trim()}]${item.find('.feed-block-tags .tag-level1').eq(0).text().trim()} ${item.find('.feed-block-title a').eq(0).text().trim()} - ${item.find('.feed-block-title a').eq(1).text().trim()}`,
                        description: item.find('.feed-block-descripe-top').eq(0).text().trim(),
                        pubDate: timezone(parseDate(item.find('.feed-block-extras').contents().eq(0).text().trim(), ['MM-DD HH:mm', 'HH:mm']), +8),
                        link: item.find('.feed-block-title a').attr('href'),
                        enclosure_type: 'image/jpeg',
                        enclosure_url: item.find('.z-feed-img img').attr('src'),
                    };
                }),
    };
}
