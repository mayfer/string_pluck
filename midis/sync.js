const fs = require('fs');
const path = require('path');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

async function scanDirectory(dir) {
    let result = {};
    const directories = await readdir(dir, { withFileTypes: true });

    for (const dirent of directories) {
        if (dirent.isDirectory()) {
            const artist = dirent.name;
            const artistPath = path.join(dir, artist);
            const artistFiles = await readdir(artistPath);

            result[artist] = artistFiles.filter(file => path.extname(file).toLowerCase() === '.mid');
        }
    }
    return result;
}

async function writeMidisJson() {
    const midis = await scanDirectory('.');
    // relative to current file's directory
    const midis_dir = path.dirname(path.resolve(__filename));
    
    fs.writeFileSync(path.join(midis_dir, 'midis.json'), JSON.stringify(midis, null, 2), 'utf8');
    console.log('midis.json has been written.');
}

writeMidisJson().catch(console.error);
