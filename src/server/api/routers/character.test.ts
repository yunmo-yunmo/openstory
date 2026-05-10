import assert from "node:assert/strict";
import test from "node:test";

import { buildCharacterUpdateData } from "./character-helpers";

test("buildCharacterUpdateData omits undefined fields and preserves explicit null clears", () => {
	assert.deepEqual(
		buildCharacterUpdateData({
			name: "Mara",
			description: null,
			traits: undefined,
			relationships: null,
			notes: "Keeps the brass key.",
		}),
		{
			name: "Mara",
			description: null,
			relationships: null,
			notes: "Keeps the brass key.",
		},
	);
});
