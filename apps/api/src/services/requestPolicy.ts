export const mayCancelRequest = (
  requestStatus: string,
  isCustomerOwner: boolean,
  isAssignedArtisan: boolean
): boolean =>
  (isCustomerOwner && ['pending', 'in_progress'].includes(requestStatus)) ||
  (isAssignedArtisan && requestStatus === 'in_progress');
