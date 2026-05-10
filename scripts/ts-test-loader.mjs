import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context);
	} catch (error) {
		if (
			!specifier.startsWith(".") &&
			!specifier.startsWith("/") &&
			!specifier.startsWith("file:")
		) {
			throw error;
		}

		const parentUrl =
			context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href;
		const baseUrl = new URL(specifier, parentUrl);
		for (const extension of [".ts", ".tsx"]) {
			const candidateUrl = new URL(`${baseUrl.href}${extension}`);
			if (existsSync(fileURLToPath(candidateUrl))) {
				return {
					shortCircuit: true,
					url: candidateUrl.href,
				};
			}
		}

		throw error;
	}
}

export async function load(url, context, nextLoad) {
	if (!url.endsWith(".ts") && !url.endsWith(".tsx")) {
		return nextLoad(url, context);
	}

	const source = readFileSync(fileURLToPath(url), "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			jsx: ts.JsxEmit.Preserve,
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
			verbatimModuleSyntax: true,
		},
		fileName: fileURLToPath(url),
	});

	return {
		format: "module",
		shortCircuit: true,
		source: transpiled.outputText,
	};
}
