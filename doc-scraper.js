const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const SitemapGenerator = require("sitemap-generator");
const jsdom = require("jsdom");
const os = require('os');
const TurndownService = require("turndown");
const fs = require('fs');
require('dotenv').config()

const baseUrl = process.env.URL;
const generator = SitemapGenerator(baseUrl, {
  stripQuerystring: false
})

const csvWriter = createCsvWriter({
    path: process.env.CSV_FILE,
    header: [
        {id: 'title', title: 'Title'},
        {id: 'desc', title: 'Description'},
        {id: 'pageurl', title: 'PageUrl'}
    ]
});

generator.on('add', (url) => {
    fetchDoc(url).then( async (d) => {
         console.log(d);
    }).catch((error) => {
         console.log(error);
    });
 });

 function fetchDoc(link) {
    return new Promise( async (resolve, reject) => {
        try {
            const dom = await jsdom.JSDOM.fromURL(link);

            /**
             *  Fetch the meta title and description
             */
            const title = dom.window.document.querySelector("meta[name='title']").content.trim() ?? "no title";
            const desc = dom.window.document.querySelector("meta[name='description']").content.trim() ?? "no description";
            
            /**
             *  css selector of the main content
             */
            const content = dom.window.document.querySelectorAll(".content_block_text")[1];

            /**
             *  Main H1 tag on the page: title
             */
            const article_title = dom.window.document.querySelector("h1").textContent;

            /**
             *  Use turndown package to convert HTML to MD
             */
            const turndownService = new TurndownService();
              turndownService.addRule('codeblockcode', {
                filter: ['code'],
                replacement: function (content) {
                  return '```' + content + '```'
                }
              })
            let node = content.innerHTML;
            let markdown = turndownService.turndown(node);

            /**
             *  Create the MD files
             */
            await createMDFile(markdown, article_title);

            const records = [
                {title: title,  desc: desc, pageurl: link}
            ];
            
            /**
             *  Track all pages converted in CSV
             */
            csvWriter.writeRecords(records)       // returns a promise
            .then(() => {
                resolve("Page url written to file");
            });
          } catch (err) {
            reject(err);
          }
    });
  }

async function createMDFile(markdown, title) {
    const filename = title.replaceAll(" ", "-").replaceAll("'", "").replaceAll("/", "-");
    const md = markdown.toString().replaceAll("<", "`<").replaceAll(">", ">`").replaceAll("````<", "```<").replaceAll(">````", ">```")
    return new Promise((resolve, reject) => {
        try{
            const writeStream = fs.createWriteStream(`${process.env.MD_FILE_DIR}/${filename}.md`);
            writeStream.write(`# ${title}${os.EOL}${os.EOL}`);
            writeStream.write(md);
            writeStream.end();
            console.log("md file created");
            resolve("md file created");
        } catch(err) {
            reject(err);
        }
    });
}

generator.start();


 