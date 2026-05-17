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

export function editFile(filePath, oldContent, newContent) {
    try {
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        const data = fs.readFileSync(filePath, 'utf-8');

        if (!data.includes(oldContent)) {
            return `Error: oldContent not found in ${filePath}. No changes made.`;
        }

        // Replace only the first occurrence to avoid unintended multi-replace
        const edited = data.replace(oldContent, newContent);
        fs.writeFileSync(filePath, edited, 'utf-8');
        return `File edited successfully: ${filePath}`;
    } catch (error) {
        console.error(`Error editing file ${filePath}:`, error);
        return `Error editing file ${filePath}: ${error.message}`;
    }
}
