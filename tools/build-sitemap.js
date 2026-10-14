/* Build sitemap.xml from the catalogue. Re-run after adding products:
 *   node tools/build-sitemap.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(root, 'js', 'dynamflow-data.js'), 'utf8');
var win = {};
vm.runInNewContext(src, { window: win });
var D = win.DynamflowData;

var BASE = String(D.SITE.url || 'https://www.dynamflow.com').replace(/\/+$/, '');
var today = new Date().toISOString().slice(0, 10);

var pages = [
    { loc: BASE + '/', priority: '1.0', changefreq: 'weekly' },
    { loc: BASE + '/shop.html', priority: '0.9', changefreq: 'weekly' },
    { loc: BASE + '/bestseller.html', priority: '0.8', changefreq: 'weekly' },
    { loc: BASE + '/contact.html', priority: '0.6', changefreq: 'monthly' },
    { loc: BASE + '/info.html', priority: '0.5', changefreq: 'monthly' }
];

D.PRODUCTS.forEach(function (product) {
    pages.push({
        loc: BASE + '/single.html?id=' + encodeURIComponent(product.id),
        priority: '0.7',
        changefreq: 'weekly'
    });
});

var body = pages.map(function (page) {
    return '    <url>\n' +
        '        <loc>' + page.loc.replace(/&/g, '&amp;') + '</loc>\n' +
        '        <lastmod>' + today + '</lastmod>\n' +
        '        <changefreq>' + page.changefreq + '</changefreq>\n' +
        '        <priority>' + page.priority + '</priority>\n' +
        '    </url>';
}).join('\n');

var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + '\n</urlset>\n';

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log('sitemap.xml written with ' + pages.length + ' addresses (' +
    (pages.length - 5) + ' products).');
