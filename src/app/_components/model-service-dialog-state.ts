interface MutationState {
	isPending: boolean;
	variables?: {
		id?: string;
	} | null;
}

export function getConfigCardMutationState({
	configId,
	deleteMutation,
	fetchModelsMutation,
	setActiveMutation,
	testConnectionMutation,
}: {
	configId: string;
	deleteMutation: MutationState;
	fetchModelsMutation: MutationState;
	setActiveMutation: MutationState;
	testConnectionMutation: MutationState;
}) {
	const isDeletingCard =
		deleteMutation.isPending && deleteMutation.variables?.id === configId;
	const isFetchingModelsForCard =
		fetchModelsMutation.isPending &&
		fetchModelsMutation.variables?.id === configId;
	const isActivatingCard =
		setActiveMutation.isPending && setActiveMutation.variables?.id === configId;
	const isTestingConnectionForCard =
		testConnectionMutation.isPending &&
		testConnectionMutation.variables?.id === configId;
	const isAnyMutationPending =
		deleteMutation.isPending ||
		fetchModelsMutation.isPending ||
		setActiveMutation.isPending ||
		testConnectionMutation.isPending;

	return {
		isActivatingCard,
		isDeletingCard,
		isFetchingModelsForCard,
		isLoading: isAnyMutationPending,
		isTestingConnectionForCard,
	};
}
