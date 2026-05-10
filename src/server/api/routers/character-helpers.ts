export type CharacterUpdateInput = {
	name?: string;
	description?: string | null;
	traits?: string | null;
	relationships?: string | null;
	notes?: string | null;
};

export function buildCharacterUpdateData(input: CharacterUpdateInput) {
	const data: CharacterUpdateInput = {};
	if (input.name !== undefined) data.name = input.name;
	if (input.description !== undefined) data.description = input.description;
	if (input.traits !== undefined) data.traits = input.traits;
	if (input.relationships !== undefined)
		data.relationships = input.relationships;
	if (input.notes !== undefined) data.notes = input.notes;
	return data;
}
