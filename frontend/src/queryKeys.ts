export const tripKeys = {
  lists: () => ['trips', 'list'] as const,
  detail: (id: string) => ['trips', 'detail', id] as const,
};

export const expenseKeys = {
  list: (tripId: string) => ['trips', tripId, 'expenses'] as const,
  detail: (tripId: string, id: string) => ['trips', tripId, 'expenses', id] as const,
  balances: (tripId: string) => ['trips', tripId, 'balances'] as const,
  settlements: (tripId: string) => ['trips', tripId, 'settlements'] as const,
};

export const eventKeys = {
  list: (tripId: string) => ['trips', tripId, 'events'] as const,
};

export const documentKeys = {
  list: (tripId: string) => ['trips', tripId, 'documents'] as const,
  downloadUrl: (tripId: string, docId: string) => ['trips', tripId, 'documents', docId, 'url'] as const,
};

export const userKeys = {
  me: () => ['users', 'me'] as const,
  avatar: (userId: string) => ['users', userId, 'avatar'] as const,
};

export const invitationKeys = {
  list: () => ['invitations'] as const,
};

const memberKeys = {
  list: (tripId: string) => ['trips', tripId, 'members'] as const,
  joinRequests: (tripId: string) => ['trips', tripId, 'join-requests'] as const,
};
