import assert from "node:assert/strict";
import test from "node:test";

import { getConfigCardMutationState } from "./model-service-dialog-state";

test("getConfigCardMutationState scopes action labels to the matching card id", () => {
	const active = getConfigCardMutationState({
		configId: "card-a",
		deleteMutation: { isPending: true, variables: { id: "card-a" } },
		fetchModelsMutation: { isPending: true, variables: { id: "card-a" } },
		setActiveMutation: { isPending: true, variables: { id: "card-a" } },
		testConnectionMutation: { isPending: true, variables: { id: "card-a" } },
	});

	assert.deepEqual(active, {
		isActivatingCard: true,
		isDeletingCard: true,
		isFetchingModelsForCard: true,
		isLoading: true,
		isTestingConnectionForCard: true,
	});

	const inactive = getConfigCardMutationState({
		configId: "card-b",
		deleteMutation: { isPending: true, variables: { id: "card-a" } },
		fetchModelsMutation: { isPending: true, variables: { id: "card-a" } },
		setActiveMutation: { isPending: true, variables: { id: "card-a" } },
		testConnectionMutation: { isPending: true, variables: { id: "card-a" } },
	});

	assert.deepEqual(inactive, {
		isActivatingCard: false,
		isDeletingCard: false,
		isFetchingModelsForCard: false,
		isLoading: true,
		isTestingConnectionForCard: false,
	});
});
