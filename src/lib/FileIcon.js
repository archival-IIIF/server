const fs = require('fs');
const path = require('path');
const {promisify} = require('util');

const readdirAsync = promisify(fs.readdir);

const fileIconsPath = path.join(__dirname, '../../node_modules/file-icon-vectors/dist/icons/vivid');

const iconsByExtension = [];
readdirAsync(fileIconsPath).then(files => {
    iconsByExtension.push(...files.map(file => path.basename(file, '.svg')));
});

module.exports = {fileIconsPath, iconsByExtension};
