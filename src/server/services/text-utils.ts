import "server-only";

export function extractSnippet(
	content: string,
	query: string,
	contextChars: number,
): string {
	const lowerContent = content.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const matchIndex = lowerContent.indexOf(lowerQuery);

	if (matchIndex === -1) {
		return content.length > contextChars * 2
			? `${content.slice(0, contextChars * 2)}...`
			: content;
	}

	const matchEnd = matchIndex + query.length;
	const start = Math.max(0, matchIndex - contextChars);
	const end = Math.min(content.length, matchEnd + contextChars);

	const prefix = start > 0 ? "..." : "";
	const suffix = end < content.length ? "..." : "";

	return prefix + content.slice(start, end) + suffix;
}
