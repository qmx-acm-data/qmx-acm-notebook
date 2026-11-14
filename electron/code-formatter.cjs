// Generated from src/main/format/code.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCodeFormatter = createCodeFormatter;
// Lazy offline code formatter (WASM in the main process; the renderer CSP blocks wasm).
// clang-format covers C-family languages, Ruff covers Python, rustfmt covers Rust.
function createCodeFormatter() {
    let clangFormatterPromise;
    let ruffWorkspacePromise;
    let rustFormatterPromise;
    return async function formatCode(source, lang) {
        const text = String(source == null ? '' : source);
        if (text.length > 200000)
            throw new Error('代码过长，格式化仅支持不超过 200000 个字符');
        const language = String(lang || '').trim().toLowerCase();
        if (language === 'python' || language === 'py') {
            if (!ruffWorkspacePromise)
                ruffWorkspacePromise = Promise.resolve().then(() => {
                    const { Workspace, PositionEncoding } = require('@astral-sh/ruff-wasm-nodejs');
                    return new Workspace({}, PositionEncoding.UTF16);
                });
            return { code: (await ruffWorkspacePromise).format(text) };
        }
        if (language === 'rust' || language === 'rs') {
            if (!rustFormatterPromise)
                rustFormatterPromise = import('@scalar/rust-fmt');
            const { format } = await rustFormatterPromise;
            return { code: await format(text, { edition: '2021', maxWidth: 100 }) };
        }
        const filenames = new Map([
            ['cpp', 'main.cpp'], ['c++', 'main.cpp'], ['c', 'main.c'], ['java', 'Main.java'],
            ['javascript', 'main.js'], ['js', 'main.js'], ['typescript', 'main.ts'], ['ts', 'main.ts'],
            ['cs', 'main.cs'], ['csharp', 'main.cs'], ['c#', 'main.cs'],
            ['objc', 'main.m'], ['objectivec', 'main.m'], ['objective-c', 'main.m']
        ]);
        const filename = filenames.get(language);
        if (!filename)
            throw new Error(language ? `暂不支持 ${language} 代码的格式化` : '未能识别代码语言，无法格式化');
        if (!clangFormatterPromise)
            clangFormatterPromise = import('@wasm-fmt/clang-format');
        const { format } = await clangFormatterPromise;
        const style = JSON.stringify({ BasedOnStyle: 'Chromium', IndentWidth: 4, ColumnLimit: 100, PointerAlignment: 'Left' });
        return { code: format(text, filename, style) };
    };
}
