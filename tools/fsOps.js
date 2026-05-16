import fs from 'fs';


export function readFile(filePath) {
    try {
        //test path first
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        return data;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return `Error reading file ${filePath}: ${error.message}`;
    }
}

export function writeFile(filePath, content) {
    try {
        //test path is current dir or subdirectory
        fs.writeFileSync(filePath, content, 'utf-8');
        return `File written successfully to ${filePath}`;
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return `Error writing file ${filePath}: ${error.message}`;
    }
}